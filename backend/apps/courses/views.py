"""
ISLOH — kurs ko'rinishlari (M2).

IKKI TOMON:
  /instructor/...  — o'qituvchi o'z kurslarini boshqaradi (auth + rol + egalik)
  /catalog/...     — talaba katalogi (auth'siz o'qiladi)

SAHIFALASH: `/instructor/courses` ATAYLAB sahifalanmaydi — u js/course-store.js
do'koni uchun va fabrika bevosita massiv kutadi (§0.1). `/catalog` esa
sahifalanadi va buni ochiq yozadi (`pagination_class`).
"""

from django.db.models import Count, Prefetch
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ROLE_INSTRUCTOR
from apps.core.pagination import IslohPagination

from .models import (
    STATUS_DRAFT,
    STATUS_PUBLISHED,
    VISIBILITY_PRIVATE,
    Course,
    CourseModule,
    CourseSettings,
    Lesson,
)
from .serializers import (
    CourseDetailSerializer,
    CourseModuleSerializer,
    CourseSerializer,
    CourseStatusSerializer,
    LessonSerializer,
    ReorderSerializer,
)


class IsInstructor(BasePermission):
    """O'qituvchi roli bo'lgan foydalanuvchi.

    Rol ALOHIDA jadvalda (apps/accounts/models.py) — bitta odam ham talaba,
    ham o'qituvchi bo'lishi mumkin, shuning uchun `user.role` tekshirilmaydi.
    """

    message = "Bu amal uchun o'qituvchi roli talab qilinadi"

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.has_role(ROLE_INSTRUCTOR))


def isloh_course_queryset():
    """Ro'yxat uchun tayyorlangan so'rov.

    `annotate` — dars sonini bitta so'rovda hisoblaydi; modelning
    `lessons_count` xossasi har kurs uchun alohida so'rov yuborardi
    (6 ta kursli ro'yxatda 7 ta so'rov).
    """
    return (
        Course.objects.select_related("category", "settings", "owner")
        .prefetch_related("tags")
        # Nom `lessons_count` EMAS: modelda shu nomli xossa bor va Django
        # annotatsiyani obyektga yozmoqchi bo'lib "property has no setter"
        # deb yiqilardi
        .annotate(lessons_annotated=Count("modules__lessons", distinct=True))
        # ORDER BY OSHKORA — `annotate()` guruhlash qo'shgani uchun Django
        # modelning `Meta.ordering` ini SQL'ga umuman chiqarmaydi (tekshirildi:
        # so'rovda ORDER BY yo'q edi). SQLite'da tartib tasodifan barqaror
        # ko'rinardi, PostgreSQL'da esa u ANIQLANMAGAN — sahifalangan
        # katalogda bitta kurs ikki sahifada takrorlanishi yoki umuman
        # tushib qolishi mumkin edi.
        #
        # `id` — teng qiymatlar uchun ajratuvchi: bir vaqtda yaratilgan
        # kurslarda faqat `created_at` yetarli emas.
        .order_by("-created_at", "id")
    )


