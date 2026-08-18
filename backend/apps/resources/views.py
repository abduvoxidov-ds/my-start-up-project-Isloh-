"""
ISLOH — fayl va resurs ko'rinishlari (M5).

Uch qadamli yuklash oqimi apps/resources/models.py boshida tasvirlangan.
Bu yerda qoladigan asosiy qarorlar:

1. **Baytlar bo'lak-bo'lak o'qiladi.** `request.body` ISHLATILMAYDI: Django
   unga `DATA_UPLOAD_MAX_MEMORY_SIZE` (sukut 2.5 MB) chegarasini qo'llaydi
   va 3 MB lik PDF ham `RequestDataTooBig` bilan yiqilardi. Chegarani
   200 MB ga ko'tarish esa faylni butunlay XOTIRAGA sig'dirishni bildiradi.
   Shuning uchun oqim `SpooledTemporaryFile` ga ko'chiriladi va chegara
   O'QISH PAYTIDA tekshiriladi — yolg'on `Content-Length` yozgan mijoz
   diskni to'ldira olmaydi.

2. **`complete` da hajm QAYTA tekshiriladi** — endi diskdagi haqiqiy hajm
   bo'yicha (apps/resources/rules.py boshidagi izoh).

3. **Yuklab olish `Content-Disposition: attachment` bilan.** Yagona
   istisno — avatar: u `<img src>` da ko'rsatiladi, shuning uchun `inline`.
   Aynan shu sabab `.svg` avatar sifatida qabul qilinmaydi (rules.py).
"""

import tempfile

from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotAuthenticated, NotFound, ValidationError
from rest_framework.parsers import BaseParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import UserSerializer
from apps.assessment.models import Assignment
from apps.core.exceptions import isloh_validation_response
from apps.courses.views import IsInstructor
from apps.learning.models import Enrollment

from .models import (
    PURPOSE_AVATAR,
    PURPOSE_LESSON_VIDEO,
    PURPOSE_SUBMISSION,
    File,
    Resource,
)
from .permissions import isloh_can_download, isloh_is_public_file
from .rules import isloh_rules_for, isloh_validate_upload
from .serializers import (
    AvatarSerializer,
    FileSerializer,
    PresignSerializer,
    ResourceSerializer,
    isloh_download_url,
)
from .storage import isloh_guess_content_type, isloh_storage

# Oqimdan bir marta o'qiladigan bo'lak
ISLOH_UPLOAD_CHUNK = 64 * 1024
# Shu hajmgacha xotirada, kattasi vaqtinchalik faylga tushadi
ISLOH_SPOOL_MAX = 5 * 1024 * 1024


class RawBodyParser(BaseParser):
    """Har qanday `Content-Type` ni xom oqim sifatida beradi.

    Yuklash `PUT <upload_url>` ko'rinishida bo'ladi va tanasi — faylning
    o'zi. DRF ning JSON parseri buni parse qilishga urinib yiqilardi.
    """

    media_type = "*/*"

    def parse(self, stream, media_type=None, parser_context=None):
        return stream


# --- 1-qadam: presign ------------------------------------------------------


