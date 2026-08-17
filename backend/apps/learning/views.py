"""
ISLOH — o'qish oqimi ko'rinishlari (M3).

SAHIFALASH YO'Q: `/student/enrollments`, `/student/notes`, `/student/tasks`,
`/student/certificates` — hammasi do'kon endpoint'lari va bevosita MASSIV
qaytaradi (§0.1). Sahifalanadigan yagona ro'yxat — o'qituvchining talabalar
jadvali emas: u ham do'konga (js/enrollment-store.js) boradi, shuning uchun
u ham massiv.

"TALABALAR" IKKI MA'NODA (docs/BACKEND-PLAN.md §M3): `Course.students_count`
— sotuvdan yig'ilgan umumiy son, `enrollments` esa haqiqiy yozuvlar. Ular
ALOHIDA nom bilan qaytariladi (`students_count` va `enrolled_count`), aks
holda bitta sahifa ikki xil raqamni bir xil deb ko'rsatardi.
"""

from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.models import Course, Lesson
from apps.courses.views import IsInstructor

from .models import Certificate, Enrollment, LessonProgress, Note, Task
from .serializers import (
    CertificateSerializer,
    EnrollCreateSerializer,
    InstructorEnrollmentSerializer,
    LessonProgressSerializer,
    NoteSerializer,
    StudentEnrollmentSerializer,
    TaskSerializer,
)

# --- Talaba: yozilishlar ---------------------------------------------------


class StudentEnrollmentView(APIView):
    """`/student/enrollments` — o'z kurslarim."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = (
            Enrollment.objects.filter(user=request.user)
            .select_related("course")
        )
        return Response(StudentEnrollmentSerializer(rows, many=True).data)

    def post(self, request):
        serializer = EnrollCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = serializer.validated_data["course"]

        # Takroriy yozilish xato emas: tugma ikki marta bosilishi mumkin va
        # foydalanuvchi uchun natija bir xil bo'lishi kerak
        enrollment, created = Enrollment.objects.get_or_create(user=request.user, course=course)
        if created:
            enrollment.recalculate_progress()

        return Response(
            StudentEnrollmentSerializer(enrollment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class StudentEnrollmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, enrollment_id):
        enrollment = Enrollment.objects.filter(pk=enrollment_id, user=request.user).first()
        if enrollment is None:
            raise NotFound("Yozuv topilmadi")
        enrollment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CourseProgressView(APIView):
    """`/student/courses/{course_id}/progress` — kursning butun holati.

    Pleer sahifasi bitta so'rov bilan hamma darsning holatini oladi: ilgari
    u `isloh_course_progress` va `isloh_video_positions` ni alohida o'qirdi.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        enrollment = isloh_user_enrollment(request.user, course_id)
        rows = LessonProgress.objects.filter(enrollment=enrollment)

        return Response(
            {
                "enrollment_id": str(enrollment.pk),
                "progress": enrollment.progress,
                "state": enrollment.state,
                "completed_at": enrollment.completed_at,
                "lessons": {
                    str(row.lesson_id): {
                        "completed": row.is_completed,
                        "position_sec": row.position_sec,
                    }
                    for row in rows
                },
            }
        )


def isloh_user_enrollment(user, course_id):
    """Foydalanuvchining shu kursdagi yozuvi. Yo'q bo'lsa 404."""
    enrollment = Enrollment.objects.filter(user=user, course_id=course_id).first()
    if enrollment is None:
        raise NotFound("Bu kursga yozilmagansiz")
    return enrollment


class LessonProgressView(APIView):
    """`/student/lessons/{lesson_id}/progress` — darsni belgilash.

    `PUT` chunki amal idempotent: pleer video pozitsiyasini bir necha
    soniyada bir yuboradi va har safar yangi yozuv yaratilmasligi kerak.
    """

    permission_classes = [IsAuthenticated]

    def put(self, request, lesson_id):
        lesson = (
            Lesson.objects.filter(pk=lesson_id)
            .select_related("module__course")
            .first()
        )
        if lesson is None:
            raise NotFound("Dars topilmadi")

        enrollment = isloh_user_enrollment(request.user, lesson.module.course_id)
        row, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)

        serializer = LessonProgressSerializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "position_sec" in data:
            row.position_sec = data["position_sec"]
        if "completed" in data:
            # Sanani mijoz bermaydi — u serverning vaqti
            row.completed_at = timezone.now() if data["completed"] else None
        row.save()

        enrollment.recalculate_progress()
        enrollment.touch()

        payload = LessonProgressSerializer(row).data
        payload["course_progress"] = enrollment.progress
        payload["state"] = enrollment.state
        return Response(payload)


