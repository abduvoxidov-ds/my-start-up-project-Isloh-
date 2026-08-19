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
    # `daphne` django.contrib.staticfiles DAN OLDIN turishi shart —
    # u `runserver` buyrug'ini ASGI variantiga almashtiradi, ya'ni
    # mahalliy serverda ham WebSocket ishlaydi (M8).
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Uchinchi tomon
    "rest_framework",
    "channels",
    # Isloh ilovalari — docs/BACKEND-PLAN.md §1
    "apps.core",
    "apps.accounts",
    "apps.courses",
    "apps.learning",
    "apps.assessment",
    "apps.resources",
    "apps.social",
    "apps.notifications",
    "apps.messaging",
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
    # `/api/` ostidagi HTML xato sahifalarini JSON o'ramiga keltiradi.
    # Eng oxirida turadi: yuqoridagilarning javobini ham qamrab olsin.
    "apps.core.middleware.ApiJsonErrorMiddleware",
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

    # SQLite'da BITTA yozuvchi bo'ladi. Frontend do'koni esa o'zgargan har
    # bir yozuvni ALOHIDA so'rov bilan yuboradi va ular parallel ketadi
    # (js/api.js dagi fabrika). Uchta vazifa birdan qo'shilganda o'lchandi:
    # ikkitasi saqlandi, uchinchisi `database is locked` bilan 500 berdi va
    # foydalanuvchi buni yo'qolgan yozuv sifatida ko'rardi.
    #
    #   timeout       — yozuvchi darhol yiqilmasin, navbat kutsin
    #   WAL           — o'qish yozishni bloklamaydi
    #
    # Bu VAQTINCHALIK chora: reja M4 dan PostgreSQL'ni talab qiladi
    # (docs/BACKEND-PLAN.md "Muhit holati") va u yerda bunday cheklov yo'q.
    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"].update(
        {
            "timeout": 20,
            "init_command": "PRAGMA journal_mode=WAL;",
        }
    )

# Email bilan kirish; `username` maydoni umuman yo'q
AUTH_USER_MODEL = "accounts.User"

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

# --- Yuklangan fayllar (M5) ------------------------------------------------
# DIQQAT: yuklangan fayllar `MEDIA_ROOT` (= backend/media/) ostida yotadi va
# u OQ RO'YXATDA EMAS. config/urls.py dagi `media` — repo ILDIZIDAGI boshqa
# papka (namunaviy video). Yuklangan faylga yagona yo'l —
# `/api/v1/files/{id}/download`, chunki u ruxsatni tekshiradi: kursga
# yozilmagan talaba resursni ololmasligi kerak (docs/BACKEND-PLAN.md §M5).
ISLOH_UPLOAD_ROOT = "uploads"

# Saqlash backendi. S3 ga o'tish SHU QATORNI almashtirish bilan cheklanadi —
# endpoint'lar ham, frontend ham o'zgarmaydi (apps/resources/storage.py).
ISLOH_STORAGE_BACKEND = env(
    "ISLOH_STORAGE_BACKEND", default="apps.resources.storage.LocalSignedStorage"
)

# Imzolangan yuklash havolasining umri (soniya). Qisqa bo'lgani ma'qul:
# havola — vaqtinchalik kalit, sarlavhada token yo'q.
ISLOH_UPLOAD_URL_TTL = env.int("ISLOH_UPLOAD_URL_TTL", default=900)

# --- Real vaqt (M8) --------------------------------------------------------
# Kanal qatlami — WebSocket xabarlarini jarayonlar orasida tarqatadi.
# Dev'da xotirada: Redis'siz ham chat ishlaydi va sinovda qo'shimcha
# xizmat ko'tarish shart emas. Ishlab chiqarishda esa xotira qatlami
# UMUMAN yaramaydi — u bitta jarayon ichida qoladi va ikkinchi worker'ga
# ulangan foydalanuvchi hech narsa olmasdi (prod.py Redis'ga o'tkazadi).
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}

# Onlayn holat shu muddatdan keyin "oflayn" deb o'qiladi. Ulanish har doim
# ham to'g'ri uzilmaydi (brauzer yopiladi, tarmoq uziladi) va bunday holda
# yozuv "online" bo'lib qolib ketardi — apps/messaging/serializers.py.
ISLOH_PRESENCE_TTL = env.int("ISLOH_PRESENCE_TTL", default=120)

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
