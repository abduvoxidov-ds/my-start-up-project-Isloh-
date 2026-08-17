"""
ISLOH — serverdagi baholash (M4).

NEGA ALOHIDA FAYL: baholash qoidasi biznes mantiqning eng nozik qismi va u
ikki joydan chaqiriladi (talaba urinishni yuborganda, o'qituvchi qo'lda
baholaganda qayta hisoblanadi). View ichida yozilsa u yerda test qilish
qiyin bo'lardi.

QOIDA: to'g'ri javob HECH QACHON mijozga yuborilmaydi va ball HECH QACHON
mijozdan qabul qilinmaydi. Talaba faqat o'z javobini beradi, qolganini shu
modul hisoblaydi (docs/BACKEND-PLAN.md §M4).

Sakkiz turdan YETTITASI avtomatik baholanadi; `long` (batafsil javob)
qo'lda — matnni mashina ishonchli baholay olmaydi va "taxminiy" ball
talabaga nisbatan adolatsiz bo'lardi.
"""

from .models import (
    TYPE_BLANK,
    TYPE_BOOLEAN,
    TYPE_MATCH,
    TYPE_MULTI,
    TYPE_ORDER,
    TYPE_SHORT,
    TYPE_SINGLE,
)


def isloh_normalize_text(value):
    """Qisqa javobni solishtirishga tayyorlaydi.

    Katta-kichik harf va chetdagi bo'shliqlar e'tiborga olinmaydi:
    "Print" va "print " bir xil javob. Ichki bo'shliqlar saqlanadi —
    "for loop" va "forloop" boshqa javoblar.
    """
    return " ".join(str(value or "").strip().lower().split())


def _correct_option_ids(question):
    return {str(o.pk) for o in question.options.all() if o.is_correct}


def _as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _grade_single(question, value):
    """single / boolean — bitta to'g'ri variant."""
    correct = _correct_option_ids(question)
    return str(value) in correct if correct else False


def _grade_multi(question, value):
    """multi — TO'LIQ moslik talab qilinadi.

    Qisman ball berilmaydi: "to'g'rilarining yarmini belgilagan" talaba
    ham, hammasini belgilagan talaba ham bir xil ball olishi mumkin
    bo'lardi. Bu qoida o'zgarsa — shu yerda, bitta joyda.
    """
    correct = _correct_option_ids(question)
    given = {str(v) for v in _as_list(value)}
    return bool(correct) and given == correct


def _grade_text(question, value):
    """short / blank — variantlar QABUL QILINADIGAN javoblar ro'yxati.

    `is_correct=True` bo'lgan har bir variant to'g'ri javobning bir
    ko'rinishi ("print", "print()"). Bittasiga mos kelsa yetarli.
    """
    given = isloh_normalize_text(value)
    if not given:
        return False
    accepted = {isloh_normalize_text(o.text) for o in question.options.all() if o.is_correct}
    return given in accepted


def _grade_order(question, value):
    """order — variantlarning to'g'ri KETMA-KETLIGI (`position` bo'yicha)."""
    expected = [str(o.pk) for o in question.options.all().order_by("position")]
    given = [str(v) for v in _as_list(value)]
    return bool(expected) and given == expected


def _grade_match(question, value):
    """match — har bir chap element o'z juftiga bog'langanmi.

    Javob shakli: {"<option_id>": "<talaba tanlagan o'ng ustun matni>"}
    """
    if not isinstance(value, dict):
        return False

    pairs = {str(o.pk): isloh_normalize_text(o.match_text) for o in question.options.all()}
    if not pairs:
        return False

    for option_id, expected in pairs.items():
        if isloh_normalize_text(value.get(option_id)) != expected:
            return False
    return True


ISLOH_GRADERS = {
    TYPE_SINGLE: _grade_single,
    TYPE_BOOLEAN: _grade_single,
    TYPE_MULTI: _grade_multi,
    TYPE_SHORT: _grade_text,
    TYPE_BLANK: _grade_text,
    TYPE_ORDER: _grade_order,
    TYPE_MATCH: _grade_match,
}


def isloh_grade_answer(question, value):
    """Bitta javob: `(is_correct, points_awarded)`.

    Qo'lda baholanadigan tur uchun `(None, 0)` — `None` "hali baholanmagan"
    degani (False EMAS: noto'g'ri deb qo'yilsa talaba nolni ko'rardi va
    o'qituvchi tekshirgunicha shunday qolardi).
    """
    grader = ISLOH_GRADERS.get(question.type)
    if grader is None:
        return None, 0

    is_correct = grader(question, value)
    return is_correct, (question.points if is_correct else 0)


def isloh_grade_attempt(attempt):
    """Butun urinishni baholaydi va natijani `attempt` ga yozadi.

    Foiz JAVOB BERILGAN savollar bo'yicha emas, testdagi BARCHA savollar
    bo'yicha hisoblanadi: aks holda bitta savolga javob berib qolganini
    tashlab ketgan talaba 100% olardi.
    """
    from django.utils import timezone

    links = attempt.quiz.quiz_questions.select_related("question").prefetch_related("question__options")
    questions = {str(link.question_id): link.question for link in links}

    points_total = sum(q.points for q in questions.values())
    points_awarded = 0
    needs_review = False

    for answer in attempt.answers.select_related("question").prefetch_related("question__options"):
        question = questions.get(str(answer.question_id))
        if question is None:
            # Savol testdan olib tashlangan — javob hisobga olinmaydi
            continue

        is_correct, points = isloh_grade_answer(question, answer.value)
        answer.is_correct = is_correct
        answer.points_awarded = points
        answer.save(update_fields=["is_correct", "points_awarded", "updated_at"])

        points_awarded += points
        if is_correct is None:
            needs_review = True

    attempt.points_total = points_total
    attempt.points_awarded = points_awarded
    attempt.score = round(points_awarded * 100 / points_total) if points_total else 0
    attempt.needs_review = needs_review
    # Qo'lda baholanadigan savol bo'lsa "o'tdi" hukmi hali erta
    attempt.passed = (not needs_review) and attempt.score >= attempt.quiz.passing_score
    attempt.status = attempt.STATUS_SUBMITTED
    attempt.submitted_at = timezone.now()
    attempt.save()

    return attempt
