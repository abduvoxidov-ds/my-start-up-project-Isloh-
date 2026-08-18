"""
ISLOH — voqealar (M7).

"QAYSI VOQEA KIMGA BORADI" degan savol SHU FAYLDA, bitta joyda. Chaqiruv
joylari (apps/learning, apps/assessment, apps/social) faqat bitta funksiya
chaqiradi va matnni o'zlari yozmaydi — aks holda bir xil voqea ikki joyda
ikki xil ta'riflanardi va uslub vaqt o'tishi bilan tarqab ketardi.

--- NEGA SIGNAL EMAS, OSHKORA CHAQIRUV --------------------------------------

`post_save` signali bilan qilish mumkin edi, lekin unda bildirishnoma
YASHIRIN bo'lib qolardi: `Enrollment.objects.create(...)` yozgan odam
uning yon ta'sirini ko'rmaydi. Testlarda ham har bir yozuv yaratilishi
bildirishnoma yasab, kutilmagan qatorlar paydo bo'lardi. Oshkora chaqiruv
esa ko'rinadigan joyda turadi va faqat HAQIQIY foydalanuvchi amalida
ishlaydi (masalan demo ma'lumot ekilganda emas).

--- IKKI QOIDA --------------------------------------------------------------

1. **O'ZINGGA BILDIRISHNOMA KELMAYDI.** O'qituvchi o'z kursiga o'zi
   yozilsa yoki o'z mavzusiga o'zi javob yozsa xabar bermaymiz — bu
   ro'yxatni shovqinga to'ldirardi. `isloh_notify` buni MARKAZIY tekshiradi,
   har chaqiruv joyida emas.
2. **BILDIRISHNOMA HECH QACHON SO'ROVNI YIQITMAYDI.** U yon ta'sir: agar
   xabar yozib bo'lmasa, talabaning topshirig'i baribir topshirilishi
   kerak. Shuning uchun har chaqiruv `try/except` ichida.
"""

import logging

from apps.core.sanitize import isloh_clean_text

from .models import (
    TYPE_ENROLLMENT,
    TYPE_REVIEW,
    TYPE_SUBMISSION,
    Notification,
)

logger = logging.getLogger(__name__)

ISLOH_TITLE_MAX = 200
ISLOH_BODY_MAX = 400


def isloh_notify(user, role, type, title, body="", href="", actor=None, course=None):
    """Bitta bildirishnoma yozadi. Qaytaradi: yozuv yoki `None`.

    Matn SERVER tomonidan yasaladi, lekin ichida FOYDALANUVCHI ismi va kurs
    nomi bor — ya'ni u ham begona matn. Shuning uchun u ham
    `isloh_clean_text` dan o'tadi (M6 dagi ikki qatlamli himoya:
    apps/core/sanitize.py).
    """
    if user is None:
        return None

    # QOIDA 1 — o'zingga bildirishnoma kelmaydi
    if actor is not None and getattr(actor, "id", None) == user.id:
        return None

    try:
        return Notification.objects.create(
            user=user,
            role=role,
            type=type,
            title=isloh_clean_text(title, ISLOH_TITLE_MAX),
            body=isloh_clean_text(body, ISLOH_BODY_MAX),
            href=href,
            actor=actor,
            course=course,
        )
    except Exception:  # noqa: BLE001 - QOIDA 2
        # Jurnalga to'liq yoziladi, lekin so'rov davom etadi
        logger.exception("Bildirishnoma yozilmadi: %s", title)
        return None


# --- M3: o'qish oqimi -------------------------------------------------------


def isloh_notify_enrollment(enrollment):
    """Talaba kursga yozildi -> KURS EGASIGA."""
    course = enrollment.course
    return isloh_notify(
        user=course.owner,
        role="instructor",
        type=TYPE_ENROLLMENT,
        title="Yangi talaba ro'yxatga olindi",
        body=f'{enrollment.user.full_name} "{course.title}" kursiga yozildi',
        href="students.html",
        actor=enrollment.user,
        course=course,
    )


# --- M4: baholash -----------------------------------------------------------


def isloh_notify_submission(submission):
    """Ish topshirildi -> TOPSHIRIQ EGASIGA (o'qituvchi)."""
    assignment = submission.assignment
    return isloh_notify(
        user=assignment.owner,
        role="instructor",
        type=TYPE_SUBMISSION,
        title="Yangi topshiriq topshirildi",
        body=f'{submission.user.full_name} "{assignment.title}" topshirig\'ini yubordi',
        href="assignments.html",
        actor=submission.user,
        course=assignment.course,
    )


def isloh_notify_graded(submission):
    """Ish baholandi -> TALABAGA.

    Ball xabar MATNIDA ko'rsatiladi: talaba sahifani ochmasdan turib ham
    natijani bilishi kerak — bildirishnomaning butun ma'nosi shunda.
    """
    assignment = submission.assignment
    return isloh_notify(
        user=submission.user,
        role="student",
        type=TYPE_SUBMISSION,
        title="Topshirig'ingiz baholandi",
        body=f'"{assignment.title}" — {submission.score} / {assignment.max_score} ball',
        href="assignments.html",
        actor=submission.graded_by,
        course=assignment.course,
    )


# --- M6: ijtimoiy -----------------------------------------------------------


def isloh_notify_review(review):
    """Sharh qoldirildi -> KURS EGASIGA."""
    course = review.course
    return isloh_notify(
        user=course.owner,
        role="instructor",
        type=TYPE_REVIEW,
        title="Yangi sharh qoldirildi",
        body=f"{review.user.full_name} {review.rating} ★ sharh qoldirdi",
        href="reviews.html",
        actor=review.user,
        course=course,
    )


def isloh_notify_review_reply(review, author):
    """O'qituvchi sharhga javob berdi -> SHARH EGASIGA (talaba)."""
    return isloh_notify(
        user=review.user,
        role="student",
        type=TYPE_REVIEW,
        title="Sharhingizga javob berildi",
        body=f'"{review.course.title}" kursi o\'qituvchisi sharhingizga javob yozdi',
        href="course-detail.html",
        actor=author,
        course=review.course,
    )


def isloh_notify_discussion_reply(reply):
    """Mavzuga javob yozildi -> MAVZU MUALLIFIGA.

    Faqat mavzu muallifiga: butun ishtirokchilar ro'yxatiga yuborish
    obuna tushunchasini talab qiladi (kim kuzatmoqda?) va u alohida
    qaror — hozircha eng aniq adresat mavzu egasi.

    Rol mavzu EGASIGA qarab hisoblanadi: o'z kursida u o'qituvchi, boshqa
    kursda esa talaba (models.py dagi "rol maydoni nega bor" izohi).
    """
    thread = reply.thread
    is_owner = thread.course.owner_id == thread.author_id
    return isloh_notify(
        user=thread.author,
        role="instructor" if is_owner else "student",
        type="message",
        title="Mavzuingizga javob yozildi",
        body=f'{reply.author.full_name}: "{thread.title}"',
        href="discussions.html",
        actor=reply.author,
        course=thread.course,
    )
