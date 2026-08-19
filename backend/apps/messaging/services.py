"""
ISLOH — chat amallari (M8).

Ko'rinishlar (views.py) va WebSocket iste'molchisi (consumers.py) BIR XIL
amallarni bajaradi: suhbat ochish, xabar yuborish, o'qilgan deb belgilash.
Agar mantiq ikkalasida takrorlansa, ular vaqt o'tishi bilan farq qila
boshlardi — masalan REST orqali yuborilgan xabar o'qilmaganlar sonini
oshirar, WebSocket orqali yuborilgani esa oshirmasdi. Shuning uchun butun
mantiq shu faylda, ikkala kirish nuqtasi esa faqat chaqiradi.
"""

from django.db import transaction
from django.db.models import F, Prefetch, Q
from django.utils import timezone

from apps.accounts.models import ROLE_ADMIN, User
from apps.core.sanitize import isloh_clean_text
from apps.courses.models import Course
from apps.learning.models import Enrollment

from .models import (
    ISLOH_MESSAGE_MAX,
    THREAD_DIRECT,
    THREAD_GROUP,
    ChatMember,
    ChatMessage,
    ChatThread,
    isloh_course_group_key,
    isloh_direct_key,
)

# Katalog cheksiz o'smasin: chat kontaktlari ro'yxati, foydalanuvchi
# ma'lumotlar bazasi emas. Qidiruv (`?q=`) serverda bajariladi.
ISLOH_CONTACT_LIMIT = 200

# Ro'yxatdagi oxirgi xabar qisqartiriladi — model maydoni 200 belgi
ISLOH_PREVIEW_MAX = 200


# --- O'qish ------------------------------------------------------------------


def isloh_my_threads(user):
    """Foydalanuvchining barcha suhbatlari, a'zolari bilan birga.

    ARXIV HAM QAYTADI: frontend uni o'zi filtrlaydi (`isloh_chatThreads`
    dagi `archived` filtri) va "Arxiv" tab'i ikkinchi so'rov yubormaydi.
    """
    return (
        ChatThread.objects.filter(members__user=user)
        .distinct()
        .select_related("last_sender")
        .prefetch_related(Prefetch("members", queryset=ChatMember.objects.only(
            "thread_id", "user_id", "unread_count", "archived", "muted"
        )))
    )


def isloh_member_or_none(thread_id, user):
    return ChatMember.objects.filter(thread_id=thread_id, user=user).select_related("thread").first()


def isloh_contact_ids(user):
    """Kim bilan yozishish mumkin — faqat ID'lar to'plami.

    Uch manba birlashadi — va uchalasi ham MAVJUD ALOQAGA tayanadi, ya'ni
    platformadagi hamma odam bir-birini ko'rmaydi:

      1. Suhbatlarimdagi odamlar — ismlarni chizish uchun MAJBURIY:
         katalogda bo'lmasa ro'yxatda "Noma'lum foydalanuvchi" chiqardi.
      2. O'quv aloqasi — o'qituvchi o'z talabalarini, talaba esa o'zi
         yozilgan kurs egalarini ko'radi.
      3. Administratorlar — qo'llab-quvvatlash xizmati sifatida hammaga
         ochiq (frontendda ular "Isloh Support" deb ko'rinadi).

    ID'lar ALOHIDA qaytariladi, chunki ikki chaqiruvchining ehtiyoji har
    xil: katalog ro'yxatni CHEKLAB oladi (`[:LIMIT]`), ruxsat tekshiruvi
    esa aynan bitta odamni qidiradi — cheklangan so'rovni yana filtrlab
    bo'lmaydi ("Cannot filter a query once a slice has been taken").
    """
    ids = set(
        ChatMember.objects.filter(thread__members__user=user).values_list("user_id", flat=True)
    )
    # O'zim ham katalogda bo'laman: frontend "men kimman" degan savolga
    # shu ro'yxatdan javob topadi (isloh_chatMe)
    ids.add(user.id)

    # O'qituvchi -> o'z kurslarining talabalari
    ids.update(
        Enrollment.objects.filter(course__owner=user).values_list("user_id", flat=True)
    )
    # Talaba -> yozilgan kurslarining egalari
    ids.update(
        Course.objects.filter(enrollments__user=user).values_list("owner_id", flat=True)
    )
    # Qo'llab-quvvatlash
    ids.update(User.objects.filter(roles__role=ROLE_ADMIN).values_list("id", flat=True))
    return ids


def isloh_contacts(user, query=""):
    """Katalog — chizish uchun tayyor ro'yxat."""
    rows = User.objects.filter(
        id__in=isloh_contact_ids(user), status=User.STATUS_ACTIVE
    ).select_related("presence")
    if query:
        rows = rows.filter(Q(full_name__icontains=query) | Q(email__icontains=query))
    return rows.order_by("full_name")[:ISLOH_CONTACT_LIMIT]


def isloh_can_message(user, other):
    """Begona odamga yozish mumkin emas.

    Chat ochiq katalog emas: aks holda platformadagi istalgan odam
    istalgan odamga yozib, spam kanaliga aylanardi. Ruxsat katalog bilan
    BIR XIL qoidaga tayanadi — u yerda ko'ringan odamga yozish mumkin.
    """
    if other.id == user.id:
        return False
    if other.status != User.STATUS_ACTIVE:
        return False
    return other.id in isloh_contact_ids(user)


