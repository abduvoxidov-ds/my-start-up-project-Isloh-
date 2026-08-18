"""
ISLOH — kurs, modul va dars modellari (M2).

QAROR 1 — `id` UUID, `slug` alohida.
Frontendda hozir ikkalasi bitta qiymat (`py-101`) va `?id=` 20 dan ortiq
sahifada ishlatiladi. `apps/core/models.SluggedModel` ularni ajratadi:
kalit — UUID, manzil — slug. Frontend `id` ni shunchaki noyob satr deb
ishlatadi, shuning uchun UUID unga shaffof.

QAROR 2 — Narx `price_cents` butun sonda, `currency` alohida.
Frontendda narx USD'da kasr son sifatida saqlanar va katalogga
`ISLOH_USD_TO_UZS = 12600` koeffitsienti bilan o'girilar edi
(js/course-store.js). Kasr pul turi yaxlitlash xatosini beradi, sehrli
koeffitsient esa ikki joyda ikki xil natija. Endi manba — butun tiyin/sent
va valyuta kodi; o'girish frontenddagi yagona `normalize` funksiyasida.

QAROR 3 — Ba'zi ro'yxatlarning qiymatlari o'zbekcha.
`status`, `visibility`, `type` — ASCII kodlar (frontend ham shunday
yozadi). `level` esa frontendda erkin ko'rinish matni ("O'rta daraja") va
u sahifalarda to'g'ridan-to'g'ri chiziladi. `apps/accounts` dagi
`ROLE_CHOICES` bilan bir xil yondashuv: qiymat frontenddagi satr bilan
AYNAN bir xil, aks holda ikki tomonda ikki xil lug'at paydo bo'lardi.

QAROR 4 — Statistik maydonlar (`students_count`, `rating`, ...) shu yerda
turadi, lekin ularni KEYINGI modullar yuritadi (M3 yozuvlar, M6 sharhlar,
M9 savdo, M11 analitika). Hozir ular sukut qiymatida qoladi — frontenddagi
kurs kartochkasi bu maydonlarni kutadi va ularsiz bo'sh joy ko'rsatardi.

docs/BACKEND-PLAN.md §M2
"""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel, SluggedModel

# --- Ro'yxatlar (frontenddagi satrlar bilan bir xil) -----------------------

STATUS_DRAFT = "draft"
STATUS_PUBLISHED = "published"
STATUS_ARCHIVED = "archived"
STATUS_CHOICES = [
    (STATUS_DRAFT, "Qoralama"),
    (STATUS_PUBLISHED, "Nashr etilgan"),
    (STATUS_ARCHIVED, "Arxiv"),
]

VISIBILITY_PUBLIC = "public"
VISIBILITY_UNLISTED = "unlisted"
VISIBILITY_PRIVATE = "private"
VISIBILITY_CHOICES = [
    (VISIBILITY_PUBLIC, "Ochiq"),
    (VISIBILITY_UNLISTED, "Ro'yxatda ko'rinmaydi"),
    (VISIBILITY_PRIVATE, "Yopiq"),
]

# js/content-store.js dagi ISLOH_LESSON_TYPE_META kalitlari
LESSON_VIDEO = "video"
LESSON_ARTICLE = "article"
LESSON_QUIZ = "quiz"
LESSON_ASSIGNMENT = "assignment"
LESSON_RESOURCE = "resource"
LESSON_TYPE_CHOICES = [
    (LESSON_VIDEO, "Video"),
    (LESSON_ARTICLE, "Maqola"),
    (LESSON_QUIZ, "Test"),
    (LESSON_ASSIGNMENT, "Topshiriq"),
    (LESSON_RESOURCE, "Resurs"),
]

# Dars ko'rinishi: `public` yoki `hidden` (js/content-store.js seed'i)
LESSON_VISIBILITY_CHOICES = [
    ("public", "Ochiq"),
    ("hidden", "Yashirin"),
]


class Category(SluggedModel):
    """Kurs turkumi. Frontend uni nom bo'yicha yuboradi ("Backend")."""

    name = models.CharField(max_length=80, unique=True)

    class Meta(SluggedModel.Meta):
        ordering = ["name"]
        verbose_name = "Turkum"
        verbose_name_plural = "Turkumlar"

    def __str__(self):
        return self.name


