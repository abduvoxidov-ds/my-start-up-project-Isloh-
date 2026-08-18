"""
ISLOH — yuklab olishdagi ruxsat (M5).

Reja M5: "yuklab olishda ruxsat (kursga yozilmagan talaba resursni
ololmasin)". Bu M5 ning eng nozik joyi: `File` o'zi hech kimga tegishli
emas, u FAQAT bog'langan yozuvi orqali ma'noga ega bo'ladi. Shuning uchun
ruxsat maqsad bo'yicha, teskari bog'lanishlarni kuzatib hisoblanadi.

RAD ETISH 404 BERADI, 403 EMAS. 403 javobning o'zi "bunday fayl bor" deb
aytardi — kurs resursining mavjudligi esa kursga yozilmagan odam uchun
ma'lumot (M2 dagi "begona kurs 404" qarori bilan bir xil sabab).

`import` lar FUNKSIYA ICHIDA: `apps.assessment` va `apps.courses`
`resources` ga satr orqali (`"resources.File"`) bog'langan, teskarisiga
modul darajasida import qilinsa aylanma bog'liqlik paydo bo'lardi.
"""

from .models import (
    PURPOSE_AVATAR,
    PURPOSE_LESSON_VIDEO,
    PURPOSE_RESOURCE,
    PURPOSE_SUBMISSION,
    Resource,
)


def isloh_is_public_file(file):
    """Avatar — YAGONA ochiq tur.

    NEGA: avatar `<img src>` orqali ko'rsatiladi (js/profile.js →
    `isloh_renderUserAvatar`), rasm so'rovi esa `Authorization` sarlavhasini
    YUBORA OLMAYDI. Brauzerda o'lchandi: token talab qilinganda rasm
    `error` bilan tugab, profil doim bosh harflarga tushib qolardi — ya'ni
    yuklangan avatar hech qachon ko'rinmasdi.

    Yo'qotish kichik: avatar baribir har bir tizimga kirgan foydalanuvchiga
    ochiq edi (sharhlar, chat, katalogdagi o'qituvchi). Manzilda taxmin
    qilib bo'lmaydigan UUID turadi — S3 dagi `public-read` avatar bilan
    bir xil model.

    Qolgan hamma tur (resurs, dars videosi, topshiriq fayli) kirishni
    TALAB QILADI va ruxsat pastda hisoblanadi.
    """
    return file.purpose == PURPOSE_AVATAR


def isloh_can_download(user, file):
    """Foydalanuvchi shu faylni ola oladimi."""
    if isloh_is_public_file(file):
        return True

    if not user or not user.is_authenticated:
        return False

    # Yuklagan odam o'z faylini har doim oladi
    if file.owner_id == user.id:
        return True

    if file.purpose == PURPOSE_RESOURCE:
        return _resource_visible(user, file)

    if file.purpose == PURPOSE_LESSON_VIDEO:
        return _lesson_video_visible(user, file)

    if file.purpose == PURPOSE_SUBMISSION:
        return _submission_visible(user, file)

    return False


def _resource_visible(user, file):
    """Kursga yozilgan talaba FAOL resursni oladi.

    Arxivlangani chiqarib tashlanadi: o'qituvchi uni ataylab ko'rinmas
    qilgan va faqat o'zi ko'radi (yuqoridagi egalik sharti).
    """
    return Resource.objects.filter(
        file=file,
        status=Resource.STATUS_ACTIVE,
        course__enrollments__user=user,
    ).exists()


def _lesson_video_visible(user, file):
    from apps.courses.models import Lesson

    return Lesson.objects.filter(
        video_file=file,
        module__course__enrollments__user=user,
    ).exists()


def _submission_visible(user, file):
    """Topshirilgan ishning faylini FAQAT topshiriq egasi (o'qituvchi)
    ko'radi. Talabaning o'zi — yuqoridagi `owner` sharti orqali."""
    from apps.assessment.models import SubmissionFile

    return SubmissionFile.objects.filter(
        file=file,
        submission__assignment__owner=user,
    ).exists()
