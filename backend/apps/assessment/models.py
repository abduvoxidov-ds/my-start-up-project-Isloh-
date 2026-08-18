"""
ISLOH — baholash modellari (M4).

ENG MUHIM QOIDA — TO'G'RI JAVOB TALABAGA YUBORILMAYDI.
`QuestionOption.is_correct` faqat o'qituvchi serializerida chiqadi; talaba
uchun alohida serializer bor va unda bu maydon umuman yo'q. Baholash ham
serverda: talaba faqat O'Z javobini yuboradi, ballni server qo'yadi
(`apps/assessment/grading.py`). Buni testlar qulflaydi
(docs/BACKEND-PLAN.md §M4).

NEGA `ArrayField` EMAS: reja M4 dan PostgreSQL'ni ko'zlagan edi, lekin
muhitda WSL2 yo'q (§"Muhit holati"). Shuning uchun ro'yxatlar munosabat
jadvallarida (`QuestionOption`, `AssignmentRubric`, `QuestionTag`), erkin
shakldagi javob esa `JSONField` da — u SQLite'da ham, PostgreSQL'da ham
ishlaydi. Ya'ni M4 bazani almashtirishni KUTMAYDI va keyin migratsiya
talab qilmaydi.
"""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel
from apps.courses.models import Course

# --- Ro'yxatlar (frontenddagi kalitlar bilan bir xil) ----------------------

# js/question-store.js dagi ISLOH_QUESTION_TYPE_META kalitlari
TYPE_SINGLE = "single"
TYPE_MULTI = "multi"
TYPE_BOOLEAN = "boolean"
TYPE_SHORT = "short"
TYPE_LONG = "long"
TYPE_MATCH = "match"
TYPE_ORDER = "order"
TYPE_BLANK = "blank"

QUESTION_TYPE_CHOICES = [
    (TYPE_SINGLE, "Bitta tanlov"),
    (TYPE_MULTI, "Ko'p tanlov"),
    (TYPE_BOOLEAN, "To'g'ri / Noto'g'ri"),
    (TYPE_SHORT, "Qisqa javob"),
    (TYPE_LONG, "Batafsil javob"),
    (TYPE_MATCH, "Moslashtirish"),
    (TYPE_ORDER, "Tartiblash"),
    (TYPE_BLANK, "Bo'sh joyni to'ldirish"),
]

# Faqat shu tur QO'LDA baholanadi — qolgan yettitasini server hisoblaydi
MANUAL_TYPES = {TYPE_LONG}

DIFFICULTY_CHOICES = [("easy", "Oson"), ("medium", "O'rta"), ("hard", "Qiyin")]

STATUS_DRAFT = "draft"
STATUS_PUBLISHED = "published"
PUBLISH_STATUS_CHOICES = [(STATUS_DRAFT, "Qoralama"), (STATUS_PUBLISHED, "Nashr etilgan")]


class Question(BaseModel):
    """Savollar bazasidagi savol.

    `course` IXTIYORIY: savollar bazasi (pages/instructor/question-bank.html)
    o'qituvchining butun to'plami bo'lib, bitta savol bir nechta testda
    ishlatilishi mumkin. Egalik `owner` orqali.
    """

    STATUS_ACTIVE = "active"
    STATUS_ARCHIVED = "archived"
    STATUS_CHOICES = [(STATUS_ACTIVE, "Faol"), (STATUS_ARCHIVED, "Arxiv")]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="questions")
    course = models.ForeignKey(
        Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="questions"
    )

    title = models.TextField()
    type = models.CharField(max_length=16, choices=QUESTION_TYPE_CHOICES, default=TYPE_SINGLE)
    points = models.PositiveSmallIntegerField(default=5)
    difficulty = models.CharField(max_length=16, choices=DIFFICULTY_CHOICES, default="easy")
    category = models.CharField(max_length=80, blank=True, default="umumiy")

    instructions = models.TextField(blank=True, default="")
    # Javobdan KEYIN ko'rsatiladi (`Quiz.show_answers`)
    explanation = models.TextField(blank=True, default="")
    hint = models.TextField(blank=True, default="")

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    class Meta(BaseModel.Meta):
        verbose_name = "Savol"
        verbose_name_plural = "Savollar"

    def __str__(self):
        return self.title[:60]

    @property
    def is_auto_graded(self):
        return self.type not in MANUAL_TYPES


class QuestionTag(BaseModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="tags")
    name = models.CharField(max_length=60)
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]
        constraints = [
            models.UniqueConstraint(fields=["question", "name"], name="uniq_question_tag"),
        ]


