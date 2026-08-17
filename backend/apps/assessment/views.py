"""
ISLOH — baholash ko'rinishlari (M4).

Talaba tomonidagi har bir endpoint kursga YOZILGANLIKNI tekshiradi
(`apps.learning`): nashr etilgan test havolasini bilgan, lekin kursga
yozilmagan odam savollarni ko'ra olmasligi kerak.
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.views import IsInstructor
from apps.learning.models import Enrollment

from .grading import isloh_grade_attempt
from .models import (
    Assignment,
    Question,
    Quiz,
    QuizAnswer,
    QuizAttempt,
    Submission,
    SubmissionFile,
)
from .serializers import (
    AttemptGradeSerializer,
    GradeSerializer,
    InstructorAssignmentSerializer,
    InstructorQuestionSerializer,
    QuizAnswerSubmitSerializer,
    QuizAttemptSerializer,
    QuizSerializer,
    StudentAssignmentSerializer,
    StudentQuizSerializer,
    SubmissionSerializer,
)

# --- O'qituvchi tomoni ------------------------------------------------------


class InstructorQuestionViewSet(viewsets.ModelViewSet):
    """`/instructor/questions` — savollar bazasi (do'kon, sahifalanmaydi)."""

    serializer_class = InstructorQuestionSerializer
    permission_classes = [IsAuthenticated, IsInstructor]
    pagination_class = None

    def get_queryset(self):
        return (
            Question.objects.filter(owner=self.request.user)
            .prefetch_related("options", "tags")
        )


class InstructorQuizViewSet(viewsets.ModelViewSet):
    """`/instructor/quizzes`."""

    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated, IsInstructor]
    pagination_class = None

    def get_queryset(self):
        queryset = Quiz.objects.filter(owner=self.request.user).prefetch_related(
            "quiz_questions__question"
        )
        course = self.request.query_params.get("course")
        if course:
            queryset = queryset.filter(course_id=course)
        return queryset


class InstructorAssignmentViewSet(viewsets.ModelViewSet):
    """`/instructor/assignments`."""

    serializer_class = InstructorAssignmentSerializer
    permission_classes = [IsAuthenticated, IsInstructor]
    pagination_class = None

    def get_queryset(self):
        queryset = Assignment.objects.filter(owner=self.request.user).prefetch_related("rubric")
        course = self.request.query_params.get("course")
        if course:
            queryset = queryset.filter(course_id=course)
        return queryset


class GradingQueueView(APIView):
    """`/instructor/submissions` — baholash navbati.

    Sukut bo'yicha faqat TEKSHIRILMAGANLARI: o'qituvchi sahifasining butun
    ma'nosi "nima kutmoqda?" savolida. `?status=` bilan boshqasi ham
    so'ralishi mumkin.
    """

    permission_classes = [IsAuthenticated, IsInstructor]

    def get(self, request):
        rows = Submission.objects.filter(assignment__owner=request.user).select_related(
            "user", "assignment"
        ).prefetch_related("files")

        status_filter = request.query_params.get("status", Submission.STATUS_PENDING)
        if status_filter != "all":
            rows = rows.filter(status=status_filter)

        assignment = request.query_params.get("assignment")
        if assignment:
            rows = rows.filter(assignment_id=assignment)

        return Response(SubmissionSerializer(rows, many=True).data)


