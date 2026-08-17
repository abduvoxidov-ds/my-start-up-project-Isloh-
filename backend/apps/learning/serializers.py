"""
ISLOH — o'qish oqimi serializerlari (M3).

IKKI TOMON, IKKI SHAKL:
  `StudentEnrollmentSerializer`    — talaba o'z kurslarini ko'radi
  `InstructorEnrollmentSerializer` — o'qituvchi talabalar ro'yxatini ko'radi
                                     (js/enrollment-store.js kutgan maydonlar)

`state` HAR IKKALASIDA ham serverdan keladi — u modelda hisoblanadi
(docs/BACKEND-PLAN.md §M3: "backend hisoblaydi").
"""

from rest_framework import serializers

from apps.courses.models import Course, Lesson

from .models import Certificate, Enrollment, LessonProgress, Note, NoteTag, Task


class StudentEnrollmentSerializer(serializers.ModelSerializer):
    """Talaba tomoni: "Mening kurslarim"."""

    course_title = serializers.CharField(source="course.title", read_only=True)
    course_slug = serializers.CharField(source="course.slug", read_only=True)
    cover = serializers.CharField(source="course.cover", read_only=True)
    icon = serializers.CharField(source="course.icon", read_only=True)
    state = serializers.CharField(read_only=True)
    lessons_count = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "course",
            "course_title",
            "course_slug",
            "cover",
            "icon",
            "enrolled_at",
            "progress",
            "avg_score",
            "streak",
            "last_active_at",
            "completed_at",
            "state",
            "lessons_count",
        ]
        # Jarayon `/lessons/{id}/progress` orqali o'zgaradi, bu yerdan emas:
        # aks holda talaba o'ziga 100% qo'yib sertifikat olardi
        read_only_fields = [
            "id",
            "progress",
            "avg_score",
            "streak",
            "completed_at",
            "state",
        ]

    def get_lessons_count(self, instance):
        return Lesson.objects.filter(module__course_id=instance.course_id).count()


class InstructorEnrollmentSerializer(serializers.ModelSerializer):
    """O'qituvchi tomoni — js/enrollment-store.js dagi maydonlar.

    Talaba ismi/emaili yozuv bilan birga keladi: ro'yxat jadvali ularni
    har qator uchun ko'rsatadi va alohida so'rov qilmasin.
    """

    student_id = serializers.CharField(source="user_id", read_only=True)
    student_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    avatar = serializers.CharField(source="user.avatar", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    state = serializers.CharField(read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "student_id",
            "student_name",
            "email",
            "avatar",
            "course",
            "course_title",
            "enrolled_at",
            "progress",
            "avg_score",
            "streak",
            "last_active_at",
            "state",
        ]
        read_only_fields = fields


class EnrollCreateSerializer(serializers.Serializer):
    """`POST /student/enrollments` — faqat kurs id'si kerak."""

    course = serializers.UUIDField()

    def validate_course(self, value):
        course = Course.objects.filter(pk=value).select_related("settings").first()
        if course is None:
            raise serializers.ValidationError("Kurs topilmadi")
        # Nashr etilmagan yoki yopiq kursga yozilib bo'lmaydi — aks holda
        # havolani bilgan odam qoralama kursga kirib olardi
        if not course.is_visible_in_catalog:
            raise serializers.ValidationError("Bu kursga yozilib bo'lmaydi")
        return course


class LessonProgressSerializer(serializers.ModelSerializer):
    """QAROR 1 — bitta yozuvda ham yakunlanganlik, ham video pozitsiyasi."""

    completed = serializers.BooleanField(required=False)

    class Meta:
        model = LessonProgress
        fields = ["id", "lesson", "completed", "completed_at", "position_sec"]
        read_only_fields = ["id", "lesson", "completed_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["completed"] = instance.is_completed
        return data


class NoteSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(child=serializers.CharField(max_length=60), required=False, write_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True, default="")
    lesson_title = serializers.CharField(source="lesson.title", read_only=True, default="")

    class Meta:
        model = Note
        fields = [
            "id",
            "title",
            "text",
            "source",
            "scope",
            "favorite",
            "pinned",
            "course",
            "lesson",
            "course_title",
            "lesson_title",
            "tags",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["tags"] = [tag.name for tag in instance.tags.all()]
        return data

    def _sync_tags(self, note, names):
        note.tags.all().delete()
        seen = set()
        rows = []
        for position, raw in enumerate(names):
            name = (raw or "").strip()
            if not name or name.lower() in seen:
                continue
            seen.add(name.lower())
            rows.append(NoteTag(note=note, name=name, position=position))
        if rows:
            NoteTag.objects.bulk_create(rows)

    def create(self, validated):
        tags = validated.pop("tags", [])
        validated["user"] = self.context["request"].user
        note = Note.objects.create(**validated)
        self._sync_tags(note, tags)
        return note

    def update(self, instance, validated):
        tags = validated.pop("tags", None)
        for field, value in validated.items():
            setattr(instance, field, value)
        instance.save()
        if tags is not None:
            self._sync_tags(instance, tags)
        return instance


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "due_date",
            "due_time",
            "category",
            "priority",
            "type",
            "course",
            "lesson",
            "is_completed",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated):
        validated["user"] = self.context["request"].user
        return Task.objects.create(**validated)


class CertificateSerializer(serializers.ModelSerializer):
    course_title = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    course_slug = serializers.CharField(source="course.slug", read_only=True)
    instructor_name = serializers.CharField(source="course.owner.full_name", read_only=True)

    class Meta:
        model = Certificate
        fields = [
            "id",
            "code",
            "course",
            "course_slug",
            "course_title",
            "student_name",
            "instructor_name",
            "issued_at",
        ]
        read_only_fields = fields

    def get_course_title(self, instance):
        # Berilgan paytdagi nom ustun: kurs keyin qayta nomlansa
        # sertifikatdagi matn o'zgarmaydi (u rasmiy hujjat)
        return instance.course_title or instance.course.title

    def get_student_name(self, instance):
        return instance.student_name or instance.user.full_name
