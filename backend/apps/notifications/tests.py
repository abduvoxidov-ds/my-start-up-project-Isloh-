"""
ISLOH — bildirishnoma testlari (M7).

Ikkita qoida qulflanadi (apps/notifications/events.py):
  1. o'zingga bildirishnoma kelmaydi;
  2. bildirishnoma hech qachon so'rovni yiqitmaydi.

Uchinchisi ko'rinishlardan: foydalanuvchi FAQAT o'zinikini ko'radi va
o'zgartiradi, begonasiga tegishga urinish 404 beradi.

`EventTests` esa har bir voqea HAQIQATAN xabar yasashini tekshiradi —
ular boshqa modullarning ko'rinishlariga ulangan (M3, M4, M6) va o'sha
ulanish uzilib qolsa modul jimgina ishlamay qo'yardi.
"""

from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import ROLE_INSTRUCTOR, ROLE_STUDENT, User, UserRole
from apps.assessment.models import Assignment, Submission
from apps.courses.models import STATUS_PUBLISHED, Course, CourseSettings
from apps.learning.models import Enrollment
from apps.notifications.events import isloh_notify
from apps.notifications.models import Notification
from apps.social.models import DiscussionThread, Review

NOTIFICATIONS = "/api/v1/notifications"


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


class NotificationTestCase(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.course = make_course(self.instructor)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)

    def notify(self, user=None, role="student", title="Sinov"):
        return Notification.objects.create(
            user=user or self.student, role=role, type="system", title=title
        )


class EventTests(NotificationTestCase):
    """Har bir voqea xabar yasaydimi — ulanish uzilib qolmasin."""

    def test_kursga_yozilish_oqituvchiga_boradi(self):
        self.client.force_authenticate(self.student)
        res = self.client.post("/api/v1/student/enrollments", {"course": str(self.course.id)})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

        row = Notification.objects.get(user=self.instructor)
        self.assertEqual(row.role, "instructor")
        self.assertEqual(row.type, "enrollment")
        self.assertIn("Test Ism", row.body)
        self.assertEqual(row.actor_id, self.student.id)

    def test_takroriy_yozilish_ikkinchi_xabar_yasamaydi(self):
        """Tugma ikki marta bosilishi mumkin — natija bir xil bo'lishi kerak."""
        self.client.force_authenticate(self.student)
        body = {"course": str(self.course.id)}
        self.client.post("/api/v1/student/enrollments", body)
        self.client.post("/api/v1/student/enrollments", body)

        self.assertEqual(Notification.objects.filter(user=self.instructor).count(), 1)

    def test_topshiriq_topshirildi_va_baholandi(self):
        Enrollment.objects.create(user=self.student, course=self.course)
        assignment = Assignment.objects.create(
            owner=self.instructor, course=self.course, title="Topshiriq",
            status="published", max_score=100,
        )

        self.client.force_authenticate(self.student)
        created = self.client.post(
            f"/api/v1/student/assignments/{assignment.id}/submissions", {"text": "Tayyor"}
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        to_instructor = Notification.objects.get(user=self.instructor)
        self.assertEqual(to_instructor.type, "submission")

        # Baholash -> talabaga, ball MATNDA
        submission = Submission.objects.get()
        self.client.force_authenticate(self.instructor)
        graded = self.client.post(
            f"/api/v1/instructor/submissions/{submission.id}/grade", {"score": 85}
        )
        self.assertEqual(graded.status_code, status.HTTP_200_OK, graded.data)

        to_student = Notification.objects.get(user=self.student)
        self.assertEqual(to_student.role, "student")
        self.assertIn("85", to_student.body)

    def test_sharh_va_sharhga_javob(self):
        Enrollment.objects.create(user=self.student, course=self.course)

        self.client.force_authenticate(self.student)
        self.client.post(f"/api/v1/courses/{self.course.id}/reviews", {"rating": 5, "text": "Zo'r"})
        self.assertEqual(Notification.objects.filter(user=self.instructor, type="review").count(), 1)

        review = Review.objects.get()
        self.client.force_authenticate(self.instructor)
        self.client.post(f"/api/v1/instructor/reviews/{review.id}/reply", {"text": "Rahmat!"})

        self.assertEqual(Notification.objects.filter(user=self.student, type="review").count(), 1)

    def test_muhokama_javobi_mavzu_muallifiga(self):
        Enrollment.objects.create(user=self.student, course=self.course)
        thread = DiscussionThread.objects.create(
            course=self.course, author=self.student, title="Savolim"
        )

        self.client.force_authenticate(self.instructor)
        self.client.post(f"/api/v1/discussions/{thread.id}/replies", {"text": "Javob"})

        row = Notification.objects.get(user=self.student)
        self.assertEqual(row.type, "message")
        self.assertIn("Savolim", row.body)

    def test_oz_mavzusiga_ozi_javob_yozsa_xabar_kelmaydi(self):
        """QOIDA 1 — o'zingga bildirishnoma kelmaydi."""
        Enrollment.objects.create(user=self.student, course=self.course)
        thread = DiscussionThread.objects.create(
            course=self.course, author=self.student, title="Savolim"
        )

        self.client.force_authenticate(self.student)
        self.client.post(f"/api/v1/discussions/{thread.id}/replies", {"text": "O'zimga javob"})

        self.assertEqual(Notification.objects.count(), 0)

    def test_oz_kursiga_ozi_yozilsa_xabar_kelmaydi(self):
        self.client.force_authenticate(self.instructor)
        self.client.post("/api/v1/student/enrollments", {"course": str(self.course.id)})

        self.assertEqual(Notification.objects.count(), 0)

    def test_matndagi_teg_tozalanadi(self):
        """Xabar matnini SERVER yozadi, lekin ichida foydalanuvchi ismi bor."""
        self.student.full_name = '<script>alert(1)</script>Ali'
        self.student.save()
        Enrollment.objects.create(user=self.student, course=self.course)

        row = isloh_notify(
            user=self.instructor, role="instructor", type="enrollment",
            title="Yangi talaba", body=f"{self.student.full_name} yozildi",
        )
        self.assertNotIn("<script", row.body)
        self.assertIn("Ali", row.body)

    def test_xabar_yozilmasa_ham_sorov_yiqilmaydi(self):
        """QOIDA 2 — bildirishnoma yon ta'sir, u asosiy amalni buzmasin."""
        self.client.force_authenticate(self.student)

        with patch(
            "apps.notifications.events.Notification.objects.create",
            side_effect=RuntimeError("baza yiqildi"),
        ):
            res = self.client.post("/api/v1/student/enrollments", {"course": str(self.course.id)})

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Enrollment.objects.count(), 1)
        self.assertEqual(Notification.objects.count(), 0)


