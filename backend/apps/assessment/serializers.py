"""
ISLOH — baholash serializerlari (M4).

IKKI OILA, ATAYLAB AJRATILGAN:

  Instructor*  — `is_correct`, `explanation`, `notes` bor
  Student*     — bu maydonlar UMUMAN E'LON QILINMAGAN

Nega "e'lon qilinmagan", "yashirilgan" emas: maydonni `write_only` yoki
`exclude` bilan olib tashlash keyinchalik biror joyda bekor qilinishi
mumkin. Alohida sinf esa tasodifan sizib chiqishga imkon bermaydi — talaba
serializerida bunday maydon YO'Q va uni qo'shish uchun kodni ataylab
o'zgartirish kerak bo'ladi (docs/BACKEND-PLAN.md §M4).
"""

from django.db import transaction
from rest_framework import serializers

from .models import (
    MANUAL_TYPES,
    Assignment,
    AssignmentRubric,
    Question,
    QuestionOption,
    QuestionTag,
    Quiz,
    QuizAnswer,
    QuizAttempt,
    QuizQuestion,
    Submission,
    SubmissionFile,
)

# --- Variantlar -------------------------------------------------------------


class InstructorOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ["id", "text", "match_text", "is_correct", "position"]
        read_only_fields = ["id"]


class StudentOptionSerializer(serializers.ModelSerializer):
    """`is_correct` va `match_text` bu yerda YO'Q.

    `match_text` ham chiqarilmaydi: moslashtirish savolida u aynan
    javobning o'zi. O'ng ustun talabaga alohida, ARALASHTIRILGAN ro'yxat
    sifatida beriladi (`StudentQuestionSerializer.match_pool`).
    """

    class Meta:
        model = QuestionOption
        fields = ["id", "text", "position"]


# --- Savollar ---------------------------------------------------------------


class InstructorQuestionSerializer(serializers.ModelSerializer):
    options = InstructorOptionSerializer(many=True, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=60), required=False, write_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "course",
            "title",
            "type",
            "points",
            "difficulty",
            "category",
            "instructions",
            "explanation",
            "hint",
            "status",
            "options",
            "tags",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["tags"] = [tag.name for tag in instance.tags.all()]
        return data

    def _sync_tags(self, question, names):
        question.tags.all().delete()
        seen = set()
        rows = []
        for position, raw in enumerate(names):
            name = (raw or "").strip()
            if not name or name.lower() in seen:
                continue
            seen.add(name.lower())
            rows.append(QuestionTag(question=question, name=name, position=position))
        if rows:
            QuestionTag.objects.bulk_create(rows)

    def _sync_options(self, question, options):
        """Variantlar TO'LIQ almashtiriladi — muharrir butun ro'yxatni yuboradi."""
        question.options.all().delete()
        rows = [
            QuestionOption(
                question=question,
                text=item.get("text", ""),
                match_text=item.get("match_text", ""),
                is_correct=item.get("is_correct", False),
                position=item.get("position", index),
            )
            for index, item in enumerate(options)
        ]
        if rows:
            QuestionOption.objects.bulk_create(rows)

    @transaction.atomic
    def create(self, validated):
        options = validated.pop("options", [])
        tags = validated.pop("tags", [])
        validated["owner"] = self.context["request"].user

        question = Question.objects.create(**validated)
        self._sync_options(question, options)
        self._sync_tags(question, tags)
        return question

    @transaction.atomic
    def update(self, instance, validated):
        options = validated.pop("options", None)
        tags = validated.pop("tags", None)

        for field, value in validated.items():
            setattr(instance, field, value)
        instance.save()

        if options is not None:
            self._sync_options(instance, options)
        if tags is not None:
            self._sync_tags(instance, tags)
        return instance


class StudentQuestionSerializer(serializers.ModelSerializer):
    """Talaba ko'radigan savol. `explanation` shu yerda ATAYLAB yo'q —
    u javob berilgandan keyin alohida endpoint orqali beriladi."""

    options = StudentOptionSerializer(many=True, read_only=True)
    match_pool = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            "id",
            "title",
            "type",
            "points",
            "difficulty",
            "instructions",
            "hint",
            "options",
            "match_pool",
        ]

    def get_match_pool(self, instance):
        """Moslashtirish savolida o'ng ustun — ARALASHTIRILGAN.

        Tartibda berilsa javob variantlar tartibidan o'qilib qolardi.
        """
        if instance.type != "match":
            return []

        import random

        pool = [o.match_text for o in instance.options.all() if o.match_text]
        random.shuffle(pool)
        return pool


