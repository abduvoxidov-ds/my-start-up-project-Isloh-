"""ISLOH — chat marshrutlari (M8).

`direct`, `course/...`, `users` va `unread-count` UUID yo'llaridan OLDIN
turadi (M7 dagi bir xil tartib): hozir `uuid` konvertori ularni baribir
rad etardi, lekin keyin `<str:>` yo'l qo'shilsa tuzoq bo'lib qolardi.
"""

from django.urls import path

from . import views

urlpatterns = [
    path("chat/threads", views.ChatThreadListView.as_view(), name="chat-threads"),
    path("chat/threads/direct", views.DirectThreadView.as_view(), name="chat-thread-direct"),
    path(
        "chat/threads/course/<uuid:course_id>",
        views.CourseGroupThreadView.as_view(),
        name="chat-thread-course",
    ),
    path("chat/users", views.ChatUserListView.as_view(), name="chat-users"),
    path("chat/unread-count", views.ChatUnreadCountView.as_view(), name="chat-unread"),
    path(
        "chat/threads/<uuid:thread_id>",
        views.ChatThreadDetailView.as_view(),
        name="chat-thread-detail",
    ),
    path(
        "chat/threads/<uuid:thread_id>/read",
        views.ChatThreadReadView.as_view(),
        name="chat-thread-read",
    ),
    path(
        "chat/threads/<uuid:thread_id>/messages",
        views.ChatMessageListView.as_view(),
        name="chat-messages",
    ),
]
