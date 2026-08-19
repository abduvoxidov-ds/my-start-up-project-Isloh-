"""
ISLOH — WebSocket autentifikatsiyasi (M8).

MUAMMO: brauzerdagi `new WebSocket(...)` `Authorization` SARLAVHASINI
qo'yishga imkon bermaydi — REST'dagi `Bearer` usuli bu yerda ishlamaydi.
Refresh cookie ham yaramaydi: u `path=/api/` bilan yozilgan (M1), ya'ni
`/ws/` ga umuman yuborilmaydi.

YECHIM — IKKI YO'L, va birinchisi ataylab afzal:

  1. **Sub-protokol** (frontend shuni ishlatadi):

         new WebSocket(url, ['isloh-jwt', accessToken])

     Brauzer buni `Sec-WebSocket-Protocol` SARLAVHASIDA yuboradi, ya'ni
     token manzil qatorida ko'rinmaydi va server jurnaliga, brauzer
     tarixiga, proksi loglariga tushmaydi.

  2. **`?token=`** — qo'lda sinash uchun (wscat, curl). Manzilda token
     qolgani sababli ishlab chiqarishda tavsiya etilmaydi, lekin uni
     butunlay yopish nosozlikni topishni qiyinlashtirardi.

Token TEKSHIRILADI (imzo va muddat) — `simplejwt` ning o'z sinfi bilan,
qo'lda emas.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

# Mijoz shu nomni birinchi sub-protokol sifatida yuboradi
ISLOH_WS_SUBPROTOCOL = "isloh-jwt"


@database_sync_to_async
def isloh_user_from_token(raw_token):
    """Tokenni tekshiradi va foydalanuvchini qaytaradi (yoki anonim)."""
    if not raw_token:
        return AnonymousUser()
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication

        auth = JWTAuthentication()
        validated = auth.get_validated_token(raw_token)
        return auth.get_user(validated)
    except Exception:  # noqa: BLE001 - noto'g'ri/muddati o'tgan token
        return AnonymousUser()


def isloh_token_from_scope(scope):
    """Sub-protokoldan, bo'lmasa `?token=` dan oladi."""
    protocols = scope.get("subprotocols") or []
    if len(protocols) >= 2 and protocols[0] == ISLOH_WS_SUBPROTOCOL:
        return protocols[1]

    query = parse_qs((scope.get("query_string") or b"").decode("utf-8", "ignore"))
    values = query.get("token") or []
    return values[0] if values else ""


class IslohJwtAuthMiddleware(BaseMiddleware):
    """`scope["user"]` ni JWT asosida to'ldiradi."""

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["user"] = await isloh_user_from_token(isloh_token_from_scope(scope))
        return await super().__call__(scope, receive, send)
