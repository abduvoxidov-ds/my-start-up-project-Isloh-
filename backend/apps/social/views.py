"""
ISLOH — sharh va muhokama ko'rinishlari (M6).

UCHTA QOIDA butun modulni belgilaydi:

1. **Sharh faqat kursga YOZILGAN talabadan.** Aks holda raqobatchi ham,
   kursni umuman ko'rmagan odam ham reytingni tushirib yuborardi. Bitta
   kursga bitta sharh — `UNIQUE(course, user)` (apps/social/models.py).

2. **Muhokamani faqat kurs ichidagilar ko'radi** — yozilgan talaba yoki
   kurs egasi. Boshqa hamma uchun 404: 403 javobning o'zi mavzu borligini
   oshkor qilardi (M2 dagi "begona kurs 404" qarori).

3. **Moderatsiya kurs egasida.** O'qituvchi o'z kursidagi istalgan mavzu
   yoki javobni o'chira oladi, qadaydi va "hal qilindi" deb belgilaydi.
   Muallif esa faqat O'ZINIKINI tahrirlaydi va o'chiradi.

Sanoqlar (`like_count`, `reply_count`, `liked`) SO'ROVDA hisoblanadi.
Ilgari frontend like sonini `textContent` dan o'qib bittaga oshirardi
(js/discussion.js) — ya'ni son hech qayerda saqlanmasdi va tugmani ikki
marta bosish uni ikki marta oshirardi.
"""

from django.db.models import BooleanField, Count, Exists, OuterRef, Prefetch, Q, Value
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.models import Course
from apps.courses.views import IsInstructor
from apps.learning.models import Enrollment

from .models import (
    DiscussionReply,
    DiscussionThread,
    Reaction,
    Review,
    ReviewReply,
    isloh_refresh_course_rating,
)
from .serializers import (
    DiscussionReplySerializer,
    DiscussionThreadSerializer,
    ReviewReplyWriteSerializer,
    ReviewSerializer,
)

# --- Umumiy yordamchilar ----------------------------------------------------


def isloh_course_or_404(course_id):
    course = Course.objects.filter(pk=course_id).first()
    if course is None:
        raise NotFound("Kurs topilmadi")
    return course


def isloh_is_enrolled(user, course_id):
    return Enrollment.objects.filter(user=user, course_id=course_id).exists()


def isloh_require_course_access(user, course):
    """Kurs ichidagilar: yozilgan talaba yoki kurs egasi."""
    if course.owner_id == user.id or isloh_is_enrolled(user, course.pk):
        return course
    raise NotFound("Bu kursga yozilmagansiz")


def isloh_liked_expression(user, field):
    """`liked` — SHU foydalanuvchi bosganmi.

    Anonim so'rovda (ochiq sharhlar ro'yxati) qiymat hech qachon `True`
    bo'lmaydi; `Exists` ga bo'sh so'rov berish o'rniga `False` qaytariladi.
    """
    if not user or not user.is_authenticated:
        return Value(False, output_field=BooleanField())
    return Exists(Reaction.objects.filter(**{field: OuterRef("pk")}, user=user))


def isloh_reply_queryset(user):
    liked = isloh_liked_expression(user, "reply")
    return (
        DiscussionReply.objects.select_related("author")
        .annotate(like_count=Count("reactions", distinct=True), liked=liked)
        .order_by("created_at")
    )


def isloh_thread_queryset(user):
    return (
        DiscussionThread.objects.select_related("author", "course", "course__owner", "module")
        .annotate(
            like_count=Count("reactions", distinct=True),
            reply_count=Count("replies", distinct=True),
            liked=isloh_liked_expression(user, "thread"),
        )
        .prefetch_related(
            Prefetch("replies", queryset=isloh_reply_queryset(user), to_attr="prefetched_replies")
        )
        # ORDER BY OSHKORA. `annotate()` guruhlash qo'shadi va Django shunda
        # modelning `Meta.ordering` ini SQL'ga UMUMAN chiqarmaydi — aynan shu
        # tuzoq M2 da katalogni sahifalashda topilgan edi. Bu yerda u
        # boshqacha ko'rinardi: o'qituvchi mavzuni qadab qo'yardi, lekin u
        # ro'yxatning tepasiga chiqmasdi. `id` — teng qiymatlar uchun
        # ajratuvchi.
        .order_by("-is_pinned", "-created_at", "id")
    )