class PresignView(APIView):
    """`POST /uploads/presign` — yozuv yaratadi va yuklash manzilini beradi."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PresignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        assignment = None
        if data["purpose"] == PURPOSE_SUBMISSION:
            assignment = self._assignment(request, data.get("assignment"))

        isloh_validate_upload(data["name"], data["size_bytes"], data["purpose"], assignment)

        storage = isloh_storage()
        file = File.objects.create(
            owner=request.user,
            purpose=data["purpose"],
            name=data["name"][:255],
            content_type=isloh_guess_content_type(data["name"], data.get("content_type", "")),
            size_bytes=data["size_bytes"],
            storage_key=storage.build_key(data["purpose"], data["name"]),
        )

        payload = {"file": FileSerializer(file).data}
        payload.update(storage.upload_target(file))
        return Response(payload, status=status.HTTP_201_CREATED)

    def _assignment(self, request, assignment_id):
        """Topshiriq chegarasi uning O'ZIDAN olinadi.

        Yozilmagan kursning topshirig'i 404: aks holda topshiriq id'sini
        taxmin qilib uning fayl sozlamalarini o'qib olish mumkin bo'lardi.
        """
        if not assignment_id:
            return None

        assignment = Assignment.objects.filter(pk=assignment_id).first()
        if assignment is None:
            raise NotFound("Topshiriq topilmadi")

        is_owner = assignment.owner_id == request.user.id
        if not is_owner and not Enrollment.objects.filter(
            user=request.user, course_id=assignment.course_id
        ).exists():
            raise NotFound("Topshiriq topilmadi")
        return assignment


# --- 2-qadam: baytlar ------------------------------------------------------


# `non_atomic_requests` — `ATOMIC_REQUESTS = True` bu yerda zarar berardi:
# 200 MB lik faylni diskka yozish davomida baza tranzaksiyasi ochiq turardi.
@method_decorator(transaction.non_atomic_requests, name="dispatch")
class LocalUploadView(APIView):
    """`PUT /uploads/local/{token}` — mahalliy saqlash backendining qabuli.

    S3 da bu manzil AWS ga ketadi va bu ko'rinish umuman chaqirilmaydi.
    Shuning uchun autentifikatsiya YO'Q: imzolangan, muddatli URL ning
    o'zi — kalit (S3 presigned PUT bilan bir xil model).
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [RawBodyParser]

    def put(self, request, token):
        storage = isloh_storage()
        file_id = storage.unsign(token)
        if not file_id:
            raise NotFound("Yuklash havolasi yaroqsiz yoki muddati o'tgan")

        file = File.objects.filter(pk=file_id).first()
        if file is None:
            raise NotFound("Fayl topilmadi")
        if file.status == File.STATUS_READY:
            # Havola bir martalik emas, lekin tugallangan faylni qayta
            # yozib bo'lmaydi: aks holda tekshiruvdan o'tgan resursning
            # ichini keyin almashtirish mumkin bo'lardi
            raise ValidationError({"form": "Bu fayl allaqachon yuklangan"})

        # Tanasiz `PUT` da DRF parserni umuman chaqirmaydi va `request.data`
        # oqim emas, bo'sh lug'at bo'ladi
        stream = request.data if hasattr(request.data, "read") else None
        if stream is None:
            raise ValidationError({"form": "Bo'sh fayl yuklandi"})

        limit = isloh_rules_for(file.purpose)["max_bytes"]
        with tempfile.SpooledTemporaryFile(max_size=ISLOH_SPOOL_MAX) as buffer:
            written = 0
            for chunk in iter(lambda: stream.read(ISLOH_UPLOAD_CHUNK), b""):
                written += len(chunk)
                if written > limit:
                    raise ValidationError({"form": "Fayl hajmi chegaradan oshdi"})
                buffer.write(chunk)

            if not written:
                raise ValidationError({"form": "Bo'sh fayl yuklandi"})

            buffer.seek(0)
            key = storage.save(file.storage_key, buffer)

        if key != file.storage_key:
            File.objects.filter(pk=file.pk).update(storage_key=key)

        return Response(status=status.HTTP_204_NO_CONTENT)


# --- 3-qadam: complete -----------------------------------------------------


# `non_atomic_requests` — ATAYLAB. Tekshiruvdan o'tmagan yuklash TOZALANADI
# (baytlar ham, yozuv ham o'chadi), keyin esa 400 otiladi. `ATOMIC_REQUESTS`
# ostida o'sha 400 butun tranzaksiyani orqaga qaytarardi: baytlar diskdan
# ketgan, `pending` qatori esa bazada qolgan bo'lardi.
@method_decorator(transaction.non_atomic_requests, name="dispatch")
class CompleteUploadView(APIView):
    """`POST /uploads/{id}/complete` — yuklashni yakunlaydi."""

    permission_classes = [IsAuthenticated]

    def post(self, request, file_id):
        file = File.objects.filter(pk=file_id, owner=request.user).first()
        if file is None:
            raise NotFound("Fayl topilmadi")

        storage = isloh_storage()
        if not storage.exists(file.storage_key):
            raise ValidationError({"form": "Fayl yuklanmagan"})

        real_size = storage.size(file.storage_key)
        try:
            # HAQIQIY hajm bo'yicha — e'lon qilingani shunchaki mijoz aytgan son
            isloh_validate_upload(file.name, real_size, file.purpose)
        except ValidationError as exc:
            # Chegaradan oshgan baytlar diskda qolmasin. Xato OTILMAYDI, javob
            # qo'lda yasaladi: otilgan istisno DRF da `set_rollback()` ni
            # chaqirib shu o'chirishning o'zini bekor qilardi
            # (apps/core/exceptions.py -> isloh_validation_response).
            storage.delete(file.storage_key)
            file.delete()
            return isloh_validation_response(exc)

        file.size_bytes = real_size
        file.status = File.STATUS_READY
        file.completed_at = timezone.now()
        file.save(update_fields=["size_bytes", "status", "completed_at", "updated_at"])

        return Response(FileSerializer(file).data)


