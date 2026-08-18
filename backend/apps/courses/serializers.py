"""
ISLOH — kurs serializerlari (M2).

JAVOB SHAKLI snake_case. Frontenddagi ichki sxema esa camelCase
(`metaTitle`, `createdAt`) va narx USD'da — 16 ta chaqiruv joyi shunga
tayanadi. Ikkalasini bog'laydigan YAGONA nuqta — js/course-store.js dagi
`isloh_normalizeCourse` (serverdan) va `isloh_serializeCourse` (serverga).
Shu sababli bu yerda API o'zining toza shaklida qoladi va frontenddagi
nomlar API'ga sizib kirmaydi.

TEKIS JAVOB: `CourseSettings` alohida jadval, lekin `visibility`,
`certificate`, `meta_title`, `meta_description` kurs javobiga tekislanadi —
frontenddagi forma ularni kursning oddiy maydoni deb biladi
(`data-course-field="metaTitle"`).
"""

from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    STATUS_PUBLISHED,
    Category,
    Course,
    CourseModule,
    CourseSettings,
    CourseTag,
    Lesson,
)


def isloh_unique_slug(base, ignore_pk=None):
    """Band bo'lsa oxiriga raqam qo'shadi: `python-backend-2`.

    `slugify` lotin bo'lmagan belgilarni tashlaydi, ya'ni sarlavha butunlay
    kirill yoki emoji bo'lsa natija bo'sh qolishi mumkin — shunda `kurs`
    asos sifatida olinadi (js/course-store.js dagi `isloh_uniqueCourseId`
    bilan bir xil xulq).
    """
    root = slugify(base or "")[:60] or "kurs"
    taken = Course.objects.exclude(pk=ignore_pk).values_list("slug", flat=True)
    taken = set(taken)

    if root not in taken:
        return root

    counter = 2
    while f"{root}-{counter}" in taken:
        counter += 1
    return f"{root}-{counter}"


class LessonSerializer(serializers.ModelSerializer):
    """`video_url` M5 da qo'shildi.

    U `read_only`: videoni bu yerdan emas, `PUT /instructor/lessons/{id}/video`
    orqali biriktiriladi — u yerda fayl egasi va tayyorligi tekshiriladi.
    Havolaning o'zi ham baytlarga bevosita yo'l emas, u ruxsat tekshiradigan
    endpoint'ga ishora qiladi (apps/resources/views.py).
    """

    video_url = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "title",
            "type",
            "duration",
            "visibility",
            "status",
            "position",
            "video_url",
        ]
        read_only_fields = ["id", "video_url"]

    def get_video_url(self, obj):
        from apps.resources.serializers import isloh_download_url

        return isloh_download_url(obj.video_file)


class CourseModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = [
            "id",
            "title",
            "description",
            "status",
            "position",
            "lessons",
        ]
        read_only_fields = ["id", "lessons"]


