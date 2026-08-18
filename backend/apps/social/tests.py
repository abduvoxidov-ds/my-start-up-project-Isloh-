"""
ISLOH — sharh va muhokama testlari (M6).

UCHTA QOIDA qulflanadi (apps/social/views.py boshidagi izoh):
  1. sharh faqat kursga YOZILGAN talabadan, bir kursga bitta;
  2. muhokamani faqat kurs ichidagilar ko'radi;
  3. moderatsiya kurs egasida.

Va M6 dan boshlab jiddiy bo'ladigan to'rtinchisi: matn BOSHQA
foydalanuvchidan keladi — `SanitizeTests` teg bazaga tushmasligini
tekshiradi.
"""

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import ROLE_INSTRUCTOR, ROLE_STUDENT, User, UserRole
from apps.courses.models import STATUS_PUBLISHED, Course, CourseModule, CourseSettings
from apps.learning.models import Enrollment
from apps.social.models import (
    DiscussionReply,
    DiscussionThread,
    Reaction,
    Review,
    ReviewReply,
)
from apps.social.sanitize import isloh_clean_text

DISCUSSIONS = "/api/v1/discussions"
INSTRUCTOR_REVIEWS = "/api/v1/instructor/reviews"


def make_user(email, role):
    user = User.objects.create_user(email=email, password="TestParol2026!", full_name="Test Ism")
    UserRole.objects.create(user=user, role=role)
    return user


def make_course(owner):
    course = Course.objects.create(
        owner=owner,
        slug=f"kurs-{Course.objects.count() + 1}",
        title="Kurs",
        description="Tavsif",
        price_cents=1000,
        status=STATUS_PUBLISHED,
    )
    CourseSettings.objects.create(course=course)
    return course


