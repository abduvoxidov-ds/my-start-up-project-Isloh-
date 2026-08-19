"""
ISLOH — chat testlari (M8).

Uch guruh qoida qulflanadi:

  1. **A'ZOLIK** — begona suhbat MAVJUD EMAS (404, 403 emas), begona
     odamga xabar yozib bo'lmaydi.
  2. **HISOBLAGICH** — o'qilmaganlar soni SHAXSIY: yozuvchida 0,
     qolganlarda +1. Bu modulning eng oson buziladigan qismi.
  3. **KURSOR** — sahifa chegarasida xabar yo'qolmaydi va ikki marta
     kelmaydi. Aynan shu narsa sahifa raqami bilan ishlamasdi.

WebSocket alohida sinaladi (`WebSocketTests`): `channels.testing`
haqiqiy ulanish ochadi va xotira kanal qatlami orqali xabar
yetkazilishini tekshiradi.
"""

from datetime import timedelta

from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_STUDENT, User, UserRole
from apps.courses.models import STATUS_PUBLISHED, Course, CourseSettings
from apps.learning.models import Enrollment

from .models import ChatMember, ChatMessage, ChatThread, Presence
from .services import isloh_open_direct, isloh_send_message

CHAT = "/api/v1/chat"


def make_user(email, role, name="Test Ism"):
    user = User.objects.create_user(email=email, password="TestParol2026!", full_name=name)
    UserRole.objects.create(user=user, role=role)
    return user


def make_course(owner, title="Kurs"):
    course = Course.objects.create(
        owner=owner,
        slug=f"kurs-{Course.objects.count() + 1}",
        title=title,
        description="Tavsif",
        price_cents=1000,
        status=STATUS_PUBLISHED,
    )
    CourseSettings.objects.create(course=course)
    return course


class ChatTestCase(APITestCase):
    """O'qituvchi + kursiga yozilgan talaba — eng oddiy haqiqiy aloqa."""

    def setUp(self):
        self.instructor = make_user("ustoz@isloh.uz", ROLE_INSTRUCTOR, "Akmal Yusupov")
        self.student = make_user("talaba@isloh.uz", ROLE_STUDENT, "Samar Mirzayev")
        self.course = make_course(self.instructor, "Python Backend")
        Enrollment.objects.create(user=self.student, course=self.course)

    def direct(self):
        return isloh_open_direct(self.student, self.instructor)

    def unread_of(self, thread, user):
        return ChatMember.objects.get(thread=thread, user=user).unread_count


# --- 1) Kirish va a'zolik ----------------------------------------------------


class AuthTests(ChatTestCase):
    def test_kirmasdan_401(self):
        for url in (f"{CHAT}/threads", f"{CHAT}/users", f"{CHAT}/unread-count"):
            self.assertEqual(
                self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED, url
            )

    def test_begona_suhbat_404(self):
        """403 EMAS: 403 ning o'zi suhbat borligini oshkor qilardi."""
        thread = self.direct()
        outsider = make_user("begona@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(outsider)

        self.assertEqual(
            self.client.get(f"{CHAT}/threads/{thread.id}/messages").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(f"{CHAT}/threads/{thread.id}/messages", {"text": "salom"}).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.patch(f"{CHAT}/threads/{thread.id}", {"muted": True}).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_begona_suhbat_royxatda_yoq(self):
        self.direct()
        outsider = make_user("begona2@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(outsider)

        res = self.client.get(f"{CHAT}/threads")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])


# --- 2) Do'kon shartnomasi (§0.1) --------------------------------------------


class StoreContractTests(ChatTestCase):
    def test_suhbatlar_massiv_qaytaradi(self):
        """O'ram kelsa js/api.js jimgina demo ma'lumotga tushardi."""
        self.direct()
        self.client.force_authenticate(self.student)

        res = self.client.get(f"{CHAT}/threads")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 1)

    def test_katalog_massiv_qaytaradi(self):
        self.client.force_authenticate(self.student)
        res = self.client.get(f"{CHAT}/users")
        self.assertIsInstance(res.data, list)

    def test_suhbat_maydonlari_frontend_shakliga_mos(self):
        thread = self.direct()
        self.client.force_authenticate(self.student)

        row = self.client.get(f"{CHAT}/threads").data[0]
        for field in (
            "id", "type", "members", "title", "course", "pinned_note",
            "last_message", "last_sender", "last_message_at",
            "unread", "archived", "muted",
        ):
            self.assertIn(field, row)
        self.assertEqual(row["type"], "direct")
        self.assertEqual(sorted(row["members"]), sorted([str(self.student.id), str(self.instructor.id)]))
        self.assertEqual(str(thread.id), row["id"])