class InstructorCourseViewSet(viewsets.ModelViewSet):
    """`/instructor/courses` — o'qituvchining o'z kurslari."""

    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsInstructor]
    # §0.1 — do'kon endpoint'i, o'ram bo'lmasin
    pagination_class = None

    def get_queryset(self):
        """FAQAT o'z kurslari.

        Egalik shu yerda filtrlanadi, `has_object_permission` da emas:
        begona kurs 403 emas, 404 berishi kerak — aks holda 403 javobning
        o'zi "bunday id'li kurs bor" degan ma'lumotni oshkor qilardi.
        """
        return isloh_course_queryset().filter(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        """Nusxa: qoralama holatida, statistikasiz, tarkibi bilan."""
        source = self.get_object()
        copy = isloh_duplicate_course(source)
        serializer = self.get_serializer(self.get_queryset().get(pk=copy.pk))
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"])
    def status(self, request, pk=None):
        """Holatni o'zgartirish. Nashrda serverdagi tekshiruv ishlaydi."""
        course = self.get_object()
        serializer = CourseStatusSerializer(data=request.data, context={"course": course})
        serializer.is_valid(raise_exception=True)
        return Response(self._apply_status(course, serializer.validated_data["status"]))

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """`status: published` uchun qisqa yo'l — frontenddagi nashr tugmasi."""
        course = self.get_object()
        serializer = CourseStatusSerializer(
            data={"status": STATUS_PUBLISHED},
            context={"course": course},
        )
        serializer.is_valid(raise_exception=True)
        return Response(self._apply_status(course, STATUS_PUBLISHED))

    def _apply_status(self, course, new_status):
        from django.utils import timezone

        course.status = new_status
        if new_status == STATUS_PUBLISHED and course.published_at is None:
            course.published_at = timezone.now()
        course.save(update_fields=["status", "published_at", "updated_at"])
        return self.get_serializer(self.get_queryset().get(pk=course.pk)).data


def isloh_duplicate_course(source):
    """Kurs nusxasi: sozlamalar, teglar, modullar va darslar bilan.

    Statistika KO'CHIRILMAYDI (talabalar, reyting, daromad) — nusxa yangi
    kurs, o'zganing raqamlarini meros qilib olmaydi. js/course-store.js
    dagi `isloh_duplicateCourse` ham shunday qiladi.
    """
    from django.db import transaction

    from .models import CourseTag
    from .serializers import isloh_unique_slug

    with transaction.atomic():
        title = f"{source.title} (nusxa)"
        copy = Course.objects.create(
            owner=source.owner,
            slug=isloh_unique_slug(title),
            title=title,
            subtitle=source.subtitle,
            description=source.description,
            category=source.category,
            level=source.level,
            language=source.language,
            free=source.free,
            price_cents=source.price_cents,
            currency=source.currency,
            duration=source.duration,
            estimate=source.estimate,
            prerequisites=source.prerequisites,
            status=STATUS_DRAFT,
            cover=source.cover,
            icon=source.icon,
        )

        source_settings = getattr(source, "settings", None)
        CourseSettings.objects.create(
            course=copy,
            visibility=source_settings.visibility if source_settings else "public",
            certificate=source_settings.certificate if source_settings else True,
            meta_title=source_settings.meta_title if source_settings else "",
            meta_description=source_settings.meta_description if source_settings else "",
        )

        CourseTag.objects.bulk_create(
            [CourseTag(course=copy, name=t.name, position=t.position) for t in source.tags.all()]
        )

        for module in source.modules.all():
            module_copy = CourseModule.objects.create(
                course=copy,
                title=module.title,
                description=module.description,
                status=module.status,
                position=module.position,
            )
            Lesson.objects.bulk_create(
                [
                    Lesson(
                        module=module_copy,
                        title=lesson.title,
                        type=lesson.type,
                        duration=lesson.duration,
                        visibility=lesson.visibility,
                        status=lesson.status,
                        position=lesson.position,
                    )
                    for lesson in module.lessons.all()
                ]
            )

    return copy


# --- Modullar --------------------------------------------------------------


def isloh_owned_course(user, course_id):
    """Egalik tekshiruvi. Begona kurs — 404 (mavjudligi oshkor bo'lmasin)."""
    course = Course.objects.filter(pk=course_id, owner=user).first()
    if course is None:
        raise NotFound("Kurs topilmadi")
    return course


def isloh_owned_module(user, module_id):
    module = CourseModule.objects.filter(pk=module_id, course__owner=user).select_related("course").first()
    if module is None:
        raise NotFound("Modul topilmadi")
    return module


class ModuleListView(APIView):
    """`/instructor/courses/{course_id}/modules` — ro'yxat va qo'shish."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def get(self, request, course_id):
        course = isloh_owned_course(request.user, course_id)
        modules = course.modules.prefetch_related("lessons")
        return Response(CourseModuleSerializer(modules, many=True).data)

    def post(self, request, course_id):
        course = isloh_owned_course(request.user, course_id)
        serializer = CourseModuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Tartib berilmasa oxiriga qo'shiladi
        if "position" not in serializer.validated_data:
            serializer.validated_data["position"] = course.modules.count()
        serializer.save(course=course)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ModuleDetailView(APIView):
    """`/instructor/modules/{id}` — tahrirlash va o'chirish."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def patch(self, request, module_id):
        module = isloh_owned_module(request.user, module_id)
        serializer = CourseModuleSerializer(module, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, module_id):
        isloh_owned_module(request.user, module_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ModuleDuplicateView(APIView):
    """`/instructor/modules/{id}/duplicate` — modul darslari bilan nusxalanadi.

    Serverda bajariladi, chunki mijoz tomonida bu N+1 ta so'rov bo'lardi
    (modul + har bir dars) va yarmida uzilsa yarim nusxa qolardi.
    Nusxa asl modulning ORQASIGA qo'yiladi — js/content-store.js dagi
    `isloh_duplicateModule` ham shunday qilardi.
    """

    permission_classes = [IsAuthenticated, IsInstructor]

    def post(self, request, module_id):
        from django.db import transaction

        source = isloh_owned_module(request.user, module_id)

        with transaction.atomic():
            copy = CourseModule.objects.create(
                course=source.course,
                title=f"{source.title} (nusxa)",
                description=source.description,
                status=STATUS_DRAFT,
                position=source.position + 1,
            )
            Lesson.objects.bulk_create(
                [
                    Lesson(
                        module=copy,
                        title=lesson.title,
                        type=lesson.type,
                        duration=lesson.duration,
                        visibility=lesson.visibility,
                        status=lesson.status,
                        position=lesson.position,
                    )
                    for lesson in source.lessons.all()
                ]
            )
            # Nusxadan keyingi modullar bir pog'ona pastga suriladi
            for follower in source.course.modules.filter(position__gte=copy.position).exclude(pk=copy.pk):
                follower.position += 1
                follower.save(update_fields=["position"])

        return Response(CourseModuleSerializer(copy).data, status=status.HTTP_201_CREATED)


class LessonDuplicateView(APIView):
    """`/instructor/lessons/{id}/duplicate`."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def post(self, request, lesson_id):
        source = isloh_owned_lesson(request.user, lesson_id)

        copy = Lesson.objects.create(
            module=source.module,
            title=f"{source.title} (nusxa)",
            type=source.type,
            duration=source.duration,
            visibility=source.visibility,
            status=source.status,
            position=source.position + 1,
        )
        for follower in source.module.lessons.filter(position__gte=copy.position).exclude(pk=copy.pk):
            follower.position += 1
            follower.save(update_fields=["position"])

        return Response(LessonSerializer(copy).data, status=status.HTTP_201_CREATED)


class ModuleReorderView(APIView):
    """`/instructor/courses/{course_id}/modules/reorder` — js/sortable.js."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def post(self, request, course_id):
        course = isloh_owned_course(request.user, course_id)
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        isloh_apply_order(course.modules.all(), serializer.validated_data["ids"])
        modules = course.modules.prefetch_related("lessons")
        return Response(CourseModuleSerializer(modules, many=True).data)


def isloh_apply_order(queryset, ids):
    """ID tartibiga qarab `position` qiymatlarini qayta yozadi.

    Ro'yxatga kirmagan yozuvlar oxirida, o'z tartibida qoladi — frontend
    faqat ko'rinib turgan qismini yuborishi mumkin va qolgani yo'qolmasin
    (js/content-store.js dagi `isloh_reorderModules` ham shunday).
    """
    rows = list(queryset)
    by_id = {str(row.pk): row for row in rows}

    ordered = []
    for raw_id in ids:
        row = by_id.pop(str(raw_id), None)
        if row is not None:
            ordered.append(row)
    ordered.extend(sorted(by_id.values(), key=lambda r: (r.position, r.created_at)))

    for position, row in enumerate(ordered):
        row.position = position

    if ordered:
        type(ordered[0]).objects.bulk_update(ordered, ["position"])


# --- Darslar ---------------------------------------------------------------


def isloh_owned_lesson(user, lesson_id):
    lesson = Lesson.objects.filter(pk=lesson_id, module__course__owner=user).first()
    if lesson is None:
        raise NotFound("Dars topilmadi")
    return lesson


class LessonListView(APIView):
    """`/instructor/modules/{module_id}/lessons`."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def get(self, request, module_id):
        module = isloh_owned_module(request.user, module_id)
        return Response(LessonSerializer(module.lessons.all(), many=True).data)

    def post(self, request, module_id):
        module = isloh_owned_module(request.user, module_id)
        serializer = LessonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if "position" not in serializer.validated_data:
            serializer.validated_data["position"] = module.lessons.count()
        serializer.save(module=module)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LessonDetailView(APIView):
    """`/instructor/lessons/{id}`."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def patch(self, request, lesson_id):
        lesson = isloh_owned_lesson(request.user, lesson_id)
        serializer = LessonSerializer(lesson, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, lesson_id):
        isloh_owned_lesson(request.user, lesson_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LessonReorderView(APIView):
    """`/instructor/modules/{module_id}/lessons/reorder`."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def post(self, request, module_id):
        module = isloh_owned_module(request.user, module_id)
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        isloh_apply_order(module.lessons.all(), serializer.validated_data["ids"])
        return Response(LessonSerializer(module.lessons.all(), many=True).data)


# --- Talaba katalogi -------------------------------------------------------


def isloh_catalog_queryset():
    """Katalogga chiqadigan kurslar: nashr etilgan va yopiq bo'lmagan.

    `unlisted` ATAYLAB kiritilgan emas: u "havola bilan ochiladi, lekin
    ro'yxatda yo'q" degani, ya'ni ro'yxatdan chiqariladi, tafsilotdan emas.
    """
    return isloh_course_queryset().filter(status=STATUS_PUBLISHED).exclude(
        settings__visibility=VISIBILITY_PRIVATE
    )


class CatalogListView(ListAPIView):
    """`/catalog` — sahifalanadi (§0.1: bu do'kon endpoint'i EMAS)."""

    serializer_class = CourseSerializer
    permission_classes = [AllowAny]
    pagination_class = IslohPagination

    def get_queryset(self):
        queryset = isloh_catalog_queryset().exclude(settings__visibility="unlisted")

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__name__iexact=category)

        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(title__icontains=search)

        return queryset


class CatalogDetailView(RetrieveAPIView):
    """`/catalog/{slug}` — tarkibi bilan.

    `unlisted` kurs shu yerda ochiladi: havolasi bor odam ko'ra oladi.
    """

    serializer_class = CourseDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return isloh_catalog_queryset().prefetch_related(
            Prefetch("modules", queryset=CourseModule.objects.prefetch_related("lessons"))
        )
