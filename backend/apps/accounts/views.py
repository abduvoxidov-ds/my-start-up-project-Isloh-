"""
ISLOH — auth ko'rinishlari.

Javob shakli har joyda bir xil:

    { "access_token": "...", "user": { id, email, full_name, role, roles } }

`js/auth-guard.js` aynan shu ikki kalitni o'qiydi:

    islohApi.setToken(res.access_token);
    const role = (res.user && res.user.role) || ...;
    window.location.href = ISLOH_ROLE_HOME[role];
"""

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Session, User, UserProfile
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .tokens import (
    clear_refresh_cookie,
    issue_tokens,
    revoke_session,
    session_is_active,
    set_refresh_cookie,
)


def auth_response(user, request, status_code=status.HTTP_200_OK):
    """Access token — tanada, refresh — httpOnly cookie'da."""
    access, refresh, _jti = issue_tokens(user, request)
    response = Response(
        {"access_token": access, "user": UserSerializer(user).data},
        status=status_code,
    )
    return set_refresh_cookie(response, refresh)


class RegisterView(APIView):
    # `authentication_classes = []` — ATAYLAB.
    #
    # Bu ochiq endpoint, lekin DRF avval AUTENTIFIKATSIYAni bajaradi va
    # faqat keyin ruxsatni tekshiradi. Brauzerda eskirgan yoki buzilgan
    # access token qolgan bo'lsa (`localStorage.isloh_access_token`),
    # js/api.js uni har so'rovga `Authorization: Bearer ...` deb qo'shadi
    # va JWT autentifikatsiyasi `AllowAny` ga yetib bormasdan 401 beradi.
    #
    # Natija o'lchangan: eskirgan tokenli foydalanuvchi na kira olardi, na
    # ro'yxatdan o'ta olardi — 401 ni ko'rgan js/api.js uni login sahifasiga
    # otardi, u yerda ham xuddi shu 401. Chiqib bo'lmaydigan halqa; yagona
    # yechim brauzer ma'lumotlarini qo'lda tozalash edi.
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Ro'yxatdan o'tgan zahoti kirgan holatda bo'ladi — frontend
        # darhol dashboard'ga yo'naltiradi
        return auth_response(user, request, status.HTTP_201_CREATED)


class LoginView(APIView):
    # `authentication_classes = []` — ATAYLAB.
    #
    # Bu ochiq endpoint, lekin DRF avval AUTENTIFIKATSIYAni bajaradi va
    # faqat keyin ruxsatni tekshiradi. Brauzerda eskirgan yoki buzilgan
    # access token qolgan bo'lsa (`localStorage.isloh_access_token`),
    # js/api.js uni har so'rovga `Authorization: Bearer ...` deb qo'shadi
    # va JWT autentifikatsiyasi `AllowAny` ga yetib bormasdan 401 beradi.
    #
    # Natija o'lchangan: eskirgan tokenli foydalanuvchi na kira olardi, na
    # ro'yxatdan o'ta olardi — 401 ni ko'rgan js/api.js uni login sahifasiga
    # otardi, u yerda ham xuddi shu 401. Chiqib bo'lmaydigan halqa; yagona
    # yechim brauzer ma'lumotlarini qo'lda tozalash edi.
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return auth_response(serializer.validated_data["user"], request)


class RefreshView(APIView):
    """Cookie'dagi refresh token bo'yicha yangi access beradi.

    Token TANADAN qabul qilinmaydi: u faqat httpOnly cookie'da yashaydi,
    ya'ni JS uni umuman ko'rmaydi.
    """

    # Sarlavhadagi access token bu yerda ahamiyatsiz — amal httpOnly
    # cookie bilan bajariladi. Eskirgan token 401 bermasin
    # (RegisterView dagi izohga qarang).
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not raw:
            return self._reject()

        try:
            refresh = RefreshToken(raw)
        except TokenError:
            return self._reject()

        jti = refresh.get("jti")
        # Bekor qilingan sessiya: token o'zi hali amal qiladi, lekin
        # foydalanuvchi uni "chiqarib yuborgan"
        if not session_is_active(jti):
            return self._reject()

        try:
            user = User.objects.get(pk=refresh["user_id"])
        except User.DoesNotExist:
            return self._reject()

        if user.status != User.STATUS_ACTIVE or not user.is_active:
            return self._reject()

        Session.objects.filter(jti=jti).update(last_active_at=timezone.now())

        # ROTATE_REFRESH_TOKENS=True — eskisi bekor qilinadi, yangisi beriladi
        revoke_session(jti)
        return auth_response(user, request)

    def _reject(self):
        response = Response(
            {"error": {
                "code": "unauthorized",
                "message": "Sessiya tugagan, qaytadan kiring",
                "fields": {},
            }},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        return clear_refresh_cookie(response)


class LogoutView(APIView):
    # Sarlavhadagi access token bu yerda ahamiyatsiz — amal httpOnly
    # cookie bilan bajariladi. Eskirgan token 401 bermasin
    # (RegisterView dagi izohga qarang).
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if raw:
            try:
                revoke_session(RefreshToken(raw).get("jti"))
            except TokenError:
                pass  # Yaroqsiz token — chiqish baribir muvaffaqiyatli

        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_refresh_cookie(response)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    data = UserSerializer(request.user).data
    data["profiles"] = ProfileSerializer(request.user.profiles.all(), many=True).data
    return Response(data)


class ProfileView(APIView):
    """`/users/me/profile?role=student` — rol bo'yicha profil."""

    permission_classes = [IsAuthenticated]

    def _get(self, request):
        role = request.query_params.get("role") or request.user.default_role
        profile, _ = UserProfile.objects.get_or_create(user=request.user, role=role)
        return profile

    def get(self, request):
        return Response(ProfileSerializer(self._get(request)).data)

    def patch(self, request):
        serializer = ProfileSerializer(self._get(request), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Parol o'zgargach barcha sessiyalar yopiladi va yangisi beriladi —
        # o'g'irlangan refresh token ishlashda davom etmasin
        Session.objects.filter(user=request.user, revoked_at__isnull=True).update(
            revoked_at=timezone.now()
        )
        return auth_response(request.user, request)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sessions_view(request):
    """Faol qurilmalar ro'yxati (pages/*/settings.html)."""
    rows = Session.objects.filter(user=request.user, revoked_at__isnull=True)
    return Response([
        {
            "id": str(s.id),
            "device": s.device,
            "ip": s.ip,
            "last_active_at": s.last_active_at,
        }
        for s in rows
    ])


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def revoke_session_view(request, session_id):
    Session.objects.filter(
        id=session_id, user=request.user, revoked_at__isnull=True
    ).update(revoked_at=timezone.now())
    return Response(status=status.HTTP_204_NO_CONTENT)
