"""
ISLOH — kurslar moduli testlari (M2).

Nimani qo'riqlaydi:
  1. §0.1 — `/instructor/courses` MASSIV qaytaradi, `/catalog` esa o'ram
  2. Egalik — begona kurs 403 emas, 404 (mavjudligi oshkor bo'lmasin)
  3. Rol — o'qituvchi bo'lmagan foydalanuvchi yoza olmaydi
  4. Nashr tekshiruvi serverda ham ishlaydi (frontendni chetlab o'tib
     bo'sh kurs nashr etilmasin)
  5. Katalogda faqat nashr etilgan va yopiq bo'lmagan kurslar
"""

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import ROLE_INSTRUCTOR, ROLE_STUDENT, User, UserRole
from apps.courses.models import (
    STATUS_ARCHIVED,
    STATUS_DRAFT,
    STATUS_PUBLISHED,
    Course,
    CourseModule,
    CourseSettings,
    Lesson,
)

COURSES_URL = "/api/v1/instructor/courses"
CATALOG_URL = "/api/v1/catalog"


def make_user(email, role):
    user = User.objects.create_user(email=email, password="TestParol2026!", full_name="Test")
    UserRole.objects.create(user=user, role=role)
    return user


def make_course(owner, **kwargs):
    """To'liq kurs: sozlamalari bilan (view ham shunday yaratadi)."""
    defaults = {
        "slug": kwargs.get("title", "kurs").lower().replace(" ", "-"),
        "title": "Kurs",
        "description": "Tavsif",
        "price_cents": 10000,
        "status": STATUS_DRAFT,
    }
    defaults.update(kwargs)
    course = Course.objects.create(owner=owner, **defaults)
    CourseSettings.objects.create(course=course)
    return course


def add_lesson(course, title="Dars"):
    module = CourseModule.objects.create(course=course, title="Modul")
    return Lesson.objects.create(module=module, title=title)


class InstructorCourseListTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.other = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(self.instructor)

    def test_royxat_massiv_qaytaradi(self):
        """§0.1 — o'ram kelsa js/api.js dagi .map() TypeError berardi."""
        make_course(self.instructor, title="Birinchi", slug="birinchi")

        response = self.client.get(COURSES_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.json(), list)

    def test_faqat_oz_kurslari_korinadi(self):
        make_course(self.instructor, title="Meniki", slug="meniki")
        make_course(self.other, title="O'zganiki", slug="ozganiki")

        titles = [c["title"] for c in self.client.get(COURSES_URL).json()]

        self.assertEqual(titles, ["Meniki"])

    def test_begona_kurs_404(self):
        """403 EMAS: 403 javobning o'zi kurs borligini oshkor qilardi."""
        foreign = make_course(self.other, title="O'zganiki", slug="ozganiki")

        response = self.client.get(f"{COURSES_URL}/{foreign.pk}")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_dars_soni_tarkibdan_hisoblanadi(self):
        course = make_course(self.instructor, title="Kurs", slug="kurs")
        add_lesson(course)
        add_lesson(course)

        row = self.client.get(COURSES_URL).json()[0]

        self.assertEqual(row["lessons_count"], 2)


class InstructorCourseWriteTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(self.instructor)

    def test_yaratishda_egasi_va_slug_qoyiladi(self):
        response = self.client.post(
            COURSES_URL,
            {"title": "Python Backend", "description": "Tavsif", "price_cents": 5000},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        course = Course.objects.get(pk=response.json()["id"])
        self.assertEqual(course.owner, self.instructor)
        self.assertEqual(course.slug, "python-backend")

    def test_slug_band_bolsa_raqam_qoshiladi(self):
        make_course(self.instructor, title="Python", slug="python")

        response = self.client.post(
            COURSES_URL, {"title": "Python", "description": "T"}, format="json"
        )

        self.assertEqual(response.json()["slug"], "python-2")

    def test_teglar_va_turkum_nom_boyicha(self):
        response = self.client.post(
            COURSES_URL,
            {
                "title": "Kurs",
                "description": "T",
                "category": "Backend",
                "tags": ["Python", "Django", "Python"],
            },
            format="json",
        )

        data = response.json()
        self.assertEqual(data["category"], "Backend")
        # Takroriy teg tushib qoladi
        self.assertEqual(data["tags"], ["Python", "Django"])

    def test_sozlamalar_javobga_tekislanadi(self):
        response = self.client.post(
            COURSES_URL,
            {"title": "Kurs", "description": "T", "meta_title": "SEO", "visibility": "unlisted"},
            format="json",
        )

        data = response.json()
        self.assertEqual(data["meta_title"], "SEO")
        self.assertEqual(data["visibility"], "unlisted")

    def test_statistikani_oqituvchi_yoza_olmaydi(self):
        """Reyting/talaba soni keyingi modullar mas'uliyati (M3/M6/M9)."""
        response = self.client.post(
            COURSES_URL,
            {"title": "Kurs", "description": "T", "rating": "5.00", "students_count": 9999},
            format="json",
        )

        data = response.json()
        self.assertEqual(float(data["rating"]), 0.0)
        self.assertEqual(data["students_count"], 0)

    def test_qayta_saqlashda_slug_ozgarmaydi(self):
        """Ilgari har saqlashda oxiriga `-2` qo'shilib ketardi."""
        course = make_course(self.instructor, title="Kurs", slug="kurs")

        for _ in range(3):
            self.client.patch(
                f"{COURSES_URL}/{course.pk}", {"slug": "kurs"}, format="json"
            )

        course.refresh_from_db()
        self.assertEqual(course.slug, "kurs")


class PublishValidationTests(APITestCase):
    """docs/BACKEND-PLAN.md §M2 — nashr tekshiruvi serverda ham."""

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(self.instructor)

    def _publish(self, course):
        return self.client.post(f"{COURSES_URL}/{course.pk}/publish")

    def test_darssiz_kurs_nashr_etilmaydi(self):
        course = make_course(self.instructor, title="Kurs", slug="kurs")

        response = self._publish(course)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        course.refresh_from_db()
        self.assertEqual(course.status, STATUS_DRAFT)

    def test_narxsiz_kurs_nashr_etilmaydi(self):
        course = make_course(self.instructor, title="Kurs", slug="kurs", price_cents=0)
        add_lesson(course)

        response = self._publish(course)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Narx", str(response.json()))

    def test_bepul_kurs_narxsiz_ham_nashr_etiladi(self):
        course = make_course(self.instructor, title="Kurs", slug="kurs", price_cents=0, free=True)
        add_lesson(course)

        self.assertEqual(self._publish(course).status_code, status.HTTP_200_OK)

    def test_tavsifsiz_kurs_nashr_etilmaydi(self):
        course = make_course(self.instructor, title="Kurs", slug="kurs", description="")
        add_lesson(course)

        self.assertEqual(self._publish(course).status_code, status.HTTP_400_BAD_REQUEST)

    def test_toliq_kurs_nashr_etiladi(self):
        course = make_course(self.instructor, title="Kurs", slug="kurs")
        add_lesson(course)

        response = self._publish(course)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        course.refresh_from_db()
        self.assertEqual(course.status, STATUS_PUBLISHED)
        self.assertIsNotNone(course.published_at)

    def test_xato_shakli_shartnomaga_mos(self):
        """§0.2 — `fields` qiymati SATR (frontend uni textContent ga yozadi)."""
        course = make_course(self.instructor, title="Kurs", slug="kurs")

        error = self._publish(course).json()["error"]

        self.assertEqual(error["code"], "validation_error")
        self.assertIsInstance(error["fields"]["status"], str)

    def test_arxivlashga_tekshiruv_qollanmaydi(self):
        """Faqat NASHR bloklanadi — arxivga olish har doim mumkin."""
        course = make_course(self.instructor, title="Kurs", slug="kurs")

        response = self.client.patch(
            f"{COURSES_URL}/{course.pk}/status", {"status": STATUS_ARCHIVED}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class DuplicateTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(self.instructor)

    def test_nusxa_tarkibi_bilan_lekin_statistikasiz(self):
        course = make_course(
            self.instructor,
            title="Asl",
            slug="asl",
            status=STATUS_PUBLISHED,
            students_count=500,
            rating="4.90",
        )
        add_lesson(course)

        response = self.client.post(f"{COURSES_URL}/{course.pk}/duplicate")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["title"], "Asl (nusxa)")
        self.assertEqual(data["status"], STATUS_DRAFT)
        self.assertEqual(data["students_count"], 0)
        self.assertEqual(float(data["rating"]), 0.0)
        # Tarkib ko'chiriladi
        self.assertEqual(data["lessons_count"], 1)
        self.assertNotEqual(data["slug"], course.slug)


class PermissionTests(APITestCase):
    def test_avtorizatsiyasiz_401(self):
        self.assertEqual(self.client.get(COURSES_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_talaba_kurs_yarata_olmaydi(self):
        """Rol alohida jadvalda — talaba o'qituvchi endpoint'iga kira olmaydi."""
        self.client.force_authenticate(make_user("t@isloh.uz", ROLE_STUDENT))

        response = self.client.post(COURSES_URL, {"title": "Kurs"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ModuleLessonTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(self.instructor)
        self.course = make_course(self.instructor, title="Kurs", slug="kurs")

    def test_modul_qoshiladi_va_tartib_oxiriga_tushadi(self):
        first = self.client.post(
            f"{COURSES_URL}/{self.course.pk}/modules", {"title": "Birinchi"}, format="json"
        ).json()
        second = self.client.post(
            f"{COURSES_URL}/{self.course.pk}/modules", {"title": "Ikkinchi"}, format="json"
        ).json()

        self.assertEqual(first["position"], 0)
        self.assertEqual(second["position"], 1)

    def test_modullarni_qayta_tartiblash(self):
        a = CourseModule.objects.create(course=self.course, title="A", position=0)
        b = CourseModule.objects.create(course=self.course, title="B", position=1)

        response = self.client.post(
            f"{COURSES_URL}/{self.course.pk}/modules/reorder",
            {"ids": [str(b.pk), str(a.pk)]},
            format="json",
        )

        self.assertEqual([m["title"] for m in response.json()], ["B", "A"])

    def test_royxatga_kirmagan_modul_yoqolmaydi(self):
        """Frontend faqat ko'rinib turgan qismini yuborishi mumkin."""
        a = CourseModule.objects.create(course=self.course, title="A", position=0)
        CourseModule.objects.create(course=self.course, title="B", position=1)

        response = self.client.post(
            f"{COURSES_URL}/{self.course.pk}/modules/reorder",
            {"ids": [str(a.pk)]},
            format="json",
        )

        self.assertEqual(len(response.json()), 2)

    def test_dars_qoshiladi(self):
        module = CourseModule.objects.create(course=self.course, title="Modul")

        response = self.client.post(
            f"/api/v1/instructor/modules/{module.pk}/lessons",
            {"title": "Kirish", "type": "video", "duration": "8 daq"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["title"], "Kirish")

    def test_begona_kursning_moduliga_tegib_bolmaydi(self):
        other = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        foreign_course = make_course(other, title="O'zganiki", slug="ozganiki")
        foreign_module = CourseModule.objects.create(course=foreign_course, title="Modul")

        response = self.client.patch(
            f"/api/v1/instructor/modules/{foreign_module.pk}", {"title": "Buzildi"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        foreign_module.refresh_from_db()
        self.assertEqual(foreign_module.title, "Modul")


class CatalogTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)

    def _published(self, title, slug, visibility="public"):
        course = make_course(self.instructor, title=title, slug=slug, status=STATUS_PUBLISHED)
        CourseSettings.objects.filter(course=course).update(visibility=visibility)
        return course

    def test_katalog_oram_bilan_keladi(self):
        """§0.1 — katalog do'kon endpoint'i EMAS, sahifalanadi."""
        self._published("Kurs", "kurs")

        body = self.client.get(CATALOG_URL).json()

        self.assertIn("data", body)
        self.assertIn("meta", body)
        self.assertEqual(body["meta"]["total"], 1)

    def test_katalog_auth_talab_qilmaydi(self):
        self._published("Kurs", "kurs")

        self.assertEqual(self.client.get(CATALOG_URL).status_code, status.HTTP_200_OK)

    def test_qoralama_katalogda_yoq(self):
        make_course(self.instructor, title="Qoralama", slug="qoralama")

        self.assertEqual(self.client.get(CATALOG_URL).json()["meta"]["total"], 0)

    def test_yopiq_kurs_katalogda_yoq(self):
        self._published("Yopiq", "yopiq", visibility="private")

        self.assertEqual(self.client.get(CATALOG_URL).json()["meta"]["total"], 0)

    def test_unlisted_royxatda_yoq_lekin_havola_bilan_ochiladi(self):
        course = self._published("Havola", "havola", visibility="unlisted")

        self.assertEqual(self.client.get(CATALOG_URL).json()["meta"]["total"], 0)

        detail = self.client.get(f"{CATALOG_URL}/{course.slug}")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)

    def test_tafsilot_tarkib_va_muallif_bilan(self):
        course = self._published("Kurs", "kurs")
        add_lesson(course, title="Kirish")

        data = self.client.get(f"{CATALOG_URL}/{course.slug}").json()

        self.assertEqual(data["modules"][0]["lessons"][0]["title"], "Kirish")
        self.assertEqual(data["instructor"]["full_name"], "Test")

    def test_turkum_boyicha_filtr(self):
        backend = self._published("Backend kursi", "backend-kursi")
        from apps.courses.models import Category

        backend.category = Category.objects.create(name="Backend", slug="backend")
        backend.save()
        self._published("Boshqa", "boshqa")

        body = self.client.get(f"{CATALOG_URL}?category=Backend").json()

        self.assertEqual(body["meta"]["total"], 1)


class PublishBypassTests(APITestCase):
    """Nashr tekshiruvini oddiy yozuv yo'li bilan chetlab o'tib bo'lmaydi.

    Do'kon fabrikasi (js/api.js) butun obyektni `PUT` bilan yuboradi —
    `/publish` endpoint'i yagona yo'l emas.
    """

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(self.instructor)

    def test_put_orqali_bosh_kurs_nashr_etilmaydi(self):
        course = make_course(self.instructor, title="Kurs", slug="kurs")

        response = self.client.put(
            f"{COURSES_URL}/{course.pk}",
            {"title": "Kurs", "description": "T", "price_cents": 100, "status": STATUS_PUBLISHED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        course.refresh_from_db()
        self.assertEqual(course.status, STATUS_DRAFT)

    def test_patch_orqali_ham_bloklanadi(self):
        course = make_course(self.instructor, title="Kurs", slug="kurs")

        response = self.client.patch(
            f"{COURSES_URL}/{course.pk}", {"status": STATUS_PUBLISHED}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bir_sorovda_tavsif_va_nashr_birga_kelsa_qabul_qilinadi(self):
        """Tekshiruv SO'ROVDAN KEYINGI holatga qo'llanadi."""
        course = make_course(self.instructor, title="Kurs", slug="kurs", description="")
        add_lesson(course)

        response = self.client.patch(
            f"{COURSES_URL}/{course.pk}",
            {"description": "Endi tavsif bor", "status": STATUS_PUBLISHED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        course.refresh_from_db()
        self.assertEqual(course.status, STATUS_PUBLISHED)


class DuplicateContentTests(APITestCase):
    """Modul/dars nusxasi serverda bajariladi (mijozda N+1 so'rov bo'lardi)."""

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(self.instructor)
        self.course = make_course(self.instructor, title="Kurs", slug="kurs")

    def test_modul_nusxasi_darslari_bilan(self):
        module = CourseModule.objects.create(course=self.course, title="Modul", position=0)
        Lesson.objects.create(module=module, title="Dars 1", position=0)
        Lesson.objects.create(module=module, title="Dars 2", position=1)

        response = self.client.post(f"/api/v1/instructor/modules/{module.pk}/duplicate")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["title"], "Modul (nusxa)")
        self.assertEqual(data["status"], STATUS_DRAFT)
        self.assertEqual([lesson["title"] for lesson in data["lessons"]], ["Dars 1", "Dars 2"])

    def test_nusxa_asl_modulning_orqasiga_tushadi(self):
        first = CourseModule.objects.create(course=self.course, title="Birinchi", position=0)
        CourseModule.objects.create(course=self.course, title="Ikkinchi", position=1)

        self.client.post(f"/api/v1/instructor/modules/{first.pk}/duplicate")

        titles = list(self.course.modules.values_list("title", flat=True))
        self.assertEqual(titles, ["Birinchi", "Birinchi (nusxa)", "Ikkinchi"])

    def test_dars_nusxasi(self):
        module = CourseModule.objects.create(course=self.course, title="Modul")
        lesson = Lesson.objects.create(module=module, title="Kirish", type="video", position=0)

        response = self.client.post(f"/api/v1/instructor/lessons/{lesson.pk}/duplicate")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["title"], "Kirish (nusxa)")
        self.assertEqual(module.lessons.count(), 2)

    def test_begona_modulni_nusxalab_bolmaydi(self):
        other = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        foreign = CourseModule.objects.create(
            course=make_course(other, title="O'zganiki", slug="ozganiki"), title="Modul"
        )

        response = self.client.post(f"/api/v1/instructor/modules/{foreign.pk}/duplicate")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class CatalogPaginationOrderTests(APITestCase):
    """Sahifalash BARQAROR bo'lishi kerak — PostgreSQL'ga o'tishda topildi.

    `isloh_course_queryset()` da `annotate()` bor va u guruhlash qo'shadi;
    shu sababli Django modelning `Meta.ordering` ini SQL'ga chiqarmay
    qo'yardi. SQLite'da qatorlar tasodifan qo'shilish tartibida qaytar va
    muammo ko'rinmasdi, PostgreSQL'da esa tartib ANIQLANMAGAN: bitta kurs
    ikki sahifada takrorlanishi yoki umuman tushib qolishi mumkin edi.
    """

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        for i in range(7):
            course = make_course(self.instructor, title=f"Kurs {i}", slug=f"kurs-{i}")
            course.status = STATUS_PUBLISHED
            course.save(update_fields=["status"])

    def test_katalog_sorovida_order_by_bor(self):
        from apps.courses.views import isloh_catalog_queryset

        self.assertTrue(
            isloh_catalog_queryset().ordered,
            "Katalog so'rovi tartiblanmagan — sahifalash beqaror bo'ladi",
        )

    def test_sahifalar_ortasida_takror_yoki_yoqolish_yoq(self):
        birinchi = self.client.get("/api/v1/catalog", {"per_page": 3, "page": 1}).json()["data"]
        ikkinchi = self.client.get("/api/v1/catalog", {"per_page": 3, "page": 2}).json()["data"]
        uchinchi = self.client.get("/api/v1/catalog", {"per_page": 3, "page": 3}).json()["data"]

        ids = [row["id"] for row in birinchi + ikkinchi + uchinchi]

        self.assertEqual(len(ids), 7)
        self.assertEqual(len(set(ids)), 7, "Sahifalar orasida takrorlangan kurs bor")

    def test_takroriy_sorov_bir_xil_tartib_beradi(self):
        birinchi = [c["id"] for c in self.client.get("/api/v1/catalog", {"per_page": 5}).json()["data"]]
        ikkinchi = [c["id"] for c in self.client.get("/api/v1/catalog", {"per_page": 5}).json()["data"]]

        self.assertEqual(birinchi, ikkinchi)
