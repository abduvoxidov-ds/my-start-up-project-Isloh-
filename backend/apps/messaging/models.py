"""
ISLOH — xabarlar (M8).

Frontenddagi model ALLAQACHON to'g'ri edi va u shu yerda takrorlanadi:
js/chat-store.js dagi suhbat `members[]` ro'yxatiga ega, "men" esa rolga
qarab aniqlanadigan HAQIQIY foydalanuvchi. Ya'ni bitta suhbat ikki
tomondan ko'rinadi. Serverda ham xuddi shunday: `ChatThread` — grafning
tuguni, `ChatMember` — unga ulangan odam.

--- NEGA `ChatMember` ALOHIDA JADVAL --------------------------------------

Uchta maydon SUHBATGA emas, ODAMGA tegishli:

    unread_count   — o'qituvchida 3 ta o'qilmagan, talabada 0 ta
    archived       — men arxivladim, suhbatdoshim uchun u faol qolaveradi
    muted          — ovoz mening qurilmamda o'chadi

Frontendda ular thread maydoni bo'lib ko'rinadi (`thread.archived`), lekin
bu KO'RINISH: serializer JORIY foydalanuvchining a'zoligidan o'qiydi.
localStorage'dagi eski shakl (`unread: { [userId]: n }`) ham aslida shu —
faqat bitta hujjatga siqilgan holda.

--- NEGA DENORMALLASHTIRILGAN `last_message` -------------------------------

Suhbatlar ro'yxati har bir qatorda oxirgi xabarni ko'rsatadi. Uni har
so'rovda hisoblash — ro'yxatdagi har bir suhbat uchun alohida so'rov
(N+1), ya'ni 20 ta suhbat = 21 ta so'rov. `Course.rating` (M6) bilan bir
xil qaror: qiymat YOZISHDA yangilanadi, o'qishda emas.

--- `unique_key` -----------------------------------------------------------

Ikki xil takrorlanishning oldini oladi va IKKALASI HAM bitta ustunda:

    direct    "a1b2...:c3d4..."      ← ikki id, saralangan holda
    guruh     "course:<kurs id>"     ← kursga bitta guruh

Saralash muhim: A→B va B→A bir xil kalitni berishi kerak. Ustun `null`
bo'la oladi (kelajakdagi nomsiz guruhlar uchun), chunki PostgreSQL'da
`NULL` qiymatlar noyoblik tekshiruviga tushmaydi.
"""

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel
from apps.courses.models import Course

# Frontenddagi `thread.type` qiymatlari (js/chat-store.js)
THREAD_DIRECT = "direct"
THREAD_GROUP = "group"

THREAD_TYPE_CHOICES = [
    (THREAD_DIRECT, "Shaxsiy"),
    (THREAD_GROUP, "Guruh"),
]

# Holat nomlari js/chat-store.js dagi ISLOH_CHAT_PRESENCE_LABEL bilan bir xil
PRESENCE_ONLINE = "online"
PRESENCE_BUSY = "busy"
PRESENCE_OFFLINE = "offline"

PRESENCE_CHOICES = [
    (PRESENCE_ONLINE, "Onlayn"),
    (PRESENCE_BUSY, "Band"),
    (PRESENCE_OFFLINE, "Oflayn"),
]

# Xabar uzunligi chegarasi. Chat — qisqa yozishmalar joyi; uzun matn
# muhokamaga (M6) tegishli va u yerda alohida chegara bor.
ISLOH_MESSAGE_MAX = 4000


def isloh_direct_key(user_a_id, user_b_id):
    """Ikki odam uchun O'ZGARMAS kalit (kim birinchi yozganidan qat'i nazar)."""
    return ":".join(sorted([str(user_a_id), str(user_b_id)]))


def isloh_course_group_key(course_id):
    return f"course:{course_id}"