class QuestionOption(BaseModel):
    """Javob varianti.

    `is_correct` — MAXFIY maydon. U faqat `InstructorOptionSerializer` da
    chiqadi; talaba serializerida (`StudentOptionSerializer`) bu maydon
    umuman e'lon qilinmagan.

    `match_text` faqat `match` turida ishlatiladi: `text` — chap ustun,
    `match_text` — unga mos keladigan o'ng ustun. Alohida model qilinmadi,
    chunki juftlik ham variantning o'zi.

    `order` turida esa `position` to'g'ri tartibni bildiradi va talabaga
    ARALASHTIRILGAN holda yuboriladi.
    """

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    text = models.TextField(blank=True, default="")
    match_text = models.TextField(blank=True, default="")
    is_correct = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]
        verbose_name = "Variant"
        verbose_name_plural = "Variantlar"

    def __str__(self):
        return self.text[:40]


class Quiz(BaseModel):
    """Test. Sozlamalari js/quiz-store.js dagi shakl bilan bir xil."""

    SCORING_LAST = "last"
    SCORING_BEST = "best"
    SCORING_AVERAGE = "average"
    SCORING_CHOICES = [
        (SCORING_LAST, "Oxirgi urinish"),
        (SCORING_BEST, "Eng yaxshi urinish"),
        (SCORING_AVERAGE, "O'rtacha"),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quizzes")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="quizzes")

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    instructions = models.TextField(blank=True, default="")
    difficulty = models.CharField(max_length=16, choices=DIFFICULTY_CHOICES, default="medium")
    status = models.CharField(max_length=16, choices=PUBLISH_STATUS_CHOICES, default=STATUS_DRAFT)

    time_limit = models.BooleanField(default=True)
    duration = models.PositiveSmallIntegerField(default=15)  # daqiqa
    limit_attempts = models.BooleanField(default=True)
    attempts = models.PositiveSmallIntegerField(default=2)
    scoring_mode = models.CharField(max_length=16, choices=SCORING_CHOICES, default=SCORING_LAST)
    passing_score = models.PositiveSmallIntegerField(default=70)  # %
    # Javoblarni urinishdan KEYIN ko'rsatish
    show_answers = models.BooleanField(default=True)
    shuffle_questions = models.BooleanField(default=False)
    shuffle_options = models.BooleanField(default=False)
    random_subset = models.BooleanField(default=False)
    subset_size = models.PositiveSmallIntegerField(default=5)
    certificate = models.BooleanField(default=False)
    cert_name = models.CharField(max_length=200, blank=True, default="")

    class Meta(BaseModel.Meta):
        verbose_name = "Test"
        verbose_name_plural = "Testlar"

    def __str__(self):
        return self.title

    @property
    def total_points(self):
        return sum(link.question.points for link in self.quiz_questions.select_related("question"))


class QuizQuestion(BaseModel):
    """Test <-> savol, tartibli.

    Alohida jadval, chunki bitta savol bir nechta testda bo'lishi mumkin va
    har birida BOSHQA o'rinda turadi.
    """

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="quiz_questions")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="quiz_links")
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]
        constraints = [
            models.UniqueConstraint(fields=["quiz", "question"], name="uniq_quiz_question"),
        ]


class QuizAttempt(BaseModel):
    """Talabaning bitta urinishi."""

    STATUS_IN_PROGRESS = "in_progress"
    STATUS_SUBMITTED = "submitted"
    STATUS_CHOICES = [
        (STATUS_IN_PROGRESS, "Davom etmoqda"),
        (STATUS_SUBMITTED, "Yuborilgan"),
    ]

    # `related_name="attempts"` EMAS: `Quiz.attempts` allaqachon band —
    # u sozlama (nechta urinishga ruxsat) va uni frontend shu nom bilan
    # yuboradi (js/quiz-store.js), shuning uchun teskari nom o'zgartirildi
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="quiz_attempts_made")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quiz_attempts")

    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)

    # Ballni FAQAT server qo'yadi
    score = models.PositiveSmallIntegerField(default=0)          # %
    points_awarded = models.PositiveIntegerField(default=0)
    points_total = models.PositiveIntegerField(default=0)
    passed = models.BooleanField(default=False)
    # `long` turidagi savol bo'lsa o'qituvchi ko'rib chiqishi kerak
    needs_review = models.BooleanField(default=False)

    class Meta(BaseModel.Meta):
        ordering = ["-started_at"]
        verbose_name = "Urinish"
        verbose_name_plural = "Urinishlar"

    def __str__(self):
        return f"{self.user.email} — {self.quiz.title}"


