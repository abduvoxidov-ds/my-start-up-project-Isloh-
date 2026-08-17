"""
ISLOH — o'qish oqimi modellari (M3).

QAROR 1 — `LessonProgress` IKKI frontend kalitini birlashtiradi.
Ilgari holat ikki joyda yashardi:
    `isloh_course_progress`  -> { lessonId: true|false }   (js/lesson-viewer.js)
    `isloh_video_positions`  -> { "courseId::lessonId": soniya } (js/lesson-video.js)
Ikkalasi ham AYNAN bir narsa haqida: talabaning shu darsdagi holati.
Alohida turgani uchun ular bir-biridan xabarsiz edi — dars "yakunlangan"
deb belgilangani bilan video pozitsiyasi 0 da qolishi mumkin edi va aksincha.
Endi bitta qator: `completed_at` (null = yakunlanmagan) + `position_sec`.

QAROR 2 — HOLAT (`state`) SAQLANMAYDI, hisoblanadi.
"Faol / Sust / Faol emas / Yakunladi" — `progress` va `last_active_at` dan
kelib chiqadi (`Enrollment.state`). Frontendda ham shunday edi
(js/enrollment-store.js dagi `isloh_enrollmentState`) va endi qoida FAQAT
shu yerda: ikki tomonda ikki xil chegara bo'lib qolmasin.

QAROR 3 — `progress` esa SAQLANADI (denormalizatsiya).
U `LessonProgress` dan hisoblanadi, lekin har o'qishda emas: talabalar
ro'yxati yuzlab qatordan iborat bo'lishi mumkin va har biri uchun darslarni
sanash N+1 so'rov berardi. Qiymat dars holati o'zgarganda yangilanadi
(`Enrollment.recalculate_progress`).

docs/BACKEND-PLAN.md §M3
"""

import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel
from apps.courses.models import Course, Lesson

# --- Faollik chegaralari (KUNda) -------------------------------------------
# js/enrollment-store.js dagi ISLOH_ENROLLMENT_STATES bilan bir xil.
# Bu yagona manba: sahifalar ham, API ham shu raqamlarga tayanadi.
STATE_COMPLETED = "completed"
STATE_ACTIVE = "active"
STATE_IDLE = "idle"
STATE_INACTIVE = "inactive"

ACTIVE_MAX_IDLE_DAYS = 3
IDLE_MAX_IDLE_DAYS = 10


