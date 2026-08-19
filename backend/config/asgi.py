"""
ISLOH — ASGI kirish nuqtasi.

M8 gacha bu yerda faqat HTTP bor edi. Endi ikki protokol:

    http       -> odatdagi Django (REST + frontend fayllari)
    websocket  -> apps/messaging/routing.py

DIQQAT — TARTIB MUHIM: `get_asgi_application()` `django.setup()` ni
bajaradi, ya'ni ilovalar reyestri to'ldiriladi. Marshrutlar (va ular
orqali modellar) undan OLDIN import qilinsa `AppRegistryNotReady`
xatosi chiqadi. Shuning uchun import qatorlari ataylab funksiya
chaqiruvidan keyin turadi.

`AllowedHostsOriginValidator` — WebSocket uchun `ALLOWED_HOSTS` ning
ekvivalenti: begona saytdagi sahifa foydalanuvchi tokeni bilan
ulanmasin (WebSocket'da Same-Origin siyosati o'z-o'zidan ishlamaydi).
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from apps.messaging.auth import IslohJwtAuthMiddleware  # noqa: E402
from apps.messaging.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            IslohJwtAuthMiddleware(URLRouter(websocket_urlpatterns))
        ),
    }
)
