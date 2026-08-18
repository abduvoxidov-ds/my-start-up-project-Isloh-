"""
ISLOH — bildirishnomalar (M7).

Bu modulning O'Z voqeasi yo'q. Hamma narsa boshqa modullardan keladi:
yangi yozilish (M3), topshiriq topshirildi va baholandi (M4), sharh va
muhokama javobi (M6), to'lov o'tdi (M9). Shu sababli modelning o'zi
ataylab sodda, butun mantiq esa `apps/notifications/events.py` da —
"qaysi voqea kimga boradi" degan savol BITTA joyda turadi.

--- ROL MAYDONI NEGA BOR ---------------------------------------------------

Frontenddagi do'kon allaqachon rol bo'yicha ajratilgan
(js/notification-store.js: `role` maydoni, sahifa faqat o'zinikini
so'raydi). Sabab M1 dagi qaror bilan bir xil: bitta odam ham talaba, ham
o'qituvchi bo'lishi mumkin. Bunday odam kursiga yozilgan talaba haqidagi
xabarni O'QITUVCHI ro'yxatida ko'rishi kerak, o'zi kurs sotib olgani
haqidagi xabarni esa TALABA ro'yxatida — aks holda ikkala oqim aralashib,
ikkalasi ham o'qib bo'lmas holga kelardi.

--- `read_at`, `read` EMAS -------------------------------------------------

Vaqt belgisi saqlanadi, mantiqiy bayroq emas: "qachon o'qidi" savoli
keyinchalik kerak bo'ladi (M11 analitikasi, eslatma yuborish), teskarisiga
esa bayroqdan vaqtni tiklab bo'lmaydi. Frontend baribir `read` deb
mantiqiy qiymat oladi — o'girish serializerda.
"""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel
from apps.courses.models import Course

# js/notification-store.js dagi ISLOH_NOTIF_TYPES kalitlari — tur ikonka va
# rangni belgilaydi, ya'ni yangi tur qo'shilsa frontendga ham qo'shiladi
TYPE_ENROLLMENT = "enrollment"
TYPE_SUBMISSION = "submission"
TYPE_PAYMENT = "payment"
TYPE_REVIEW = "review"
TYPE_COURSE = "course"
TYPE_MESSAGE = "message"
TYPE_SYSTEM = "system"

TYPE_CHOICES = [
    (TYPE_ENROLLMENT, "Yozilish"),
    (TYPE_SUBMISSION, "Topshiriq"),
    (TYPE_PAYMENT, "To'lov"),
    (TYPE_REVIEW, "Sharh"),
    (TYPE_COURSE, "Kurs"),
    (TYPE_MESSAGE, "Xabar"),
    (TYPE_SYSTEM, "Tizim"),
]

ROLE_CHOICES = [
    ("student", "Talaba"),
    ("instructor", "O'qituvchi"),
    ("admin", "Administrator"),
]


class Notification(BaseModel):
    """Bitta bildirishnoma.

    `href` — SAHIFAGA NISBIY havola (`students.html`), to'liq manzil emas.
    Frontend uni o'z rol papkasi ichida ochadi va bu shartnoma M7 dan
    oldin ham shunday edi (js/notification-store.js).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    # Qaysi oqimga tushadi (yuqoridagi izohga qarang)
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default="student")
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, default=TYPE_SYSTEM)

    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    href = models.CharField(max_length=200, blank=True, default="")

    # Voqeani KIM boshlagani — "Sardor kursga yozildi" dagi Sardor.
    # Hisob o'chirilsa bildirishnoma qolsin: `SET_NULL`.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications"
    )

    read_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        indexes = [
            # Ro'yxat HAR DOIM (user, role) bo'yicha so'raladi va vaqt
            # bo'yicha tartiblanadi — indeks aynan shu so'rov uchun
            models.Index(fields=["user", "role", "-created_at"]),
        ]
        verbose_name = "Bildirishnoma"
        verbose_name_plural = "Bildirishnomalar"

    def __str__(self):
        return f"{self.user.email}: {self.title}"

    @property
    def read(self):
        return self.read_at is not None
