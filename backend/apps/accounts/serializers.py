"""
ISLOH — auth serializerlari.

Maydon NOMLARI frontend yuboradigan nomlar bilan bir xil bo'lishi shart:
js/auth-guard.js dagi `isloh_authPayload` shu kalitlarni yig'adi va
`data-auth-field` atributlari orqali xatoni qaytadan o'sha maydonga
ko'rsatadi. Nom mos kelmasa serverning validatsiya xatosi maydon ostiga
tushmaydi.

    register: { full_name, email, password, role, organization? }
    login:    { email, password, remember }
    javob:    { access_token, user: {...} }
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import PUBLIC_ROLES, ROLE_CHOICES, ROLE_INSTRUCTOR, User, UserProfile, UserRole


class UserSerializer(serializers.ModelSerializer):
    """`/auth/me` va login/register javobidagi `user` bloki."""

    # js/auth-guard.js: `res.user.role` -> ISLOH_ROLE_HOME[role]
    role = serializers.CharField(source="default_role", read_only=True)
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "avatar", "status", "role", "roles"]
        read_only_fields = fields

    def get_roles(self, obj):
        return obj.role_names


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "id", "role", "headline", "bio", "location",
            "languages", "organization", "joined_at",
        ]
        read_only_fields = ["id", "role", "joined_at"]


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    # Admin ro'yxatdan o'ta olmaydi — uni faqat mavjud admin tayinlaydi
    role = serializers.ChoiceField(choices=ROLE_CHOICES, default="student")
    organization = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Bu email allaqachon ro'yxatdan o'tgan")
        return value

    def validate_role(self, value):
        if value not in PUBLIC_ROLES:
            raise serializers.ValidationError("Bu rolni tanlab bo'lmaydi")
        return value

    def validate_password(self, value):
        """Django parol qoidalari (uzunlik, keng tarqalganlik, raqamlilik).

        Xabarlar ro'yxat bo'lib keladi, apps/core/exceptions.py ularni
        bitta satrga yig'adi va `fields.password` ga qo'yadi.
        """
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    @transaction.atomic
    def create(self, validated):
        organization = validated.pop("organization", "")
        role = validated.pop("role")

        user = User.objects.create_user(
            email=validated["email"],
            password=validated["password"],
            full_name=validated["full_name"],
        )
        UserRole.objects.create(user=user, role=role)
        UserProfile.objects.create(
            user=user,
            role=role,
            organization=organization if role == ROLE_INSTRUCTOR else "",
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    remember = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"].lower().strip(),
            password=attrs["password"],
        )

        # Xato KONKRET maydonga bog'lanmaydi: "bunday email yo'q" deb aytish
        # mavjud hisoblarni sanab chiqishga imkon berardi. Ikkala holatda
        # ham bitta umumiy xabar (`form` bloki).
        if user is None:
            raise serializers.ValidationError("Email yoki parol noto'g'ri")

        if user.status == User.STATUS_SUSPENDED:
            raise serializers.ValidationError("Hisob vaqtincha to'xtatilgan")
        if user.status == User.STATUS_DELETED or not user.is_active:
            raise serializers.ValidationError("Hisob faol emas")

        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """pages/*/settings.html dagi forma: current / new / confirm.

    Maydon nomlari markupdagi `data-error-for` qiymatlari bilan bir xil
    (js/settings-security.js).
    """

    current = serializers.CharField(write_only=True)
    new = serializers.CharField(write_only=True)
    confirm = serializers.CharField(write_only=True)

    def validate_current(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Joriy parol noto'g'ri")
        return value

    def validate_new(self, value):
        try:
            validate_password(value, self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate(self, attrs):
        if attrs["new"] != attrs["confirm"]:
            # Xato aynan `confirm` maydoniga tushsin
            raise serializers.ValidationError({"confirm": "Parollar mos kelmadi"})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new"])
        user.save(update_fields=["password", "updated_at"])
        return user
