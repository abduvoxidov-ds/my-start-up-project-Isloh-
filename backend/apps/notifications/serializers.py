"""ISLOH — bildirishnoma serializeri (M7).

Frontenddagi shakl js/notification-store.js da: `read` — MANTIQIY qiymat,
`createdAt` — ISO satr. Serverda esa `read_at` vaqt belgisi (sabab
models.py da), shuning uchun o'girish shu yerda bo'ladi.
"""

from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """HAMMASI `read_only`.

    Bildirishnomani mijoz YARATMAYDI — uni voqealar yasaydi
    (apps/notifications/events.py). Mijoz qila oladigan yagona narsa —
    o'qilgan deb belgilash va o'chirish, ular esa alohida endpoint'lar.
    Aks holda istalgan odam o'ziga (yoki API orqali boshqasiga) yolg'on
    xabar yozib qo'yardi.
    """

    read = serializers.BooleanField(read_only=True)
    actor_name = serializers.CharField(source="actor.full_name", read_only=True, default="")
    # SATR, `PrimaryKeyRelatedField` emas: u UUID OBYEKTINI qoldiradi va
    # REST yo'lida `JSONRenderer` uni o'girib yuborardi, WebSocket yo'lida
    # esa `json.dumps` yiqilardi (M8 — apps/messaging/realtime.py).
    course = serializers.UUIDField(source="course_id", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "role",
            "type",
            "title",
            "body",
            "href",
            "read",
            "actor_name",
            "course",
            "created_at",
        ]
        read_only_fields = fields