class QuizAnswer(BaseModel):
    """Bitta savolga berilgan javob.

    `value` — JSON, chunki turlar har xil shakl talab qiladi:
        single/boolean -> "<option_id>"
        multi/order    -> ["<option_id>", ...]
        match          -> {"<option_id>": "<match matni>"}
        short/blank    -> "matn"
        long           -> "matn"
    `ArrayField` ishlatilmagani haqida fayl boshidagi izohga qarang.
    """

    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")

    value = models.JSONField(default=dict, blank=True)
    # null = hali baholanmagan (qo'lda baholanadigan tur)
    is_correct = models.BooleanField(null=True, blank=True)
    points_awarded = models.PositiveSmallIntegerField(default=0)
    feedback = models.TextField(blank=True, default="")

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["attempt", "question"], name="uniq_attempt_answer"),
        ]


class Assignment(BaseModel):
    """Topshiriq. Shakli js/assignment-store.js bilan bir xil."""

    SUBMIT_TEXT = "text"
    SUBMIT_FILE = "file"
    SUBMIT_MULTI = "multi"
    SUBMIT_CHOICES = [
        (SUBMIT_TEXT, "Matn"),
        (SUBMIT_FILE, "Fayl"),
        (SUBMIT_MULTI, "Matn va fayl"),
    ]

    VISIBILITY_CHOICES = [
        ("public", "Ochiq"),
        ("hidden", "Yashirin"),
        ("scheduled", "Rejalashtirilgan"),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assignments")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="assignments")

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    instructions = models.TextField(blank=True, default="")

    submit_type = models.CharField(max_length=16, choices=SUBMIT_CHOICES, default=SUBMIT_FILE)
    max_files = models.PositiveSmallIntegerField(default=3)
    # [".pdf", ".zip"] — JSONField (fayl boshidagi izohga qarang)
    file_types = models.JSONField(default=list, blank=True)
    max_size_mb = models.PositiveSmallIntegerField(default=25)

    max_score = models.PositiveSmallIntegerField(default=100)
    estimate = models.PositiveSmallIntegerField(default=60)  # daqiqa
    due_date = models.DateField(null=True, blank=True)
    due_time = models.TimeField(null=True, blank=True)

    status = models.CharField(max_length=16, choices=PUBLISH_STATUS_CHOICES, default=STATUS_DRAFT)
    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default="public")
    attempts = models.PositiveSmallIntegerField(default=1)
    allow_late = models.BooleanField(default=True)
    late_penalty = models.PositiveSmallIntegerField(default=10)  # % / kun
    # Faqat o'qituvchi ko'radi — talaba serializerida YO'Q
    notes = models.TextField(blank=True, default="")

    cover = models.CharField(max_length=200, blank=True, default="linear-gradient(135deg,#6C5DD3,#4B3FA8)")
    icon = models.CharField(max_length=60, blank=True, default="bi-file-earmark-text-fill")

    class Meta(BaseModel.Meta):
        verbose_name = "Topshiriq"
        verbose_name_plural = "Topshiriqlar"

    def __str__(self):
        return self.title


class AssignmentRubric(BaseModel):
    """Baholash mezoni: `[{text, points}]` ilgari massiv edi."""

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="rubric")
    text = models.CharField(max_length=200)
    points = models.PositiveSmallIntegerField(default=0)
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]


class Submission(BaseModel):
    """Talabaning topshirig'i."""

    STATUS_PENDING = "pending"
    STATUS_GRADED = "graded"
    STATUS_RETURNED = "returned"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Tekshirilmagan"),
        (STATUS_GRADED, "Baholangan"),
        (STATUS_RETURNED, "Qaytarilgan"),
    ]

    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="submissions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="submissions")

    text = models.TextField(blank=True, default="")
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_late = models.BooleanField(default=False)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    feedback = models.TextField(blank=True, default="")
    graded_at = models.DateTimeField(null=True, blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="graded_submissions",
    )

    class Meta(BaseModel.Meta):
        ordering = ["-submitted_at"]
        verbose_name = "Topshirilgan ish"
        verbose_name_plural = "Topshirilgan ishlar"

    def __str__(self):
        return f"{self.user.email} — {self.assignment.title}"


class SubmissionFile(BaseModel):
    """Topshirilgan ishning fayli.

    M4 da bu faqat metama'lumot edi (`name`, `size_bytes`, `url`) va baytlar
    hech qayerda saqlanmasdi. M5 da `file` qo'shildi; eski uchta maydon
    QOLDI, chunki ular yozuvning NUSXASI: fayl o'chirilsa ham ishning
    tarkibida nima topshirilgani ko'rinib turishi kerak.

    Satrli havola (`"resources.File"`) ATAYLAB: `apps.resources`
    `apps.assessment` ga tayanadi (yuklash chegarasi topshiriqdan olinadi),
    teskari import aylanma bo'lardi.
    """

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="files")
    file = models.ForeignKey(
        "resources.File",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submission_files",
    )
    name = models.CharField(max_length=200)
    size_bytes = models.PositiveBigIntegerField(default=0)
    url = models.URLField(blank=True, default="")

    class Meta(BaseModel.Meta):
        ordering = ["created_at"]
