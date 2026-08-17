"""ISLOH — baholash marshrutlari (M4).

`trailing_slash=False` — sabab apps/courses/urls.py da.
"""

from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("instructor/questions", views.InstructorQuestionViewSet, basename="instructor-question")
router.register("instructor/quizzes", views.InstructorQuizViewSet, basename="instructor-quiz")
router.register("instructor/assignments", views.InstructorAssignmentViewSet, basename="instructor-assignment")

urlpatterns = [
    # O'qituvchi — baholash
    path("instructor/submissions", views.GradingQueueView.as_view(), name="grading-queue"),
    path(
        "instructor/submissions/<uuid:submission_id>/grade",
        views.GradeSubmissionView.as_view(),
        name="grade-submission",
    ),
    path(
        "instructor/attempts/<uuid:attempt_id>/grade",
        views.GradeAttemptAnswerView.as_view(),
        name="grade-attempt",
    ),
    # Talaba — testlar
    path("student/quizzes/<uuid:quiz_id>", views.StudentQuizView.as_view(), name="student-quiz"),
    path(
        "student/quizzes/<uuid:quiz_id>/attempts",
        views.StudentAttemptView.as_view(),
        name="student-attempt-create",
    ),
    path(
        "student/quizzes/<uuid:quiz_id>/attempts/list",
        views.StudentAttemptListView.as_view(),
        name="student-attempt-list",
    ),
    path(
        "student/attempts/<uuid:attempt_id>/submit",
        views.SubmitAttemptView.as_view(),
        name="student-attempt-submit",
    ),
    # Talaba — topshiriqlar
    path("student/assignments", views.StudentAssignmentListView.as_view(), name="student-assignments"),
    path(
        "student/assignments/<uuid:assignment_id>/submissions",
        views.SubmitAssignmentView.as_view(),
        name="student-assignment-submit",
    ),
    path("student/submissions", views.StudentSubmissionListView.as_view(), name="student-submissions"),
]

urlpatterns += router.urls