class ChatThread(BaseModel):
    """Suhbat: 1-ga-1 yoki kurs guruhi."""

    type = models.CharField(max_length=16, choices=THREAD_TYPE_CHOICES, default=THREAD_DIRECT)

    # `direct` suhbatda nom yo'q — u suhbatdoshdan olinadi
    # (js/chat-store.js: isloh_chatThreadTitle). Guruhda esa o'z nomi bor.
    title = models.CharField(max_length=120, blank=True, default="")
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, null=True, blank=True, related_name="chat_threads"
    )

    # Guruh tepasidagi qadalgan e'lon (o'qituvchi qo'yadi). SUHBATGA
    # tegishli, a'zoga emas: hamma bir xil e'lonni ko'rishi kerak.
    pinned_note = models.CharField(max_length=200, blank=True, default="")

    # Ro'yxat uchun denormallashtirilgan qiymatlar (yuqoridagi izoh)
    last_message = models.CharField(max_length=200, blank=True, default="")
    last_sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    last_message_at = models.DateTimeField(null=True, blank=True)

    unique_key = models.CharField(max_length=100, unique=True, null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ["-last_message_at", "-created_at"]
        verbose_name = "Suhbat"
        verbose_name_plural = "Suhbatlar"

    def __str__(self):
        return self.title or f"{self.type} {self.pk}"


class ChatMember(BaseModel):
    """Odamning suhbatdagi a'zoligi va SHAXSIY holati."""

    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_memberships"
    )

    unread_count = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)
    muted = models.BooleanField(default=False)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        constraints = [
            # Bir odam bir suhbatda bir marta
            models.UniqueConstraint(fields=["thread", "user"], name="chat_member_unique"),
        ]
        indexes = [
            # "Mening suhbatlarim" — modulning eng ko'p so'raladigan so'rovi
            models.Index(fields=["user", "archived"]),
        ]
        verbose_name = "Suhbat a'zosi"
        verbose_name_plural = "Suhbat a'zolari"

    def __str__(self):
        return f"{self.user.email} @ {self.thread_id}"


class ChatMessage(BaseModel):
    """Bitta xabar.

    `sender` — `SET_NULL`: hisob o'chirilsa yozishma buzilmasin, faqat
    muallif "noma'lum" bo'lib qolsin (M7 dagi `actor` bilan bir xil qaror).
    """

    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
    )
    text = models.TextField()

    class Meta(BaseModel.Meta):
        # Kursor sahifalash aynan shu tartibda o'qiydi (views.py) — `id`
        # ikkinchi kalit sifatida turadi, chunki bir mikrosoniyada
        # yozilgan ikki xabar aks holda sahifa chegarasida yo'qolardi.
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["thread", "-created_at"]),
        ]
        verbose_name = "Xabar"
        verbose_name_plural = "Xabarlar"

    def __str__(self):
        return f"{self.thread_id}: {self.text[:40]}"


class Presence(BaseModel):
    """Kim hozir onlayn.

    NEGA `last_seen_at` HAM SAQLANADI: ulanish har doim ham to'g'ri
    uzilmaydi (brauzer yopiladi, tarmoq uziladi, server qayta ishga
    tushadi) va bunday holatda `status` "online" bo'lib QOLIB KETADI.
    Shuning uchun holat vaqt bilan birga o'qiladi: `ISLOH_PRESENCE_TTL`
    dan eski yozuv oflayn hisoblanadi (serializers.py).

    Bu jadval `apps.messaging` da, `apps.accounts` da emas: onlayn holat —
    chat xususiyati, va uni `User` ga qo'shish har bir foydalanuvchi
    yozuviga chat mantiqini olib kirardi.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="presence"
    )
    status = models.CharField(max_length=16, choices=PRESENCE_CHOICES, default=PRESENCE_OFFLINE)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    # Bir odam bir nechta tabda ochishi mumkin — oxirgi tab yopilgandagina
    # oflayn bo'ladi
    connections = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        verbose_name = "Onlayn holat"
        verbose_name_plural = "Onlayn holatlar"

    def __str__(self):
        return f"{self.user.email}: {self.status}"