# --- Yuklab olish ----------------------------------------------------------


class FileDownloadView(APIView):
    """`GET /files/{id}/download` — ruxsat tekshirilgandan keyin.

    `AllowAny` — ATAYLAB, lekin bu "hamma hamma narsani oladi" degani EMAS.
    Faqat avatar anonim beriladi (sabab: `isloh_is_public_file`), qolgan
    hamma tur uchun kirish pastda talab qilinadi. Ruxsat DRF darajasida
    emas, ko'rinish ichida hisoblanadi, chunki u faylning MAQSADIGA bog'liq
    va maqsad so'rovdan oldin ma'lum emas.
    """

    permission_classes = [AllowAny]

    def get(self, request, file_id):
        file = File.objects.filter(pk=file_id, status=File.STATUS_READY).first()
        # Ruxsat yo'q bo'lsa ham 404: 403 javobning o'zi fayl borligini
        # oshkor qilardi (apps/resources/permissions.py)
        if file is None:
            raise NotFound("Fayl topilmadi")

        # Ochiq bo'lmagan faylda sessiya tugagani "topilmadi" emas, "kiring"
        if not isloh_is_public_file(file) and not request.user.is_authenticated:
            raise NotAuthenticated()

        if not isloh_can_download(request.user, file):
            raise NotFound("Fayl topilmadi")

        storage = isloh_storage()
        if not storage.exists(file.storage_key):
            raise NotFound("Fayl topilmadi")

        # Avatar `<img src>` da ko'rsatiladi — faqat u inline
        as_attachment = file.purpose != PURPOSE_AVATAR
        response = FileResponse(
            storage.open(file.storage_key),
            as_attachment=as_attachment,
            filename=file.name,
            content_type=file.content_type or "application/octet-stream",
        )
        # Brauzer MIME ni O'ZI taxmin qilib ko'rsatmasin: yuklangan fayl
        # boshqa foydalanuvchidan keladi
        response["X-Content-Type-Options"] = "nosniff"
        return response


# --- Kutubxona: o'qituvchi -------------------------------------------------


class InstructorResourceViewSet(viewsets.ModelViewSet):
    """`/instructor/resources` — do'kon endpoint'i, SAHIFALANMAYDI (§0.1)."""

    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated, IsInstructor]
    pagination_class = None

    def get_queryset(self):
        queryset = Resource.objects.filter(owner=self.request.user).select_related("file")
        course = self.request.query_params.get("course")
        if course:
            queryset = queryset.filter(course_id=course)
        return queryset

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        """Nusxa SERVERDA yasaladi.

        Sabab M2 dagi bilan bir xil: mijozda bu "o'qi -> o'zgartir -> yoz"
        bo'lardi va yarmida uzilsa nomi ham, holati ham noto'g'ri nusxa
        qolib ketardi. Baytlar KO'CHIRILMAYDI — ikkala yozuv bitta `File`
        ga ishora qiladi (fayl o'zgarmas: uni qayta yozib bo'lmaydi).
        """
        source = self.get_object()

        # "slides (nusxa).pptx" — kengaytmadan OLDIN (js/resource-store.js)
        dot = source.name.rfind(".")
        name = (
            source.name[:dot] + " (nusxa)" + source.name[dot:]
            if dot > 0
            else source.name + " (nusxa)"
        )

        copy = Resource.objects.create(
            owner=source.owner,
            course=source.course,
            file=source.file,
            name=name[:255],
            type=source.type,
            folder=source.folder,
            category=source.category,
            size_kb=source.size_kb,
            url=source.url,
            favorite=False,
            status=Resource.STATUS_ACTIVE,
        )
        return Response(
            self.get_serializer(copy).data, status=status.HTTP_201_CREATED
        )