class GradeSubmissionView(APIView):
    """`POST /instructor/submissions/{id}/grade`."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def post(self, request, submission_id):
        submission = Submission.objects.filter(
            pk=submission_id, assignment__owner=request.user
        ).select_related("assignment").first()
        if submission is None:
            raise NotFound("Ish topilmadi")

        serializer = GradeSerializer(data=request.data, context={"submission": submission})
        serializer.is_valid(raise_exception=True)

        submission.score = serializer.validated_data["score"]
        submission.feedback = serializer.validated_data.get("feedback", "")
        submission.status = Submission.STATUS_GRADED
        submission.graded_at = timezone.now()
        submission.graded_by = request.user
        submission.save()

        return Response(SubmissionSerializer(submission).data)


class GradeAttemptAnswerView(APIView):
    """`POST /instructor/attempts/{id}/grade` — qo'lda baholanadigan javob.

    `long` turidagi savol avtomatik baholanmaydi (apps/assessment/grading.py),
    shuning uchun o'qituvchi ballni shu yerdan qo'yadi va urinishning umumiy
    natijasi qayta hisoblanadi.
    """

    permission_classes = [IsAuthenticated, IsInstructor]

    def post(self, request, attempt_id):
        attempt = QuizAttempt.objects.filter(
            pk=attempt_id, quiz__owner=request.user
        ).select_related("quiz").first()
        if attempt is None:
            raise NotFound("Urinish topilmadi")

        serializer = AttemptGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        answer = attempt.answers.filter(pk=data["answer"]).select_related("question").first()
        if answer is None:
            raise NotFound("Javob topilmadi")

        if data["points_awarded"] > answer.question.points:
            raise ValidationError({"points_awarded": f"Ball {answer.question.points} dan oshmasligi kerak"})

        answer.points_awarded = data["points_awarded"]
        answer.is_correct = data["points_awarded"] > 0
        answer.feedback = data.get("feedback", "")
        answer.save()

        isloh_recalculate_attempt(attempt)
        return Response(QuizAttemptSerializer(attempt).data)


def isloh_recalculate_attempt(attempt):
    """Qo'lda baholashdan keyingi umumiy natija.

    `isloh_grade_attempt` ni qayta chaqirib bo'lmaydi — u avtomatik
    baholashni takrorlab, o'qituvchi qo'ygan ballni o'chirib yuborardi.
    """
    answers = list(attempt.answers.all())
    attempt.points_awarded = sum(a.points_awarded for a in answers)
    attempt.score = (
        round(attempt.points_awarded * 100 / attempt.points_total) if attempt.points_total else 0
    )
    attempt.needs_review = any(a.is_correct is None for a in answers)
    attempt.passed = (not attempt.needs_review) and attempt.score >= attempt.quiz.passing_score
    attempt.save()
    return attempt


# --- Talaba tomoni ----------------------------------------------------------


def isloh_require_enrollment(user, course_id):
    """Kursga yozilganlik. Yozilmagan bo'lsa 404 — testning mavjudligi ham
    oshkor bo'lmasin."""
    if not Enrollment.objects.filter(user=user, course_id=course_id).exists():
        raise NotFound("Bu kursga yozilmagansiz")


class StudentQuizView(APIView):
    """`GET /student/quizzes/{id}` — TO'G'RI JAVOBSIZ.

    Bu endpoint M4 ning eng nozik joyi: javob `StudentQuizSerializer` orqali
    yasaladi va u `is_correct` maydonini umuman bilmaydi.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, quiz_id):
        quiz = Quiz.objects.filter(pk=quiz_id, status="published").first()
        if quiz is None:
            raise NotFound("Test topilmadi")

        isloh_require_enrollment(request.user, quiz.course_id)
        return Response(StudentQuizSerializer(quiz, context={"request": request}).data)


class StudentAttemptView(APIView):
    """`POST /student/quizzes/{id}/attempts` — urinishni boshlash."""

    permission_classes = [IsAuthenticated]

    def post(self, request, quiz_id):
        quiz = Quiz.objects.filter(pk=quiz_id, status="published").first()
        if quiz is None:
            raise NotFound("Test topilmadi")

        isloh_require_enrollment(request.user, quiz.course_id)

        used = QuizAttempt.objects.filter(quiz=quiz, user=request.user).count()
        if quiz.limit_attempts and used >= quiz.attempts:
            raise ValidationError({"form": "Urinishlar soni tugagan"})

        attempt = QuizAttempt.objects.create(quiz=quiz, user=request.user)
        return Response(QuizAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)


class SubmitAttemptView(APIView):
    """`POST /student/attempts/{id}/submit` — javoblarni yuborish.

    Ball SHU YERDA hisoblanadi va mijozdan hech qanday ball qabul
    qilinmaydi (apps/assessment/grading.py).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, attempt_id):
        attempt = QuizAttempt.objects.filter(pk=attempt_id, user=request.user).select_related("quiz").first()
        if attempt is None:
            raise NotFound("Urinish topilmadi")

        if attempt.status == attempt.STATUS_SUBMITTED:
            raise ValidationError({"form": "Bu urinish allaqachon yuborilgan"})

        serializer = QuizAnswerSubmitSerializer(data=request.data.get("answers", []), many=True)
        serializer.is_valid(raise_exception=True)

        allowed = {
            str(link.question_id)
            for link in attempt.quiz.quiz_questions.all()
        }

        for row in serializer.validated_data:
            question_id = str(row["question"])
            # Testda yo'q savolga javob qabul qilinmaydi
            if question_id not in allowed:
                continue
            QuizAnswer.objects.update_or_create(
                attempt=attempt,
                question_id=question_id,
                defaults={"value": row["value"]},
            )

        isloh_grade_attempt(attempt)
        return Response(QuizAttemptSerializer(attempt).data)


