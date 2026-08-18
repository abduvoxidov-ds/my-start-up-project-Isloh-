"""
ISLOH — foydalanuvchi, rol va profil modellari.

NEGA MAXSUS `User`: frontend hech qayerda `username` so'ramaydi — kirish
ham, ro'yxatdan o'tish ham email bilan (pages/auth/login.html). Django'ning
standart modelida `username` majburiy va noyob, ya'ni uni sun'iy to'ldirish
kerak bo'lardi.

NEGA ROL ALOHIDA JADVALDA: frontendda profil do'koni rol bo'yicha
bo'lingan —

    isloh_profiles = { student: {...}, instructor: {...}, admin: {...} }

va sahifa o'z rolini `.sidebar[data-role]` orqali e'lon qiladi. Ya'ni bitta
odam bir vaqtning o'zida ham talaba, ham o'qituvchi bo'lishi mumkin va har
bir rolda BOSHQA profil (bio, headline) ko'rsatadi. `User.role` degan yagona
maydon bu holatni ifodalay olmasdi.

docs/BACKEND-PLAN.md §2 (1-sprint)
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel

# Frontenddagi rol nomlari bilan AYNAN bir xil: js/auth-guard.js dagi
# ISLOH_ROLE_HOME va js/profile.js dagi ISLOH_PROFILE_DEFAULTS shu
# satrlarni kutadi.
ROLE_STUDENT = "student"
ROLE_INSTRUCTOR = "instructor"
ROLE_ADMIN = "admin"

ROLE_CHOICES = [
    (ROLE_STUDENT, "Talaba"),
    (ROLE_INSTRUCTOR, "O'qituvchi"),
    (ROLE_ADMIN, "Administrator"),
]

# Ro'yxatdan o'tishda tanlash mumkin bo'lgan rollar — admin bu ro'yxatda
# ATAYLAB yo'q: uni faqat mavjud admin tayinlaydi.
PUBLIC_ROLES = {ROLE_STUDENT, ROLE_INSTRUCTOR}


class UserManager(BaseUserManager):
    """Email bilan ishlaydigan menejer."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email manzil ko'rsatilishi shart")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("status", User.STATUS_ACTIVE)
        if not extra["is_staff"] or not extra["is_superuser"]:
            raise ValueError("Superuser is_staff va is_superuser bo'lishi shart")

        user = self._create_user(email, password, **extra)
        # Django admin paneliga kirish uchun rol ham kerak
        UserRole.objects.get_or_create(user=user, role=ROLE_ADMIN)
        return user


