"""
ISLOH — chat ko'rinishlari (M8).

Butun modulni bitta qoida boshqaradi: **suhbatga faqat A'ZO kira oladi.**
A'zo bo'lmagan odam uchun suhbat MAVJUD EMAS — 403 emas, 404 qaytadi,
chunki 403 ning o'zi "bunday suhbat bor" degan ma'lumotni oshkor qilardi
(M2 dan beri saqlanadigan qaror).

--- SAHIFALASH ------------------------------------------------------------

Ikki xil, va sabab har xil:

  `GET /chat/threads`   — SAHIFALANMAYDI (§0.1). Bu do'kon endpoint'i:
                          `js/api.js` javobga to'g'ridan-to'g'ri `.map()`
                          qo'llaydi va o'ram kelsa sahifa jimgina demo
                          ma'lumotga tushardi.

  `GET .../messages`    — KURSOR bo'yicha. Yozishma cheksiz o'sadi va uni
                          butunlay yuborish mumkin emas. Sahifa raqami
                          ham yaramaydi: suhbatga yangi xabar kelishi
                          bilan barcha raqamlar SURILADI va "eskiroq"
                          bosilganda bir xil xabar ikki marta kelardi.
                          Kursor esa yozuvning o'ziga bog'lanadi.

Kursor — `"<vaqt>|<id>"`. Faqat vaqt yetarli emas: bir mikrosoniyada
yozilgan ikki xabar chegaraga tushsa, biri butunlay yo'qolardi.
"""

from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.sanitize import isloh_clean_text
from apps.courses.models import Course

from .models import ChatMessage, ChatThread
from .realtime import isloh_broadcast_message, isloh_broadcast_thread
from .serializers import (
    ChatMemberSettingsSerializer,
    ChatMessageSerializer,
    ChatThreadSerializer,
    ChatUserSerializer,
)
from .services import (
    isloh_can_message,
    isloh_can_open_course_group,
    isloh_can_pin,
    isloh_contacts,
    isloh_mark_read,
    isloh_member_or_none,
    isloh_my_threads,
    isloh_open_course_group,
    isloh_open_direct,
    isloh_send_message,
    isloh_unread_total,
)

# Bir sahifadagi xabarlar soni. Chat oynasi bir ekranga ~15 tasini
# sig'diradi, qolgani "eskiroq" bosilganda keladi.
ISLOH_MESSAGE_PAGE = 50
ISLOH_MESSAGE_PAGE_MAX = 100

ISLOH_PINNED_NOTE_MAX = 200


def isloh_thread_context(request):
    """Serializer JORIY foydalanuvchini bilishi shart (serializers.py)."""
    return {"me": request.user, "request": request}


def isloh_thread_or_404(request, thread_id):
    """A'zo bo'lmagan odam uchun suhbat yo'q (yuqoridagi izoh)."""
    member = isloh_member_or_none(thread_id, request.user)
    if member is None:
        raise NotFound("Suhbat topilmadi")
    return member.thread, member


def isloh_thread_payload(request, thread):
    """Bitta suhbatni javobga tayyorlaydi.

    `refresh_from_db` emas, QAYTA SO'ROV: `members` prefetch bilan
    kelishi kerak, aks holda serializer har bir a'zo uchun alohida
    so'rov yuborardi.
    """
    row = isloh_my_threads(request.user).filter(pk=thread.pk).first()
    return ChatThreadSerializer(row or thread, context=isloh_thread_context(request)).data


class ChatThreadListView(APIView):
    """`GET /chat/threads` — do'kon endpoint'i (massiv)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = isloh_my_threads(request.user)
        return Response(
            ChatThreadSerializer(rows, many=True, context=isloh_thread_context(request)).data
        )


class DirectThreadView(APIView):
    """`POST /chat/threads/direct` — 1-ga-1 suhbatni ochadi yoki yaratadi.

    Suhbatdosh `user_id` yoki `email` bilan ko'rsatiladi: frontenddagi
    "Yangi suhbat" oynasi email so'raydi (pages/student/chat.html),
    talabalar ro'yxatidan kelgan chuqur havola esa id beradi
    (js/instructor-messages.js).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        other = self._target(request)
        if not isloh_can_message(request.user, other):
            # Sabab aytilmaydi: "bunday odam bor, lekin yozolmaysiz" ham
            # ma'lumot oshkor qilish bo'lardi
            raise ValidationError({"form": "Bu foydalanuvchiga xabar yozib bo'lmaydi"})

        thread = isloh_open_direct(request.user, other)
        return Response(isloh_thread_payload(request, thread), status=status.HTTP_201_CREATED)

    def _target(self, request):
        user_id = request.data.get("user_id")
        email = str(request.data.get("email") or "").strip().lower()

        if user_id:
            other = User.objects.filter(pk=user_id).first()
        elif email:
            other = User.objects.filter(email=email).first()
        else:
            raise ValidationError({"form": "Foydalanuvchi ko'rsatilmagan"})

        if other is None:
            raise ValidationError({"email": "Bunday foydalanuvchi topilmadi"})
        return other