class StudentAttemptListView(APIView):
    """`/student/quizzes/{id}/attempts` — o'z urinishlarim."""

    permission_classes = [IsAuthenticated]

    def get(self, request, quiz_id):
        rows = QuizAttempt.objects.filter(quiz_id=quiz_id, user=request.user)
        return Response(QuizAttemptSerializer(rows, many=True).data)


class StudentAssignmentListView(APIView):
    """`/student/assignments?course=` — kursning topshiriqlari."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = Assignment.objects.filter(status="published").exclude(visibility="hidden")

        course = request.query_params.get("course")
        if course:
            isloh_require_enrollment(request.user, course)
            rows = rows.filter(course_id=course)
        else:
            # Kurs ko'rsatilmasa — faqat yozilgan kurslarim
            enrolled = Enrollment.objects.filter(user=request.user).values_list("course_id", flat=True)
            rows = rows.filter(course_id__in=list(enrolled))

        rows = rows.prefetch_related("rubric", "submissions")
        return Response(
            StudentAssignmentSerializer(rows, many=True, context={"request": request}).data
        )


class SubmitAssignmentView(APIView):
    """`POST /student/assignments/{id}/submissions`."""

    permission_classes = [IsAuthenticated]

    def post(self, request, assignment_id):
        assignment = get_object_or_404(Assignment, pk=assignment_id, status="published")
        isloh_require_enrollment(request.user, assignment.course_id)

        used = Submission.objects.filter(assignment=assignment, user=request.user).count()
        if used >= assignment.attempts:
            raise ValidationError({"form": "Topshirishlar soni tugagan"})

        is_late = isloh_is_late(assignment)
        if is_late and not assignment.allow_late:
            raise ValidationError({"form": "Muddat tugagan"})

        submission = Submission.objects.create(
            assignment=assignment,
            user=request.user,
            text=request.data.get("text", ""),
            is_late=is_late,
        )

        # Fayl metama'lumoti — haqiqiy yuklash M5 da
        for row in request.data.get("files", [])[: assignment.max_files]:
            SubmissionFile.objects.create(
                submission=submission,
                name=row.get("name", ""),
                size_bytes=row.get("size_bytes", 0),
                url=row.get("url", ""),
            )

        return Response(SubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)


def isloh_is_late(assignment):
    """Muddat o'tganmi. Sana ko'rsatilmagan bo'lsa — hech qachon kech emas."""
    if not assignment.due_date:
        return False

    from datetime import datetime, time

    due_time = assignment.due_time or time(23, 59)
    deadline = datetime.combine(assignment.due_date, due_time)
    deadline = timezone.make_aware(deadline, timezone.get_current_timezone())
    return timezone.now() > deadline


class StudentSubmissionListView(APIView):
    """`/student/submissions` — mening ishlarim va ballarim."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = (
            Submission.objects.filter(user=request.user)
            .select_related("assignment")
            .prefetch_related("files")
        )
        return Response(SubmissionSerializer(rows, many=True).data)
