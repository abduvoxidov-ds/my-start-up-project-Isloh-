import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
# WebSocket (chat, bildirishnomalar) 5-sprintda shu yerga ulanadi —
# docs/BACKEND-PLAN.md
application = get_asgi_application()