# --- Testlar ----------------------------------------------------------------


class QuizSerializer(serializers.ModelSerializer):
    """O'qituvchi tomoni."""

    question_ids = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    questions_count = serializers.SerializerMethodField()
    total_points = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "course",
            "title",
            "description",
            "instructions",
            "difficulty",
            "status",
            "time_limit",
            "duration",
            "limit_attempts",
            "attempts",
            "scoring_mode",
            "passing_score",
            "show_answers",
            "shuffle_questions",
            "shuffle_options",
            "random_subset",
            "subset_size",
            "certificate",
            "cert_name",
            "question_ids",
            "questions_count",
            "total_points",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "questions_count", "total_points", "created_at", "updated_at"]

    def get_questions_count(self, instance):
        return instance.quiz_questions.count()

    def get_total_points(self, instance):
        return sum(link.question.points for link in instance.quiz_questions.all())

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["question_ids"] = [str(link.question_id) for link in instance.quiz_questions.all()]
        return data

    def _sync_questions(self, quiz, ids):
        """Savollar ro'yxati va TARTIBI — muharrir butun ro'yxatni yuboradi."""
        quiz.quiz_questions.all().delete()
        owned = {
            str(q.pk): q
            for q in Question.objects.filter(pk__in=ids, owner=quiz.owner)
        }
        rows = []
        position = 0
        for raw in ids:
            question = owned.get(str(raw))
            # Begona savolni testga qo'shib bo'lmaydi — jimgina tushiriladi
            if question is None:
                continue
            rows.append(QuizQuestion(quiz=quiz, question=question, position=position))
            position += 1
        if rows:
            QuizQuestion.objects.bulk_create(rows)

    @transaction.atomic
    def create(self, validated):
        ids = validated.pop("question_ids", [])
        validated["owner"] = self.context["request"].user
        quiz = Quiz.objects.create(**validated)
        self._sync_questions(quiz, ids)
        return quiz

    @transaction.atomic
    def update(self, instance, validated):
        ids = validated.pop("question_ids", None)
        for field, value in validated.items():
            setattr(instance, field, value)
        instance.save()
        if ids is not None:
            self._sync_questions(instance, ids)
        return instance


class StudentQuizSerializer(serializers.ModelSerializer):
    """Talaba ko'radigan test. Sozlamalarning faqat unga taalluqli qismi."""

    questions = serializers.SerializerMethodField()
    attempts_used = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "course",
            "title",
            "description",
            "instructions",
            "difficulty",
            "time_limit",
            "duration",
            "limit_attempts",
            "attempts",
            "passing_score",
            "questions",
            "attempts_used",
        ]

    def get_questions(self, instance):
        links = instance.quiz_questions.select_related("question").prefetch_related("question__options")
        questions = [link.question for link in links]

        if instance.shuffle_questions:
            import random

            random.shuffle(questions)

        return StudentQuestionSerializer(questions, many=True).data

    def get_attempts_used(self, instance):
        user = self.context["request"].user
        return QuizAttempt.objects.filter(quiz=instance, user=user).count()


class QuizAnswerSubmitSerializer(serializers.Serializer):
    """Talaba yuboradigan bitta javob. `is_correct` va `points` YO'Q —
    ularni faqat server qo'yadi."""

    question = serializers.UUIDField()
    value = serializers.JSONField()


class QuizAttemptSerializer(serializers.ModelSerializer):
    """Urinish natijasi. Javoblar `answers` da, lekin to'g'ri javobsiz."""

    answers = serializers.SerializerMethodField()

    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "quiz",
            "status",
            "started_at",
            "submitted_at",
            "score",
            "points_awarded",
            "points_total",
            "passed",
            "needs_review",
            "answers",
        ]
        read_only_fields = fields

    def get_answers(self, instance):
        """`explanation` faqat test sozlamasi ruxsat bersa qo'shiladi
        (`Quiz.show_answers`) va faqat urinish YUBORILGANDAN keyin."""
        show = instance.quiz.show_answers and instance.status == instance.STATUS_SUBMITTED

        rows = []
        for answer in instance.answers.select_related("question"):
            row = {
                "question": str(answer.question_id),
                "value": answer.value,
                "is_correct": answer.is_correct,
                "points_awarded": answer.points_awarded,
            }
            if show:
                row["explanation"] = answer.question.explanation
            rows.append(row)
        return rows


# --- Topshiriqlar -----------------------------------------------------------


class RubricSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssignmentRubric
        fields = ["id", "text", "points", "position"]
        read_only_fields = ["id"]


