"""
ISLOH — auth testlari.

Har bir test frontenddagi aniq bir joyni qo'riqlaydi: javob kalitlari
(js/auth-guard.js), maydon nomlari (`data-auth-field`), xato shakli
(`data-error-for`) va refresh cookie'ning httpOnly ekani.
"""

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from .models import ROLE_INSTRUCTOR, ROLE_STUDENT, Session, User, UserProfile, UserRole

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
CHANGE_PASSWORD = "/api/v1/auth/change-password"
SESSIONS = "/api/v1/auth/sessions"
PROFILE = "/api/v1/users/me/profile"

GOOD_PASSWORD = "Qorong'iTun2026"


def make_user(email="talaba@example.com", role=ROLE_STUDENT, password=GOOD_PASSWORD):
    user = User.objects.create_user(email=email, password=password, full_name="Test Foydalanuvchi")
    UserRole.objects.create(user=user, role=role)
    UserProfile.objects.create(user=user, role=role)
    return user


class RegisterTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_talaba_royxatdan_otadi(self):
        response = self.client.post(REGISTER, {
            "full_name": "Samar Mirzayev",
            "email": "Samar@Example.COM",
            "password": GOOD_PASSWORD,
            "role": "student",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # js/auth-guard.js aynan shu ikki kalitni o'qiydi
        self.assertIn("access_token", response.data)
        self.assertEqual(response.data["user"]["role"], "student")
        # Email kichik harfga keltiriladi — aks holda "Samar@" va "samar@"
        # ikki xil hisob bo'lib qolardi
        self.assertTrue(User.objects.filter(email="samar@example.com").exists())

    def test_oqituvchi_tashkilot_bilan(self):
        response = self.client.post(REGISTER, {
            "full_name": "Akmal Yusupov",
            "email": "akmal@example.com",
            "password": GOOD_PASSWORD,
            "role": "instructor",
            "organization": "Isloh Academy",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["role"], "instructor")
        profile = UserProfile.objects.get(user__email="akmal@example.com")
        self.assertEqual(profile.organization, "Isloh Academy")

    def test_admin_royxatdan_ota_olmaydi(self):
        """Admin rolini faqat mavjud admin tayinlaydi."""
        response = self.client.post(REGISTER, {
            "full_name": "Yomon Niyat", "email": "x@example.com",
            "password": GOOD_PASSWORD, "role": "admin",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data["error"]["fields"])
        self.assertFalse(User.objects.filter(email="x@example.com").exists())

    def test_takroriy_email(self):
        make_user(email="bor@example.com")
        response = self.client.post(REGISTER, {
            "full_name": "Boshqa", "email": "bor@example.com",
            "password": GOOD_PASSWORD, "role": "student",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Xato AYNAN email maydoniga tushsin (data-error-for="email")
        self.assertIn("email", response.data["error"]["fields"])

    def test_zaif_parol_maydonga_tushadi(self):
        response = self.client.post(REGISTER, {
            "full_name": "Test", "email": "yangi@example.com",
            "password": "123", "role": "student",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        fields = response.data["error"]["fields"]
        self.assertIn("password", fields)
        # Frontend qiymatni textContent ga yozadi — satr bo'lishi shart
        self.assertIsInstance(fields["password"], str)


class LoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()

    def test_muvaffaqiyatli_kirish(self):
        response = self.client.post(LOGIN, {"email": self.user.email, "password": GOOD_PASSWORD})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.data)
        self.assertEqual(response.data["user"]["email"], self.user.email)

    def test_refresh_cookie_httponly_va_javob_tanasida_yoq(self):
        response = self.client.post(LOGIN, {"email": self.user.email, "password": GOOD_PASSWORD})

        cookie = response.cookies.get(settings.JWT_REFRESH_COOKIE_NAME)
        self.assertIsNotNone(cookie, "refresh cookie qo'yilmadi")
        self.assertTrue(cookie["httponly"], "refresh cookie httpOnly emas — JS o'qiy oladi")
        self.assertEqual(cookie["path"], "/api/")
        # Refresh token TANAGA tushmasligi kerak
        self.assertNotIn("refresh", response.data)
        self.assertNotIn("refresh_token", response.data)

    def test_notogri_parol_401_va_umumiy_xabar(self):
        response = self.client.post(LOGIN, {"email": self.user.email, "password": "notogri"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error = response.data["error"]
        # Xato `form` blokiga tushadi: qaysi maydon noto'g'ri ekani
        # aytilmaydi — aks holda mavjud emaillarni sanab chiqish mumkin
        self.assertIn("form", error["fields"])
        self.assertNotIn("email", error["fields"])

    def test_toxtatilgan_hisob(self):
        self.user.status = User.STATUS_SUSPENDED
        self.user.save(update_fields=["status"])

        response = self.client.post(LOGIN, {"email": self.user.email, "password": GOOD_PASSWORD})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("to'xtatilgan", response.data["error"]["fields"]["form"])

    def test_sessiya_yozuvi_ochiladi(self):
        self.client.post(LOGIN, {"email": self.user.email, "password": GOOD_PASSWORD})
        self.assertEqual(Session.objects.filter(user=self.user, revoked_at__isnull=True).count(), 1)


class RefreshTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.client.post(LOGIN, {"email": self.user.email, "password": GOOD_PASSWORD})

    def test_cookie_bilan_yangi_access(self):
        response = self.client.post(REFRESH)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.data)

    def test_cookiesiz_401(self):
        self.client.cookies.clear()
        response = self.client.post(REFRESH)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"]["code"], "unauthorized")

    def test_chiqishdan_keyin_refresh_ishlamaydi(self):
        """Logout sessiyani bekor qiladi — eski cookie qaytarilsa ham."""
        saved = self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
        self.client.post(LOGOUT)

        self.client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = saved
        response = self.client.post(REFRESH)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MeAndProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        login = self.client.post(LOGIN, {"email": self.user.email, "password": GOOD_PASSWORD})
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access_token"])

    def test_me(self):
        response = self.client.get(ME)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertEqual(response.data["roles"], ["student"])

    def test_tokensiz_401(self):
        self.client.credentials()
        self.assertEqual(self.client.get(ME).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profil_yangilanadi(self):
        response = self.client.patch(PROFILE, {"headline": "Backend dasturchi"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["headline"], "Backend dasturchi")

    def test_rol_boyicha_alohida_profil(self):
        """Bitta odam ikki rolda ikki xil profilga ega bo'ladi."""
        UserRole.objects.create(user=self.user, role=ROLE_INSTRUCTOR)

        first = self.client.patch(PROFILE + "?role=student", {"headline": "Talaba"})
        # Instruktor profili shu so'rovda YARATILADI — javob ham tekshiriladi,
        # aks holda 500 sezilmay qolardi (joined_at datetime/date nosozligi
        # aynan shu yo'lda chiqqan edi).
        second = self.client.patch(PROFILE + "?role=instructor", {"headline": "O'qituvchi"})

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["joined_at"], str(timezone.localdate()))

        self.assertEqual(
            self.client.get(PROFILE + "?role=student").data["headline"], "Talaba"
        )
        self.assertEqual(
            self.client.get(PROFILE + "?role=instructor").data["headline"], "O'qituvchi"
        )


class ChangePasswordTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        login = self.client.post(LOGIN, {"email": self.user.email, "password": GOOD_PASSWORD})
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access_token"])

    def test_parol_ozgaradi_va_sessiyalar_yopiladi(self):
        response = self.client.post(CHANGE_PASSWORD, {
            "current": GOOD_PASSWORD, "new": "YangiParol2026!", "confirm": "YangiParol2026!",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("YangiParol2026!"))
        # Eski sessiyalar bekor, yangisi ochilgan
        self.assertEqual(Session.objects.filter(user=self.user, revoked_at__isnull=True).count(), 1)

    def test_notogri_joriy_parol_maydonga_tushadi(self):
        response = self.client.post(CHANGE_PASSWORD, {
            "current": "notogri", "new": "YangiParol2026!", "confirm": "YangiParol2026!",
        })
        # data-error-for="current" (pages/*/settings.html)
        self.assertIn("current", response.data["error"]["fields"])

    def test_mos_kelmagan_tasdiq(self):
        response = self.client.post(CHANGE_PASSWORD, {
            "current": GOOD_PASSWORD, "new": "YangiParol2026!", "confirm": "Boshqa2026!",
        })
        self.assertIn("confirm", response.data["error"]["fields"])


class SessionListTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        login = self.client.post(LOGIN, {"email": self.user.email, "password": GOOD_PASSWORD})
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access_token"])

    def test_royxat_massiv_qaytaradi(self):
        """docs/BACKEND-PLAN.md §0.1 — do'kon endpoint'lari o'ramsiz."""
        response = self.client.get(SESSIONS)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_sessiyani_bekor_qilish(self):
        session_id = self.client.get(SESSIONS).data[0]["id"]
        response = self.client.delete(f"{SESSIONS}/{session_id}")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(len(self.client.get(SESSIONS).data), 0)