# --- O'qituvchi: talabalar ro'yxati ----------------------------------------


class InstructorEnrollmentView(APIView):
    """`/instructor/enrollments` — o'z kurslarimdagi talabalar.

    js/enrollment-store.js shu endpoint'ni o'qiydi. Faqat O'ZINING
    kurslaridagi yozuvlar: `course__owner` bo'yicha filtr.
    """

    permission_classes = [IsAuthenticated, IsInstructor]

    def get(self, request):
        rows = (
            Enrollment.objects.filter(course__owner=request.user)
            .select_related("user", "course")
        )
        course_id = request.query_params.get("course")
        if course_id:
            rows = rows.filter(course_id=course_id)
        return Response(InstructorEnrollmentSerializer(rows, many=True).data)


class InstructorCourseStudentsView(APIView):
    """`/instructor/courses/{course_id}/students` — ikki xil "talaba" soni.

    docs/BACKEND-PLAN.md §M3: `students_count` (sotuvdan) va `enrolled_count`
    (haqiqiy yozuvlar) BIR XIL narsa emas va bir xil nom bilan
    qaytarilmaydi.
    """

    permission_classes = [IsAuthenticated, IsInstructor]

    def get(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id, owner=request.user)
        stats = Enrollment.objects.filter(course=course).aggregate(enrolled=Count("id"))
        return Response(
            {
                "course": str(course.pk),
                "students_count": course.students_count,
                "enrolled_count": stats["enrolled"] or 0,
            }
        )


# --- Izohlar ---------------------------------------------------------------


class NoteViewSet(viewsets.ModelViewSet):
    """`/student/notes` — do'kon endpoint'i, sahifalanmaydi (§0.1)."""

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (
            Note.objects.filter(user=self.request.user)
            .select_related("course", "lesson")
            .prefetch_related("tags")
        )


# --- Vazifalar -------------------------------------------------------------


class TaskViewSet(viewsets.ModelViewSet):
    """`/student/tasks`."""

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).select_related("course", "lesson")


# --- Sertifikatlar ---------------------------------------------------------


class CertificateListView(APIView):
    """`/student/certificates` — men olgan sertifikatlar."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = Certificate.objects.filter(user=request.user).select_related("course", "course__owner")
        return Response(CertificateSerializer(rows, many=True).data)

    def post(self, request):
        """Kurs yakunlangach sertifikat berish.

        SERVER TEKSHIRADI: talaba 100% ga yetganmi. Mijoz "yakunladim" deb
        ayta olmaydi — aks holda birinchi darsni ochgan odam ham sertifikat
        olardi.
        """
        course_id = request.data.get("course")
        enrollment = isloh_user_enrollment(request.user, course_id)

        if enrollment.progress < 100:
            raise ValidationError({"course": "Kurs hali yakunlanmagan"})

        certificate, _ = Certificate.objects.get_or_create(
            user=request.user,
            course=enrollment.course,
            defaults={
                "enrollment": enrollment,
                "course_title": enrollment.course.title,
                "student_name": request.user.full_name,
            },
        )
        return Response(CertificateSerializer(certificate).data, status=status.HTTP_201_CREATED)


class CertificateVerifyView(RetrieveAPIView):
    """`/certificates/verify/{code}` — AUTH'SIZ.

    Sertifikatni ish beruvchi tekshiradi, ya'ni u Isloh'da hisobi bo'lmagan
    odam. Javobda faqat ommaviy ma'lumot: kim, qaysi kurs, qachon —
    email yoki boshqa shaxsiy maydon YO'Q.
    """

    serializer_class = CertificateSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    lookup_field = "code"

    def get_queryset(self):
        return Certificate.objects.select_related("course", "course__owner", "user")
