"""Mahalliy ishlab chiqish sozlamalari."""

from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

# Manifest storage `collectstatic` talab qiladi — dev'da keraksiz to'siq
STORAGES["staticfiles"]["BACKEND"] = "whitenoise.storage.CompressedStaticFilesStorage"  # noqa: F405

# Xatolar konsolga to'liq chiqsin (apps.core.exceptions ularni jurnalga yozadi)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