class SocialTestCase(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.course = make_course(self.instructor)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.outsider = make_user("begona@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=self.student, course=self.course)

        self.reviews_url = f"/api/v1/courses/{self.course.id}/reviews"


class ReviewRuleTests(SocialTestCase):
    """QOIDA 1 — sharh faqat yozilgan talabadan, bir kursga bitta."""

    def test_yozilgan_talaba_sharh_qoldiradi(self):
        self.client.force_authenticate(self.student)
        res = self.client.post(self.reviews_url, {"rating": 5, "text": "Ajoyib kurs"})

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["rating"], 5)
        self.assertEqual(res.data["author"]["role"], "student")

    def test_yozilmagan_odam_sharh_qoldira_olmaydi(self):
        self.client.force_authenticate(self.outsider)
        res = self.client.post(self.reviews_url, {"rating": 1, "text": "Yomon"})

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("form", res.data["error"]["fields"])
        self.assertEqual(Review.objects.count(), 0)

    def test_bir_kursga_ikkinchi_sharh_yozilmaydi(self):
        self.client.force_authenticate(self.student)
        self.client.post(self.reviews_url, {"rating": 5, "text": "Birinchi"})

        res = self.client.post(self.reviews_url, {"rating": 1, "text": "Ikkinchi"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Review.objects.count(), 1)

    def test_ballning_chegarasi(self):
        self.client.force_authenticate(self.student)
        for bad in (0, 6, 99):
            res = self.client.post(self.reviews_url, {"rating": bad, "text": "Matn"})
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, bad)

    def test_avtorizatsiyasiz_yozib_bolmaydi(self):
        res = self.client.post(self.reviews_url, {"rating": 5, "text": "Salom"})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_sharhlar_royxati_ochiq(self):
        """Katalog sahifasi auth'siz ishlaydi (M2) — sharhsiz kurs sahifasi
        yarim bo'lardi."""
        Review.objects.create(course=self.course, user=self.student, rating=4, text="Yaxshi")

        self.client.force_authenticate(None)
        res = self.client.get(self.reviews_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 1)

    def test_ozgalarning_sharhini_tahrirlab_bolmaydi(self):
        review = Review.objects.create(course=self.course, user=self.student, rating=5, text="Zo'r")

        self.client.force_authenticate(self.outsider)
        res = self.client.put(f"/api/v1/reviews/{review.id}", {"rating": 1})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_oz_sharhini_tahrirlash_va_ochirish(self):
        self.client.force_authenticate(self.student)
        created = self.client.post(self.reviews_url, {"rating": 5, "text": "Zo'r"})
        review_id = created.data["id"]

        updated = self.client.put(f"/api/v1/reviews/{review_id}", {"rating": 3})
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["rating"], 3)

        removed = self.client.delete(f"/api/v1/reviews/{review_id}")
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Review.objects.count(), 0)

    def test_sharhning_kursini_ozgartirib_bolmaydi(self):
        """Aks holda `UNIQUE(course, user)` chetlab o'tilardi: sharhni
        boshqa kursga ko'chirib, birinchisiga yangisini yozish mumkin edi."""
        boshqa = make_course(self.instructor)
        Enrollment.objects.create(user=self.student, course=boshqa)
        review = Review.objects.create(course=self.course, user=self.student, rating=5, text="Zo'r")

        self.client.force_authenticate(self.student)
        res = self.client.put(f"/api/v1/reviews/{review.id}", {"course": str(boshqa.id)})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class CourseRatingTests(SocialTestCase):
    """Kurs reytingi sharhlardan hisoblanadi va SAQLANADI."""

    def _course(self):
        self.course.refresh_from_db()
        return self.course

    def test_reyting_va_sanoq_yangilanadi(self):
        self.client.force_authenticate(self.student)
        self.client.post(self.reviews_url, {"rating": 5, "text": "Besh"})

        boshqa = make_user("t2@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=boshqa, course=self.course)
        self.client.force_authenticate(boshqa)
        self.client.post(self.reviews_url, {"rating": 3, "text": "Uch"})

        self.assertEqual(float(self._course().rating), 4.0)
        self.assertEqual(self._course().reviews_count, 2)

    def test_sharh_ochirilsa_reyting_qaytadi(self):
        self.client.force_authenticate(self.student)
        created = self.client.post(self.reviews_url, {"rating": 5, "text": "Besh"})
        self.client.delete(f"/api/v1/reviews/{created.data['id']}")

        self.assertEqual(float(self._course().rating), 0.0)
        self.assertEqual(self._course().reviews_count, 0)

    def test_reytingni_oqituvchi_ozi_yoza_olmaydi(self):
        """`rating` — `read_only`: API orqali istalgan reyting qo'yib
        bo'lmasin (M2 dagi qaror bilan bir xil sabab)."""
        self.client.force_authenticate(self.instructor)
        res = self.client.patch(
            f"/api/v1/instructor/courses/{self.course.id}", {"rating": "5.00", "reviews_count": 999}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(float(self._course().rating), 0.0)
        self.assertEqual(self._course().reviews_count, 0)


class ReviewReplyTests(SocialTestCase):
    def setUp(self):
        super().setUp()
        self.review = Review.objects.create(
            course=self.course, user=self.student, rating=4, text="Yaxshi kurs"
        )
        self.url = f"/api/v1/instructor/reviews/{self.review.id}/reply"

    def test_oqituvchi_javob_yozadi(self):
        self.client.force_authenticate(self.instructor)
        res = self.client.post(self.url, {"text": "Rahmat!"})

        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["reply"]["text"], "Rahmat!")

    def test_ikkinchi_javob_eskisini_yangilaydi(self):
        self.client.force_authenticate(self.instructor)
        self.client.post(self.url, {"text": "Birinchi"})
        res = self.client.post(self.url, {"text": "Ikkinchi"})

        self.assertEqual(res.data["reply"]["text"], "Ikkinchi")
        self.assertEqual(ReviewReply.objects.count(), 1)

    def test_begona_sharhga_javob_yozib_bolmaydi(self):
        boshqa = make_user("o2@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(boshqa)
        res = self.client.post(self.url, {"text": "Men javob beraman"})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_talaba_javob_yoza_olmaydi(self):
        self.client.force_authenticate(self.student)
        res = self.client.post(self.url, {"text": "O'zimga javob"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_bosh_javob_qabul_qilinmaydi(self):
        self.client.force_authenticate(self.instructor)
        res = self.client.post(self.url, {"text": "   "})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_instructor_royxati_massiv_va_faqat_oz_kurslari(self):
        boshqa = make_user("o2@isloh.uz", ROLE_INSTRUCTOR)
        begona_kurs = make_course(boshqa)
        Enrollment.objects.create(user=self.student, course=begona_kurs)
        Review.objects.create(course=begona_kurs, user=self.student, rating=1, text="Begona")

        self.client.force_authenticate(self.instructor)
        res = self.client.get(INSTRUCTOR_REVIEWS)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["text"], "Yaxshi kurs")


class DiscussionAccessTests(SocialTestCase):
    """QOIDA 2 — muhokamani faqat kurs ichidagilar ko'radi."""

    def setUp(self):
        super().setUp()
        self.thread = DiscussionThread.objects.create(
            course=self.course, author=self.student, title="Savolim bor", body="Matn"
        )

    def test_yozilgan_talaba_koradi(self):
        self.client.force_authenticate(self.student)
        res = self.client.get(DISCUSSIONS, {"course": str(self.course.id)})

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 1)

    def test_yozilmagan_odam_404(self):
        self.client.force_authenticate(self.outsider)
        res = self.client.get(DISCUSSIONS, {"course": str(self.course.id)})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_kurssiz_royxatda_begona_mavzu_korinmaydi(self):
        self.client.force_authenticate(self.outsider)
        res = self.client.get(DISCUSSIONS)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_oqituvchi_oz_kursini_koradi(self):
        self.client.force_authenticate(self.instructor)
        res = self.client.get(DISCUSSIONS)
        self.assertEqual(len(res.data), 1)

    def test_yozilmagan_odam_mavzu_ocha_olmaydi(self):
        self.client.force_authenticate(self.outsider)
        res = self.client.post(DISCUSSIONS, {"course": str(self.course.id), "title": "Salom"})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(DiscussionThread.objects.count(), 1)

    def test_avtorizatsiyasiz_401(self):
        self.assertEqual(self.client.get(DISCUSSIONS).status_code, status.HTTP_401_UNAUTHORIZED)


class DiscussionThreadTests(SocialTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.student)

    def test_mavzu_yaratiladi(self):
        res = self.client.post(DISCUSSIONS, {
            "course": str(self.course.id), "title": "Docker xatosi", "body": "Yordam kerak",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["author"]["role"], "student")
        self.assertEqual(res.data["like_count"], 0)
        self.assertEqual(res.data["reply_count"], 0)
        self.assertFalse(res.data["liked"])

    def test_begona_kursning_moduli_biriktirilmaydi(self):
        boshqa = make_course(make_user("o2@isloh.uz", ROLE_INSTRUCTOR))
        module = CourseModule.objects.create(course=boshqa, title="Begona modul")

        res = self.client.post(DISCUSSIONS, {
            "course": str(self.course.id), "title": "Mavzu", "module": str(module.id),
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_qadalgan_mavzu_tepada(self):
        eski = DiscussionThread.objects.create(course=self.course, author=self.student, title="Eski")
        DiscussionThread.objects.create(course=self.course, author=self.student, title="Yangi")

        self.client.force_authenticate(self.instructor)
        self.client.post(f"{DISCUSSIONS}/{eski.id}/pin")

        res = self.client.get(DISCUSSIONS, {"course": str(self.course.id)})
        self.assertEqual(res.data[0]["title"], "Eski")
        self.assertTrue(res.data[0]["is_pinned"])

    def test_talaba_qadab_bolmaydi(self):
        """Qadalgan mavzu hamma uchun tepada turadi — bu o'qituvchining
        vositasi."""
        thread = DiscussionThread.objects.create(course=self.course, author=self.student, title="M")
        res = self.client.post(f"{DISCUSSIONS}/{thread.id}/pin")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_mavzu_muallifi_hal_qilindi_deb_belgilaydi(self):
        thread = DiscussionThread.objects.create(course=self.course, author=self.student, title="M")
        res = self.client.post(f"{DISCUSSIONS}/{thread.id}/solve")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["is_solved"])

    def test_begona_odam_hal_qilindi_deb_belgilay_olmaydi(self):
        boshqa = make_user("t2@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=boshqa, course=self.course)
        thread = DiscussionThread.objects.create(course=self.course, author=self.student, title="M")

        self.client.force_authenticate(boshqa)
        res = self.client.post(f"{DISCUSSIONS}/{thread.id}/solve")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_ozganing_mavzusini_tahrirlab_bolmaydi(self):
        thread = DiscussionThread.objects.create(course=self.course, author=self.student, title="M")

        self.client.force_authenticate(self.instructor)
        res = self.client.put(
            f"{DISCUSSIONS}/{thread.id}", {"course": str(self.course.id), "title": "Boshqacha"}
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_oqituvchi_begona_mavzuni_ochira_oladi(self):
        """QOIDA 3 — moderatsiya kurs egasida."""
        thread = DiscussionThread.objects.create(course=self.course, author=self.student, title="M")

        self.client.force_authenticate(self.instructor)
        res = self.client.delete(f"{DISCUSSIONS}/{thread.id}")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_begona_talaba_ochira_olmaydi(self):
        boshqa = make_user("t2@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=boshqa, course=self.course)
        thread = DiscussionThread.objects.create(course=self.course, author=self.student, title="M")

        self.client.force_authenticate(boshqa)
        res = self.client.delete(f"{DISCUSSIONS}/{thread.id}")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


class ReactionTests(SocialTestCase):
    def setUp(self):
        super().setUp()
        self.thread = DiscussionThread.objects.create(
            course=self.course, author=self.student, title="Mavzu"
        )
        self.client.force_authenticate(self.student)

    def test_yoqtirish_almashadi(self):
        first = self.client.post(f"{DISCUSSIONS}/{self.thread.id}/like")
        self.assertEqual(first.data["like_count"], 1)
        self.assertTrue(first.data["liked"])

        second = self.client.post(f"{DISCUSSIONS}/{self.thread.id}/like")
        self.assertEqual(second.data["like_count"], 0)
        self.assertFalse(second.data["liked"])

    def test_bir_odam_ikki_marta_sanalmaydi(self):
        """Ilgari sanoq `textContent` dan o'qilardi va tugmani ikki marta
        bosish uni ikki marta oshirardi (js/discussion.js)."""
        self.client.post(f"{DISCUSSIONS}/{self.thread.id}/like")
        Reaction.objects.create(user=self.instructor, thread=self.thread)

        res = self.client.get(DISCUSSIONS, {"course": str(self.course.id)})
        self.assertEqual(res.data[0]["like_count"], 2)
        self.assertEqual(Reaction.objects.filter(thread=self.thread).count(), 2)

    def test_liked_faqat_ozimniki(self):
        Reaction.objects.create(user=self.instructor, thread=self.thread)

        res = self.client.get(DISCUSSIONS, {"course": str(self.course.id)})
        self.assertEqual(res.data[0]["like_count"], 1)
        self.assertFalse(res.data[0]["liked"])


class DiscussionReplyTests(SocialTestCase):
    def setUp(self):
        super().setUp()
        self.thread = DiscussionThread.objects.create(
            course=self.course, author=self.student, kind="qa", title="Savol"
        )
        self.client.force_authenticate(self.student)

    def _reply(self, text="Javobim", parent=None):
        body = {"text": text}
        if parent:
            body["parent"] = str(parent)
        return self.client.post(f"{DISCUSSIONS}/{self.thread.id}/replies", body)

    def test_javob_qoshiladi(self):
        res = self._reply()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["reply_count"], 1)
        self.assertEqual(res.data["replies"][0]["text"], "Javobim")

    def test_ichma_ich_ikki_daraja_bilan_cheklanadi(self):
        """Uchinchi daraja frontendda sahifadan chiqib ketardi — nevara
        javob bobosiga biriktiriladi, rad etilmaydi."""
        birinchi = self._reply("Birinchi")
        first_id = birinchi.data["replies"][0]["id"]

        ikkinchi = self._reply("Ikkinchi", parent=first_id)
        second_id = [r for r in ikkinchi.data["replies"] if r["text"] == "Ikkinchi"][0]["id"]

        uchinchi = self._reply("Uchinchi", parent=second_id)
        row = [r for r in uchinchi.data["replies"] if r["text"] == "Uchinchi"][0]
        self.assertEqual(str(row["parent"]), str(first_id))

    def test_javobni_qabul_qilish_mavzuni_hal_qiladi(self):
        created = self._reply()
        reply_id = created.data["replies"][0]["id"]

        res = self.client.post(f"/api/v1/discussion-replies/{reply_id}/accept")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["is_accepted"])

        self.thread.refresh_from_db()
        self.assertTrue(self.thread.is_solved)

    def test_bitta_qabul_qilingan_javob(self):
        birinchi = self._reply("Birinchi")
        first_id = birinchi.data["replies"][0]["id"]
        ikkinchi = self._reply("Ikkinchi")
        second_id = [r for r in ikkinchi.data["replies"] if r["text"] == "Ikkinchi"][0]["id"]

        self.client.post(f"/api/v1/discussion-replies/{first_id}/accept")
        self.client.post(f"/api/v1/discussion-replies/{second_id}/accept")

        self.assertEqual(DiscussionReply.objects.filter(is_accepted=True).count(), 1)

    def test_javob_muallifi_ozini_qabul_qildira_olmaydi(self):
        boshqa = make_user("t2@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=boshqa, course=self.course)

        self.client.force_authenticate(boshqa)
        created = self._reply("Meniki eng yaxshi")
        reply_id = [r for r in created.data["replies"] if r["text"] == "Meniki eng yaxshi"][0]["id"]

        res = self.client.post(f"/api/v1/discussion-replies/{reply_id}/accept")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_ozganing_javobini_tahrirlab_bolmaydi(self):
        created = self._reply()
        reply_id = created.data["replies"][0]["id"]

        self.client.force_authenticate(self.instructor)
        res = self.client.put(f"/api/v1/discussion-replies/{reply_id}", {"text": "Boshqacha"})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_oqituvchi_begona_javobni_ochira_oladi(self):
        created = self._reply()
        reply_id = created.data["replies"][0]["id"]

        self.client.force_authenticate(self.instructor)
        res = self.client.delete(f"/api/v1/discussion-replies/{reply_id}")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_yozilmagan_odam_javob_yoza_olmaydi(self):
        self.client.force_authenticate(self.outsider)
        res = self._reply()
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_oqituvchi_javobi_instructor_rolida_korinadi(self):
        self.client.force_authenticate(self.instructor)
        res = self._reply("O'qituvchi javobi")
        row = [r for r in res.data["replies"] if r["text"] == "O'qituvchi javobi"][0]
        self.assertEqual(row["author"]["role"], "instructor")

    def test_bosh_javob_qabul_qilinmaydi(self):
        self.assertEqual(self._reply("   ").status_code, status.HTTP_400_BAD_REQUEST)


class SanitizeTests(SocialTestCase):
    """M6 dan boshlab matn BOSHQA foydalanuvchidan keladi.

    Asosiy himoya — chizishda ekranlash (js/escape.js). Bu yerdagi test
    IKKINCHI qatlamni qulflaydi: bazaga teg tushmasin, ya'ni matnni
    ekranlashni unutgan kelajakdagi ko'rinish ham zarar bermasin.
    """

    XSS = '<script>alert("xss")</script>Salom'

    def test_sharh_matnidan_teg_olib_tashlanadi(self):
        self.client.force_authenticate(self.student)
        res = self.client.post(self.reviews_url, {"rating": 5, "text": self.XSS})

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("<script", res.data["text"])
        self.assertIn("Salom", res.data["text"])

    def test_mavzu_sarlavhasi_va_matni_tozalanadi(self):
        self.client.force_authenticate(self.student)
        res = self.client.post(DISCUSSIONS, {
            "course": str(self.course.id),
            "title": '<img src=x onerror=alert(1)>Sarlavha',
            "body": self.XSS,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertNotIn("<img", res.data["title"])
        self.assertNotIn("<script", res.data["body"])

    def test_javob_matni_tozalanadi(self):
        thread = DiscussionThread.objects.create(
            course=self.course, author=self.student, title="M"
        )
        self.client.force_authenticate(self.student)
        res = self.client.post(f"{DISCUSSIONS}/{thread.id}/replies", {"text": self.XSS})

        self.assertNotIn("<script", res.data["replies"][0]["text"])

    def test_oqituvchi_javobi_ham_tozalanadi(self):
        """O'qituvchi ham foydalanuvchi — uning matni talaba ekranida
        chiziladi."""
        review = Review.objects.create(course=self.course, user=self.student, rating=5, text="Zo'r")

        self.client.force_authenticate(self.instructor)
        res = self.client.post(f"/api/v1/instructor/reviews/{review.id}/reply", {"text": self.XSS})
        self.assertNotIn("<script", res.data["reply"]["text"])

    def test_oddiy_matn_buzilmaydi(self):
        """`a < b` teg emas — u shundayligicha qolishi kerak."""
        self.assertEqual(isloh_clean_text("a < b va c > d"), "a < b va c > d")

    def test_nazorat_belgilari_olib_tashlanadi(self):
        self.assertEqual(isloh_clean_text("Sa\x00lom\x07"), "Salom")

    def test_uzun_bosh_qatorlar_qisqaradi(self):
        self.assertEqual(isloh_clean_text("bir\n\n\n\n\nikki"), "bir\n\nikki")
