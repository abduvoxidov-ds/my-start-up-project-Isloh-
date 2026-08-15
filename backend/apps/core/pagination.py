"""
ISLOH — sahifalash.

DIQQAT: bu sinf SUKUT BO'YICHA yoqilmagan (settings: DEFAULT_PAGINATION_CLASS
= None). Sabab docs/BACKEND-PLAN.md §0.1 da:

`js/api.js` dagi do'kon fabrikasi javobga to'g'ridan-to'g'ri `.map()`
qo'llaydi:

    _cache = (data || []).map(normalize);

Sahifalash o'rami (`{count, next, previous, results}` yoki `{data, meta}`)
kelsa `.map` mavjud bo'lmaydi -> TypeError -> uni `.catch` ushlaydi ->
sahifa JIMGINA demo ma'lumotga tushadi. Ekranda hech qanday xato yo'q,
foydalanuvchi demoni haqiqiy deb o'ylaydi.

Shuning uchun:
  * do'kon endpoint'lari (/courses, /enrollments, /notes, /tasks ...)
    bevosita MASSIV qaytaradi;
  * sahifalash faqat katalog, jadval va tarixlar uchun — u yerda view
    `pagination_class = IslohPagination` deb ATAYLAB yozadi va frontend
    `data`/`meta` ni bilib o'qiydi.
"""

from collections import OrderedDict

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class IslohPagination(PageNumberPagination):
    """`{ data: [...], meta: { page, per_page, total, pages } }`."""

    page_size = 20
    page_size_query_param = "per_page"
    max_page_size = 100
    page_query_param = "page"

    def get_paginated_response(self, data):
        return Response(
            OrderedDict(
                [
                    ("data", data),
                    (
                        "meta",
                        OrderedDict(
                            [
                                ("page", self.page.number),
                                ("per_page", self.get_page_size(self.request)),
                                ("total", self.page.paginator.count),
                                ("pages", self.page.paginator.num_pages),
                            ]
                        ),
                    ),
                ]
            )
        )
