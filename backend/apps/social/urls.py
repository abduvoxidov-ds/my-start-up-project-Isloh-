"""ISLOH — sharh va muhokama marshrutlari (M6).

`trailing_slash=False` — sabab apps/courses/urls.py da.
"""

from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter(trailing_slash=False)
router.register("discussions", views.DiscussionThreadViewSet, basename="discussion")

urlpatterns = [
    # Sharhlar
    path("courses/<uuid:course_id>/reviews", views.CourseReviewView.as_view(), name="course-reviews"),
    path("reviews/<uuid:review_id>", views.ReviewDetailView.as_view(), name="review-detail"),
    path("instructor/reviews", views.InstructorReviewListView.as_view(), name="instructor-reviews"),
    path(
        "instructor/reviews/<uuid:review_id>/reply",
        views.InstructorReviewReplyView.as_view(),
        name="instructor-review-reply",
    ),
    # Muhokama javoblari (mavzu amallari router'da: /discussions/{id}/like ...)
    path(
        "discussion-replies/<uuid:reply_id>",
        views.DiscussionReplyDetailView.as_view(),
        name="discussion-reply-detail",
    ),
    path(
        "discussion-replies/<uuid:reply_id>/<str:verb>",
        views.DiscussionReplyActionView.as_view(),
        name="discussion-reply-action",
    ),
]

urlpatterns += router.urls