class User(BaseModel, AbstractBaseUser, PermissionsMixin):
    """Hisob. Rollar va profillar alohida jadvallarda."""

    STATUS_ACTIVE = "active"
    STATUS_SUSPENDED = "suspended"
    STATUS_DELETED = "deleted"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Faol"),
        (STATUS_SUSPENDED, "To'xtatilgan"),
        (STATUS_DELETED, "O'chirilgan"),
    ]

    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=150)
    # Frontend `user.avatar` ni URL deb o'qiydi (js/profile.js) — shartnoma
    # o'zgarmadi. `avatar_file` esa M5 da qo'shildi va faqat TOZALASH uchun:
    # usiz har almashtirishda eski rasm diskda yetim bo'lib qolardi.
    # Satrli havola (`"resources.File"`) ATAYLAB: `apps.resources`
    # `apps.accounts` ga tayanadi, teskari import aylanma bo'lardi.
    avatar = models.URLField(blank=True, default="")
    avatar_file = models.ForeignKey(
        "resources.File",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    email_verified_at = models.DateTimeField(null=True, blank=True)

    # Django admin talab qiladi
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta(BaseModel.Meta):
        verbose_name = "Foydalanuvchi"
        verbose_name_plural = "Foydalanuvchilar"

    def __str__(self):
        return self.email

    @property
    def role_names(self):
        return list(self.roles.values_list("role", flat=True))

    def has_role(self, role):
        return self.roles.filter(role=role).exists()

    @property
    def default_role(self):
        """Kirishdan keyin qaysi dashboard'ga yuborilishi.

        Frontend `res.user.role` ni o'qib `ISLOH_ROLE_HOME` dan manzil
        oladi (js/auth-guard.js). Bir nechta rol bo'lsa eng imtiyozlisi
        tanlanadi — admin panelga kirgan odam talaba sahifasiga tushib
        qolmasin.
        """
        names = set(self.role_names)
        for role in (ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_STUDENT):
            if role in names:
                return role
        return ROLE_STUDENT


class UserRole(BaseModel):
    """Kim qaysi rolda ishlay oladi."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="roles")
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["user", "role"], name="uniq_user_role"),
        ]

    def __str__(self):
        return f"{self.user.email} — {self.role}"


class UserProfile(BaseModel):
    """Rolga xos profil.

    Bio va headline rol bo'yicha farq qiladi: bitta odam talaba sifatida
    "Backend dasturchi bo'lishga intilayotgan talaba", o'qituvchi sifatida
    esa "Backend & DevOps o'qituvchisi" deb tanishtiriladi
    (js/profile.js dagi ISLOH_PROFILE_DEFAULTS shu naqshda).
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="profiles")
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)

    headline = models.CharField(max_length=200, blank=True, default="")
    bio = models.TextField(blank=True, default="")
    location = models.CharField(max_length=120, blank=True, default="")
    languages = models.CharField(max_length=120, blank=True, default="")
    # Faqat o'qituvchi ro'yxatdan o'tishida so'raladi
    # (pages/auth/register-instructor.html)
    organization = models.CharField(max_length=150, blank=True, default="")
    # `timezone.now` EMAS: u datetime qaytaradi va DateField uni bazaga
    # yozishda date'ga o'giradi, lekin xotiradagi obyektda datetime bo'lib
    # qoladi. Shu sababli yangi yaratilgan profilni serializatsiya qilganda
    # DRF "Expected a `date`, but got a `datetime`" deb 500 berardi —
    # faqat YARATISH javobida, keyingi o'qishlarda emas.
    joined_at = models.DateField(default=timezone.localdate)

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["user", "role"], name="uniq_user_profile_role"),
        ]

    def __str__(self):
        return f"{self.user.email} ({self.role})"


class UserSkill(BaseModel):
    """Profil sahifasidagi ko'nikmalar ro'yxati."""

    profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=80)
    level = models.CharField(max_length=40, blank=True, default="")
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]


class UserGoal(BaseModel):
    """Maqsadlar. `course` bog'lanishi 2-sprintda qo'shiladi."""

    profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="goals")
    text = models.CharField(max_length=200)
    position = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        ordering = ["position", "created_at"]


class UserSetting(BaseModel):
    """Sozlamalar: `role` bo'sh bo'lsa — umumiy.

    Frontendda ikki kalit bor: `isloh_settings` (til, mavzu, sana formati)
    va `isloh_role_settings` (rolga xos). Ikkalasi ham shu jadvalga tushadi,
    farqi faqat `role` maydonida.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="settings")
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, blank=True, default="")
    key = models.CharField(max_length=64)
    value = models.JSONField()

    class Meta(BaseModel.Meta):
        constraints = [
            models.UniqueConstraint(fields=["user", "role", "key"], name="uniq_user_setting"),
        ]


class Session(BaseModel):
    """Faol refresh sessiyalari — qurilmalar ro'yxati va bekor qilish.

    Xom token SAQLANMAYDI: baza o'g'irlansa u bilan boshqa sessiyaga kirib
    bo'lmasin. Faqat `jti` (token identifikatori) yoziladi.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    jti = models.CharField(max_length=64, unique=True, db_index=True)
    device = models.CharField(max_length=200, blank=True, default="")
    ip = models.GenericIPAddressField(null=True, blank=True)
    last_active_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ["-last_active_at"]

    @property
    def is_active(self):
        return self.revoked_at is None
