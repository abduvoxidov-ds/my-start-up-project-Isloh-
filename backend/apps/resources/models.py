"""
ISLOH — fayllar va resurslar (M5).

IKKI TUSHUNCHA, ataylab ajratilgan:

  `File`     — SAQLANGAN BAYTLAR haqidagi yozuv: nomi, MIME turi, hajmi,
               saqlashdagi kaliti va holati. U o'zi hech qayerga tegishli
               emas — avatar ham, dars videosi ham, topshiriq fayli ham
               bir xil `File`.
  `Resource` — o'qituvchining KURS KUTUBXONASIDAGI yozuv (papka, turkum,
               sevimli, arxiv). Uning ichida fayl bo'lishi ham, bo'lmasligi
               ham mumkin: `type="url"` da resurs — tashqi havola, ya'ni
               hech qanday bayt saqlanmagan.

NEGA AJRATILDI: agar kutubxona yozuvi baytlar bilan bitta jadvalda bo'lsa,
avatar va topshiriq fayli ham "resurs" bo'lib qolardi va papka/turkum kabi
umuman aloqasi yo'q maydonlarni ko'tarib yurardi. Teskarisi ham: bitta
faylni ikki resursda ishlatib bo'lmasdi (nusxalash aynan shunga tayanadi).

--- YUKLASH OQIMI (uch qadam) ----------------------------------------------

    1. POST /uploads/presign        -> `File` (status=pending) + upload_url
    2. PUT  <upload_url>            -> baytlar SAQLASHGA boradi
    3. POST /uploads/{id}/complete  -> status=ready, download_url beriladi

Fayl Django'ning so'rov siklidan O'TMAYDI (reja M5: "imzolangan URL orqali
to'g'ridan-to'g'ri yuklash"). Muhitda S3 yo'q, shuning uchun 2-qadamni
mahalliy backend qabul qiladi — LEKIN SHARTNOMA BIR XIL: imzolangan,
muddatli URL ga oddiy `PUT`. S3 ga o'tish `ISLOH_STORAGE_BACKEND`
sozlamasini almashtirish bilan cheklanadi, endpoint'lar ham, frontend ham
o'zgarmaydi (apps/resources/storage.py).

`pending` holat MAJBURIY: 1-qadam yozuv yaratadi, lekin baytlar hali yo'q.
Tugallanmagan yuklash hech qayerda ko'rinmasligi kerak, aks holda
kutubxonada ochib bo'lmaydigan fayl qatori paydo bo'lardi.
"""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel
from apps.courses.models import Course

# --- Fayl maqsadi ----------------------------------------------------------
# Maqsad IKKI narsani belgilaydi: yuklashdagi CHEGARA (hajm, MIME) va
# yuklab olishdagi RUXSAT. Shuning uchun u faylning o'zida saqlanadi va
# keyin o'zgartirilmaydi.

PURPOSE_AVATAR = "avatar"
PURPOSE_RESOURCE = "resource"
PURPOSE_LESSON_VIDEO = "lesson_video"
PURPOSE_SUBMISSION = "submission"

PURPOSE_CHOICES = [
    (PURPOSE_AVATAR, "Profil rasmi"),
    (PURPOSE_RESOURCE, "Kurs resursi"),
    (PURPOSE_LESSON_VIDEO, "Dars videosi"),
    (PURPOSE_SUBMISSION, "Topshiriq fayli"),
]


class File(BaseModel):
    """Saqlangan fayl metama'lumoti.

    `storage_key` — saqlashdagi yo'l. U SERVER tomonidan yasaladi va
    mijozdan hech qachon qabul qilinmaydi: aks holda `../` bilan boshqa
    faylni qayta yozish yoki o'qish mumkin bo'lardi.
    """

    STATUS_PENDING = "pending"
    STATUS_READY = "ready"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Yuklanmoqda"),
        (STATUS_READY, "Tayyor"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="files"
    )
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default=PURPOSE_RESOURCE)

    # Foydalanuvchi ko'radigan nom — yuklab olishda shu qaytariladi
    name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120, blank=True, default="")
    size_bytes = models.PositiveBigIntegerField(default=0)

    storage_key = models.CharField(max_length=300, unique=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Fayl"
        verbose_name_plural = "Fayllar"
        indexes = [models.Index(fields=["owner", "purpose", "status"])]

    def __str__(self):
        return self.name

    @property
    def size_kb(self):
        """Frontend hajmni KB da butun son sifatida saqlaydi
        (js/resource-store.js). 0 KB ko'rinmasin — eng kichigi 1 KB."""
        if not self.size_bytes:
            return 0
        return max(1, round(self.size_bytes / 1024))


# --- Kutubxona -------------------------------------------------------------

# js/resource-store.js dagi ISLOH_RESOURCE_TYPE_META kalitlari
RESOURCE_TYPE_CHOICES = [
    ("pdf", "PDF"),
    ("zip", "ZIP"),
    ("video", "Video"),
    ("audio", "Audio"),
    ("image", "Rasm"),
    ("presentation", "Taqdimot"),
    ("spreadsheet", "Jadval"),
    ("document", "Hujjat"),
    ("code", "Kod"),
    ("url", "Tashqi havola"),
]

# ISLOH_RESOURCE_FOLDERS kalitlari
FOLDER_CHOICES = [
    ("lessons", "Dars resurslari"),
    ("assignments", "Topshiriq resurslari"),
    ("quizzes", "Test resurslari"),
    ("general", "Umumiy kurs resurslari"),
]


class Resource(BaseModel):
    """Kurs kutubxonasidagi yozuv.

    `size_kb` DENORMALIZATSIYA: uni `file.size_bytes` dan hisoblash mumkin
    edi, lekin tashqi havolada fayl umuman yo'q va kutubxona statistikasi
    (umumiy hajm) butun ro'yxat bo'yicha yig'indi oladi — har qator uchun
    bog'lanishga borish keraksiz. Qiymatni SERVER qo'yadi (serializer
    `read_only`), ya'ni u fayl bilan hech qachon ziddiyatga tushmaydi.
    """

    STATUS_ACTIVE = "active"
    STATUS_ARCHIVED = "archived"
    STATUS_CHOICES = [(STATUS_ACTIVE, "Faol"), (STATUS_ARCHIVED, "Arxiv")]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resources"
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="resources")

    # Fayl o'chirilsa resurs qatori qolsin va "fayli yo'q" bo'lib ko'rinsin —
    # jimgina yo'qolgan qatordan ko'ra tushunarli
    file = models.ForeignKey(
        File, on_delete=models.SET_NULL, null=True, blank=True, related_name="resources"
    )

    name = models.CharField(max_length=255)
    type = models.CharField(max_length=16, choices=RESOURCE_TYPE_CHOICES, default="document")
    folder = models.CharField(max_length=20, choices=FOLDER_CHOICES, default="general")
    category = models.CharField(max_length=60, blank=True, default="umumiy")

    size_kb = models.PositiveIntegerField(default=0)
    # Faqat `type="url"` da to'ladi
    url = models.URLField(blank=True, default="")

    favorite = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    # "Oxirgi ishlatilgan" ro'yxati shu maydondan (kutubxona sahifasi)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Resurs"
        verbose_name_plural = "Resurslar"
        indexes = [models.Index(fields=["course", "status"])]

    def __str__(self):
        return self.name
