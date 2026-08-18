"""
ISLOH — sharhlar va muhokamalar (M6).

IKKI TUSHUNCHA, ataylab ajratilgan:

  `Review`           — kursga qo'yilgan BAHO. Bitta talaba bitta kursga bir
                       marta yozadi va uni o'zgartirishi mumkin. Kurs
                       reytingi shundan hisoblanadi.
  `DiscussionThread` — kurs ichidagi SUHBAT. Bir odam istagancha mavzu
                       ochadi, javoblar ichma-ich bo'ladi.

Ular birlashtirilmadi, chunki qoidalari qarama-qarshi: sharh yagona va
reytingga ta'sir qiladi, mavzu esa cheksiz va reytingga umuman aloqasi
yo'q. Bitta jadvalda ikkalasining ham qoidasi buzilardi.

--- KURS REYTINGI DENORMALIZATSIYA QILINADI ---------------------------------

`Course.rating` va `Course.reviews_count` sharh yozilgan/o'zgargan/o'chgan
har safar QAYTA HISOBLANADI (`isloh_refresh_course_rating`). Sabab M3 dagi
`Enrollment.progress` bilan bir xil: katalog sahifasi o'nlab kursni bir
so'rovda chizadi va har biri uchun sharhlarni sanash N+1 so'rov berardi.

--- MATN ---------------------------------------------------------------------

Foydalanuvchi matni `apps/social/sanitize.py` orqali o'tadi (teglarsiz
saqlanadi), chizishda esa frontend uni `isloh_escapeHtml` bilan ekranlaydi.
Qaysi qatlam nima uchun javob berishi o'sha faylda yozilgan.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count

from apps.core.models import BaseModel
from apps.courses.models import Course, CourseModule


class Review(BaseModel):
    """Kursga sharh. Bitta talaba — bitta sharh (`UNIQUE(course, user)`).

    Sharh FAQAT kursga yozilgan talabadan qabul qilinadi; tekshiruv
    ko'rinishda (apps/social/views.py), chunki u `Enrollment` ga tayanadi
    va model qatlami `apps.learning` ga bog'lanib qolmasligi kerak.
    """

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )

    rating = models.PositiveSmallIntegerField(
        default=5, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    text = models.TextField(blank=True, default="")

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["course", "user"], name="uniq_course_review"),
        ]
        indexes = [models.Index(fields=["course", "-created_at"])]
        verbose_name = "Sharh"
        verbose_name_plural = "Sharhlar"

    def __str__(self):
        return f"{self.user.email} → {self.course.title} ({self.rating})"


class ReviewReply(BaseModel):
    """O'qituvchining sharhga javobi.

    `OneToOne`: frontenddagi shakl ham shunday edi
    (`isloh_review_replies = { "<sharh-id>": "javob" }`) va sahifada bitta
    javob bloki chiziladi. Ko'p javob kerak bo'lsa u muhokama, sharh emas.
    """

    review = models.OneToOneField(Review, on_delete=models.CASCADE, related_name="reply")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="review_replies"
    )
    text = models.TextField()

    class Meta(BaseModel.Meta):
        verbose_name = "Sharhga javob"
        verbose_name_plural = "Sharhga javoblar"


def isloh_refresh_course_rating(course):
    """Kursning reytingi va sharhlar sonini qayta hisoblaydi.

    `update()` ishlatiladi, `save()` emas: kursning boshqa maydonlariga
    tegilmasin va `updated_at` sharh tufayli o'zgarib ketmasin (o'qituvchi
    kursni tahrirlamagan).
    """
    stats = Review.objects.filter(course=course).aggregate(
        average=Avg("rating"), total=Count("id")
    )
    Course.objects.filter(pk=course.pk).update(
        rating=round(stats["average"] or 0, 2),
        reviews_count=stats["total"] or 0,
    )


# --- Muhokamalar -----------------------------------------------------------

# Frontenddagi ikki tab: "Muhokama" va "Savol-Javob"
# (pages/student/discussions.html)
KIND_DISCUSSION = "discussion"
KIND_QA = "qa"
KIND_CHOICES = [(KIND_DISCUSSION, "Muhokama"), (KIND_QA, "Savol-Javob")]


class DiscussionThread(BaseModel):
    """Kurs ichidagi mavzu yoki savol."""

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="threads")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="threads"
    )
    # Mavzu qaysi modulga tegishli ("1-modul: Kirish" yorlig'i). Modul
    # o'chirilsa mavzu qolsin — `SET_NULL`
    module = models.ForeignKey(
        CourseModule, on_delete=models.SET_NULL, null=True, blank=True, related_name="threads"
    )

    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=KIND_DISCUSSION)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    # Savol-Javob tabidagi chiplar ("docker", "compose", "deploy") — erkin
    # satr, chunki ular kursga qarab o'zgaradi va alohida jadval talab
    # qilmaydi
    category = models.CharField(max_length=60, blank=True, default="")

    is_pinned = models.BooleanField(default=False)
    is_solved = models.BooleanField(default=False)

    class Meta(BaseModel.Meta):
        # Qadalgan mavzu doim tepada — frontend uni alohida saralamaydi
        ordering = ["-is_pinned", "-created_at"]
        indexes = [models.Index(fields=["course", "kind", "-created_at"])]
        verbose_name = "Mavzu"
        verbose_name_plural = "Mavzular"

    def __str__(self):
        return self.title


class DiscussionReply(BaseModel):
    """Mavzuga javob. `parent` bo'lsa — javobga javob (ichma-ich).

    Chuqurlik CHEKLANGAN: `parent` ning o'zi `parent` ga ega bo'lsa, yangi
    javob uning OTASIGA biriktiriladi (apps/social/views.py). Frontend ikki
    darajani chizadi (`.comment-card` va `.comment-card.nested`), uchinchi
    daraja esa sahifadan chiqib ketardi.
    """

    thread = models.ForeignKey(DiscussionThread, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="discussion_replies"
    )
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )

    text = models.TextField()
    # Savol-Javobda "Qabul qilingan javob" — mavzuda bittadan ortiq
    # bo'lmaydi (ko'rinish yangisini qo'yishda eskisini bo'shatadi)
    is_accepted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)

    class Meta(BaseModel.Meta):
        ordering = ["created_at"]
        indexes = [models.Index(fields=["thread", "created_at"])]
        verbose_name = "Javob"
        verbose_name_plural = "Javoblar"


class Reaction(BaseModel):
    """Yoqtirish. Mavzuga YOKI javobga qo'yiladi.

    NEGA `GenericForeignKey` EMAS: `contenttypes` bilan har bir sanoq
    qo'shimcha JOIN va indekssiz filtr beradi, ikkita nullable FK esa
    oddiy indeksga tushadi. Ikkalasi birdan to'lib qolmasligini baza
    darajasidagi cheklov qo'riqlaydi — ya'ni buni ko'rinishda unutib
    bo'lmaydi.

    `UNIQUE` — bir odam bir marta: ilgari like soni `textContent` dan
    o'qilardi va tugmani ikki marta bosish sanoqni ikki marta oshirardi
    (js/discussion.js).
    """

    KIND_LIKE = "like"
    KIND_CHOICES = [(KIND_LIKE, "Yoqtirish")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reactions"
    )
    thread = models.ForeignKey(
        DiscussionThread, on_delete=models.CASCADE, null=True, blank=True, related_name="reactions"
    )
    reply = models.ForeignKey(
        DiscussionReply, on_delete=models.CASCADE, null=True, blank=True, related_name="reactions"
    )
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=KIND_LIKE)

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["user", "thread"],
                condition=models.Q(thread__isnull=False),
                name="uniq_thread_reaction",
            ),
            models.UniqueConstraint(
                fields=["user", "reply"],
                condition=models.Q(reply__isnull=False),
                name="uniq_reply_reaction",
            ),
            models.CheckConstraint(
                # Aynan bittasi to'ldiriladi
                condition=models.Q(thread__isnull=False, reply__isnull=True)
                | models.Q(thread__isnull=True, reply__isnull=False),
                name="reaction_has_single_target",
            ),
        ]
        verbose_name = "Reaksiya"
        verbose_name_plural = "Reaksiyalar"
