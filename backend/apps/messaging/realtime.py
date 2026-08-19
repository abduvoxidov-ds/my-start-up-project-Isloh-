"""
ISLOH — real vaqt tarqatish (M8).

Kanal qatlamiga yozadigan YAGONA joy. Ko'rinishlar (views.py) va voqealar
(apps/notifications/events.py) shu yerdagi funksiyalarni chaqiradi va
`channels` haqida hech narsa bilmaydi.

--- NEGA HAR BIR CHAQIRUV XATONI YUTADI -----------------------------------

Bu M7 dagi 2-qoidaning aynan o'zi: **yetkazish so'rovni yiqitmaydi.**
Redis o'chgan bo'lsa yoki kanal qatlami umuman sozlanmagan bo'lsa, xabar
baribir BAZAGA yozilgan bo'ladi va suhbatdosh uni sahifani yangilaganda
ko'radi. WebSocket — tezlik, ishonchlilik emas.

--- NEGA `transaction.on_commit` -------------------------------------------

`ATOMIC_REQUESTS = True`, ya'ni butun so'rov bitta tranzaksiyada. Agar
tarqatish darhol bajarilsa va tranzaksiya keyin ortga qaytsa, suhbatdosh
BAZADA YO'Q xabarni ekranida ko'rib turardi. Shuning uchun yuborish
faqat commit'dan keyin — chaqiruv joyi buni o'ylamasin deb, o'rash shu
yerda.
"""

import json
import logging

from asgiref.sync import async_to_sync
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction

logger = logging.getLogger(__name__)

# Kanal guruhlari nomi (faqat ASCII, nuqta va chiziqcha ruxsat etiladi)
ISLOH_CHAT_GROUP = "chat.user.{}"
ISLOH_NOTIF_GROUP = "notif.user.{}"
ISLOH_PRESENCE_GROUP = "chat.presence"


def isloh_chat_group(user_id):
    from uuid import UUID

    value = user_id.hex if isinstance(user_id, UUID) else str(user_id).replace("-", "")
    return ISLOH_CHAT_GROUP.format(value)


def isloh_notif_group(user_id):
    from uuid import UUID

    value = user_id.hex if isinstance(user_id, UUID) else str(user_id).replace("-", "")
    return ISLOH_NOTIF_GROUP.format(value)


def isloh_json_safe(value):
    """Kanal qatlamiga TOZA JSON turlarini beradi.

    NEGA KERAK (brauzer sinovida topildi): DRF serializeri `.data` ichida
    Python obyektlarini qoldiradi — `PrimaryKeyRelatedField` UUID
    qaytaradi, sana esa `datetime` bo'ladi. REST yo'lida bu muammo emas:
    `JSONRenderer` ularni o'zi o'giradi. WebSocket yo'lida esa
    `json.dumps` chaqiriladi va u "Object of type UUID is not JSON
    serializable" bilan yiqilardi — xabar bazaga yozilgan, lekin
    suhbatdoshga YETMASDI va ekranda hech qanday xato yo'q edi.

    Shuning uchun o'girish MARKAZIY joyda: har bir yangi tarqatish
    funksiyasi buni qaytadan o'ylamasin.
    """
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def _layer():
    """Kanal qatlami — sozlanmagan bo'lsa `None`.

    `file://` va oddiy WSGI ishga tushirishda WebSocket umuman yo'q; bu
    kutilgan holat, xato emas.
    """
    try:
        from channels.layers import get_channel_layer

        return get_channel_layer()
    except Exception:  # noqa: BLE001 - channels o'rnatilmagan bo'lishi mumkin
        return None


def _send(group, payload):
    """Bitta guruhga yuboradi. Xato jurnalda qoladi, yuqoriga chiqmaydi."""
    layer = _layer()
    if layer is None:
        return False
    try:
        async_to_sync(layer.group_send)(group, payload)
        return True
    except Exception:  # noqa: BLE001 - yuqoridagi izoh
        logger.exception("Kanal qatlamiga yozib bo'lmadi: %s", group)
        return False


async def _asend(group, payload):
    """`_send` ning async varianti — WebSocket iste'molchisi uchun.

    NEGA ALOHIDA: `async_to_sync` ISHLAYOTGAN hodisa siklining ichida
    chaqirilsa `You cannot use AsyncToSync in the same thread as an async
    event loop` xatosini beradi. Iste'molchi (consumers.py) aynan shunday
    muhitda ishlaydi, ko'rinishlar esa — sinxron. Ikki muhit, ikki yo'l.
    """
    layer = _layer()
    if layer is None:
        return False
    try:
        await layer.group_send(group, payload)
        return True
    except Exception:  # noqa: BLE001 - yuqoridagi izoh
        logger.exception("Kanal qatlamiga yozib bo'lmadi: %s", group)
        return False


def _send_later(group, payload):
    """Tranzaksiya muvaffaqiyatli yakunlangandan KEYIN yuboradi."""
    transaction.on_commit(lambda: _send(group, payload))


# --- Chat --------------------------------------------------------------------


def isloh_broadcast_message(thread, message_data, unread_by_user):
    """Yangi xabarni suhbatning HAR BIR a'zosiga yetkazadi.

    `unread_by_user` — {user_id: son}: har kim O'ZINING hisoblagichini
    oladi. Bitta umumiy son yuborilsa, yozgan odamning tabida ham
    "o'qilmagan" paydo bo'lardi.

    Yuboruvchining o'ziga ham boradi — uning BOSHQA tablari yangilanishi
    kerak (mijoz o'z xabarini `message.sender` bo'yicha taniydi).
    """
    payload = isloh_json_safe(message_data)
    for user_id, unread in unread_by_user.items():
        _send_later(
            isloh_chat_group(user_id),
            {
                "type": "chat.message",
                "thread_id": str(thread.id),
                "message": payload,
                "unread": unread,
            },
        )


def isloh_broadcast_thread(user_ids, thread_id, patch):
    """Suhbatning o'zi o'zgargani (e'lon, arxiv) haqida xabar beradi."""
    for user_id in user_ids:
        _send_later(
            isloh_chat_group(user_id),
            {"type": "chat.thread", "thread_id": str(thread_id), "patch": isloh_json_safe(patch)},
        )


def isloh_presence_payload(user_id, presence):
    return {"type": "chat.presence", "user_id": str(user_id), "presence": presence}


async def isloh_broadcast_presence(user_id, presence):
    """Onlayn holat — barcha ulangan mijozlarga.

    Guruh bitta: holat maxfiy ma'lumot emas va uni har bir kontaktga
    alohida yuborish har ulanishda o'nlab yuborish demak bo'lardi.
    Tarqatish DARHOL ketadi (`on_commit` emas): bu chaqiruv WebSocket
    ulanishidan keladi va u yerda so'rov tranzaksiyasi yo'q.
    """
    return await _asend(ISLOH_PRESENCE_GROUP, isloh_presence_payload(user_id, presence))


# --- Bildirishnomalar --------------------------------------------------------


def isloh_broadcast_notification(user_id, notification_data):
    """M7 bildirishnomasini `/ws/notifications` orqali yetkazadi."""
    _send_later(
        isloh_notif_group(user_id),
        {"type": "notif.new", "notification": isloh_json_safe(notification_data)},
    )
