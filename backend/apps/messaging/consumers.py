"""
ISLOH — WebSocket iste'molchilari (M8).

    WS /ws/chat           — yangi xabar va onlayn holat
    WS /ws/notifications  — M7 bildirishnomalari

--- NIMA UCHUN BU KANAL FAQAT O'QIYDI --------------------------------------

Xabar YOZISH REST orqali qoladi (`POST /chat/threads/{id}/messages`).
WebSocket orqali ham yozish mumkin edi, lekin unda IKKI yozish yo'li
paydo bo'lardi va ular vaqt o'tishi bilan farq qila boshlardi (biri
tozalashni bajaradi, ikkinchisi unutadi). Bundan tashqari mijoz javobni
kutishi kerak: do'kon optimistik yozuvni SERVER bergan id bilan
almashtiradi (js/api.js dagi fabrika naqshi), WebSocket'da esa so'rov va
javobni bog'lash uchun qo'shimcha "correlation id" mexanizmi kerak
bo'lardi.

Ya'ni bo'linish sodda:
    yozish  -> REST (ishonchli, xatoni ko'rsatadi)
    o'qish  -> WebSocket (tez), ulanmasa sahifa yangilanganda keladi

--- ULANISH SONI -----------------------------------------------------------

Bir odam bir nechta tabda ochishi mumkin. Oflayn bo'lish faqat OXIRGI tab
yopilganda sodir bo'ladi, shuning uchun `Presence.connections` sanaladi.
"""

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.db.models import F
from django.utils import timezone

from .auth import ISLOH_WS_SUBPROTOCOL
from .models import PRESENCE_OFFLINE, PRESENCE_ONLINE, Presence
from .realtime import (
    ISLOH_PRESENCE_GROUP,
    isloh_broadcast_presence,
    isloh_chat_group,
    isloh_notif_group,
)

logger = logging.getLogger(__name__)

# Kirish talab qilinadi. 4401 — WebSocket'ning shaxsiy kodi (4000-4999
# ilova uchun ajratilgan): mijoz uni HTTP 401 bilan bir xil deb o'qiydi.
ISLOH_WS_UNAUTHORIZED = 4401


