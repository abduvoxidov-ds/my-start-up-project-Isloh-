"""ISLOH — fayl va resurs marshrutlari (M5).

`trailing_slash=False` — sabab apps/courses/urls.py da.
"""

from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("instructor/resources", views.InstructorResourceViewSet, basename="instructor-resource")

urlpatterns = [
    # Yuklash — uch qadam (apps/resources/models.py boshidagi izoh)
    path("uploads/presign", views.PresignView.as_view(), name="upload-presign"),
    path("uploads/local/<str:token>", views.LocalUploadView.as_view(), name="upload-local"),
    path("uploads/<uuid:file_id>/complete", views.CompleteUploadView.as_view(), name="upload-complete"),
    path("files/<uuid:file_id>/download", views.FileDownloadView.as_view(), name="file-download"),
    # Qamrov
    path("users/me/avatar", views.AvatarView.as_view(), name="user-avatar"),
    path(
        "instructor/lessons/<uuid:lesson_id>/video",
        views.LessonVideoView.as_view(),
        name="lesson-video",
    ),
    path(
        "student/courses/<uuid:course_id>/resources",
        views.StudentCourseResourceView.as_view(),
        name="student-course-resources",
    ),
]

urlpatterns += router.urls
