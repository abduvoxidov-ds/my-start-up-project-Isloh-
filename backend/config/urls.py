"""
ISLOH — URL xaritasi.

Ikki qism:
  1. /api/v1/...  — REST API (sprintlar bo'yicha to'ldiriladi)
  2. frontend     — pages/, js/, css/, assets/, index.html

Frontend NEGA shu yerdan beriladi: refresh token httpOnly cookie'da yuradi
va `js/api.js` `credentials: 'include'` bilan yuboradi — bu frontend va API
BIR XIL origin'da bo'lishini talab qiladi. Alohida portda CORS +
`SameSite=None` kerak bo'lardi.

Har bir papka ALOHIDA e'lon qilinadi: REPO_ROOT ni butunlay ochib qo'ysak
`backend/.env` (SECRET_KEY, DATABASE_URL) ham tashqariga chiqib ketardi.

Ishlab chiqarishda bu yo'llarni nginx yoki WhiteNoise oldindan ushlaydi;
`django.views.static.serve` faqat qulaylik uchun.
"""

from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from django.views.static import serve

from config.settings.base import REPO_ROOT

# Tashqariga chiqadigan frontend papkalari — oq ro'yxat
ISLOH_PUBLIC_DIRS = ("pages", "js", "css", "assets", "media")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.courses.urls")),
    path("api/v1/", include("apps.learning.urls")),
    path("api/v1/", include("apps.assessment.urls")),
    path("api/v1/", include("apps.resources.urls")),
    path("api/v1/", include("apps.social.urls")),
]

# `/api/` ostidagi 404/500 lar ham JSON shartnomasida chiqsin.
# Sababi apps/core/exceptions.py oxirida — qisqasi: DRF ning xato
# ishlovchisi ko'rinishga yetib bormagan so'rovlarni ushlay olmaydi va
# frontend HTML javobni JSON deb o'qishga urinib `parse_error` beradi.
handler400 = "apps.core.exceptions.isloh_400"
handler403 = "apps.core.exceptions.isloh_403"
handler404 = "apps.core.exceptions.isloh_404"
handler500 = "apps.core.exceptions.isloh_500"

urlpatterns += [
    re_path(
        rf"^(?P<path>(?:{'|'.join(ISLOH_PUBLIC_DIRS)})/.*)$",
        serve,
        {"document_root": REPO_ROOT},
    ),
    # index.html -> login (frontenddagi mavjud oqim)
    path("", RedirectView.as_view(url="/pages/auth/login.html", permanent=False)),
]
