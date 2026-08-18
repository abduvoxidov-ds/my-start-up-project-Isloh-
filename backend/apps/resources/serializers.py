"""
ISLOH — fayl va resurs serializerlari (M5).

Frontend shakli js/resource-store.js da: `sizeKb`, `uploadedAt`, `usedAt`.
API o'z toza shaklida (snake_case) qoladi va ikkalasi FAQAT ikki
funksiyada uchrashadi — `isloh_normalizeResource` / `isloh_serializeResource`
(M2 dagi 2-qaror).
"""

from rest_framework import serializers

from apps.courses.models import Course

from .models import (
    PURPOSE_CHOICES,
    File,
    Resource,
)
from .rules import isloh_resource_type


def isloh_download_url(file):
    """Yuklab olish manzili. Fayl `pending` bo'lsa manzil BERILMAYDI —
    baytlar hali yo'q va havola 404 qaytarardi."""
    if not file or file.status != File.STATUS_READY:
        return ""
    return f"/api/v1/files/{file.id}/download"


class FileSerializer(serializers.ModelSerializer):
    size_kb = serializers.IntegerField(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = File
        fields = [
            "id",
            "purpose",
            "name",
            "content_type",
            "size_bytes",
            "size_kb",
            "status",
            "download_url",
            "created_at",
        ]
        # `storage_key` UMUMAN BERILMAYDI: u ichki yo'l va tashqariga
        # chiqishi kerak emas. Qolgani ham server qo'yadigan qiymatlar.
        read_only_fields = fields

    def get_download_url(self, obj):
        return isloh_download_url(obj)


class PresignSerializer(serializers.Serializer):
    """`POST /uploads/presign` tanasi.

    `size_bytes` — mijoz E'LON QILGAN hajm. Unga ishonilmaydi: u faqat
    katta faylni yuklashdan OLDIN rad etish uchun; haqiqiy tekshiruv
    `complete` da, diskdagi hajm bo'yicha (apps/resources/rules.py).
    """

    purpose = serializers.ChoiceField(choices=[key for key, _ in PURPOSE_CHOICES])
    name = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=120, required=False, allow_blank=True)
    size_bytes = serializers.IntegerField(min_value=1)
    # Faqat `purpose="submission"` da: chegarani topshiriq belgilaydi
    assignment = serializers.UUIDField(required=False, allow_null=True)


class ResourceSerializer(serializers.ModelSerializer):
    """Kutubxona yozuvi — js/resource-store.js do'koni uchun.

    `type` va `size_kb` MIJOZDAN QABUL QILINMAYDI. Ikkalasi ham faylning
    o'zidan kelib chiqadi: aks holda 4 KB lik matn fayli "PDF · 2 GB" bo'lib
    ko'rinishi mumkin edi va kutubxona statistikasi yolg'on ko'rsatardi.
    """

    file = serializers.PrimaryKeyRelatedField(
        queryset=File.objects.all(), required=False, allow_null=True
    )
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())

    type = serializers.CharField(read_only=True)
    size_kb = serializers.IntegerField(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = [
            "id",
            "course",
            "file",
            "name",
            "type",
            "folder",
            "category",
            "size_kb",
            "url",
            "favorite",
            "status",
            "used_at",
            "download_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "type", "size_kb", "download_url", "created_at", "updated_at"]

    def get_download_url(self, obj):
        return isloh_download_url(obj.file)

    def validate_course(self, course):
        if course.owner_id != self.context["request"].user.id:
            # Begona kurs — 404 emas, 400: bu yerda kurs id'sini MIJOZ
            # yubordi, ya'ni u shunday kurs borligini allaqachon biladi
            raise serializers.ValidationError("Bu kurs sizga tegishli emas")
        return course

    def validate_file(self, file):
        if file is None:
            return None
        user = self.context["request"].user
        if file.owner_id != user.id:
            raise serializers.ValidationError("Bu fayl sizga tegishli emas")
        if file.status != File.STATUS_READY:
            raise serializers.ValidationError("Fayl yuklab bo'linmagan")
        return file

    def validate(self, attrs):
        """Resurs YO fayl, YO tashqi havola bo'ladi.

        Ikkalasi ham bo'lmasa kutubxonada ochib bo'lmaydigan qator paydo
        bo'lardi; ikkalasi ham bo'lsa "Ochish" tugmasi qaysi biriga
        borishi noaniq qolardi.
        """
        # Qisman yangilashda (PATCH) mavjud qiymat hisobga olinadi
        instance = self.instance
        file = attrs.get("file", getattr(instance, "file", None))
        url = attrs.get("url", getattr(instance, "url", "") or "")

        if not file and not url:
            raise serializers.ValidationError({"form": "Fayl tanlang yoki havola kiriting"})
        if file and url:
            raise serializers.ValidationError({"form": "Fayl va havola birga bo'lmaydi"})

        return attrs

    def _derive(self, validated, instance=None):
        """Turni va hajmni SERVER qo'yadi (sinf izohiga qarang)."""
        file = validated.get("file", getattr(instance, "file", None))
        url = validated.get("url", getattr(instance, "url", "") or "")

        if file:
            # Tur faylning HAQIQIY nomidan — resursni qayta nomlash uni
            # o'zgartirmaydi
            validated["type"] = isloh_resource_type(file.name)
            validated["size_kb"] = file.size_kb
            if not validated.get("name") and not instance:
                validated["name"] = file.name
        elif url:
            validated["type"] = "url"
            validated["size_kb"] = 0
        return validated

    def create(self, validated_data):
        validated_data = self._derive(validated_data)
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._derive(validated_data, instance)
        return super().update(instance, validated_data)


class AvatarSerializer(serializers.Serializer):
    """`PUT /users/me/avatar` — yuklangan faylni profil rasmiga bog'laydi."""

    file = serializers.PrimaryKeyRelatedField(queryset=File.objects.all())
