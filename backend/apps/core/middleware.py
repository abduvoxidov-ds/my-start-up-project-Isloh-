"""
ISLOH — frontend fayllari uchun kesh sarlavhalari.

NEGA BU FAYL BOR (docs/BACKEND-AUDIT.md §5.1): mahalliy tekshiruv paytida
brauzer o'zgartirilgan `js/*.js` fayllarni keshdan olishda davom etdi.
`?bust=` parametri ham, majburiy qayta yuklash ham yordam bermadi — statik
server `Cache-Control` yubormagani uchun brauzer evristik keshlashga o'tadi.

Ishlab chiqarishda bu deploy'dan keyin foydalanuvchini eski JS bilan
qoldiradi: yangi `api.js` eski `course-store.js` bilan aralashib, tashxis
qo'yish qiyin nosozlik beradi (masalan `isloh_createStoreCache` mavjud
bo'lmay qoladi).

`no-cache` — "keshla, lekin HAR SAFAR serverdan tasdiqlat". Bu `no-store`
emas: fayl o'zgarmagan bo'lsa 304 qaytadi va trafik sarflanmaydi.
"""

from apps.core.exceptions import ISLOH_API_PREFIX, isloh_json_error

# Shu prefikslardagi fayllar har safar tasdiqlanadi
ISLOH_REVALIDATE_PREFIXES = ("/js/", "/css/")

# Rasm va shriftlar — mazmuni o'zgarmaydigan turlar, uzoq keshlanadi
ISLOH_LONG_CACHE_PREFIXES = ("/assets/",)
ISLOH_LONG_CACHE_SECONDS = 60 * 60 * 24 * 30  # 30 kun


class FrontendCacheControlMiddleware:
    """`/js/` va `/css/` — no-cache; `/assets/` — uzoq kesh."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path

        if path.startswith(ISLOH_REVALIDATE_PREFIXES):
            response["Cache-Control"] = "no-cache, must-revalidate"
        elif path.startswith(ISLOH_LONG_CACHE_PREFIXES):
            response["Cache-Control"] = f"public, max-age={ISLOH_LONG_CACHE_SECONDS}"

        return response


class ApiJsonErrorMiddleware:
    """`/api/` ostidagi HTML xato javoblarini JSON shartnomasiga keltiradi.

    NEGA HANDLER'NING O'ZI YETMAYDI (config/urls.py dagi `handler404` va h.k.):
    Django `DEBUG=True` bo'lganda o'zining texnik xato sahifasini beradi va
    `handler404`/`handler500` ni UMUMAN chaqirmaydi. Ya'ni handler'lar faqat
    ishlab chiqarishda ishlaydi, mahalliy tekshiruvda esa frontend baribir
    HTML oladi va `js/api.js` uni `parse_error` deb ko'rsatadi — bu aynan
    ishlab chiquvchi ko'radigan holat.

    Shu sababli javob DARAJASIDA tekshiriladi: `/api/` ostidagi 4xx/5xx
    javobning turi JSON bo'lmasa, u §0.2 o'ramiga almashtiriladi. Handler'lar
    esa joyida qoladi — ular ishlab chiqarishdagi asosiy yo'l.

    Muvaffaqiyatli javoblarga va `/api/` dan tashqari yo'llarga tegilmaydi.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if not request.path.startswith(ISLOH_API_PREFIX):
            return response
        if response.status_code < 400:
            return response
        if response.get("Content-Type", "").startswith("application/json"):
            return response

        return isloh_json_error(response.status_code)
