"""
ISLOH — core testlari.

Asosiy maqsad: xato javobining shakli `js/api.js` kutgan shartnomaga mos
kelishini qo'riqlash. Bu shakl buzilsa frontend xatoni umuman ko'rsata
olmaydi (maydon ostidagi matn ham, banner ham chiqmaydi), shuning uchun
test har bir holatni alohida tekshiradi.
"""

from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import path
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.test import APIClient
from rest_framework.views import APIView

from apps.core.middleware import FrontendCacheControlMiddleware
from apps.core.pagination import IslohPagination


# --- Test uchun ko'rinishlar -----------------------------------------------


class _LoginLikeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8)


class _ValidationView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = _LoginLikeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"ok": True})


class _NotFoundView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        raise NotFound()


class _ForbiddenView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        raise PermissionDenied()


class _CrashView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        raise ValueError("ichki nosozlik — tafsiloti tashqariga chiqmasin")


urlpatterns = [
    path("validate", _ValidationView.as_view()),
    path("missing", _NotFoundView.as_view()),
    path("forbidden", _ForbiddenView.as_view()),
    path("crash", _CrashView.as_view()),
]


@override_settings(ROOT_URLCONF="apps.core.tests")
class ExceptionShapeTests(TestCase):
    """Har bir javob { error: { code, message, fields } } bo'lishi shart."""

    def setUp(self):
        self.client = APIClient()

    def _error(self, response):
        self.assertIn("error", response.data, "javob `error` kalitisiz keldi")
        error = response.data["error"]
        for key in ("code", "message", "fields"):
            self.assertIn(key, error, f"`error.{key}` yo'q")
        return error

    def test_validation_error_maydonlarga_tarqaladi(self):
        """422/400 — `fields` [data-error-for] ga tushadigan shaklda."""
        response = self.client.post("/validate", {"email": "notanemail", "password": "x"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error = self._error(response)
        self.assertEqual(error["code"], "validation_error")
        # Ikkala maydon ham nomi bo'yicha chiqishi kerak
        self.assertIn("email", error["fields"])
        self.assertIn("password", error["fields"])
        # Qiymat — SATR, ro'yxat emas: frontend uni textContent ga yozadi
        self.assertIsInstance(error["fields"]["email"], str)
        self.assertIsInstance(error["fields"]["password"], str)
        # Umumiy xabar ham bo'lishi shart (banner/toast uchun)
        self.assertTrue(error["message"])

    def test_bosh_maydon_form_kaliti_ostida(self):
        """non_field_errors -> `form` (pages/auth/*.html dagi blok nomi)."""
        response = self.client.post("/validate", {})
        error = self._error(response)
        self.assertIn("email", error["fields"])

    def test_not_found(self):
        response = self.client.get("/missing")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        error = self._error(response)
        self.assertEqual(error["code"], "not_found")
        self.assertEqual(error["fields"], {})

    def test_forbidden(self):
        response = self.client.get("/forbidden")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._error(response)["code"], "permission_denied")

    def test_ushlanmagan_istisno_tafsilotni_oshkor_qilmaydi(self):
        """500 da stack trace yoki istisno matni javobga chiqmasligi kerak."""
        with self.assertLogs("apps.core.exceptions", level="ERROR"):
            response = self.client.get("/crash", raise_request_exception=False)

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        error = self._error(response)
        self.assertEqual(error["code"], "server_error")
        self.assertNotIn("ichki nosozlik", error["message"])


class PaginationTests(SimpleTestCase):
    """Sahifalash ATAYLAB o'chirilgan — docs/BACKEND-PLAN.md §0.1."""

    def test_sukut_boyicha_sahifalash_yoq(self):
        from django.conf import settings

        self.assertIsNone(
            settings.REST_FRAMEWORK["DEFAULT_PAGINATION_CLASS"],
            "Sukut bo'yicha sahifalash yoqilsa do'kon endpoint'lari o'ramli "
            "javob qaytaradi va js/api.js dagi .map() TypeError beradi — "
            "sahifa jimgina demo ma'lumotga tushadi.",
        )

    def test_sahifalash_shakli(self):
        self.assertEqual(IslohPagination.page_size_query_param, "per_page")
        self.assertEqual(IslohPagination.page_query_param, "page")


class CacheControlTests(SimpleTestCase):
    """docs/BACKEND-AUDIT.md §5.1 — deploy'dan keyin eski JS qolmasin."""

    def _header(self, path):
        from django.http import HttpResponse

        middleware = FrontendCacheControlMiddleware(lambda request: HttpResponse("x"))
        request = type("R", (), {"path": path})()
        return middleware(request).get("Cache-Control")

    def test_js_va_css_har_safar_tasdiqlanadi(self):
        self.assertEqual(self._header("/js/api.js"), "no-cache, must-revalidate")
        self.assertEqual(self._header("/css/style.css"), "no-cache, must-revalidate")

    def test_assets_uzoq_keshlanadi(self):
        self.assertIn("max-age=", self._header("/assets/icons/logo.svg"))

    def test_api_javobiga_tegilmaydi(self):
        self.assertIsNone(self._header("/api/v1/courses"))


class DjangoLevelErrorTests(TestCase):
    """Ko'rinishga yetib bormaydigan xatolar ham §0.2 shakliga bo'ysunadi.

    Bu holat brauzerda o'lchandi: hali yozilmagan `/api/v1/auth/forgot-password`
    ga so'rov yuborilganda Django HTML 404 sahifasini qaytarardi, `js/api.js`
    esa uni JSON deb o'qib `code=parse_error` berardi — foydalanuvchi
    tushunarsiz xato ko'rardi. Bu test shu regressiyani qulflaydi.
    """

    def test_api_ostidagi_404_json_qaytaradi(self):
        response = self.client.get("/api/v1/bunday-manzil-yoq")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response["Content-Type"], "application/json")

        error = response.json()["error"]
        self.assertEqual(error["code"], "not_found")
        self.assertTrue(error["message"])
        self.assertEqual(error["fields"], {})

    def test_hali_yozilmagan_auth_endpointi_ham_json(self):
        """M13 da qo'shiladigan endpoint'lar hozircha 404 — lekin JSON 404."""
        response = self.client.post(
            "/api/v1/auth/forgot-password",
            {"email": "a@b.com"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_frontend_yollari_html_qoladi(self):
        """`/api/` dan tashqarida brauzer sahifa kutadi — JSON berilmasin."""
        response = self.client.get("/pages/bunday-sahifa-yoq.html")

        self.assertEqual(response.status_code, 404)
        self.assertNotEqual(response["Content-Type"], "application/json")


@override_settings(DEBUG=True)
class DebugRejimidaHamJsonTests(TestCase):
    """`DEBUG=True` da handler404 chaqirilmaydi — middleware qutqaradi.

    Bu aynan ishlab chiquvchi ko'radigan holat: testlar DEBUG=False bilan
    yurgani uchun handler'lar o'tib ketardi, mahalliy serverda esa frontend
    baribir HTML olib `parse_error` ko'rsatardi.
    """

    def test_debug_rejimida_ham_api_404_json(self):
        response = self.client.get("/api/v1/bunday-manzil-yoq")

        self.assertEqual(response.status_code, 404)
        self.assertTrue(
            response["Content-Type"].startswith("application/json"),
            f"DEBUG=True da ham JSON kutilardi, keldi: {response['Content-Type']}",
        )
        self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_debug_rejimida_frontend_yoli_html_qoladi(self):
        response = self.client.get("/pages/yoq.html")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response["Content-Type"].startswith("application/json"))
