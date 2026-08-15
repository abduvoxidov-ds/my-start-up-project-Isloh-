"""
ISLOH — yagona xato formati.

NEGA BU FAYL BOR: frontend `js/api.js` har qanday nosozlikni bitta shaklga
keltiradi va shu shaklni parse qiladi:

    { "error": { "code": "...", "message": "...", "fields": { "<maydon>": "<xabar>" } } }

`fields` to'g'ridan-to'g'ri `[data-error-for="<maydon>"]` elementlariga
tarqaladi (js/ui-feedback.js -> isloh_setFieldError). DRF ning standart
javobi mos kelmaydi:

    {"detail": "Not found."}                 <- xabar `error` ichida emas
    {"email": ["This field is required."]}   <- maydon xatolari yuzada

Ikkinchi shakl bilan frontend "email" ni xato KODI deb o'qishga urinardi va
foydalanuvchi maydon ostida hech narsa ko'rmasdi.

docs/BACKEND-PLAN.md §0.2
"""

import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# HTTP holatidan mashina o'qiydigan kodga. Frontend `code` bo'yicha qaror
# qabul qiladi (masalan validation_error -> maydonlarni belgilash).
ISLOH_ERROR_CODES = {
    400: "validation_error",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    415: "unsupported_media_type",
    422: "validation_error",
    429: "throttled",
}

# Foydalanuvchiga ko'rinadigan umumiy matnlar (o'zbekcha — LANGUAGE_CODE).
# Maydonga xos xabarlar serializerdan keladi va tarjima qilinmaydi.
ISLOH_DEFAULT_MESSAGES = {
    400: "Yuborilgan ma'lumotda xatolik bor",
    401: "Sessiya tugagan yoki kirish talab qilinadi",
    403: "Bu amal uchun ruxsat yo'q",
    404: "So'ralgan ma'lumot topilmadi",
    405: "Bu metod qo'llab-quvvatlanmaydi",
    409: "Ma'lumot ziddiyati",
    429: "So'rovlar juda tez-tez yuborilmoqda",
    500: "Serverda kutilmagan xatolik",
}

# DRF maydonsiz validatsiya xatolarini shu kalit ostida beradi; frontendda
# unga mos `[data-error-for="form"]` bloki bor (pages/auth/*.html).
ISLOH_NON_FIELD_KEY = "form"


def _flatten(value):
    """DRF xato qiymatini bitta satrga keltiradi.

    Qiymat ro'yxat (["Bu maydon shart", "..."]) yoki ichma-ich lug'at
    bo'lishi mumkin. Frontend maydonga BITTA satr chizadi, shuning uchun
    birinchisi olinadi — qolganini ko'rsatadigan joy yo'q.
    """
    if isinstance(value, (list, tuple)):
        return _flatten(value[0]) if value else ""
    if isinstance(value, dict):
        for nested in value.values():
            return _flatten(nested)
        return ""
    return str(value)


def _collect_fields(detail):
    """Serializer xatolaridan {maydon: xabar} yig'adi."""
    if not isinstance(detail, dict):
        return {}

    fields = {}
    for key, value in detail.items():
        name = ISLOH_NON_FIELD_KEY if key == "non_field_errors" else key
        message = _flatten(value)
        if message:
            fields[name] = message
    return fields


def _build(code, message, fields=None, status_code=status.HTTP_400_BAD_REQUEST):
    return Response(
        {"error": {"code": code, "message": message, "fields": fields or {}}},
        status=status_code,
    )


def isloh_exception_handler(exc, context):
    """DRF ning EXCEPTION_HANDLER'i (settings.REST_FRAMEWORK)."""
    # Django darajasidagi ikki istisnoni DRF ekvivalentiga o'giramiz,
    # aks holda ular 500 bo'lib chiqib ketardi.
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = drf_exception_handler(exc, context)

    if response is None:
        # Ushlanmagan istisno: batafsil ma'lumot javobga CHIQMAYDI —
        # stack trace foydalanuvchiga ketmasin. Jurnalga to'liq yoziladi.
        logger.exception("Ushlanmagan istisno", exc_info=exc)
        return _build(
            "server_error",
            ISLOH_DEFAULT_MESSAGES[500],
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    status_code = response.status_code
    detail = response.data
    fields = {}
    message = ""

    if isinstance(detail, dict):
        fields = _collect_fields(detail)
        # {"detail": "..."} — maydonga tegishli emas, umumiy xabar
        if "detail" in detail:
            message = _flatten(detail["detail"])
            fields.pop("detail", None)
    elif isinstance(detail, list):
        # Serializer ro'yxatga xato bergan holat (many=True)
        message = _flatten(detail)

    if not message:
        # Maydon xatolari bo'lsa umumiy xabar ham kerak: banner yoki toast
        # nimadir ko'rsatishi shart.
        message = ISLOH_DEFAULT_MESSAGES.get(status_code, ISLOH_DEFAULT_MESSAGES[400])

    code = getattr(exc, "default_code", None) or ISLOH_ERROR_CODES.get(status_code, "error")
    # DRF ba'zi kodlarni "invalid" deb beradi — frontend uchun ma'nosiz
    if code in {"invalid", "parse_error"} and status_code in ISLOH_ERROR_CODES:
        code = ISLOH_ERROR_CODES[status_code]

    response.data = {"error": {"code": code, "message": message, "fields": fields}}
    return response