class CourseSerializer(serializers.ModelSerializer):
    # Bularning HAMMASI `write_only`, o'qish qismi `to_representation` da.
    # Sabab: ular modelning oddiy maydoni emas — `category` bog'lanish,
    # `tags` alohida jadval, qolgani esa `CourseSettings` da. DRF ularni
    # o'qishga urinsa `instance.tags` (RelatedManager) ni ro'yxat deb
    # iteratsiya qilib "'RelatedManager' object is not iterable" beradi.

    # Turkum nom bo'yicha keladi ("Backend") — frontendda `<select>`
    # qiymatlari aynan nomlar
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True, write_only=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=60),
        required=False,
        write_only=True,
    )

    # CourseSettings dan tekislanadi
    visibility = serializers.CharField(required=False, write_only=True)
    certificate = serializers.BooleanField(required=False, write_only=True)
    meta_title = serializers.CharField(required=False, allow_blank=True, write_only=True)
    meta_description = serializers.CharField(required=False, allow_blank=True, write_only=True)

    # Ro'yxatda `annotate` dan (bitta so'rov), yagona obyektda modeldan
    lessons_count = serializers.SerializerMethodField()
    # Katalog kartochkasi muallif ismini ko'rsatadi, shuning uchun u
    # TAFSILOTDA emas, RO'YXATDA ham kerak. Qo'shimcha so'rov bermaydi:
    # `isloh_course_queryset()` da `select_related("owner")` bor.
    instructor = serializers.SerializerMethodField()
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "slug",
            "title",
            "subtitle",
            "description",
            "category",
            "level",
            "language",
            "tags",
            "free",
            "price_cents",
            "currency",
            "duration",
            "estimate",
            "prerequisites",
            "certificate",
            "visibility",
            "meta_title",
            "meta_description",
            "status",
            "cover",
            "icon",
            "lessons_count",
            "instructor",
            "students_count",
            "rating",
            "reviews_count",
            "revenue_cents",
            "completion",
            "published_at",
            "created_at",
            "updated_at",
        ]
        # Statistikani o'qituvchi o'zi yozmaydi — ularni M3/M6/M9/M11
        # yuritadi. Aks holda API orqali istalgan reyting qo'yib bo'lardi.
        read_only_fields = [
            "id",
            "lessons_count",
            "students_count",
            "rating",
            "reviews_count",
            "revenue_cents",
            "completion",
            "published_at",
            "created_at",
            "updated_at",
        ]

    # --- O'qish ------------------------------------------------------------

    def validate(self, attrs):
        """Nashr tekshiruvi ODDIY yozuv yo'lida ham qo'llanadi.

        `/status` va `/publish` endpoint'lari yagona yo'l emas: do'kon
        fabrikasi butun obyektni `PUT` bilan yuboradi (js/api.js), ya'ni
        `status: "published"` shu yerdan ham kelishi mumkin edi va
        tekshiruv chetlab o'tilardi.
        """
        if attrs.get("status") == STATUS_PUBLISHED:
            blockers = isloh_publish_blockers(self.instance, attrs)
            if blockers:
                # Satr, ro'yxat emas — §0.2
                raise serializers.ValidationError({"status": "; ".join(blockers)})
        return attrs

    def get_instructor(self, instance):
        return {
            "id": str(instance.owner_id),
            "full_name": instance.owner.full_name,
            "avatar": instance.owner.avatar,
        }

    def get_lessons_count(self, instance):
        annotated = getattr(instance, "lessons_annotated", None)
        return annotated if annotated is not None else instance.lessons_count

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["category"] = instance.category.name if instance.category else ""
        data["tags"] = [tag.name for tag in instance.tags.all()]

        row = getattr(instance, "settings", None)
        data["visibility"] = row.visibility if row else "public"
        data["certificate"] = row.certificate if row else True
        data["meta_title"] = row.meta_title if row else ""
        data["meta_description"] = row.meta_description if row else ""
        return data

    # --- Yozish ------------------------------------------------------------

    SETTINGS_FIELDS = ("visibility", "certificate", "meta_title", "meta_description")

    def _pop_settings(self, validated):
        return {f: validated.pop(f) for f in self.SETTINGS_FIELDS if f in validated}

    def _resolve_category(self, name):
        """Nom bo'yicha turkum. Yo'q bo'lsa yaratiladi.

        O'qituvchi frontendda erkin turkum kirita oladi; qat'iy ro'yxatga
        aylantirish M12 (administratsiya) ishi.
        """
        name = (name or "").strip()
        if not name:
            return None
        category = Category.objects.filter(name__iexact=name).first()
        if category:
            return category
        return Category.objects.create(name=name, slug=isloh_category_slug(name))

    def _sync_tags(self, course, names):
        """Teglarni to'liq almashtiradi — forma butun ro'yxatni yuboradi."""
        course.tags.all().delete()
        seen = set()
        rows = []
        for position, raw in enumerate(names):
            name = (raw or "").strip()
            key = name.lower()
            if not name or key in seen:
                continue
            seen.add(key)
            rows.append(CourseTag(course=course, name=name, position=position))
        if rows:
            CourseTag.objects.bulk_create(rows)

    @transaction.atomic
    def create(self, validated):
        settings_data = self._pop_settings(validated)
        tags = validated.pop("tags", [])
        category_name = validated.pop("category", "")

        slug = (validated.pop("slug", "") or "").strip()
        validated["slug"] = isloh_unique_slug(slug or validated.get("title"))
        validated["category"] = self._resolve_category(category_name)
        validated["owner"] = self.context["request"].user

        course = Course.objects.create(**validated)
        CourseSettings.objects.create(course=course, **settings_data)
        self._sync_tags(course, tags)
        return course

    @transaction.atomic
    def update(self, instance, validated):
        settings_data = self._pop_settings(validated)
        tags = validated.pop("tags", None)

        if "category" in validated:
            validated["category"] = self._resolve_category(validated.pop("category"))

        if "slug" in validated:
            slug = (validated.pop("slug") or "").strip()
            # Slug o'zgarmagan bo'lsa qayta hisoblanmaydi: aks holda har
            # saqlashda `-2` qo'shilib ketardi
            if slug and slug != instance.slug:
                validated["slug"] = isloh_unique_slug(slug, ignore_pk=instance.pk)

        for field, value in validated.items():
            setattr(instance, field, value)
        instance.save()

        if settings_data:
            CourseSettings.objects.update_or_create(course=instance, defaults=settings_data)
        if tags is not None:
            self._sync_tags(instance, tags)
        return instance