def isloh_toggle_reaction(user, **target):
    """Yoqtirishni almashtiradi va yangi sanoqni qaytaradi.

    `get_or_create` + `delete` — bitta amalda: `UNIQUE` cheklovi ikkinchi
    yozuvga yo'l qo'ymaydi, ya'ni tugmani tez-tez bosish sanoqni buzmaydi.
    """
    row, created = Reaction.objects.get_or_create(user=user, **target)
    if not created:
        row.delete()
    return created


# --- Sharhlar ---------------------------------------------------------------


class CourseReviewView(APIView):
    """`/courses/{id}/reviews` — o'qish OCHIQ, yozish yozilganlarga.

    O'qish auth'siz: katalog sahifasi (`/catalog/{slug}`) ham auth'siz
    ishlaydi (M2) va sharhlarsiz kurs sahifasi yarim bo'lardi.
    """

    permission_classes = [AllowAny]

    def get(self, request, course_id):
        course = isloh_course_or_404(course_id)
        rows = (
            Review.objects.filter(course=course)
            .select_related("user", "course", "course__owner")
            .prefetch_related("reply")
        )
        return Response(ReviewSerializer(rows, many=True).data)

    def post(self, request, course_id):
        if not request.user.is_authenticated:
            raise NotFound("Kurs topilmadi")

        course = isloh_course_or_404(course_id)
        # QOIDA 1 — sharh faqat kursga yozilgan talabadan
        if not isloh_is_enrolled(request.user, course.pk):
            raise ValidationError({"form": "Sharh qoldirish uchun kursga yozilishingiz kerak"})

        if Review.objects.filter(course=course, user=request.user).exists():
            raise ValidationError({"form": "Siz bu kursga allaqachon sharh qoldirgansiz"})

        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save(course=course, user=request.user)

        isloh_refresh_course_rating(course)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class ReviewDetailView(APIView):
    """`/reviews/{id}` — o'z sharhini tahrirlash yoki o'chirish."""

    permission_classes = [IsAuthenticated]

    def _own(self, request, review_id):
        review = (
            Review.objects.filter(pk=review_id, user=request.user)
            .select_related("course", "course__owner", "user")
            .first()
        )
        if review is None:
            raise NotFound("Sharh topilmadi")
        return review

    def put(self, request, review_id):
        review = self._own(request, review_id)
        serializer = ReviewSerializer(review, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        isloh_refresh_course_rating(review.course)
        return Response(ReviewSerializer(review).data)

    def delete(self, request, review_id):
        review = self._own(request, review_id)
        course = review.course
        review.delete()

        isloh_refresh_course_rating(course)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstructorReviewListView(APIView):
    """`/instructor/reviews` — do'kon endpoint'i, SAHIFALANMAYDI (§0.1)."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def get(self, request):
        rows = (
            Review.objects.filter(course__owner=request.user)
            .select_related("user", "course", "course__owner")
            .prefetch_related("reply")
        )
        course = request.query_params.get("course")
        if course:
            rows = rows.filter(course_id=course)
        return Response(ReviewSerializer(rows, many=True).data)


class InstructorReviewReplyView(APIView):
    """`/instructor/reviews/{id}/reply` — javob yozish yoki o'chirish."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def _own_review(self, request, review_id):
        review = (
            Review.objects.filter(pk=review_id, course__owner=request.user)
            .select_related("course", "course__owner", "user")
            .first()
        )
        if review is None:
            raise NotFound("Sharh topilmadi")
        return review

    def post(self, request, review_id):
        review = self._own_review(request, review_id)

        serializer = ReviewReplyWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Javob YANGILANADI, ikkinchisi yaratilmaydi (`OneToOne`)
        ReviewReply.objects.update_or_create(
            review=review,
            defaults={"author": request.user, "text": serializer.validated_data["text"]},
        )
        review.refresh_from_db()
        return Response(ReviewSerializer(review).data)

    def delete(self, request, review_id):
        review = self._own_review(request, review_id)
        ReviewReply.objects.filter(review=review).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- Muhokamalar ------------------------------------------------------------


class DiscussionThreadViewSet(viewsets.ModelViewSet):
    """`/discussions` — do'kon endpoint'i (massiv, sahifalanmaydi).

    `?course=` MAJBURIY emas, lekin bo'lmasa faqat FOYDALANUVCHI kira
    oladigan kurslarning mavzulari qaytadi — ya'ni ro'yxat hech qachon
    begona kursni oshkor qilmaydi.
    """

    serializer_class = DiscussionThreadSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = isloh_thread_queryset(user)

        course_id = self.request.query_params.get("course")
        if course_id:
            course = isloh_course_or_404(course_id)
            isloh_require_course_access(user, course)
            queryset = queryset.filter(course=course)
        else:
            enrolled = Enrollment.objects.filter(user=user).values_list("course_id", flat=True)
            queryset = queryset.filter(Q(course__owner=user) | Q(course_id__in=list(enrolled)))

        kind = self.request.query_params.get("kind")
        if kind:
            queryset = queryset.filter(kind=kind)
        return queryset

    def perform_create(self, serializer):
        course = serializer.validated_data.get("course")
        if course is None:
            raise ValidationError({"course": "Kurs ko'rsatilmagan"})
        isloh_require_course_access(self.request.user, course)

        module = serializer.validated_data.get("module")
        # Boshqa kursning moduli biriktirilmasin — yorliqda o'sha kursning
        # nomi chiqib qolardi
        if module is not None and module.course_id != course.pk:
            raise ValidationError({"module": "Modul bu kursga tegishli emas"})

        serializer.save(author=self.request.user)

    def _annotated(self, pk):
        """Sanoqlar bilan birga qayta o'qish.

        Yaratish va yangilashdan keyin ZARUR: `serializer.instance` — bu
        yangi saqlangan obyekt va unda `annotate` qiymatlari (`like_count`,
        `reply_count`, `liked`) YO'Q. Ularsiz javob yuborilsa frontend
        kartochkani sanoqsiz chizardi va son faqat sahifa yangilangandan
        keyin paydo bo'lardi.
        """
        row = isloh_thread_queryset(self.request.user).filter(pk=pk).first()
        if row is None:
            raise NotFound("Mavzu topilmadi")
        return self.get_serializer(row).data

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(self._annotated(serializer.instance.pk), status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=kwargs.pop("partial", False))
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(self._annotated(instance.pk))

    def _editable(self, thread):
        """Tahrirlash — faqat muallif. O'chirish esa kurs egasiga ham
        ochiq (moderatsiya), u alohida tekshiriladi."""
        if thread.author_id != self.request.user.id:
            raise NotFound("Mavzu topilmadi")

    def perform_update(self, serializer):
        self._editable(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        # QOIDA 3 — moderatsiya kurs egasida
        if instance.author_id != self.request.user.id and instance.course.owner_id != self.request.user.id:
            raise NotFound("Mavzu topilmadi")
        instance.delete()

    # --- Amallar ------------------------------------------------------------

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        thread = self.get_object()
        isloh_toggle_reaction(request.user, thread=thread)
        return Response(self._annotated(thread.pk))

    @action(detail=True, methods=["post"])
    def pin(self, request, pk=None):
        """Qadash — FAQAT kurs egasi.

        Qadalgan mavzu hamma uchun tepada turadi, ya'ni bu talabaning
        emas, o'qituvchining vositasi."""
        thread = self.get_object()
        if thread.course.owner_id != request.user.id:
            raise NotFound("Mavzu topilmadi")

        DiscussionThread.objects.filter(pk=thread.pk).update(
            is_pinned=not thread.is_pinned, updated_at=timezone.now()
        )
        return Response(self._annotated(thread.pk))

    @action(detail=True, methods=["post"])
    def solve(self, request, pk=None):
        """"Hal qilindi" — kurs egasi YOKI mavzu muallifi.

        Muallif ham qo'ya oladi: savol bergan odam javobni olganini o'zi
        biladi va buning uchun o'qituvchini kutib turishi shart emas."""
        thread = self.get_object()
        if thread.course.owner_id != request.user.id and thread.author_id != request.user.id:
            raise NotFound("Mavzu topilmadi")

        DiscussionThread.objects.filter(pk=thread.pk).update(
            is_solved=not thread.is_solved, updated_at=timezone.now()
        )
        return Response(self._annotated(thread.pk))

    @action(detail=True, methods=["post"], url_path="replies")
    def add_reply(self, request, pk=None):
        thread = self.get_object()

        serializer = DiscussionReplySerializer(
            data=request.data, context={"course_owner_id": thread.course.owner_id}
        )
        serializer.is_valid(raise_exception=True)

        parent = isloh_resolve_parent(thread, request.data.get("parent"))
        serializer.save(thread=thread, author=request.user, parent=parent)
        return Response(self._annotated(thread.pk), status=status.HTTP_201_CREATED)


def isloh_resolve_parent(thread, parent_id):
    """Javobning otasi. Chuqurlik IKKI daraja bilan cheklanadi.

    Uchinchi daraja frontendda sahifadan chiqib ketardi (`.comment-card`
    va `.comment-card.nested` — boshqa sinf yo'q), shuning uchun nevara
    javob otasining o'rniga BOBOSIGA biriktiriladi. Rad etish emas:
    foydalanuvchi javobini yo'qotmasligi kerak.
    """
    if not parent_id:
        return None

    parent = DiscussionReply.objects.filter(pk=parent_id, thread=thread).first()
    if parent is None:
        # Begona mavzuning javobi — jimgina yuqori daraja bo'lib qoladi
        return None
    return parent.parent if parent.parent_id else parent


class DiscussionReplyDetailView(APIView):
    """`/discussion-replies/{id}` — tahrirlash va o'chirish."""

    permission_classes = [IsAuthenticated]

    def _reply(self, request, reply_id):
        reply = (
            DiscussionReply.objects.filter(pk=reply_id)
            .select_related("thread", "thread__course", "author")
            .first()
        )
        if reply is None:
            raise NotFound("Javob topilmadi")
        isloh_require_course_access(request.user, reply.thread.course)
        return reply

    def put(self, request, reply_id):
        reply = self._reply(request, reply_id)
        if reply.author_id != request.user.id:
            raise NotFound("Javob topilmadi")

        serializer = DiscussionReplySerializer(
            reply,
            data=request.data,
            partial=True,
            context={"course_owner_id": reply.thread.course.owner_id},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(isloh_reply_payload(request, reply.pk))

    def delete(self, request, reply_id):
        reply = self._reply(request, reply_id)
        # QOIDA 3 — moderatsiya kurs egasida
        if reply.author_id != request.user.id and reply.thread.course.owner_id != request.user.id:
            raise NotFound("Javob topilmadi")
        reply.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def isloh_reply_payload(request, reply_id):
    """Sanoqlar bilan birga bitta javob (annotate qayta qo'llanadi)."""
    row = (
        isloh_reply_queryset(request.user)
        .select_related("thread__course")
        .filter(pk=reply_id)
        .first()
    )
    if row is None:
        raise NotFound("Javob topilmadi")
    return DiscussionReplySerializer(
        row, context={"course_owner_id": row.thread.course.owner_id}
    ).data


class DiscussionReplyActionView(APIView):
    """`/discussion-replies/{id}/{like|accept|pin}`."""

    permission_classes = [IsAuthenticated]

    def post(self, request, reply_id, verb):
        reply = (
            DiscussionReply.objects.filter(pk=reply_id)
            .select_related("thread", "thread__course", "author")
            .first()
        )
        if reply is None:
            raise NotFound("Javob topilmadi")
        isloh_require_course_access(request.user, reply.thread.course)

        if verb == "like":
            isloh_toggle_reaction(request.user, reply=reply)

        elif verb == "accept":
            # Javobni QABUL QILISH — savol muallifi yoki kurs egasi
            thread = reply.thread
            if thread.author_id != request.user.id and thread.course.owner_id != request.user.id:
                raise NotFound("Javob topilmadi")
            # Mavzuda bittadan ortiq qabul qilingan javob bo'lmaydi
            DiscussionReply.objects.filter(thread=thread).update(is_accepted=False)
            DiscussionReply.objects.filter(pk=reply.pk).update(is_accepted=True)
            DiscussionThread.objects.filter(pk=thread.pk).update(is_solved=True)

        elif verb == "pin":
            if reply.thread.course.owner_id != request.user.id:
                raise NotFound("Javob topilmadi")
            DiscussionReply.objects.filter(pk=reply.pk).update(is_pinned=not reply.is_pinned)

        else:
            raise NotFound("Amal topilmadi")

        return Response(isloh_reply_payload(request, reply.pk))
