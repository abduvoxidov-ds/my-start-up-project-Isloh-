"""
ISLOH — bildirishnoma ko'rinishlari (M7).

Bitta qoida butun modulni belgilaydi: **foydalanuvchi FAQAT o'zining
bildirishnomalarini ko'radi va o'zgartiradi.** Boshqasining yozuviga
tegishga urinish 404 beradi — 403 javobning o'zi bunday bildirishnoma
borligini oshkor qilardi (M2 dagi "begona kurs 404" qarori).

Ro'yxat ROL bo'yicha filtrlanadi (`?role=`), chunki bitta odam ham talaba,
ham o'qituvchi bo'lishi mumkin va ikkala oqim aralashmasligi kerak
(models.py dagi izoh). Rol berilmasa — hammasi qaytadi.

Bu do'kon endpoint'i, ya'ni SAHIFALANMAYDI (§0.1). Bildirishnomalar
vaqt o'tishi bilan ko'payadi, shuning uchun ro'yxat `ISLOH_NOTIF_LIMIT`
bilan cheklangan: sahifa baribir faqat so'nggilarini ko'rsatadi, eskisi
esa M13 dagi fon vazifasi bilan tozalanadi.
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer

# Sahifa so'nggilarini ko'rsatadi; qo'ng'iroq menyusi esa bundan ham kam
ISLOH_NOTIF_LIMIT = 100


def isloh_notification_queryset(request):
    """Joriy foydalanuvchining bildirishnomalari, ixtiyoriy rol filtri bilan."""
    rows = Notification.objects.filter(user=request.user).select_related("actor")

    role = request.query_params.get("role")
    if role:
        rows = rows.filter(role=role)
    return rows


class NotificationListView(APIView):
    """`GET /notifications?role=` — do'kon endpoint'i (massiv)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = isloh_notification_queryset(request)[:ISLOH_NOTIF_LIMIT]
        return Response(NotificationSerializer(rows, many=True).data)


class NotificationUnreadCountView(APIView):
    """`GET /notifications/unread-count?role=` — topbar nuqtasi uchun.

    Alohida endpoint, chunki nuqta HAR BIR sahifada ko'rinadi va butun
    ro'yxatni yuklash faqat bitta son uchun isrof bo'lardi.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = isloh_notification_queryset(request).filter(read_at__isnull=True).count()
        return Response({"unread": count})


class NotificationReadView(APIView):
    """`POST /notifications/{id}/read` va `DELETE /notifications/{id}`."""

    permission_classes = [IsAuthenticated]

    def _own(self, request, notification_id):
        row = Notification.objects.filter(pk=notification_id, user=request.user).first()
        if row is None:
            raise NotFound("Bildirishnoma topilmadi")
        return row

    def post(self, request, notification_id):
        row = self._own(request, notification_id)
        # Ikkinchi marta bosilganda vaqt YANGILANMAYDI: "qachon o'qidi"
        # birinchi o'qish vaqti bo'lishi kerak
        if row.read_at is None:
            row.read_at = timezone.now()
            row.save(update_fields=["read_at", "updated_at"])
        return Response(NotificationSerializer(row).data)

    def delete(self, request, notification_id):
        self._own(request, notification_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationReadAllView(APIView):
    """`POST /notifications/read-all?role=`.

    FAQAT so'ralgan rolning yozuvlari belgilanadi: o'qituvchi "barchasini
    o'qildi" desa, o'sha odamning TALABA oqimidagi xabarlari tegilmasin
    (js/notification-store.js da ham xuddi shu qoida bor edi).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = isloh_notification_queryset(request).filter(read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response({"updated": updated})
