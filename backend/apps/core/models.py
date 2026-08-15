"""
ISLOH — umumiy model asoslari.

`id` — UUID. Sabab docs/BACKEND-AUDIT.md §5.2.4 da: hozir frontendda kurs
id'si va slug'i bir xil (`py-101`), ya'ni URL ham, kalit ham bitta qiymat.
UUID kalit va alohida `slug` maydoni ularni ajratadi; `?id=` parametri 20 dan
ortiq sahifada ishlatilgani uchun bu almashuv oldindan rejalashtiriladi.
"""

import uuid

from django.db import models


class BaseModel(models.Model):
    """UUID kalit + yaratilgan/yangilangan vaqt."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class SluggedModel(BaseModel):
    """URL'da ko'rinadigan yozuvlar uchun: kalit UUID, manzil — slug."""

    slug = models.SlugField(max_length=80, unique=True, db_index=True)

    class Meta(BaseModel.Meta):
        abstract = True