class IslohAuthedConsumer(AsyncJsonWebsocketConsumer):
    """Ikkala kanal uchun umumiy: kirishni tekshirish va sub-protokol."""

    group_name = ""

    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=ISLOH_WS_UNAUTHORIZED)
            return

        self.user = user
        self.group_name = self.group_for(user)
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Mijoz sub-protokol yuborgan bo'lsa, server uni TASDIQLASHI shart —
        # aks holda brauzer ulanishni o'zi uzadi
        chosen = ISLOH_WS_SUBPROTOCOL if ISLOH_WS_SUBPROTOCOL in (
            self.scope.get("subprotocols") or []
        ) else None
        await self.accept(subprotocol=chosen)

    async def disconnect(self, code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """Faqat `ping`. Kanal o'qish uchun (yuqoridagi izoh).

        `ping` bekor emas va IKKI ish qiladi: ba'zi proksilar jim turgan
        ulanishni 60 soniyadan keyin uzadi, va har ping onlayn holatning
        vaqt belgisini yangilaydi (`ISLOH_PRESENCE_TTL` tugab qolmasin).
        """
        if isinstance(content, dict) and content.get("action") == "ping":
            await self.on_ping()
            await self.send_json({"event": "pong"})

    async def on_ping(self):
        """Sukut bo'yicha hech narsa — faqat chat kanali holat yozadi."""
        return None

    def group_for(self, user):
        raise NotImplementedError


class ChatConsumer(IslohAuthedConsumer):
    """`/ws/chat` — yangi xabarlar va onlayn holat."""

    def group_for(self, user):
        return isloh_chat_group(user.id)

    async def connect(self):
        await super().connect()
        if not self.scope.get("user") or not self.scope["user"].is_authenticated:
            return

        await self.channel_layer.group_add(ISLOH_PRESENCE_GROUP, self.channel_name)
        await self._mark_online()
        # HAR ULANISHDA e'lon qilinadi, "faqat birinchisida" emas: takroriy
        # xabar mijozda hech narsani buzmaydi (u shunchaki holatni
        # "onlayn" deb yozadi), o'tkazib yuborilgan xabar esa suhbatdoshni
        # oflayn ko'rsatib qo'yardi.
        await isloh_broadcast_presence(self.user.id, PRESENCE_ONLINE)

    async def disconnect(self, code):
        await super().disconnect(code)
        if getattr(self, "user", None) is None:
            return
        await self.channel_layer.group_discard(ISLOH_PRESENCE_GROUP, self.channel_name)
        if await self._mark_offline():
            await isloh_broadcast_presence(self.user.id, PRESENCE_OFFLINE)

    # --- Guruhdan keladigan hodisalar ---------------------------------------

    async def chat_message(self, event):
        await self.send_json(
            {
                "event": "message",
                "thread_id": event["thread_id"],
                "message": event["message"],
                "unread": event.get("unread", 0),
            }
        )

    async def chat_thread(self, event):
        await self.send_json(
            {"event": "thread", "thread_id": event["thread_id"], "patch": event.get("patch", {})}
        )

    async def chat_presence(self, event):
        await self.send_json(
            {"event": "presence", "user_id": event["user_id"], "presence": event["presence"]}
        )

    # --- Onlayn holat --------------------------------------------------------

    @database_sync_to_async
    def _mark_online(self):
        """Ulanishni sanaydi.

        ESKIRGAN HISOBLAGICH TIKLANADI. Server qayta ishga tushganda
        (yoki jarayon o'ldirilganda) `disconnect` umuman chaqirilmaydi va
        `connections` bazada 1 bo'lib qolib ketadi. Keyingi safar u 2
        bo'lardi, ya'ni yagona haqiqiy tab yopilganda ham son nolga
        tushmasdi — odam abadiy "onlayn" bo'lib qolardi. Shuning uchun
        oxirgi belgi `ISLOH_PRESENCE_TTL` dan eski bo'lsa, hisoblagich
        eski hisoblanadi va 1 dan boshlanadi.
        """
        now = timezone.now()
        presence, created = Presence.objects.get_or_create(
            user=self.user,
            defaults={"status": PRESENCE_ONLINE, "last_seen_at": now, "connections": 1},
        )
        if created:
            return

        ttl = getattr(settings, "ISLOH_PRESENCE_TTL", 120)
        stale = presence.last_seen_at is None or (now - presence.last_seen_at).total_seconds() > ttl
        Presence.objects.filter(pk=presence.pk).update(
            status=PRESENCE_ONLINE,
            last_seen_at=now,
            connections=1 if stale else F("connections") + 1,
        )

    @database_sync_to_async
    def _touch(self):
        """`ping` — "hali shu yerdaman" belgisi."""
        Presence.objects.filter(user=self.user).update(last_seen_at=timezone.now())

    async def on_ping(self):
        await self._touch()

    @database_sync_to_async
    def _mark_offline(self):
        """Oxirgi tab yopilganda oflayn qiladi."""
        presence = Presence.objects.filter(user=self.user).first()
        if presence is None:
            return False

        remaining = max(presence.connections - 1, 0)
        status = PRESENCE_OFFLINE if remaining == 0 else presence.status
        Presence.objects.filter(pk=presence.pk).update(
            connections=remaining, status=status, last_seen_at=timezone.now()
        )
        return remaining == 0


class NotificationConsumer(IslohAuthedConsumer):
    """`/ws/notifications` — M7 bildirishnomalari jonli."""

    def group_for(self, user):
        return isloh_notif_group(user.id)

    async def notif_new(self, event):
        await self.send_json({"event": "notification", "notification": event["notification"]})