class InstructorAssignmentSerializer(serializers.ModelSerializer):
    rubric = RubricSerializer(many=True, required=False)
    submissions_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            "id",
            "course",
            "title",
            "description",
            "instructions",
            "submit_type",
            "max_files",
            "file_types",
            "max_size_mb",
            "max_score",
            "estimate",
            "due_date",
            "due_time",
            "status",
            "visibility",
            "attempts",
            "allow_late",
            "late_penalty",
            "notes",
            "cover",
            "icon",
            "rubric",
            "submissions_count",
            "pending_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "submissions_count", "pending_count", "created_at", "updated_at"]

    def get_submissions_count(self, instance):
        return instance.submissions.count()

    def get_pending_count(self, instance):
        return instance.submissions.filter(status=Submission.STATUS_PENDING).count()

    def _sync_rubric(self, assignment, rows):
        assignment.rubric.all().delete()
        objects = [
            AssignmentRubric(
                assignment=assignment,
                text=item.get("text", ""),
                points=item.get("points", 0),
                position=item.get("position", index),
            )
            for index, item in enumerate(rows)
        ]
        if objects:
            AssignmentRubric.objects.bulk_create(objects)

    @transaction.atomic
    def create(self, validated):
        rubric = validated.pop("rubric", [])
        validated["owner"] = self.context["request"].user
        assignment = Assignment.objects.create(**validated)
        self._sync_rubric(assignment, rubric)
        return assignment

    @transaction.atomic
    def update(self, instance, validated):
        rubric = validated.pop("rubric", None)
        for field, value in validated.items():
            setattr(instance, field, value)
        instance.save()
        if rubric is not None:
            self._sync_rubric(instance, rubric)
        return instance


class StudentAssignmentSerializer(serializers.ModelSerializer):
    """`notes` — o'qituvchining shaxsiy eslatmasi — bu yerda YO'Q."""

    rubric = RubricSerializer(many=True, read_only=True)
    my_submission = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            "id",
            "course",
            "title",
            "description",
            "instructions",
            "submit_type",
            "max_files",
            "file_types",
            "max_size_mb",
            "max_score",
            "estimate",
            "due_date",
            "due_time",
            "allow_late",
            "late_penalty",
            "attempts",
            "cover",
            "icon",
            "rubric",
            "my_submission",
        ]

    def get_my_submission(self, instance):
        user = self.context["request"].user
        row = instance.submissions.filter(user=user).order_by("-submitted_at").first()
        return SubmissionSerializer(row).data if row else None


class SubmissionFileSerializer(serializers.ModelSerializer):
    """`download_url` M5 da qo'shildi — u yerda ruxsat tekshiriladi.

    `url` maydoni ham qoldi: unda tashqi havola bo'lishi mumkin
    (apps/assessment/models.py dagi `SubmissionFile` izohi).
    """

    download_url = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionFile
        fields = ["id", "file", "name", "size_bytes", "url", "download_url"]
        read_only_fields = ["id", "download_url"]

    def get_download_url(self, obj):
        from apps.resources.serializers import isloh_download_url

        return isloh_download_url(obj.file)


class SubmissionSerializer(serializers.ModelSerializer):
    files = SubmissionFileSerializer(many=True, required=False)
    student_name = serializers.CharField(source="user.full_name", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment",
            "assignment_title",
            "student_name",
            "text",
            "files",
            "submitted_at",
            "is_late",
            "status",
            "score",
            "feedback",
            "graded_at",
        ]
        # Ball va holatni talaba yoza olmaydi — ular baholash amali natijasi
        read_only_fields = [
            "id",
            "assignment_title",
            "student_name",
            "submitted_at",
            "is_late",
            "status",
            "score",
            "feedback",
            "graded_at",
        ]


class GradeSerializer(serializers.Serializer):
    """`POST /instructor/submissions/{id}/grade`."""

    score = serializers.IntegerField(min_value=0)
    feedback = serializers.CharField(required=False, allow_blank=True)

    def validate_score(self, value):
        max_score = self.context["submission"].assignment.max_score
        if value > max_score:
            raise serializers.ValidationError(f"Ball {max_score} dan oshmasligi kerak")
        return value


class AttemptGradeSerializer(serializers.Serializer):
    """Qo'lda baholanadigan javob uchun (`long` turi)."""

    answer = serializers.UUIDField()
    points_awarded = serializers.IntegerField(min_value=0)
    feedback = serializers.CharField(required=False, allow_blank=True)