class NotificationApiTests(NotificationTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.student)

    def test_royxat_massiv_va_faqat_ozimniki(self):
        self.notify(title="Meniki")
        self.notify(user=self.instructor, role="instructor", title="Begona")

        res = self.client.get(NOTIFICATIONS)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual([r["title"] for r in res.data], ["Meniki"])

    def test_rol_boyicha_filtr(self):
        """Bitta odam ham talaba, ham o'qituvchi bo'lishi mumkin — ikki
        oqim aralashmasligi kerak."""
        UserRole.objects.create(user=self.student, role=ROLE_INSTRUCTOR)
        self.notify(role="student", title="Talaba oqimi")
        self.notify(role="instructor", title="O'qituvchi oqimi")

        res = self.client.get(NOTIFICATIONS, {"role": "instructor"})
        self.assertEqual([r["title"] for r in res.data], ["O'qituvchi oqimi"])

    def test_oqilgan_deb_belgilash(self):
        row = self.notify()
        res = self.client.post(f"{NOTIFICATIONS}/{row.id}/read")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["read"])
        row.refresh_from_db()
        self.assertIsNotNone(row.read_at)

    def test_ikkinchi_marta_belgilash_vaqtni_ozgartirmaydi(self):
        """"Qachon o'qidi" — BIRINCHI o'qish vaqti."""
        row = self.notify()
        self.client.post(f"{NOTIFICATIONS}/{row.id}/read")
        row.refresh_from_db()
        first = row.read_at

        self.client.post(f"{NOTIFICATIONS}/{row.id}/read")
        row.refresh_from_db()
        self.assertEqual(row.read_at, first)

    def test_barchasini_belgilash_faqat_soralgan_rolni(self):
        self.notify(role="student", title="Talaba")
        self.notify(role="instructor", title="O'qituvchi")

        res = self.client.post(f"{NOTIFICATIONS}/read-all", {}, QUERY_STRING="role=student")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.assertEqual(Notification.objects.filter(role="student", read_at__isnull=True).count(), 0)
        self.assertEqual(Notification.objects.filter(role="instructor", read_at__isnull=True).count(), 1)

    def test_ochirish(self):
        row = self.notify()
        res = self.client.delete(f"{NOTIFICATIONS}/{row.id}")

        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Notification.objects.count(), 0)

    def test_begona_xabarga_tegib_bolmaydi(self):
        """404, 403 EMAS: 403 javobning o'zi bunday yozuv borligini
        oshkor qilardi."""
        row = self.notify(user=self.instructor, role="instructor")

        self.assertEqual(
            self.client.post(f"{NOTIFICATIONS}/{row.id}/read").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.delete(f"{NOTIFICATIONS}/{row.id}").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(Notification.objects.count(), 1)

    def test_oqilmaganlar_soni(self):
        self.notify()
        read = self.notify()
        self.client.post(f"{NOTIFICATIONS}/{read.id}/read")

        res = self.client.get(f"{NOTIFICATIONS}/unread-count")
        self.assertEqual(res.data["unread"], 1)

    def test_xabarni_mijoz_yarata_olmaydi(self):
        """Bildirishnomani voqealar yasaydi; `POST /notifications` yo'q."""
        res = self.client.post(NOTIFICATIONS, {"title": "O'zimga yolg'on xabar"})
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(Notification.objects.count(), 0)

    def test_avtorizatsiyasiz_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(NOTIFICATIONS).status_code, status.HTTP_401_UNAUTHORIZED)