# --- Suhbat ochish -----------------------------------------------------------


def isloh_open_direct(user, other):
    """1-ga-1 suhbatni ochadi, bo'lmasa yaratadi.

    `unique_key` tufayli ikki tomon bir vaqtda bosgan taqdirda ham ikki
    nusxa yaratilmaydi: ikkinchisi `get_or_create` da mavjudini topadi.
    """
    key = isloh_direct_key(user.id, other.id)
    thread, created = ChatThread.objects.get_or_create(
        unique_key=key, defaults={"type": THREAD_DIRECT}
    )
    if created:
        ChatMember.objects.bulk_create(
            [ChatMember(thread=thread, user=user), ChatMember(thread=thread, user=other)]
        )
    else:
        # Suhbat bor edi, lekin a'zolik yo'q bo'lishi mumkin emas —
        # baribir tekshiriladi (ma'lumot yaxlitligi)
        for member in (user, other):
            ChatMember.objects.get_or_create(thread=thread, user=member)
    return thread


def isloh_open_course_group(user, course):
    """Kurs guruhini ochadi va A'ZOLARNI SINXRONLAYDI.

    Sinxronlash har ochishda bajariladi, chunki guruh yaratilgandan keyin
    ham kursga yangi talabalar yoziladi. Muqobil yo'l — M7 dagidek
    `apps.learning` dan voqea chaqirish edi, lekin unda yozilish oqimi
    chatga bog'lanib qolardi; bu yerda esa bog'liqlik bir tomonlama.
    """
    thread, _ = ChatThread.objects.get_or_create(
        unique_key=isloh_course_group_key(course.id),
        defaults={
            "type": THREAD_GROUP,
            "title": course.title,
            "course": course,
        },
    )

    wanted = set(
        Enrollment.objects.filter(course=course).values_list("user_id", flat=True)
    )
    wanted.add(course.owner_id)

    existing = set(ChatMember.objects.filter(thread=thread).values_list("user_id", flat=True))
    missing = wanted - existing
    if missing:
        ChatMember.objects.bulk_create(
            [ChatMember(thread=thread, user_id=uid) for uid in missing]
        )

    # Kursdan chiqqan odam guruhda qolmasin
    extra = existing - wanted
    if extra:
        ChatMember.objects.filter(thread=thread, user_id__in=extra).delete()

    return thread


def isloh_can_open_course_group(user, course):
    """Guruhga kurs EGASI va YOZILGAN talabalar kira oladi."""
    if course.owner_id == user.id:
        return True
    return Enrollment.objects.filter(course=course, user=user).exists()


# --- Yozish ------------------------------------------------------------------


def isloh_send_message(thread, sender, text):
    """Xabar yozadi va suhbatni yangilaydi. Qaytaradi: `ChatMessage`.

    Uch ish BITTA tranzaksiyada bo'lishi shart (`ATOMIC_REQUESTS` so'rov
    yo'lida buni ta'minlaydi, WebSocket yo'lida esa — shu dekorator):

      1. xabarning o'zi
      2. suhbatdagi "oxirgi xabar" (ro'yxat shundan chiziladi)
      3. BOSHQA a'zolarning o'qilmaganlar hisoblagichi

    Ikkinchisisiz ro'yxat eski matnni ko'rsatardi, uchinchisisiz esa
    suhbatdosh yangi xabar kelganini umuman bilmasdi.
    """
    clean = isloh_clean_text(text, ISLOH_MESSAGE_MAX)
    if not clean:
        return None

    with transaction.atomic():
        message = ChatMessage.objects.create(thread=thread, sender=sender, text=clean)

        thread.last_message = clean[:ISLOH_PREVIEW_MAX]
        thread.last_sender = sender
        thread.last_message_at = message.created_at
        thread.save(update_fields=["last_message", "last_sender", "last_message_at", "updated_at"])

        # Qolganlarda o'qilmagan +1 — SQL darajasida, o'qib-yozmasdan:
        # ikki xabar bir vaqtda kelsa hisoblagich yo'qolmasin
        ChatMember.objects.filter(thread=thread).exclude(user=sender).update(
            unread_count=F("unread_count") + 1
        )
        # Yozgan odam suhbatni o'qigan hisoblanadi
        ChatMember.objects.filter(thread=thread, user=sender).update(
            unread_count=0, last_read_at=timezone.now()
        )

    return message


def isloh_mark_read(thread, user):
    """O'qilmaganlar hisoblagichini nolga tushiradi."""
    return ChatMember.objects.filter(thread=thread, user=user).update(
        unread_count=0, last_read_at=timezone.now()
    )


def isloh_unread_total(user):
    """Yon menyudagi nishon uchun — arxivlanganlar hisobga olinmaydi."""
    total = 0
    for count in ChatMember.objects.filter(user=user, archived=False).values_list(
        "unread_count", flat=True
    ):
        total += count
    return total


def isloh_can_pin(user, thread):
    """E'lonni faqat kurs egasi (yoki xodim) qo'yadi.

    E'lon butun guruhga ko'rinadi, ya'ni u SUHBATNI o'zgartiradi —
    shuning uchun uni har bir a'zo emas, o'qituvchi boshqaradi.
    """
    if thread.type != THREAD_GROUP:
        return False
    if user.is_staff or user.has_role(ROLE_ADMIN):
        return True
    return bool(thread.course_id and thread.course.owner_id == user.id)