class CourseGroupThreadView(APIView):
    """`POST /chat/threads/course/{course_id}` — kurs guruhini ochadi.

    Guruh TALAB BO'YICHA yaratiladi: har bir kursga oldindan suhbat
    yasab qo'yish minglab bo'sh yozuv demak bo'lardi.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not isloh_can_open_course_group(request.user, course):
            raise NotFound("Kurs topilmadi")

        thread = isloh_open_course_group(request.user, course)
        return Response(isloh_thread_payload(request, thread), status=status.HTTP_201_CREATED)


class ChatThreadDetailView(APIView):
    """`PATCH /chat/threads/{id}` — arxiv, ovoz va e'lon.

    Uch maydon ikki xil egaga tegishli va bu shu yerda ajratiladi:
    `archived`/`muted` — MENING a'zoligim, `pinned_note` — SUHBAT
    (guruhdagi hamma ko'radi, shuning uchun uni faqat kurs egasi qo'yadi).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, thread_id):
        thread, _ = isloh_thread_or_404(request, thread_id)
        return Response(isloh_thread_payload(request, thread))

    def patch(self, request, thread_id):
        thread, member = isloh_thread_or_404(request, thread_id)

        settings_serializer = ChatMemberSettingsSerializer(
            member, data=request.data, partial=True
        )
        settings_serializer.is_valid(raise_exception=True)
        settings_serializer.save()

        if "pinned_note" in request.data:
            self._set_pinned_note(request, thread)

        return Response(isloh_thread_payload(request, thread))

    def _set_pinned_note(self, request, thread):
        if not isloh_can_pin(request.user, thread):
            raise ValidationError({"pinned_note": "E'lonni faqat kurs egasi qo'ya oladi"})

        note = isloh_clean_text(request.data.get("pinned_note"), ISLOH_PINNED_NOTE_MAX)
        thread.pinned_note = note
        thread.save(update_fields=["pinned_note", "updated_at"])

        # E'lon hammaga ko'rinadi — a'zolarning ochiq oynasi ham yangilansin
        isloh_broadcast_thread(
            [m.user_id for m in thread.members.all()], thread.id, {"pinned_note": note}
        )


class ChatThreadReadView(APIView):
    """`POST /chat/threads/{id}/read` — o'qilmaganlar hisoblagichini nollaydi."""

    permission_classes = [IsAuthenticated]

    def post(self, request, thread_id):
        thread, _ = isloh_thread_or_404(request, thread_id)
        isloh_mark_read(thread, request.user)
        return Response({"unread": 0})


class ChatMessageListView(APIView):
    """`GET|POST /chat/threads/{id}/messages`."""

    permission_classes = [IsAuthenticated]

    def get(self, request, thread_id):
        thread, _ = isloh_thread_or_404(request, thread_id)

        limit = self._limit(request)
        rows = ChatMessage.objects.filter(thread=thread)
        rows = self._apply_cursor(rows, request.query_params.get("before"))

        # Bittasi ORTIQCHA olinadi: "yana bormi" degan savolga ikkinchi
        # `count()` so'rovisiz javob beradi
        page = list(rows[: limit + 1])
        has_more = len(page) > limit
        page = page[:limit]

        # Bazadan yangi -> eski keladi, ekranda esa eski -> yangi
        page.reverse()
        return Response(
            {
                "results": ChatMessageSerializer(page, many=True).data,
                "has_more": has_more,
                "next_before": self._cursor(page[0]) if page and has_more else "",
            }
        )

    def post(self, request, thread_id):
        thread, _ = isloh_thread_or_404(request, thread_id)

        message = isloh_send_message(thread, request.user, request.data.get("text"))
        if message is None:
            raise ValidationError({"text": "Xabar matni bo'sh"})

        data = ChatMessageSerializer(message).data
        self._broadcast(thread, data)
        return Response(data, status=status.HTTP_201_CREATED)

    # --- Yordamchilar --------------------------------------------------------

    def _broadcast(self, thread, data):
        """Har bir a'zoga O'ZINING o'qilmaganlar soni bilan yuboriladi."""
        unread_by_user = {m.user_id: m.unread_count for m in thread.members.all()}
        isloh_broadcast_message(thread, data, unread_by_user)

    def _limit(self, request):
        try:
            limit = int(request.query_params.get("limit") or ISLOH_MESSAGE_PAGE)
        except ValueError:
            limit = ISLOH_MESSAGE_PAGE
        return max(1, min(limit, ISLOH_MESSAGE_PAGE_MAX))

    def _cursor(self, message):
        return f"{message.created_at.isoformat()}|{message.id}"

    def _apply_cursor(self, rows, before):
        """`before` dan ESKIROQ xabarlar.

        Vaqt va id birga tekshiriladi: bir xil vaqtli ikki xabar bo'lsa,
        faqat vaqt bo'yicha filtrlash ulardan birini tashlab ketardi
        (`<` bo'lsa) yoki ikki marta qaytarardi (`<=` bo'lsa).
        """
        if not before:
            return rows

        raw_time, _, raw_id = str(before).partition("|")
        moment = parse_datetime(raw_time)
        if moment is None:
            raise ValidationError({"before": "Kursor noto'g'ri"})

        if raw_id:
            from django.db.models import Q

            return rows.filter(Q(created_at__lt=moment) | Q(created_at=moment, id__lt=raw_id))
        return rows.filter(created_at__lt=moment)


class ChatUserListView(APIView):
    """`GET /chat/users?q=` — kim bilan yozishish mumkin (massiv).

    Bu ham do'kon endpoint'i: `js/chat-store.js` dagi `isloh_chat_users`
    kalitining serverdagi manbasi.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = str(request.query_params.get("q") or "").strip()
        rows = isloh_contacts(request.user, query)
        return Response(ChatUserSerializer(rows, many=True).data)


class ChatUnreadCountView(APIView):
    """`GET /chat/unread-count` — yon menyudagi nishon uchun.

    M7 dagi `/notifications/unread-count` bilan bir xil sabab: nishon 60+
    sahifada turadi va butun ro'yxatni bitta son uchun yuklash isrof
    bo'lardi.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"unread": isloh_unread_total(request.user)})