# --- 3) Suhbat ochish --------------------------------------------------------


class OpenThreadTests(ChatTestCase):
    def test_email_bilan_ochiladi(self):
        self.client.force_authenticate(self.student)
        res = self.client.post(f"{CHAT}/threads/direct", {"email": "ustoz@isloh.uz"})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(ChatThread.objects.count(), 1)

    def test_ikki_marta_ochilsa_bitta_suhbat(self):
        """`unique_key` — A→B va B→A bir xil suhbat."""
        self.client.force_authenticate(self.student)
        first = self.client.post(f"{CHAT}/threads/direct", {"user_id": str(self.instructor.id)})

        self.client.force_authenticate(self.instructor)
        second = self.client.post(f"{CHAT}/threads/direct", {"user_id": str(self.student.id)})

        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(ChatThread.objects.count(), 1)

    def test_ozing_bilan_suhbat_yoq(self):
        self.client.force_authenticate(self.student)
        res = self.client.post(f"{CHAT}/threads/direct", {"user_id": str(self.student.id)})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("form", res.data["error"]["fields"])

    def test_begona_odamga_yozib_bolmaydi(self):
        """Chat ochiq katalog emas — aloqasiz odamga yozish yopiq."""
        stranger = make_user("uzoq@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(self.student)

        res = self.client.post(f"{CHAT}/threads/direct", {"user_id": str(stranger.id)})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ChatThread.objects.count(), 0)

    def test_yoq_email_maydon_xatosi(self):
        """`fields` qiymati SATR bo'lishi shart (§0.2)."""
        self.client.force_authenticate(self.student)
        res = self.client.post(f"{CHAT}/threads/direct", {"email": "yoq@isloh.uz"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIsInstance(res.data["error"]["fields"]["email"], str)

    def test_admin_hammaga_ochiq(self):
        """Qo'llab-quvvatlash — aloqasi bo'lmagan talaba ham yoza oladi."""
        admin = make_user("support@isloh.uz", ROLE_ADMIN, "Isloh Support")
        lonely = make_user("yolgiz@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(lonely)

        res = self.client.post(f"{CHAT}/threads/direct", {"user_id": str(admin.id)})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)


class CourseGroupTests(ChatTestCase):
    def test_guruh_talab_boyicha_yaratiladi_va_azolar_sinxronlanadi(self):
        self.client.force_authenticate(self.instructor)
        res = self.client.post(f"{CHAT}/threads/course/{self.course.id}")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["type"], "group")
        self.assertEqual(sorted(res.data["members"]),
                         sorted([str(self.instructor.id), str(self.student.id)]))

        # Yangi talaba yozildi -> guruh qayta ochilganda u ham a'zo bo'ladi
        newcomer = make_user("yangi@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=newcomer, course=self.course)

        again = self.client.post(f"{CHAT}/threads/course/{self.course.id}")
        self.assertEqual(again.data["id"], res.data["id"])
        self.assertIn(str(newcomer.id), again.data["members"])
        self.assertEqual(ChatThread.objects.filter(type="group").count(), 1)

    def test_yozilmagan_talaba_uchun_kurs_yoq(self):
        outsider = make_user("chetdan@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(outsider)
        res = self.client.post(f"{CHAT}/threads/course/{self.course.id}")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


# --- 4) Xabar yuborish va o'qilmaganlar --------------------------------------


class SendMessageTests(ChatTestCase):
    def test_yuborish_hisoblagichlarni_togri_ozgartiradi(self):
        """Yozuvchida 0, qolganlarda +1 — modulning asosiy qoidasi."""
        thread = self.direct()
        self.client.force_authenticate(self.student)

        res = self.client.post(f"{CHAT}/threads/{thread.id}/messages", {"text": "Salom ustoz"})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

        self.assertEqual(self.unread_of(thread, self.student), 0)
        self.assertEqual(self.unread_of(thread, self.instructor), 1)

        self.client.post(f"{CHAT}/threads/{thread.id}/messages", {"text": "Yana bir savol"})
        self.assertEqual(self.unread_of(thread, self.instructor), 2)

    def test_oxirgi_xabar_suhbatga_yoziladi(self):
        """Ro'yxat shu maydondan chiziladi — u yangilanmasa eski matn qolardi."""
        thread = self.direct()
        self.client.force_authenticate(self.student)
        self.client.post(f"{CHAT}/threads/{thread.id}/messages", {"text": "Oxirgi matn"})

        thread.refresh_from_db()
        self.assertEqual(thread.last_message, "Oxirgi matn")
        self.assertEqual(thread.last_sender_id, self.student.id)
        self.assertIsNotNone(thread.last_message_at)

    def test_bosh_xabar_rad_etiladi(self):
        thread = self.direct()
        self.client.force_authenticate(self.student)

        for text in ("", "   ", None):
            res = self.client.post(f"{CHAT}/threads/{thread.id}/messages", {"text": text})
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("text", res.data["error"]["fields"])
        self.assertEqual(ChatMessage.objects.count(), 0)

    def test_teglar_saqlanmaydi(self):
        """Ikkinchi qatlam (apps/core/sanitize.py) — birinchisi ekranlash."""
        thread = self.direct()
        self.client.force_authenticate(self.student)
        res = self.client.post(
            f"{CHAT}/threads/{thread.id}/messages",
            {"text": "<script>alert(1)</script> salom"},
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("<script>", res.data["text"])
        self.assertIn("salom", res.data["text"])

    def test_oqilgan_deb_belgilash(self):
        thread = self.direct()
        self.client.force_authenticate(self.student)
        self.client.post(f"{CHAT}/threads/{thread.id}/messages", {"text": "salom"})

        self.client.force_authenticate(self.instructor)
        res = self.client.post(f"{CHAT}/threads/{thread.id}/read")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["unread"], 0)
        self.assertEqual(self.unread_of(thread, self.instructor), 0)

    def test_umumiy_hisob_arxivni_hisoblamaydi(self):
        """Nishon arxivlangan suhbatni sanamaydi (js/chat-store.js bilan bir xil)."""
        thread = self.direct()
        self.client.force_authenticate(self.student)
        self.client.post(f"{CHAT}/threads/{thread.id}/messages", {"text": "salom"})

        self.client.force_authenticate(self.instructor)
        self.assertEqual(self.client.get(f"{CHAT}/unread-count").data["unread"], 1)

        self.client.patch(f"{CHAT}/threads/{thread.id}", {"archived": True})
        self.assertEqual(self.client.get(f"{CHAT}/unread-count").data["unread"], 0)


# --- 5) Shaxsiy sozlamalar ---------------------------------------------------


class ThreadSettingsTests(ChatTestCase):
    def test_arxiv_va_ovoz_shaxsiy(self):
        """Men arxivladim — suhbatdoshim uchun suhbat faol qolaveradi."""
        thread = self.direct()
        self.client.force_authenticate(self.student)
        res = self.client.patch(f"{CHAT}/threads/{thread.id}", {"archived": True, "muted": True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["archived"])
        self.assertTrue(res.data["muted"])

        self.client.force_authenticate(self.instructor)
        mine = self.client.get(f"{CHAT}/threads/{thread.id}").data
        self.assertFalse(mine["archived"])
        self.assertFalse(mine["muted"])

    def test_elonni_faqat_kurs_egasi_qoyadi(self):
        self.client.force_authenticate(self.instructor)
        group_id = self.client.post(f"{CHAT}/threads/course/{self.course.id}").data["id"]

        res = self.client.patch(f"{CHAT}/threads/{group_id}", {"pinned_note": "Ertaga dars 18:00"})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["pinned_note"], "Ertaga dars 18:00")

        self.client.force_authenticate(self.student)
        denied = self.client.patch(f"{CHAT}/threads/{group_id}", {"pinned_note": "Men qo'ydim"})
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pinned_note", denied.data["error"]["fields"])

    def test_elon_1ga1_suhbatda_yoq(self):
        thread = self.direct()
        self.client.force_authenticate(self.instructor)
        res = self.client.patch(f"{CHAT}/threads/{thread.id}", {"pinned_note": "E'lon"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


# --- 6) Kursor sahifalash ----------------------------------------------------


class CursorPaginationTests(ChatTestCase):
    def setUp(self):
        super().setUp()
        self.thread = self.direct()
        for i in range(12):
            message = isloh_send_message(self.thread, self.student, f"xabar {i}")
            # VAQT ATAYLAB QO'YILADI: Windows soati ~15 ms aniqlikda
            # ishlaydi va ketma-ket yozilgan xabarlar BIR XIL `created_at`
            # olishi mumkin. Bunday holatda tartib `id` ga tushadi (u
            # UUID, ya'ni tasodifiy) va test vaqti-vaqti bilan yiqilardi.
            # Haqiqiy chatda xabarlar orasida odam yozadigan vaqt bor,
            # lekin tartib SHART bo'lgani uchun ikkinchi kalit (`id`)
            # baribir kerak — u yerda muhimi barqarorlik.
            ChatMessage.objects.filter(pk=message.pk).update(
                created_at=timezone.now() + timedelta(seconds=i)
            )

    def test_sahifa_eskidan_yangiga_tartibda(self):
        self.client.force_authenticate(self.student)
        res = self.client.get(f"{CHAT}/threads/{self.thread.id}/messages", {"limit": 5})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        texts = [m["text"] for m in res.data["results"]]
        self.assertEqual(texts, ["xabar 7", "xabar 8", "xabar 9", "xabar 10", "xabar 11"])
        self.assertTrue(res.data["has_more"])
        self.assertTrue(res.data["next_before"])

    def test_kursor_bilan_yurganda_xabar_yoqolmaydi_va_takrorlanmaydi(self):
        """Sahifa raqami bilan aynan shu buzilardi."""
        self.client.force_authenticate(self.student)
        seen = []
        before = ""

        for _ in range(5):
            res = self.client.get(
                f"{CHAT}/threads/{self.thread.id}/messages",
                {"limit": 5, "before": before} if before else {"limit": 5},
            )
            seen = [m["id"] for m in res.data["results"]] + seen
            if not res.data["has_more"]:
                break
            before = res.data["next_before"]

        self.assertEqual(len(seen), 12)
        self.assertEqual(len(set(seen)), 12)
        self.assertEqual(seen, [str(m.id) for m in
                                ChatMessage.objects.filter(thread=self.thread).order_by("created_at", "id")])

    def test_notogri_kursor_maydon_xatosi(self):
        self.client.force_authenticate(self.student)
        res = self.client.get(f"{CHAT}/threads/{self.thread.id}/messages", {"before": "salom"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("before", res.data["error"]["fields"])

    def test_limit_chegaralanadi(self):
        self.client.force_authenticate(self.student)
        res = self.client.get(f"{CHAT}/threads/{self.thread.id}/messages", {"limit": 9999})
        self.assertEqual(len(res.data["results"]), 12)


# --- 7) Katalog va onlayn holat ----------------------------------------------


class ContactTests(ChatTestCase):
    def test_oquv_aloqasi_boyicha_korinadi(self):
        self.client.force_authenticate(self.student)
        emails = {u["email"] for u in self.client.get(f"{CHAT}/users").data}
        self.assertIn("ustoz@isloh.uz", emails)
        # O'zim ham katalogda: frontend "men kimman" degan javobni shundan oladi
        self.assertIn("talaba@isloh.uz", emails)

    def test_aloqasiz_odam_katalogda_yoq(self):
        make_user("uzoq2@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(self.student)
        emails = {u["email"] for u in self.client.get(f"{CHAT}/users").data}
        self.assertNotIn("uzoq2@isloh.uz", emails)

    def test_qidiruv_ishlaydi(self):
        self.client.force_authenticate(self.student)
        rows = self.client.get(f"{CHAT}/users", {"q": "Akmal"}).data
        self.assertEqual([u["email"] for u in rows], ["ustoz@isloh.uz"])

    def test_ulanmagan_odam_oflayn(self):
        self.client.force_authenticate(self.student)
        rows = {u["email"]: u["presence"] for u in self.client.get(f"{CHAT}/users").data}
        self.assertEqual(rows["ustoz@isloh.uz"], "offline")

    def test_eskirgan_online_holat_oflayn_deb_oqiladi(self):
        """Ulanish har doim ham to'g'ri uzilmaydi — vaqt ham tekshiriladi."""
        Presence.objects.create(
            user=self.instructor,
            status="online",
            last_seen_at=timezone.now() - timedelta(hours=1),
            connections=1,
        )
        self.client.force_authenticate(self.student)
        rows = {u["email"]: u["presence"] for u in self.client.get(f"{CHAT}/users").data}
        self.assertEqual(rows["ustoz@isloh.uz"], "offline")


class BroadcastPayloadTests(ChatTestCase):
    """Kanal qatlamiga JSON'ga o'girilmaydigan qiymat ketmasin.

    BU XATO HAQIQATAN BO'LGAN (brauzer sinovida topilgan): serializer
    `thread` maydonida UUID OBYEKTINI qoldirardi. REST yo'lida buni
    `JSONRenderer` o'girib yuborardi, WebSocket yo'lida esa `json.dumps`
    "Object of type UUID is not JSON serializable" bilan yiqilardi —
    xabar bazada bor edi, lekin suhbatdoshga YETMASDI va ekranda hech
    qanday xato ko'rinmasdi. Aynan shunday jim nosozlik uchun test kerak.
    """

    def test_xabar_yuki_json_ga_ogiriladi(self):
        import json

        from .serializers import ChatMessageSerializer

        thread = self.direct()
        message = isloh_send_message(thread, self.student, "Salom")
        json.dumps(ChatMessageSerializer(message).data)

    def test_bildirishnoma_yuki_json_ga_ogiriladi(self):
        import json

        from apps.notifications.models import Notification
        from apps.notifications.serializers import NotificationSerializer

        notification = Notification.objects.create(
            user=self.instructor, role="instructor", type="message",
            title="Yangi xabar", course=self.course,
        )
        json.dumps(NotificationSerializer(notification).data)


# --- 8) WebSocket ------------------------------------------------------------


class WebSocketTests(TransactionTestCase):
    """Haqiqiy ulanish ochiladi (`channels.testing`).

    `TransactionTestCase` — `APITestCase` EMAS: iste'molchi bazaga
    boshqa oqimdan yozadi va oddiy `TestCase` ning tranzaksiyasi u
    yerdan ko'rinmasdi.
    """

    def setUp(self):
        self.user = make_user("ws@isloh.uz", ROLE_STUDENT)
        self.token = str(AccessToken.for_user(self.user))

    def application(self):
        from config.asgi import application

        return application

    def connect_to(self, path, token=None):
        """`Origin` sarlavhasi MAJBURIY.

        `AllowedHostsOriginValidator` (config/asgi.py) sarlavhasiz
        ulanishni rad etadi va bu TO'G'RI: brauzer uni har doim yuboradi,
        yubormagan mijoz esa — skript. Testda ham haqiqiy brauzer kabi
        yuboriladi, aks holda himoya sinovdan chetda qolardi.
        """
        subprotocols = ["isloh-jwt", token] if token else None
        return WebsocketCommunicator(
            self.application(),
            path,
            headers=[(b"origin", b"http://localhost")],
            subprotocols=subprotocols,
        )

    async def receive_event(self, communicator, wanted):
        """`presence` hodisalarini o'tkazib yuborib, kutilganini oladi.

        Ulangan mijoz `chat.presence` guruhida turadi va O'ZINING
        "onlayn" e'lonini ham oladi — bu to'g'ri (boshqa tablar ham
        ko'rishi kerak), lekin test kutgan hodisadan oldin keladi.
        """
        for _ in range(5):
            event = await communicator.receive_json_from(timeout=3)
            if event.get("event") == wanted:
                return event
        raise AssertionError(f"{wanted} hodisasi kelmadi")

    async def test_tokensiz_ulanish_rad_etiladi(self):
        communicator = self.connect_to("/ws/chat")
        connected, _ = await communicator.connect()
        self.assertFalse(connected)

    async def test_begona_origin_rad_etiladi(self):
        """Begona saytdagi sahifa foydalanuvchi tokeni bilan ulanmasin."""
        communicator = WebsocketCommunicator(
            self.application(),
            "/ws/chat",
            headers=[(b"origin", b"http://yovuz.example")],
            subprotocols=["isloh-jwt", self.token],
        )
        connected, _ = await communicator.connect()
        self.assertFalse(connected)

    async def test_notogri_token_rad_etiladi(self):
        communicator = self.connect_to("/ws/chat", "yolgon.token.qiymat")
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_subprotokol_bilan_ulanadi(self):
        """Token SARLAVHADA ketadi — manzil qatorida emas (apps/messaging/auth.py)."""
        communicator = self.connect_to("/ws/chat", self.token)
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        self.assertEqual(subprotocol, "isloh-jwt")

        await communicator.send_json_to({"action": "ping"})
        self.assertEqual(await self.receive_event(communicator, "pong"), {"event": "pong"})
        await communicator.disconnect()

    async def test_yangi_xabar_ulangan_mijozga_yetadi(self):
        """Modulning butun ma'nosi: xabar sahifa yangilanmasdan keladi."""
        from asgiref.sync import sync_to_async

        peer = await sync_to_async(make_user)("ws2@isloh.uz", ROLE_INSTRUCTOR)
        thread = await sync_to_async(isloh_open_direct)(self.user, peer)

        communicator = self.connect_to("/ws/chat", self.token)
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        from .realtime import isloh_broadcast_message

        await sync_to_async(isloh_broadcast_message)(
            thread,
            {"id": "1", "text": "Salom", "sender": str(peer.id)},
            {self.user.id: 1},
        )

        event = await self.receive_event(communicator, "message")
        self.assertEqual(event["thread_id"], str(thread.id))
        self.assertEqual(event["message"]["text"], "Salom")
        self.assertEqual(event["unread"], 1)
        await communicator.disconnect()

    async def test_ulanish_onlayn_holatni_yozadi(self):
        from asgiref.sync import sync_to_async

        communicator = self.connect_to("/ws/chat", self.token)
        await communicator.connect()

        presence = await sync_to_async(Presence.objects.get)(user=self.user)
        self.assertEqual(presence.status, "online")
        self.assertEqual(presence.connections, 1)

        await communicator.disconnect()
        await sync_to_async(presence.refresh_from_db)()
        self.assertEqual(presence.status, "offline")
        self.assertEqual(presence.connections, 0)

    async def test_bildirishnoma_kanali_ham_ishlaydi(self):
        from asgiref.sync import sync_to_async

        from .realtime import isloh_broadcast_notification

        communicator = self.connect_to("/ws/notifications", self.token)
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await sync_to_async(isloh_broadcast_notification)(
            self.user.id, {"id": "1", "title": "Yangi xabar"}
        )
        event = await self.receive_event(communicator, "notification")
        self.assertEqual(event["notification"]["title"], "Yangi xabar")
        await communicator.disconnect()
