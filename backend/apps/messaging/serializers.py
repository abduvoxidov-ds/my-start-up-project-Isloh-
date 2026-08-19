"""
ISLOH — xabar serializerlari (M8).

O'girish qoidasi M7 dagi bilan bir xil: server o'z toza shaklida
(snake_case, vaqt belgilari) qoladi, frontend esa o'z ichki shaklida
(`unread` xaritasi, millisekund) — va ikkalasi FAQAT
js/chat-store.js dagi `normalize` funksiyalarida uchrashadi.

--- SHAXSIY MAYDONLAR ------------------------------------------------------

`unread`, `archived`, `muted` — suhbat maydoni EMAS, a'zolik maydoni
(models.py). Frontend ularni thread ustida ko'radi, shuning uchun
serializer ularni JORIY foydalanuvchining a'zoligidan o'qiydi. "Joriy
foydalanuvchi" kontekstdan keladi: `context["me"]`.
"""

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import ChatMember, ChatMessage, ChatThread, Presence


def isloh_presence_of(user):
    """Foydalanuvchining KO'RINADIGAN holati.

    Yozuvdagi `status` ning o'ziga ishonib bo'lmaydi: brauzer yopilganda
    yoki server qayta ishga tushganda uzilish xabari kelmasligi mumkin va
    "online" abadiy qolib ketardi. Shuning uchun vaqt ham tekshiriladi.
    """
    presence = getattr(user, "presence", None)
    if presence is None or presence.status == "offline":
        return "offline"

    ttl = getattr(settings, "ISLOH_PRESENCE_TTL", 120)
    if presence.last_seen_at is None:
        return "offline"
    if (timezone.now() - presence.last_seen_at).total_seconds() > ttl:
        return "offline"
    return presence.status


class ChatUserSerializer(serializers.Serializer):
    """Chat katalogidagi odam.

    `avatar` — YUKLANGAN RASM havolasi yoki bo'sh satr. Frontend chatda
    hozir bosh harflarni chizadi va fonni o'z palitrasidan tanlaydi
    (rang — dizayn qarori, CLAUDE.md §2), shuning uchun bu maydon
    kelajakdagi rasmli avatar uchun turadi.
    """

    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(source="full_name", read_only=True)
    email = serializers.EmailField(read_only=True)
    avatar = serializers.CharField(read_only=True)
    role = serializers.CharField(source="default_role", read_only=True)
    presence = serializers.SerializerMethodField()

    def get_presence(self, user):
        return isloh_presence_of(user)


class ChatMessageSerializer(serializers.ModelSerializer):
    """Bitta xabar. `text` dan boshqa hamma narsani server yozadi."""

    # Ikkalasi ham SATR: `PrimaryKeyRelatedField` UUID obyektini qoldiradi
    # va u WebSocket yo'lida `json.dumps` ni yiqitardi (realtime.py).
    thread = serializers.UUIDField(source="thread_id", read_only=True)
    sender = serializers.UUIDField(source="sender_id", read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "thread", "sender", "text", "created_at"]
        read_only_fields = ["id", "thread", "sender", "created_at"]


class ChatThreadSerializer(serializers.ModelSerializer):
    """Suhbat — frontend ro'yxatidagi bitta qator.

    `members` — id'lar ro'yxati (js/chat-store.js shu shaklni kutadi).
    Ismlar bu yerda TAKRORLANMAYDI: ular `/chat/users` katalogida bir
    marta keladi, aks holda 20 ta suhbatda bir xil odam 20 marta
    yozilardi.
    """

    members = serializers.SerializerMethodField()
    last_sender = serializers.UUIDField(source="last_sender_id", read_only=True)
    unread = serializers.SerializerMethodField()
    archived = serializers.SerializerMethodField()
    muted = serializers.SerializerMethodField()

    class Meta:
        model = ChatThread
        fields = [
            "id",
            "type",
            "title",
            "course",
            "members",
            "pinned_note",
            "last_message",
            "last_sender",
            "last_message_at",
            "unread",
            "archived",
            "muted",
            "created_at",
        ]
        read_only_fields = fields

    def get_members(self, thread):
        return [str(m.user_id) for m in thread.members.all()]

    def _mine(self, thread):
        """Joriy foydalanuvchining a'zoligi — prefetch qilingan ro'yxatdan.

        `.filter(...)` yozilsa har bir suhbat uchun yangi so'rov ketardi va
        prefetch behuda bo'lardi (N+1).
        """
        me = self.context.get("me")
        if me is None:
            return None
        for member in thread.members.all():
            if member.user_id == me.id:
                return member
        return None

    def get_unread(self, thread):
        member = self._mine(thread)
        return member.unread_count if member else 0

    def get_archived(self, thread):
        member = self._mine(thread)
        return bool(member and member.archived)

    def get_muted(self, thread):
        member = self._mine(thread)
        return bool(member and member.muted)


class ChatMemberSettingsSerializer(serializers.ModelSerializer):
    """`PATCH /chat/threads/{id}` — a'zoning shaxsiy sozlamalari.

    `pinned_note` bu yerda YO'Q: u suhbatga tegishli va uni faqat guruh
    egasi o'zgartira oladi (views.py).
    """

    class Meta:
        model = ChatMember
        fields = ["archived", "muted"]

    def update(self, instance, validated_data):
        """FAQAT yuborilgan maydonlar yoziladi.

        BU XATO BRAUZERDA TOPILDI. Standart `ModelSerializer.update`
        `instance.save()` chaqiradi va u BUTUN qatorni qayta yozadi. Ikki
        `PATCH` deyarli bir vaqtda kelganda (interfeys "arxivdan qaytar"
        va "ovozni yoq" ni ketma-ket yuboradi) ikkinchisi birinchisidan
        OLDIN o'qigan nusxani saqlab, uning natijasini bekor qilardi:
        suhbat arxivda qolib ketardi.

        `update_fields` bilan har bir so'rov faqat o'zi o'zgartirgan
        ustunga tegadi va ular bir-birini bosmaydi. Mijoz tomonida ham
        yozuv navbati bor (js/chat-store.js), lekin himoya SERVERDA
        bo'lishi kerak: har qanday mijoz shunday yuborishi mumkin.
        """
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(update_fields=list(validated_data.keys()) + ["updated_at"])
        return instance


class PresenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Presence
        fields = ["user", "status", "last_seen_at"]
        read_only_fields = fields