def isloh_category_slug(name):
    """Turkum uchun noyob slug."""
    root = slugify(name)[:70] or "turkum"
    taken = set(Category.objects.values_list("slug", flat=True))
    if root not in taken:
        return root
    counter = 2
    while f"{root}-{counter}" in taken:
        counter += 1
    return f"{root}-{counter}"


class CourseDetailSerializer(CourseSerializer):
    """Katalog tafsiloti — tarkib bilan birga."""

    modules = CourseModuleSerializer(many=True, read_only=True)

    class Meta(CourseSerializer.Meta):
        fields = CourseSerializer.Meta.fields + ["modules"]


# --- Nashr tekshiruvi ------------------------------------------------------

def isloh_publish_blockers(course, changes=None):
    """Nashrga to'sqinlik qiladigan bandlar ro'yxati (bo'sh = nashr mumkin).

    NEGA SERVERDA HAM: `pages/instructor/course-publish.html` shu ro'yxatni
    frontendda chizadi va tugmani o'chiradi, lekin server takrorlamasa
    API orqali bo'sh kursni nashr etib bo'lardi (docs/BACKEND-PLAN.md §M2).

    Bandlar js/course-publish.js dagi `isloh_publishChecks` ning `fail`
    darajasidagi UCHTA qoidasi bilan bir xil. `warn` darajasidagilar (SEO,
    test, topshiriq, resurs) nashrni to'xtatmaydi — ular ham bu yerda
    tekshirilsa frontend "nashr etsa bo'ladi" deb ko'rsatib turgan holatda
    server rad etardi.

    `changes` — shu so'rovda o'zgarayotgan maydonlar. Tekshiruv SO'ROVDAN
    KEYINGI holatga qo'llanadi: bitta PUT bilan tavsif ham yozilib, holat
    ham `published` ga o'tishi mumkin va u holda eski tavsifga qarab rad
    etish noto'g'ri bo'lardi.
    """
    changes = changes or {}

    def value(field, default=None):
        if field in changes:
            return changes[field]
        return getattr(course, field, default) if course is not None else default

    blockers = []

    title = value("title", "")
    if not title or not (value("description", "") or value("subtitle", "")):
        blockers.append("Asosiy ma'lumotlar to'ldirilmagan")

    # Darslar faqat bazadan: yangi kursda ular hali yo'q
    has_lessons = course is not None and Lesson.objects.filter(module__course=course).exists()
    if not has_lessons:
        blockers.append("Kamida 1 ta dars qo'shilishi shart")

    if not value("free", False) and (value("price_cents", 0) or 0) <= 0:
        blockers.append("Narx belgilanmagan")

    return blockers


class CourseStatusSerializer(serializers.Serializer):
    """`PATCH /instructor/courses/{id}/status` tanasi."""

    status = serializers.ChoiceField(choices=[c[0] for c in Course._meta.get_field("status").choices])

    def validate_status(self, value):
        if value != STATUS_PUBLISHED:
            return value

        blockers = isloh_publish_blockers(self.context["course"], None)
        if blockers:
            # Bitta satr — §0.2: `fields` qiymati frontendda `textContent`
            # ga yoziladi, ro'yxat emas
            raise serializers.ValidationError("; ".join(blockers))
        return value


class ReorderSerializer(serializers.Serializer):
    """Tortib ko'chirishdan keyingi tartib: ID'lar ro'yxati."""

    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)
