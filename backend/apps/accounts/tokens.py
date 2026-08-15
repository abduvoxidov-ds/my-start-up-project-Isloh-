"""
ISLOH — token va cookie yordamchilari.

Shartnoma (docs/BACKEND-PLAN.md §0.3, js/api.js):
  * access token  -> javob TANASIDA (`access_token`), frontend uni
                     localStorage'ga qo'yadi va `Authorization: Bearer` da
                     yuboradi;
  * refresh token -> httpOnly COOKIE, JS uni o'qiy olmaydi. Shu sababli
                     `js/api.js` har so'rovda `credentials: 'include'`
                     yuboradi va frontend bilan API bir xil origin'da
                     bo'lishi shart.

Har bir refresh token uchun `Session` yozuvi ochiladi — foydalanuvchi
qurilmalar ro'yxatini ko'radi va istalganini bekor qila oladi
(pages/*/settings.html "Faol sessiyalar").
"""

from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Session

# Sessiya nomi uchun: to'liq User-Agent juda uzun va foydasiz
MAX_DEVICE_LEN = 200


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR") or None


def issue_tokens(user, request):
    """Yangi juftlik yaratadi va sessiyani qayd qiladi."""
    refresh = RefreshToken.for_user(user)

    Session.objects.create(
        user=user,
        jti=refresh["jti"],
        device=request.META.get("HTTP_USER_AGENT", "")[:MAX_DEVICE_LEN],
        ip=client_ip(request),
    )
    return str(refresh.access_token), str(refresh), refresh["jti"]


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        httponly=True,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        # Cookie faqat API yo'llariga yuborilsin — statik fayl so'rovlari
        # (js, css, rasm) uni ko'tarib yurishi keraksiz.
        path="/api/",
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path="/api/",
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
    )
    return response


def revoke_session(jti):
    """Sessiyani bekor qiladi. Topilmasa jim o'tadi (idempotent)."""
    Session.objects.filter(jti=jti, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )


def session_is_active(jti):
    return Session.objects.filter(jti=jti, revoked_at__isnull=True).exists()
