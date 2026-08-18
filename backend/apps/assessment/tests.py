"""
ISLOH — baholash testlari (M4).

BIRINCHI NAVBATDAGI QOIDA: to'g'ri javob talabaga hech qachon
yuborilmaydi va ball hech qachon mijozdan qabul qilinmaydi
(docs/BACKEND-PLAN.md §M4). `AnswerLeakTests` aynan shuni qulflaydi —
u buzilsa butun baholash tizimining ma'nosi qolmaydi.
"""

import json

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import ROLE_INSTRUCTOR, ROLE_STUDENT, User, UserRole
from apps.assessment.grading import isloh_grade_answer
from apps.assessment.models import (
    Assignment,
    Question,
    QuestionOption,
    Quiz,
    QuizAnswer,
    QuizAttempt,
    QuizQuestion,
    Submission,
)
from apps.courses.models import STATUS_PUBLISHED, Course, CourseSettings
from apps.learning.models import Enrollment

QUESTIONS = "/api/v1/instructor/questions"
QUIZZES = "/api/v1/instructor/quizzes"
ASSIGNMENTS = "/api/v1/instructor/assignments"


def make_user(email, role):
    user = User.objects.create_user(email=email, password="TestParol2026!", full_name="Test")
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


def make_question(owner, type="single", points=5, options=None):
    question = Question.objects.create(owner=owner, title="Savol?", type=type, points=points)
    for index, item in enumerate(options or []):
        QuestionOption.objects.create(
            question=question,
            text=item.get("text", ""),
            match_text=item.get("match_text", ""),
            is_correct=item.get("is_correct", False),
            position=index,
        )
    return question


def make_quiz(owner, course, questions=(), **kwargs):
    quiz = Quiz.objects.create(
        owner=owner, course=course, title="Test", status="published", **kwargs
    )
    for position, question in enumerate(questions):
        QuizQuestion.objects.create(quiz=quiz, question=question, position=position)
    return quiz


class AnswerLeakTests(APITestCase):
    """M4 ning eng muhim testi — to'g'ri javob sizib chiqmaydi."""

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor)
        Enrollment.objects.create(user=self.student, course=self.course)

        self.question = make_question(
            self.instructor,
            options=[
                {"text": "To'g'ri javob", "is_correct": True},
                {"text": "Noto'g'ri", "is_correct": False},
            ],
        )
        self.question.explanation = "Bu javob to'g'ri, chunki..."
        self.question.save()
        self.quiz = make_quiz(self.instructor, self.course, [self.question])
        self.client.force_authenticate(self.student)

    def test_javobda_is_correct_umuman_yoq(self):
        body = self.client.get(f"/api/v1/student/quizzes/{self.quiz.pk}").json()

        raw = json.dumps(body)
        self.assertNotIn("is_correct", raw)
        # Variant matni bor, lekin qaysi biri to'g'ri ekani yo'q
        self.assertIn("To'g'ri javob", raw)

    def test_izoh_urinishdan_oldin_berilmaydi(self):
        """`explanation` javobni oshkor qilishi mumkin."""
        body = self.client.get(f"/api/v1/student/quizzes/{self.quiz.pk}").json()

        self.assertNotIn("chunki", json.dumps(body))

    def test_moslashtirish_juftligi_berilmaydi(self):
        question = make_question(
            self.instructor,
            type="match",
            options=[
                {"text": "git add", "match_text": "Fayl qo'shadi"},
                {"text": "git commit", "match_text": "O'zgarishni saqlaydi"},
            ],
        )
        quiz = make_quiz(self.instructor, self.course, [question])

        body = self.client.get(f"/api/v1/student/quizzes/{quiz.pk}").json()

        raw = json.dumps(body, ensure_ascii=False)
        # `match_text` maydoni variantlar ichida chiqmasligi kerak
        self.assertNotIn("match_text", raw)
        # O'ng ustun alohida, aralashtirilgan ro'yxatda keladi
        self.assertEqual(sorted(body["questions"][0]["match_pool"]), ["Fayl qo'shadi", "O'zgarishni saqlaydi"])

    def test_yozilmagan_talaba_testni_kora_olmaydi(self):
        boshqa = make_user("b@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(boshqa)

        response = self.client.get(f"/api/v1/student/quizzes/{self.quiz.pk}")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_nashr_etilmagan_test_korinmaydi(self):
        self.quiz.status = "draft"
        self.quiz.save()

        response = self.client.get(f"/api/v1/student/quizzes/{self.quiz.pk}")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class GradingUnitTests(APITestCase):
    """`grading.py` — har bir tur alohida."""

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)

    def test_single(self):
        q = make_question(self.instructor, options=[{"text": "A", "is_correct": True}, {"text": "B"}])
        correct_id = str(q.options.get(text="A").pk)
        wrong_id = str(q.options.get(text="B").pk)

        self.assertEqual(isloh_grade_answer(q, correct_id), (True, 5))
        self.assertEqual(isloh_grade_answer(q, wrong_id), (False, 0))

    def test_multi_toliq_moslik_talab_qiladi(self):
        q = make_question(
            self.instructor,
            type="multi",
            options=[{"text": "A", "is_correct": True}, {"text": "B", "is_correct": True}, {"text": "C"}],
        )
        a = str(q.options.get(text="A").pk)
        b = str(q.options.get(text="B").pk)

        self.assertEqual(isloh_grade_answer(q, [a, b])[0], True)
        # Yarmi — qisman ball berilmaydi
        self.assertEqual(isloh_grade_answer(q, [a]), (False, 0))

    def test_qisqa_javob_katta_kichik_harfga_qaramaydi(self):
        q = make_question(self.instructor, type="short", options=[{"text": "print", "is_correct": True}])

        self.assertEqual(isloh_grade_answer(q, "  PRINT ")[0], True)
        self.assertEqual(isloh_grade_answer(q, "printf")[0], False)

    def test_qisqa_javobda_bir_nechta_qabul_qilinadigan_variant(self):
        q = make_question(
            self.instructor,
            type="short",
            options=[{"text": "print", "is_correct": True}, {"text": "print()", "is_correct": True}],
        )

        self.assertEqual(isloh_grade_answer(q, "print()")[0], True)

    def test_tartiblash(self):
        q = make_question(
            self.instructor, type="order", options=[{"text": "1"}, {"text": "2"}, {"text": "3"}]
        )
        ids = [str(o.pk) for o in q.options.order_by("position")]

        self.assertEqual(isloh_grade_answer(q, ids)[0], True)
        self.assertEqual(isloh_grade_answer(q, list(reversed(ids)))[0], False)

    def test_moslashtirish(self):
        q = make_question(
            self.instructor,
            type="match",
            options=[
                {"text": "git add", "match_text": "Fayl qo'shadi"},
                {"text": "git commit", "match_text": "Saqlaydi"},
            ],
        )
        add_id = str(q.options.get(text="git add").pk)
        commit_id = str(q.options.get(text="git commit").pk)

        self.assertEqual(
            isloh_grade_answer(q, {add_id: "Fayl qo'shadi", commit_id: "Saqlaydi"})[0], True
        )
        self.assertEqual(
            isloh_grade_answer(q, {add_id: "Saqlaydi", commit_id: "Fayl qo'shadi"})[0], False
        )

    def test_batafsil_javob_qolda_baholanadi(self):
        """`None` — "hali baholanmagan", `False` EMAS."""
        q = make_question(self.instructor, type="long")

        self.assertEqual(isloh_grade_answer(q, "Uzun matn"), (None, 0))


class AttemptTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor)
        Enrollment.objects.create(user=self.student, course=self.course)

        self.q1 = make_question(
            self.instructor, points=10, options=[{"text": "A", "is_correct": True}, {"text": "B"}]
        )
        self.q2 = make_question(
            self.instructor, points=10, options=[{"text": "C", "is_correct": True}, {"text": "D"}]
        )
        self.quiz = make_quiz(self.instructor, self.course, [self.q1, self.q2], passing_score=70)
        self.client.force_authenticate(self.student)

    def _start(self):
        return self.client.post(f"/api/v1/student/quizzes/{self.quiz.pk}/attempts").json()

    def test_ball_serverda_hisoblanadi(self):
        attempt = self._start()
        correct = str(self.q1.options.get(text="A").pk)
        wrong = str(self.q2.options.get(text="D").pk)

        body = self.client.post(
            f"/api/v1/student/attempts/{attempt['id']}/submit",
            {"answers": [
                {"question": str(self.q1.pk), "value": correct},
                {"question": str(self.q2.pk), "value": wrong},
            ]},
            format="json",
        ).json()

        self.assertEqual(body["points_awarded"], 10)
        self.assertEqual(body["points_total"], 20)
        self.assertEqual(body["score"], 50)
        self.assertFalse(body["passed"])

    def test_javob_berilmagan_savol_ham_hisobga_olinadi(self):
        """Aks holda bitta savolga javob bergan talaba 100% olardi."""
        attempt = self._start()
        correct = str(self.q1.options.get(text="A").pk)

        body = self.client.post(
            f"/api/v1/student/attempts/{attempt['id']}/submit",
            {"answers": [{"question": str(self.q1.pk), "value": correct}]},
            format="json",
        ).json()

        self.assertEqual(body["score"], 50)

    def test_mijoz_yuborgan_ball_etiborga_olinmaydi(self):
        attempt = self._start()
        wrong = str(self.q1.options.get(text="B").pk)

        body = self.client.post(
            f"/api/v1/student/attempts/{attempt['id']}/submit",
            {"answers": [{"question": str(self.q1.pk), "value": wrong, "points_awarded": 999}],
             "score": 100},
            format="json",
        ).json()

        self.assertEqual(body["score"], 0)
        self.assertEqual(body["points_awarded"], 0)

    def test_urinishlar_chegarasi(self):
        self.quiz.limit_attempts = True
        self.quiz.attempts = 1
        self.quiz.save()

        self._start()
        response = self.client.post(f"/api/v1/student/quizzes/{self.quiz.pk}/attempts")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bir_urinish_ikki_marta_yuborilmaydi(self):
        attempt = self._start()
        self.client.post(f"/api/v1/student/attempts/{attempt['id']}/submit", {"answers": []}, format="json")

        response = self.client.post(
            f"/api/v1/student/attempts/{attempt['id']}/submit", {"answers": []}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_begona_urinishni_yuborib_bolmaydi(self):
        boshqa = make_user("b@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=boshqa, course=self.course)
        foreign = QuizAttempt.objects.create(quiz=self.quiz, user=boshqa)

        response = self.client.post(
            f"/api/v1/student/attempts/{foreign.pk}/submit", {"answers": []}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_testda_yoq_savolga_javob_qabul_qilinmaydi(self):
        begona_savol = make_question(self.instructor, options=[{"text": "X", "is_correct": True}])
        attempt = self._start()

        self.client.post(
            f"/api/v1/student/attempts/{attempt['id']}/submit",
            {"answers": [{"question": str(begona_savol.pk), "value": "x"}]},
            format="json",
        )

        self.assertEqual(QuizAnswer.objects.filter(attempt_id=attempt["id"]).count(), 0)

    def test_qolda_baholanadigan_savol_bolsa_otdi_hukmi_kechiktiriladi(self):
        long_q = make_question(self.instructor, type="long", points=10)
        quiz = make_quiz(self.instructor, self.course, [long_q], passing_score=50)

        attempt = self.client.post(f"/api/v1/student/quizzes/{quiz.pk}/attempts").json()
        body = self.client.post(
            f"/api/v1/student/attempts/{attempt['id']}/submit",
            {"answers": [{"question": str(long_q.pk), "value": "Javobim"}]},
            format="json",
        ).json()

        self.assertTrue(body["needs_review"])
        self.assertFalse(body["passed"])


class ManualGradingTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor)
        Enrollment.objects.create(user=self.student, course=self.course)

        self.question = make_question(self.instructor, type="long", points=10)
        self.quiz = make_quiz(self.instructor, self.course, [self.question], passing_score=50)

        self.client.force_authenticate(self.student)
        attempt = self.client.post(f"/api/v1/student/quizzes/{self.quiz.pk}/attempts").json()
        self.client.post(
            f"/api/v1/student/attempts/{attempt['id']}/submit",
            {"answers": [{"question": str(self.question.pk), "value": "Javobim"}]},
            format="json",
        )
        self.attempt = QuizAttempt.objects.get(pk=attempt["id"])

    def test_oqituvchi_ball_qoyadi_va_natija_qayta_hisoblanadi(self):
        self.client.force_authenticate(self.instructor)
        answer = self.attempt.answers.first()

        body = self.client.post(
            f"/api/v1/instructor/attempts/{self.attempt.pk}/grade",
            {"answer": str(answer.pk), "points_awarded": 8, "feedback": "Yaxshi"},
            format="json",
        ).json()

        self.assertEqual(body["points_awarded"], 8)
        self.assertEqual(body["score"], 80)
        self.assertTrue(body["passed"])
        self.assertFalse(body["needs_review"])

    def test_savol_ballidan_oshiq_qoyib_bolmaydi(self):
        self.client.force_authenticate(self.instructor)
        answer = self.attempt.answers.first()

        response = self.client.post(
            f"/api/v1/instructor/attempts/{self.attempt.pk}/grade",
            {"answer": str(answer.pk), "points_awarded": 999},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_talaba_ozini_baholay_olmaydi(self):
        answer = self.attempt.answers.first()

        response = self.client.post(
            f"/api/v1/instructor/attempts/{self.attempt.pk}/grade",
            {"answer": str(answer.pk), "points_awarded": 10},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AssignmentTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.course = make_course(self.instructor)
        Enrollment.objects.create(user=self.student, course=self.course)

        self.assignment = Assignment.objects.create(
            owner=self.instructor,
            course=self.course,
            title="Amaliy ish",
            status="published",
            max_score=100,
            attempts=1,
            notes="O'qituvchining shaxsiy eslatmasi",
        )

    def test_oqituvchi_eslatmasi_talabaga_korinmaydi(self):
        self.client.force_authenticate(self.student)

        body = self.client.get("/api/v1/student/assignments").json()

        self.assertNotIn("shaxsiy eslatmasi", json.dumps(body, ensure_ascii=False))

    def test_topshiriq_yuboriladi(self):
        self.client.force_authenticate(self.student)

        response = self.client.post(
            f"/api/v1/student/assignments/{self.assignment.pk}/submissions",
            {"text": "Ishim", "files": [{"name": "ish.zip", "url": "https://github.com/ish"}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["status"], Submission.STATUS_PENDING)
        self.assertEqual(len(response.json()["files"]), 1)

    def test_baytsiz_fayl_metamalumoti_qabul_qilinmaydi(self):
        """M5 da o'zgardi: `{name, size_bytes}` endi yetarli emas.

        M4 da bu yozuv shunchaki metama'lumot edi — o'qituvchi baholash
        navbatida "ish.zip" ni ko'rardi, lekin ochib bo'lmasdi (baytlar
        hech qayerda saqlanmagan). Endi fayl YO yuklangan bo'ladi
        (`{file: "<id>"}`), YO tashqi havola (`{url}`).
        """
        self.client.force_authenticate(self.student)

        response = self.client.post(
            f"/api/v1/student/assignments/{self.assignment.pk}/submissions",
            {"text": "Ishim", "files": [{"name": "ish.zip", "size_bytes": 1024}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.json()["files"]), 0)

    def test_topshirishlar_chegarasi(self):
        self.client.force_authenticate(self.student)
        url = f"/api/v1/student/assignments/{self.assignment.pk}/submissions"
        self.client.post(url, {"text": "1"}, format="json")

        response = self.client.post(url, {"text": "2"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_talaba_ozi_ball_qoya_olmaydi(self):
        self.client.force_authenticate(self.student)

        body = self.client.post(
            f"/api/v1/student/assignments/{self.assignment.pk}/submissions",
            {"text": "Ishim", "score": 100, "status": "graded"},
            format="json",
        ).json()

        self.assertIsNone(body["score"])
        self.assertEqual(body["status"], Submission.STATUS_PENDING)

    def test_baholash_navbatida_faqat_tekshirilmaganlar(self):
        submission = Submission.objects.create(assignment=self.assignment, user=self.student, text="Ish")
        self.client.force_authenticate(self.instructor)

        rows = self.client.get("/api/v1/instructor/submissions").json()
        self.assertEqual(len(rows), 1)

        self.client.post(
            f"/api/v1/instructor/submissions/{submission.pk}/grade",
            {"score": 85, "feedback": "Yaxshi ish"},
            format="json",
        )

        self.assertEqual(len(self.client.get("/api/v1/instructor/submissions").json()), 0)

    def test_maksimal_balldan_oshiq_qoyib_bolmaydi(self):
        submission = Submission.objects.create(assignment=self.assignment, user=self.student)
        self.client.force_authenticate(self.instructor)

        response = self.client.post(
            f"/api/v1/instructor/submissions/{submission.pk}/grade", {"score": 500}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_begona_ishni_baholab_bolmaydi(self):
        other = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        foreign_assignment = Assignment.objects.create(
            owner=other, course=make_course(other), title="O'zganiki", status="published"
        )
        foreign = Submission.objects.create(assignment=foreign_assignment, user=self.student)
        self.client.force_authenticate(self.instructor)

        response = self.client.post(
            f"/api/v1/instructor/submissions/{foreign.pk}/grade", {"score": 10}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class InstructorCrudTests(APITestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.course = make_course(self.instructor)
        self.client.force_authenticate(self.instructor)

    def test_savol_variantlari_bilan_yaratiladi(self):
        response = self.client.post(
            QUESTIONS,
            {
                "title": "Qaysi kalit so'z?",
                "type": "single",
                "points": 5,
                "tags": ["sintaksis", "sintaksis"],
                "options": [
                    {"text": "def", "is_correct": True},
                    {"text": "func", "is_correct": False},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(len(data["options"]), 2)
        self.assertEqual(data["tags"], ["sintaksis"])

    def test_royxat_massiv(self):
        self.assertIsInstance(self.client.get(QUESTIONS).json(), list)

    def test_begona_savol_korinmaydi(self):
        other = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        make_question(other)

        self.assertEqual(self.client.get(QUESTIONS).json(), [])

    def test_testga_begona_savol_qoshilmaydi(self):
        other = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        foreign = make_question(other)
        mine = make_question(self.instructor)

        response = self.client.post(
            QUIZZES,
            {"course": str(self.course.pk), "title": "Test",
             "question_ids": [str(foreign.pk), str(mine.pk)]},
            format="json",
        )

        self.assertEqual(response.json()["question_ids"], [str(mine.pk)])

    def test_talaba_savol_yarata_olmaydi(self):
        self.client.force_authenticate(make_user("t@isloh.uz", ROLE_STUDENT))

        response = self.client.post(QUESTIONS, {"title": "Savol"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
