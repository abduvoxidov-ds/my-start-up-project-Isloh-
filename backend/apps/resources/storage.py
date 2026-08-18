"""
ISLOH — saqlash qatlami (M5).

Reja M5 dan S3-mos xizmatni va IMZOLANGAN URL orqali to'g'ridan-to'g'ri
yuklashni talab qiladi: fayl Django'ning so'rov siklidan o'tmasin, chunki
100 MB lik video WSGI ishchisini o'sha vaqtga band qilib turadi.

Muhitda S3 yo'q (docs/BACKEND-PLAN.md "Muhit holati" — Docker/WSL2 ham
yo'q edi). Shu sababli SHARTNOMA qoldirildi, backend esa almashtiriladigan
qilindi:

    presign -> {upload_url, method, headers}   # mijoz shu URL ga PUT qiladi
    PUT <upload_url>                            # baytlar saqlashga boradi
    complete                                    # server hajmni TEKSHIRADI

`LocalSignedStorage` — `upload_url` sifatida o'z endpoint'ini beradi va uni
`TimestampSigner` bilan imzolaydi. Ya'ni URL ning O'ZI — vaqtinchalik
kalit, xuddi S3 presigned PUT dagidek: sarlavhada token kerak emas, muddat
tugagach URL ishlamaydi.

`S3SignedStorage` yozilganda faqat `ISLOH_STORAGE_BACKEND` almashadi —
ko'rinishlar ham, frontend ham o'zgarmaydi.

NEGA BAYTLAR `MEDIA_ROOT` DA, `<repo>/media/` DA EMAS: repo ildizidagi
`media/` papkasi config/urls.py da OQ RO'YXATDA va hech qanday tekshiruvsiz
beriladi. Yuklangan fayl esa ruxsat talab qiladi (kursga yozilmagan talaba
resursni ololmasligi kerak), shuning uchun u `backend/media/uploads/` ga
tushadi — u yerga faqat `/files/{id}/download` orqali yo'l bor.
"""

import mimetypes
import re
import uuid
from pathlib import PurePosixPath

from django.conf import settings
from django.core.files import File as DjangoFile
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.utils.module_loading import import_string

# Imzo tuzi — boshqa maqsaddagi imzo (masalan parol tiklash havolasi) shu
# yerda ishlatib bo'lmasin
ISLOH_UPLOAD_SALT = "isloh.upload"

# Kalitda faqat shu belgilar qoladi: fayl nomi foydalanuvchidan keladi va
# u `../` yoki `\` bo'lishi mumkin
ISLOH_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def isloh_safe_extension(name):
    """Fayl nomidan kengaytma. Nuqtasiz nom yoki `.` bilan boshlanuvchi
    yashirin fayl — kengaytmasiz hisoblanadi."""
    suffix = PurePosixPath(str(name).replace("\\", "/")).suffix.lower()
    if not suffix or len(suffix) > 12:
        return ""
    return ISLOH_SAFE_NAME.sub("", suffix)


class BaseUploadStorage:
    """Saqlash backendi shartnomasi."""

    def build_key(self, purpose, name):
        """`purpose/uuid.ext` — nom TO'LIQ tashlanadi.

        Foydalanuvchi nomi faqat `File.name` da qoladi va yuklab olishda
        `Content-Disposition` orqali qaytariladi. Saqlashda esa u kerak
        emas va faqat xavf: yo'ldan chiqish (`../`), Windows'da taqiqlangan
        belgilar, bir xil nomdagi ikki fayl.
        """
        return f"{settings.ISLOH_UPLOAD_ROOT}/{purpose}/{uuid.uuid4().hex}{isloh_safe_extension(name)}"

    def upload_target(self, file):  # pragma: no cover - abstrakt
        raise NotImplementedError

    def save(self, key, content):  # pragma: no cover - abstrakt
        raise NotImplementedError

    def open(self, key):  # pragma: no cover - abstrakt
        raise NotImplementedError

    def delete(self, key):  # pragma: no cover - abstrakt
        raise NotImplementedError

    def size(self, key):  # pragma: no cover - abstrakt
        raise NotImplementedError

    def exists(self, key):  # pragma: no cover - abstrakt
        raise NotImplementedError


class LocalSignedStorage(BaseUploadStorage):
    """Mahalliy disk + imzolangan yuklash URL i."""

    def __init__(self):
        self.signer = TimestampSigner(salt=ISLOH_UPLOAD_SALT)

    # --- Imzo --------------------------------------------------------------

    def sign(self, file_id):
        return self.signer.sign(str(file_id))

    def unsign(self, token):
        """Yaroqli bo'lsa fayl id'sini, aks holda `None` qaytaradi.

        Muddati o'tgan va soxta imzo BIR XIL natija beradi: qaysi biri
        ekanini aytish yuklash URL i qachon berilganini oshkor qilardi.
        """
        try:
            return self.signer.unsign(token, max_age=settings.ISLOH_UPLOAD_URL_TTL)
        except (BadSignature, SignatureExpired):
            return None

    # --- Shartnoma ---------------------------------------------------------

    def upload_target(self, file):
        return {
            "upload_url": f"/api/v1/uploads/local/{self.sign(file.id)}",
            "method": "PUT",
            # S3 da bu yerda `Content-Type` va imzo sarlavhalari bo'ladi.
            # Mahalliy backendda hech narsa kerak emas, lekin kalit
            # SAQLANADI: frontend uni har doim bir xil o'qiydi.
            "headers": {},
            "expires_in": settings.ISLOH_UPLOAD_URL_TTL,
        }

    def save(self, key, content):
        """Baytlarni yozadi va HAQIQIY kalitni qaytaradi.

        `content` — fayl-obyekt yoki baytlar. Fayl-obyekt AFZAL: 200 MB lik
        resurs xotiraga to'liq sig'dirilmasin (ko'rinish uni bo'lak-bo'lak
        vaqtinchalik faylga yozadi).

        `default_storage.save` nom band bo'lsa uni o'zgartiradi; kalit UUID
        bo'lgani uchun bunday bo'lmasligi kerak, lekin qaytgan qiymat
        baribir yozib qo'yiladi — bazadagi kalit diskdagi fayldan farq
        qilib qolmasin.
        """
        if default_storage.exists(key):
            default_storage.delete(key)  # qayta yuklash — eskisi ustiga
        payload = ContentFile(content) if isinstance(content, (bytes, bytearray)) else DjangoFile(content)
        return default_storage.save(key, payload)

    def open(self, key):
        return default_storage.open(key, "rb")

    def delete(self, key):
        if key and default_storage.exists(key):
            default_storage.delete(key)

    def size(self, key):
        return default_storage.size(key) if default_storage.exists(key) else 0

    def exists(self, key):
        return bool(key) and default_storage.exists(key)


_storage = None


def isloh_storage():
    """Sozlamadagi backend (bir marta yaratiladi)."""
    global _storage
    if _storage is None:
        _storage = import_string(settings.ISLOH_STORAGE_BACKEND)()
    return _storage


def isloh_guess_content_type(name, fallback=""):
    """Nomdan MIME. Mijoz yuborgan `content_type` ga to'liq ishonib
    bo'lmaydi — u brauzer yoki skript aytgan qiymat."""
    guessed, _ = mimetypes.guess_type(str(name))
    return guessed or fallback or "application/octet-stream"