class Enrollment(BaseModel):
    """Talaba <-> kurs. Bitta talaba bitta kursga bir marta yoziladi."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")

    enrolled_at = models.DateTimeField(default=timezone.now)
    # QAROR 3 — darslardan hisoblanadi, lekin saqlanadi
    progress = models.PositiveSmallIntegerField(default=0)
    # O'rtacha ball M4 (baholash) da to'ladi
    avg_score = models.PositiveSmallIntegerField(default=0)
    streak = models.PositiveIntegerField(default=0)
    last_active_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ["-enrolled_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="uniq_enrollment"),
        ]
        verbose_name = "Yozilish"
        verbose_name_plural = "Yozilishlar"

    def __str__(self):
        return f"{self.user.email} -> {self.course.title}"

    @property
    def idle_days(self):
        if not self.last_active_at:
            return None  # hech qachon "faol" emas
        return (timezone.now() - self.last_active_at).days

    @property
    def state(self):
        """QAROR 2 — yagona holat manbai."""
        if self.progress >= 100:
            return STATE_COMPLETED

        idle = self.idle_days
        if idle is None:
            return STATE_INACTIVE
        if idle <= ACTIVE_MAX_IDLE_DAYS:
            return STATE_ACTIVE
        if idle <= IDLE_MAX_IDLE_DAYS:
            return STATE_IDLE
        return STATE_INACTIVE

    def recalculate_progress(self, save=True):
        """Yakunlangan darslar ulushi.

        Kursda dars bo'lmasa 0 — nolga bo'lish ham, "darssiz kurs 100%
        yakunlangan" degan absurd ham chiqmasin.
        """
        total = Lesson.objects.filter(module__course_id=self.course_id).count()
        if not total:
            self.progress = 0
        else:
            done = LessonProgress.objects.filter(
                enrollment=self, completed_at__isnull=False
            ).count()
            self.progress = round(done * 100 / total)

        if self.progress >= 100 and self.completed_at is None:
            self.completed_at = timezone.now()
        elif self.progress < 100:
            self.completed_at = None

        if save:
            self.save(update_fields=["progress", "completed_at", "updated_at"])
        return self.progress

    def touch(self):
        """Oxirgi faollik — holat shu maydondan kelib chiqadi."""
        self.last_active_at = timezone.now()
        self.save(update_fields=["last_active_at", "updated_at"])


class LessonProgress(BaseModel):
    """Bitta darsdagi holat — QAROR 1.

    `enrollment` orqali bog'lanadi (user + course emas): talaba kursdan
    chiqarilsa uning dars holati ham o'zi bilan ketadi.
    """

    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="progress")

    # null = yakunlanmagan (bo'sh bo'lmagan sana = yakunlangan vaqti)
    completed_at = models.DateTimeField(null=True, blank=True)
    # Videoni qayerdan davom ettirish (ilgari `isloh_video_positions`)
    position_sec = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["enrollment", "lesson"], name="uniq_lesson_progress"),
        ]
        verbose_name = "Dars jarayoni"
        verbose_name_plural = "Dars jarayonlari"

    def __str__(self):
        return f"{self.enrollment.user.email} — {self.lesson.title}"

    @property
    def is_completed(self):
        return self.completed_at is not None


class Note(BaseModel):
    """Izoh: darsga bog'langan yoki shaxsiy.

    Yassi ro'yxat — js/notes-store.js dagi bilan bir xil sabab: notes.html
    da darsga bog'lanmagan shaxsiy izohlar ham bor va ikkalasi bitta
    ro'yxatda ko'rsatiladi.
    """

    SOURCE_LESSON = "lesson"
    SOURCE_PERSONAL = "personal"
    SOURCE_CHOICES = [(SOURCE_LESSON, "Dars izohi"), (SOURCE_PERSONAL, "Shaxsiy")]

    SCOPE_PERSONAL = "personal"
    SCOPE_SHARED = "shared"
    SCOPE_CHOICES = [(SCOPE_PERSONAL, "Shaxsiy"), (SCOPE_SHARED, "Ulashilgan")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes")
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="notes")
    lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True, related_name="notes")

    title = models.CharField(max_length=200, blank=True, default="")
    text = models.TextField(blank=True, default="")
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default=SOURCE_PERSONAL)
    scope = models.CharField(max_length=16, choices=SCOPE_CHOICES, default=SCOPE_PERSONAL)
    favorite = models.BooleanField(default=False)
    pinned = models.BooleanField(default=False)

    class Meta(BaseModel.Meta):
        # Qadalganlar tepada, keyin yangilanish vaqti bo'yicha
        ordering = ["-pinned", "-updated_at"]
        constraints = [
            # Bitta darsga bitta izoh — pleer uni id bo'yicha topadi
            models.UniqueConstraint(
                fields=["user", "lesson"],
                condition=models.Q(source="lesson"),
                name="uniq_lesson_note",
            ),
        ]
        verbose_name = "Izoh"
        verbose_name_plural = "Izohlar"

    def __str__(self):
        return self.title or self.text[:40]


class NoteTag(BaseModel):
    """Izoh teglari — `CourseTag` bilan bir xil sabab (filtr va qidiruv)."""

    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="tags")
    name = models.CharField(max_length=60)
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]
        constraints = [
            models.UniqueConstraint(fields=["note", "name"], name="uniq_note_tag"),
        ]


class Task(BaseModel):
    """Reja bandi. `pages/student/calendar.html` va vazifalar ro'yxati.

    HOLAT (bugun / muddati o'tgan / kelgusi / bajarilgan) SAQLANMAYDI —
    `due_date` va `is_completed` dan kelib chiqadi (js/tasks.js ham shunday
    qiladi). Aks holda sana o'tib ketganda yozuv "kelgusi" bo'lib qolardi.
    """

    TYPE_CHOICES = [
        ("lesson", "Dars"),
        ("deadline", "Muddat"),
        ("exam", "Imtihon"),
        ("personal", "Shaxsiy"),
    ]
    PRIORITY_CHOICES = [("high", "Yuqori"), ("medium", "O'rta"), ("low", "Past")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tasks")
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    lesson = models.ForeignKey(Lesson, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")

    title = models.CharField(max_length=200)
    due_date = models.DateField(null=True, blank=True)
    due_time = models.TimeField(null=True, blank=True)
    category = models.CharField(max_length=80, blank=True, default="")
    priority = models.CharField(max_length=16, choices=PRIORITY_CHOICES, default="medium")
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, default="personal")
    is_completed = models.BooleanField(default=False)

    class Meta(BaseModel.Meta):
        ordering = ["due_date", "due_time", "created_at"]
        verbose_name = "Vazifa"
        verbose_name_plural = "Vazifalar"

    def __str__(self):
        return self.title


def isloh_certificate_code():
    """Ommaviy tekshiruv kodi.

    UUID EMAS: kod odam tomonidan o'qiladi va qo'lda kiritiladi
    (`/certificates/verify/{code}`), shuning uchun qisqa va katta harfli.
    `secrets` — taxmin qilib bo'lmasin: kod bo'yicha kimningdir sertifikati
    ochiladi.
    """
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 0/O va 1/I chiqarildi
    return "ISLOH-" + "".join(secrets.choice(alphabet) for _ in range(10))


class Certificate(BaseModel):
    """Kurs yakunlanganda beriladigan sertifikat."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="certificates")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="certificates")
    enrollment = models.OneToOneField(
        Enrollment, on_delete=models.CASCADE, related_name="certificate", null=True, blank=True
    )

    code = models.CharField(max_length=32, unique=True, db_index=True, default=isloh_certificate_code)
    issued_at = models.DateTimeField(default=timezone.now)
    # Berilgan paytdagi nomlar — kurs keyin qayta nomlansa sertifikat
    # o'zgarmasin (u rasmiy hujjat)
    course_title = models.CharField(max_length=200, blank=True, default="")
    student_name = models.CharField(max_length=150, blank=True, default="")

    class Meta(BaseModel.Meta):
        ordering = ["-issued_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="uniq_certificate"),
        ]
        verbose_name = "Sertifikat"
        verbose_name_plural = "Sertifikatlar"

    def __str__(self):
        return self.code
