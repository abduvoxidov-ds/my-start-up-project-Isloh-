"""
ISLOH — umumiy sozlamalar.

Muhitga xos qismlar dev.py va prod.py da. Maxfiy qiymatlar hech qachon
shu faylda emas — hammasi backend/.env dan (django-environ).

docs/BACKEND-PLAN.md §1
"""

from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
# Frontend shu yerda: pages/, js/, css/, assets/, index.html
REPO_ROOT = BASE_DIR.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    JWT_ACCESS_MINUTES=(int, 15),
    JWT_REFRESH_DAYS=(int, 30),
    JWT_REFRESH_COOKIE_NAME=(str, "isloh_refresh"),
    JWT_REFRESH_COOKIE_SECURE=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Uchinchi tomon
    "rest_framework",
    # Isloh ilovalari — docs/BACKEND-PLAN.md §1
    "apps.core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Statik fayllarni Django o'zi beradi: frontend va API BIR XIL origin
    # bo'lishi shart, chunki refresh token httpOnly cookie'da yuradi
    # (js/api.js -> credentials: 'include').
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Frontend JS/CSS keshini boshqaradi — docs/BACKEND-AUDIT.md §5.1
    "apps.core.middleware.FrontendCacheControlMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Ma'lumotlar bazasi ----------------------------------------------------
# DATABASE_URL bitta qatorda almashadi: hozir sqlite, Docker tayyor bo'lgach
# postgres://... (backend/.env). Kod hech qayerda baza turini bilmaydi.
DATABASES = {"default": env.db("DATABASE_URL", default="sqlite:///db.sqlite3")}
DATABASES["default"]["ATOMIC_REQUESTS"] = True

# SQLite yo'li joriy PAPKAGA nisbiy bo'lib qoladi, ya'ni `manage.py` qayerdan
# chaqirilganiga qarab boshqa fayl ochiladi: `backend/` dan yugurtirilsa
# backend/db.sqlite3, repo ildizidan yugurtirilsa (preview serveri shunday
# qiladi) ildizdagi bo'sh db.sqlite3. Natijada migratsiyalar bir faylda,
# so'rovlar boshqasida bo'lib qolardi. Yo'lni BASE_DIR ga bog'laymiz.
if DATABASES["default"]["ENGINE"].endswith("sqlite3"):
    _name = DATABASES["default"]["NAME"]
    if _name and not Path(_name).is_absolute():
        DATABASES["default"]["NAME"] = str(BASE_DIR / _name)

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Til va vaqt -----------------------------------------------------------
# Interfeys tili so'rov bilan keladi (js/api.js -> Accept-Language: uz|en|ru).
LANGUAGE_CODE = "uz"
LANGUAGES = [("uz", "O'zbek"), ("en", "English"), ("ru", "Русский")]
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
# Baza UTC da saqlaydi, ko'rsatish frontendda (js/datetime.js)
USE_TZ = True

# --- Statik fayllar --------------------------------------------------------
# /static/ faqat Django admin uchun. Frontend (pages/, js/, css/, assets/)
# o'z yo'llarida config/urls.py orqali beriladi — REPO_ROOT ni butunlay
# ochib qo'ysak backend/.env ham tashqariga chiqib ketardi.
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF -------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    # Xato shakli js/api.js kutgan { error: { code, message, fields } } —
    # DRF ning standarti mos kelmaydi (docs/BACKEND-PLAN.md §0.2)
    "EXCEPTION_HANDLER": "apps.core.exceptions.isloh_exception_handler",
    # DIQQAT: bu SUKUT BO'YICHA sahifalash EMAS. Do'kon endpoint'lari
    # (/courses, /enrollments ...) bevosita massiv qaytaradi, chunki
    # js/api.js dagi fabrika javobga to'g'ridan-to'g'ri .map() qo'llaydi
    # (docs/BACKEND-PLAN.md §0.1). Sahifalash kerak bo'lgan joyda view
    # `pagination_class = IslohPagination` deb ATAYLAB yozadi.
    "DEFAULT_PAGINATION_CLASS": None,
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

# --- JWT -------------------------------------------------------------------
# js/api.js shartnomasi: access — javob tanasida (localStorage),
# refresh — httpOnly cookie (credentials: 'include').
from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

JWT_REFRESH_COOKIE_NAME = env("JWT_REFRESH_COOKIE_NAME")
JWT_REFRESH_COOKIE_SECURE = env("JWT_REFRESH_COOKIE_SECURE")
JWT_REFRESH_COOKIE_SAMESITE = "Lax"
