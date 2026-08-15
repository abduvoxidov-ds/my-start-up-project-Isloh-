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
