"""ISLOH — kurs marshrutlari (M2).

`trailing_slash=False`: frontend manzillarni `endpoint + '/' + id` tarzida
yasaydi va oxirida `/` qo'ymaydi (js/api.js). Standart router `/` bilan
yozadi — POST so'rov 301 redirectga tushib, tanasini yo'qotardi.
"""

from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("instructor/courses", views.InstructorCourseViewSet, basename="instructor-course")

urlpatterns = [
    # Modullar
    path(
        "instructor/courses/<uuid:course_id>/modules",
        views.ModuleListView.as_view(),
        name="module-list",
    ),
    path(
        "instructor/courses/<uuid:course_id>/modules/reorder",
        views.ModuleReorderView.as_view(),
        name="module-reorder",
    ),
    path(
        "instructor/modules/<uuid:module_id>",
        views.ModuleDetailView.as_view(),
        name="module-detail",
    ),
    path(
        "instructor/modules/<uuid:module_id>/duplicate",
        views.ModuleDuplicateView.as_view(),
        name="module-duplicate",
    ),
    # Darslar
    path(
        "instructor/modules/<uuid:module_id>/lessons",
        views.LessonListView.as_view(),
        name="lesson-list",
    ),
    path(
        "instructor/modules/<uuid:module_id>/lessons/reorder",
        views.LessonReorderView.as_view(),
        name="lesson-reorder",
    ),
    path(
        "instructor/lessons/<uuid:lesson_id>",
        views.LessonDetailView.as_view(),
        name="lesson-detail",
    ),
    path(
        "instructor/lessons/<uuid:lesson_id>/duplicate",
        views.LessonDuplicateView.as_view(),
        name="lesson-duplicate",
    ),
    # Talaba katalogi
    path("catalog", views.CatalogListView.as_view(), name="catalog-list"),
    path("catalog/<slug:slug>", views.CatalogDetailView.as_view(), name="catalog-detail"),
]

# Router oxirida: `instructor/courses/<pk>` naqshi yuqoridagi aniqroq
# yo'llarni (masalan `.../modules`) ushlab qolmasin
urlpatterns += router.urls
