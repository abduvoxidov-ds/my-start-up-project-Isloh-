"""
ISLOH — o'qish oqimi testlari (M3).

Nimani qo'riqlaydi:
  1. Jarayonni MIJOZ yoza olmaydi — u darslardan hisoblanadi
  2. `state` serverdan keladi va chegaralar bitta joyda
  3. Sertifikat faqat 100% da beriladi; tekshiruv auth'siz, lekin
     shaxsiy ma'lumotsiz
  4. Begona yozuv/izoh/vazifaga tegib bo'lmaydi
  5. §0.1 — do'kon endpoint'lari massiv qaytaradi
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import ROLE_INSTRUCTOR, ROLE_STUDENT, User, UserRole
from apps.courses.models import (
    STATUS_PUBLISHED,
    Course,
    CourseModule,
    CourseSettings,
    Lesson,
)
from apps.learning.models import (
    STATE_ACTIVE,
    STATE_IDLE,
    STATE_INACTIVE,
    Certificate,
    Enrollment,
    LessonProgress,
    Note,
    Task,
)

ENROLLMENTS = "/api/v1/student/enrollments"
NOTES = "/api/v1/student/notes"
TASKS = "/api/v1/student/tasks"
CERTIFICATES = "/api/v1/student/certificates"


def make_user(email, role):
    user = User.objects.create_user(email=email, password="TestParol2026!", full_name="Test Foydalanuvchi")
    UserRole.objects.create(user=user, role=role)
    return user


def make_course(owner, lessons=2, published=True, visibility="public"):
    course = Course.objects.create(
        owner=owner,
        slug=f"kurs-{Course.objects.count() + 1}",
        title="Kurs",
        description="Tavsif",
        price_cents=10000,
        status=STATUS_PUBLISHED if published else "draft",
    )
    CourseSettings.objects.create(course=course, visibility=visibility)
    module = CourseModule.objects.create(course=course, title="Modul")
    for i in range(lessons):
        Lesson.objects.create(module=module, title=f"Dars {i + 1}", position=i)
    return course


class EnrollmentTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor)
        self.client.force_authenticate(self.student)

    def test_royxat_massiv(self):
        """§0.1 — do'kon endpoint'i o'ram qaytarmaydi."""
        self.assertIsInstance(self.client.get(ENROLLMENTS).json(), list)

    def test_kursga_yozilish(self):
        response = self.client.post(ENROLLMENTS, {"course": str(self.course.pk)}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["progress"], 0)
        self.assertEqual(response.json()["lessons_count"], 2)

    def test_takroriy_yozilish_xato_emas(self):
        """Tugma ikki marta bosilishi mumkin — natija bir xil bo'lsin."""
        self.client.post(ENROLLMENTS, {"course": str(self.course.pk)}, format="json")
        second = self.client.post(ENROLLMENTS, {"course": str(self.course.pk)}, format="json")

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Enrollment.objects.filter(user=self.student).count(), 1)

    def test_nashr_etilmagan_kursga_yozilib_bolmaydi(self):
        draft = make_course(self.instructor, published=False)

        response = self.client.post(ENROLLMENTS, {"course": str(draft.pk)}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_yopiq_kursga_yozilib_bolmaydi(self):
        private = make_course(self.instructor, visibility="private")

        response = self.client.post(ENROLLMENTS, {"course": str(private.pk)}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_faqat_oz_yozuvlarim(self):
        boshqa = make_user("b@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=boshqa, course=self.course)

        self.assertEqual(self.client.get(ENROLLMENTS).json(), [])

    def test_jarayonni_mijoz_yoza_olmaydi(self):
        """Aks holda talaba o'ziga 100% qo'yib sertifikat olardi."""
        response = self.client.post(
            ENROLLMENTS, {"course": str(self.course.pk), "progress": 100}, format="json"
        )

        self.assertEqual(response.json()["progress"], 0)


class ProgressTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor, lessons=4)
        self.enrollment = Enrollment.objects.create(user=self.student, course=self.course)
        self.lessons = list(Lesson.objects.filter(module__course=self.course).order_by("position"))
        self.client.force_authenticate(self.student)

    def _mark(self, lesson, **body):
        return self.client.put(
            f"/api/v1/student/lessons/{lesson.pk}/progress", body, format="json"
        )

    def test_darsni_yakunlash_jarayonni_hisoblaydi(self):
        response = self._mark(self.lessons[0], completed=True)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["course_progress"], 25)

    def test_video_pozitsiyasi_va_yakunlanganlik_BITTA_yozuvda(self):
        """QAROR 1 — ilgari ular ikki localStorage kalitida edi."""
        self._mark(self.lessons[0], position_sec=120)
        self._mark(self.lessons[0], completed=True)

        row = LessonProgress.objects.get(enrollment=self.enrollment, lesson=self.lessons[0])
        self.assertEqual(row.position_sec, 120)
        self.assertTrue(row.is_completed)
        self.assertEqual(LessonProgress.objects.count(), 1)

    def test_belgilashni_bekor_qilish(self):
        self._mark(self.lessons[0], completed=True)
        response = self._mark(self.lessons[0], completed=False)

        self.assertEqual(response.json()["course_progress"], 0)

    def test_hamma_dars_yakunlansa_100_va_completed_at(self):
        for lesson in self.lessons:
            self._mark(lesson, completed=True)

        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.progress, 100)
        self.assertIsNotNone(self.enrollment.completed_at)
        self.assertEqual(self.enrollment.state, "completed")

    def test_yozilmagan_kursda_jarayon_yozib_bolmaydi(self):
        boshqa_kurs = make_course(self.instructor)
        begona_dars = Lesson.objects.filter(module__course=boshqa_kurs).first()

        response = self._mark(begona_dars, completed=True)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_kurs_jarayoni_bitta_sorovda_keladi(self):
        self._mark(self.lessons[0], completed=True, position_sec=45)

        body = self.client.get(f"/api/v1/student/courses/{self.course.pk}/progress").json()

        self.assertEqual(body["progress"], 25)
        self.assertEqual(body["lessons"][str(self.lessons[0].pk)]["completed"], True)
        self.assertEqual(body["lessons"][str(self.lessons[0].pk)]["position_sec"], 45)


