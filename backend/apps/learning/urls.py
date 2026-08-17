"""ISLOH — o'qish oqimi marshrutlari (M3).

`trailing_slash=False` — sabab apps/courses/urls.py da.
"""

from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("student/notes", views.NoteViewSet, basename="student-note")
router.register("student/tasks", views.TaskViewSet, basename="student-task")

urlpatterns = [
    # Talaba
    path("student/enrollments", views.StudentEnrollmentView.as_view(), name="student-enrollments"),
    path(
        "student/enrollments/<uuid:enrollment_id>",
        views.StudentEnrollmentDetailView.as_view(),
        name="student-enrollment-detail",
    ),
    path(
        "student/courses/<uuid:course_id>/progress",
        views.CourseProgressView.as_view(),
        name="course-progress",
    ),
    path(
        "student/lessons/<uuid:lesson_id>/progress",
        views.LessonProgressView.as_view(),
        name="lesson-progress",
    ),
    path("student/certificates", views.CertificateListView.as_view(), name="student-certificates"),
    # Ommaviy tekshiruv — auth'siz
    path(
        "certificates/verify/<str:code>",
        views.CertificateVerifyView.as_view(),
        name="certificate-verify",
    ),
    # O'qituvchi
    path("instructor/enrollments", views.InstructorEnrollmentView.as_view(), name="instructor-enrollments"),
    path(
        "instructor/courses/<uuid:course_id>/students",
        views.InstructorCourseStudentsView.as_view(),
        name="instructor-course-students",
    ),
]

urlpatterns += router.urls
