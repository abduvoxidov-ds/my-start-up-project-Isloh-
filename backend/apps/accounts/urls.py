"""ISLOH — auth marshrutlari (docs/BACKEND-AUDIT.md §3)."""

from django.urls import path

from . import views

urlpatterns = [
    path("auth/register", views.RegisterView.as_view(), name="register"),
    path("auth/login", views.LoginView.as_view(), name="login"),
    path("auth/refresh", views.RefreshView.as_view(), name="refresh"),
    path("auth/logout", views.LogoutView.as_view(), name="logout"),
    path("auth/me", views.me_view, name="me"),
    path("auth/change-password", views.ChangePasswordView.as_view(), name="change-password"),
    path("auth/sessions", views.sessions_view, name="sessions"),
    path("auth/sessions/<uuid:session_id>", views.revoke_session_view, name="revoke-session"),
    path("users/me/profile", views.ProfileView.as_view(), name="profile"),
]
