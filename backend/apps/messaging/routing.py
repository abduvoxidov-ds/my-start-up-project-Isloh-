"""ISLOH — WebSocket marshrutlari (M8).

Yo'llar `/api/v1/` OSTIDA EMAS: WebSocket REST resursi emas va uni
alohida prefiksda ushlab turgan nginx sozlamasi ham soddaroq bo'ladi
(`location /ws/ { proxy_pass ...; }`).
"""

from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path("ws/chat", consumers.ChatConsumer.as_asgi(), name="ws-chat"),
    path("ws/notifications", consumers.NotificationConsumer.as_asgi(), name="ws-notifications"),
]