class Course(SluggedModel):
    """Kurs. Egasi — o'qituvchi (`apps.accounts.User`)."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="courses",
    )

    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=300, blank=True, default="")
    description = models.TextField(blank=True, default="")

    # Turkum o'chirilsa kurs qolsin — `SET_NULL`
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courses",
    )
    level = models.CharField(max_length=40, blank=True, default="Boshlang'ich")
    language = models.CharField(max_length=40, blank=True, default="O'zbek")

    # Narx — QAROR 2. `free=True` bo'lsa `price_cents` e'tiborga olinmaydi.
    #
    # Sukut bo'yicha USD, chunki o'qituvchi formasi aynan shuni so'raydi
    # ("Narxni kiriting (USD)" — pages/instructor/course-create.html) va
    # o'qituvchi tomonidagi 5 ta modul narx/daromadni `$` bilan chizadi.
    # Talaba katalogi esa so'mda ishlaydi — valyuta o'girish M9 (savdo)
    # ishi; unga qadar frontenddagi yagona koeffitsient qoladi
    # (js/course-store.js dagi ISLOH_USD_TO_UZS).
    free = models.BooleanField(default=False)
    price_cents = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=3, default="USD")

    # Ko'rinish matnlari ("12 hafta", "42 soat") — hisoblanadigan qiymat emas
    duration = models.CharField(max_length=60, blank=True, default="")
    estimate = models.CharField(max_length=60, blank=True, default="")
    prerequisites = models.TextField(blank=True, default="")

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)

    # Muqova — CSS gradienti, ikonka — bootstrap-icons nomi. Rasm yuklash
    # M5 da qo'shiladi; hozir frontend aynan shu ikki qiymatni chizadi.
    cover = models.CharField(max_length=200, blank=True, default="linear-gradient(135deg,#4ED88A,#1FAE5E)")
    icon = models.CharField(max_length=60, blank=True, default="bi-journal-bookmark-fill")

    # QAROR 4 — keyingi modullar yuritadi.
    # `rating` va `reviews_count` ni M6 yuritadi: sharh yozilgan/o'zgargan/
    # o'chgan har safar `isloh_refresh_course_rating` qayta hisoblaydi.
    # Denormalizatsiya ataylab — katalog o'nlab kursni bir so'rovda chizadi
    # va har biri uchun sharhlarni sanash N+1 so'rov berardi.
    students_count = models.PositiveIntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    revenue_cents = models.PositiveBigIntegerField(default=0)
    completion = models.PositiveSmallIntegerField(default=0)

    class Meta(SluggedModel.Meta):
        verbose_name = "Kurs"
        verbose_name_plural = "Kurslar"
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return self.title

    @property
    def lessons_count(self):
        """Darslar soni — tarkibdan hisoblanadi, qo'lda yozilmaydi.

        Ro'yxat ko'rinishlarida `annotate` bilan oldindan hisoblanadi
        (N+1 so'rov bo'lmasin); bu xossa yagona obyekt uchun zaxira.
        """
        return Lesson.objects.filter(module__course=self).count()

    @property
    def is_visible_in_catalog(self):
        settings_row = getattr(self, "settings", None)
        visibility = settings_row.visibility if settings_row else VISIBILITY_PUBLIC
        return self.status == STATUS_PUBLISHED and visibility != VISIBILITY_PRIVATE


class CourseSettings(BaseModel):
    """Nashr va SEO sozlamalari.

    Alohida jadval: bular kursning O'ZI haqida emas, uning ko'rsatilishi
    haqida. Frontenddagi forma ularni tekis maydon sifatida yuboradi
    (`data-course-field="metaTitle"`), shuning uchun serializer ularni
    kurs javobiga tekislaydi — jadval bo'linishi frontendga chiqmaydi.
    """

    course = models.OneToOneField(Course, on_delete=models.CASCADE, related_name="settings")

    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    certificate = models.BooleanField(default=True)
    meta_title = models.CharField(max_length=200, blank=True, default="")
    meta_description = models.TextField(blank=True, default="")

    class Meta(BaseModel.Meta):
        verbose_name = "Kurs sozlamasi"
        verbose_name_plural = "Kurs sozlamalari"

    def __str__(self):
        return f"{self.course.title} — sozlamalar"


class CourseTag(BaseModel):
    """Kurs teglari. Alohida jadval — reja §M2.

    Bitta matn maydonida vergul bilan saqlash qidiruv va filtrni
    imkonsiz qilardi; teg bo'yicha katalog filtri M2 dan keyin keladi.
    """

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="tags")
    name = models.CharField(max_length=60)
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]
        constraints = [
            models.UniqueConstraint(fields=["course", "name"], name="uniq_course_tag"),
        ]

    def __str__(self):
        return self.name


class CourseModule(BaseModel):
    """Kurs moduli — darslar to'plami.

    `position` — js/sortable.js tortib ko'chirgandan keyin yuboradigan
    tartib. `ordering` shu maydon bo'yicha, ya'ni ro'yxat har doim
    o'qituvchi qo'ygan tartibda keladi.
    """

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=200, default="Yangi modul")
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]
        verbose_name = "Modul"
        verbose_name_plural = "Modullar"

    def __str__(self):
        return self.title


class Lesson(BaseModel):
    """Dars. Videosi M5 da qo'shildi; matnli mazmun hali metama'lumot."""

    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200, default="Yangi dars")
    type = models.CharField(max_length=16, choices=LESSON_TYPE_CHOICES, default=LESSON_VIDEO)
    # "8 daq", "—" — ko'rinish matni; haqiqiy davomiylik videodan keladi
    duration = models.CharField(max_length=40, blank=True, default="—")

    # M5 — dars videosi. Satrli havola ATAYLAB: `apps.resources`
    # `apps.courses` ga tayanadi (Resource -> Course), teskari import
    # aylanma bo'lardi. Fayl o'chirilsa dars qolsin — `SET_NULL`.
    video_file = models.ForeignKey(
        "resources.File",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lessons",
    )
    visibility = models.CharField(max_length=16, choices=LESSON_VISIBILITY_CHOICES, default="public")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]
        verbose_name = "Dars"
        verbose_name_plural = "Darslar"

    def __str__(self):
        return self.title
