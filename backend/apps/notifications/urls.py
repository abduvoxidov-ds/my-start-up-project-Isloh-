"""ISLOH — bildirishnoma marshrutlari (M7).

`read-all` va `unread-count` UUID yo'lidan OLDIN turadi: aks holda Django
ularni `<uuid:notification_id>` deb o'qishga urinardi. (Hozirgi tartibda
ham xato bo'lmasdi — `uuid` konvertori mos kelmaydi — lekin tartib
ataylab, keyin qo'shiladigan `<str:>` yo'llarida tuzoq bo'lmasin.)
"""

from django.urls import path

from . import views

urlpatterns = [
    path("notifications", views.NotificationListView.as_view(), name="notifications"),
    path(
        "notifications/unread-count",
        views.NotificationUnreadCountView.as_view(),
        name="notifications-unread",
    ),
    path(
        "notifications/read-all",
        views.NotificationReadAllView.as_view(),
        name="notifications-read-all",
    ),
    path(
        "notifications/<uuid:notification_id>",
        views.NotificationReadView.as_view(),
        name="notification-detail",
    ),
    path(
        "notifications/<uuid:notification_id>/read",
        views.NotificationReadView.as_view(),
        name="notification-read",
    ),
]