# --- Kutubxona: talaba -----------------------------------------------------


class StudentCourseResourceView(APIView):
    """`GET /student/courses/{id}/resources` — kursga yozilganlar uchun."""

    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        if not Enrollment.objects.filter(user=request.user, course_id=course_id).exists():
            raise NotFound("Bu kursga yozilmagansiz")

        rows = Resource.objects.filter(
            course_id=course_id, status=Resource.STATUS_ACTIVE
        ).select_related("file")
        return Response(ResourceSerializer(rows, many=True, context={"request": request}).data)


# --- Avatar ----------------------------------------------------------------


class AvatarView(APIView):
    """`PUT /users/me/avatar` — M1 dan qolgan, M5 ni kutgan endpoint.

    Ko'rinish `accounts` da emas, SHU YERDA: u butunlay fayl moduliga
    tayanadi va `accounts` ni `resources` ga bog'lash aylanma import
    berardi (`resources` allaqachon `accounts` ga tayanadi).
    """

    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = AvatarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data["file"]

        if file.owner_id != request.user.id:
            raise NotFound("Fayl topilmadi")
        if file.purpose != PURPOSE_AVATAR:
            raise ValidationError({"file": "Bu fayl avatar sifatida yuklanmagan"})
        if file.status != File.STATUS_READY:
            raise ValidationError({"file": "Fayl yuklab bo'linmagan"})

        # Eski rasm diskda qolib ketmasin — har almashtirishda bittadan
        # yetim fayl to'planardi
        previous = request.user.avatar_file
        request.user.avatar_file = file
        request.user.avatar = isloh_download_url(file)
        request.user.save(update_fields=["avatar_file", "avatar", "updated_at"])

        if previous and previous.pk != file.pk:
            isloh_storage().delete(previous.storage_key)
            previous.delete()

        return Response(UserSerializer(request.user).data)

    def delete(self, request):
        """Rasmni olib tashlash — profil bosh harflarga qaytadi."""
        previous = request.user.avatar_file
        request.user.avatar_file = None
        request.user.avatar = ""
        request.user.save(update_fields=["avatar_file", "avatar", "updated_at"])

        if previous:
            isloh_storage().delete(previous.storage_key)
            previous.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- Dars videosi ----------------------------------------------------------


class LessonVideoView(APIView):
    """`PUT /instructor/lessons/{id}/video` — darsga video biriktiradi."""

    permission_classes = [IsAuthenticated, IsInstructor]

    def put(self, request, lesson_id):
        from apps.courses.models import Lesson

        lesson = Lesson.objects.filter(
            pk=lesson_id, module__course__owner=request.user
        ).select_related("video_file").first()
        if lesson is None:
            raise NotFound("Dars topilmadi")

        file = File.objects.filter(
            pk=request.data.get("file"), owner=request.user
        ).first()
        if file is None:
            raise NotFound("Fayl topilmadi")
        # Maqsad yuklashdagi CHEGARANI belgilagan edi (rules.py) — resurs
        # sifatida yuklangan 200 MB lik arxivni darsga video deb qo'yib
        # bo'lmaydi
        if file.purpose != PURPOSE_LESSON_VIDEO:
            raise ValidationError({"file": "Bu fayl dars videosi sifatida yuklanmagan"})
        if file.status != File.STATUS_READY:
            raise ValidationError({"file": "Fayl yuklab bo'linmagan"})

        previous = lesson.video_file
        lesson.video_file = file
        lesson.save(update_fields=["video_file", "updated_at"])

        if previous and previous.pk != file.pk:
            isloh_storage().delete(previous.storage_key)
            previous.delete()

        return Response({"id": str(lesson.id), "video_url": isloh_download_url(file)})