class StateTests(APITestCase):
    """QAROR 2 — holat serverda hisoblanadi, chegaralar bitta joyda."""

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor)

    def _enrollment_with_idle(self, days):
        return Enrollment.objects.create(
            user=self.student,
            course=self.course,
            last_active_at=timezone.now() - timedelta(days=days),
        )

    def test_uch_kungacha_faol(self):
        self.assertEqual(self._enrollment_with_idle(2).state, STATE_ACTIVE)

    def test_on_kungacha_sust(self):
        self.assertEqual(self._enrollment_with_idle(7).state, STATE_IDLE)

    def test_ondan_keyin_faol_emas(self):
        self.assertEqual(self._enrollment_with_idle(30).state, STATE_INACTIVE)

    def test_holat_javobda_keladi(self):
        self._enrollment_with_idle(1)
        self.client.force_authenticate(self.student)

        self.assertEqual(self.client.get(ENROLLMENTS).json()[0]["state"], STATE_ACTIVE)


class InstructorRosterTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.other = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor)
        self.client.force_authenticate(self.instructor)

    def test_faqat_oz_kurslarimdagi_talabalar(self):
        Enrollment.objects.create(user=self.student, course=self.course)
        Enrollment.objects.create(user=self.student, course=make_course(self.other))

        rows = self.client.get("/api/v1/instructor/enrollments").json()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["email"], "t@isloh.uz")

    def test_talaba_royxatni_kora_olmaydi(self):
        self.client.force_authenticate(self.student)

        response = self.client.get("/api/v1/instructor/enrollments")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ikki_xil_talaba_soni_alohida_nom_bilan(self):
        """§M3 — `students_count` (sotuv) va `enrolled_count` (yozuvlar)."""
        self.course.students_count = 2330
        self.course.save(update_fields=["students_count"])
        Enrollment.objects.create(user=self.student, course=self.course)

        body = self.client.get(f"/api/v1/instructor/courses/{self.course.pk}/students").json()

        self.assertEqual(body["students_count"], 2330)
        self.assertEqual(body["enrolled_count"], 1)


class CertificateTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor, lessons=1)
        self.enrollment = Enrollment.objects.create(user=self.student, course=self.course)
        self.client.force_authenticate(self.student)

    def test_yakunlanmagan_kursga_sertifikat_berilmaydi(self):
        response = self.client.post(CERTIFICATES, {"course": str(self.course.pk)}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Certificate.objects.count(), 0)

    def test_yakunlangach_beriladi(self):
        lesson = Lesson.objects.filter(module__course=self.course).first()
        self.client.put(f"/api/v1/student/lessons/{lesson.pk}/progress", {"completed": True}, format="json")

        response = self.client.post(CERTIFICATES, {"course": str(self.course.pk)}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.json()["code"].startswith("ISLOH-"))

    def test_tekshiruv_authsiz_ishlaydi(self):
        certificate = Certificate.objects.create(
            user=self.student, course=self.course, course_title="Kurs", student_name="Test"
        )
        self.client.force_authenticate(None)

        response = self.client.get(f"/api/v1/certificates/verify/{certificate.code}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["student_name"], "Test")

    def test_tekshiruvda_shaxsiy_malumot_yoq(self):
        """Kodni bilgan istalgan odam ochadi — email chiqmasligi kerak."""
        certificate = Certificate.objects.create(user=self.student, course=self.course)
        self.client.force_authenticate(None)

        body = self.client.get(f"/api/v1/certificates/verify/{certificate.code}").json()

        self.assertNotIn("email", str(body))

    def test_notogri_kod_404(self):
        self.client.force_authenticate(None)

        response = self.client.get("/api/v1/certificates/verify/ISLOH-YOQYOQYOQ")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class NoteTaskTests(APITestCase):
    def setUp(self):
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.other = make_user("b@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(self.student)

    def test_izoh_teglar_bilan_saqlanadi(self):
        response = self.client.post(
            NOTES, {"title": "Izoh", "text": "Matn", "tags": ["django", "orm", "django"]}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["tags"], ["django", "orm"])

    def test_begona_izoh_korinmaydi(self):
        Note.objects.create(user=self.other, title="O'zganiki")

        self.assertEqual(self.client.get(NOTES).json(), [])

    def test_begona_izohni_tahrirlab_bolmaydi(self):
        foreign = Note.objects.create(user=self.other, title="O'zganiki")

        response = self.client.patch(f"{NOTES}/{foreign.pk}", {"title": "Buzildi"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_vazifa_yaratiladi(self):
        response = self.client.post(
            TASKS,
            {"title": "Django modellari", "due_date": "2026-09-01", "type": "lesson", "priority": "high"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Task.objects.filter(user=self.student).count(), 1)

    def test_vazifa_royxati_massiv(self):
        self.assertIsInstance(self.client.get(TASKS).json(), list)

    def test_avtorizatsiyasiz_401(self):
        self.client.force_authenticate(None)

        self.assertEqual(self.client.get(NOTES).status_code, status.HTTP_401_UNAUTHORIZED)
