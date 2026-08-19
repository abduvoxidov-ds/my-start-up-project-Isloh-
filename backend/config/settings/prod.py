"""Ishlab chiqarish sozlamalari."""

from .base import *  # noqa: F401,F403

DEBUG = False

# HTTPS majburiy — refresh token httpOnly cookie'da yuradi
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

JWT_REFRESH_COOKIE_SECURE = True

# --- Real vaqt (M8) --------------------------------------------------------
# Xotira qatlami (base.py) FAQAT bitta jarayonda ishlaydi. Ishlab
# chiqarishda bir nechta worker bo'ladi va ikkinchi worker'ga ulangan
# foydalanuvchi birinchisidagi xabarni umuman olmasdi — shuning uchun bu
# yerda Redis majburiy.
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [env("REDIS_URL", default="redis://127.0.0.1:6379/0")]},
    },
}
