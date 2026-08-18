"""
ISLOH — sharh va muhokama serializerlari (M6).

MATN IKKI JOYDA TOZALANADI, lekin BU YERDA — saqlashdan oldin
(`apps/core/sanitize.py` dagi izohga qarang: bu ikkinchi qatlam, asosiy
himoya chizishdagi ekranlash).

MUALLIF HAR DOIM BIR XIL SHAKLDA qaytadi (`isloh_author_payload`): id, ism,
avatar va ROL. Rol saqlanmaydi — u mavzu/sharh kursining egasi bilan
solishtirib hisoblanadi, chunki bitta odam bir kursda o'qituvchi, boshqa
kursda talaba bo'lishi mumkin (M1 dagi "rol alohida jadvalda" qarori).
"""

from rest_framework import serializers

from apps.core.sanitize import isloh_clean_text
from apps.courses.models import Course

from .models import (
    DiscussionReply,
    DiscussionThread,
    Review,
    ReviewReply,
)

ISLOH_TEXT_MAX = 5000
ISLOH_TITLE_MAX = 200


def isloh_author_payload(user, course_owner_id):
    """Muallif bloki — sharhda ham, javobda ham bir xil."""
    if user is None:
        return None
    return {
        "id": str(user.id),
        "name": user.full_name,
        "avatar": user.avatar,
        # Frontenddagi `.role-badge instructor|student`
        "role": "instructor" if user.id == course_owner_id else "student",
    }


# --- Sharhlar ---------------------------------------------------------------


class ReviewReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewReply
        fields = ["id", "text", "created_at"]
        read_only_fields = fields


class ReviewSerializer(serializers.ModelSerializer):
    """Sharh — js/review-store.js do'koni uchun.

    `course` faqat YARATISHDA yoziladi: mavjud sharhni boshqa kursga
    ko'chirish `UNIQUE(course, user)` cheklovini chetlab o'tish yo'li
    bo'lardi (bitta odam bir kursga ikkinchi sharh yozib olardi).
    """

    # `required=False` — kurs MANZILDAN keladi
    # (`POST /courses/{id}/reviews`), tanadan emas. Maydonning o'zi javobda
    # kerak (do'kon uni `courseId` ga o'giradi), shuning uchun `read_only`
    # qilinmadi; o'zgartirishni esa `validate` bloklaydi.
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all(), required=False)
    author = serializers.SerializerMethodField()
    student_name = serializers.CharField(source="user.full_name", read_only=True)
    avatar = serializers.CharField(source="user.avatar", read_only=True)
    reply = ReviewReplySerializer(read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "course",
            "course_title",
            "author",
            "student_name",
            "avatar",
            "rating",
            "text",
            "reply",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "course_title",
            "author",
            "student_name",
            "avatar",
            "reply",
            "created_at",
            "updated_at",
        ]

    def get_author(self, obj):
        return isloh_author_payload(obj.user, obj.course.owner_id)

    def validate_text(self, value):
        return isloh_clean_text(value, ISLOH_TEXT_MAX)

    def validate(self, attrs):
        if self.instance is not None and "course" in attrs:
            if attrs["course"].pk != self.instance.course_id:
                raise serializers.ValidationError({"course": "Sharhning kursini o'zgartirib bo'lmaydi"})
        return attrs


class ReviewReplyWriteSerializer(serializers.Serializer):
    """`POST /instructor/reviews/{id}/reply`."""

    text = serializers.CharField(max_length=ISLOH_TEXT_MAX, allow_blank=False)

    def validate_text(self, value):
        cleaned = isloh_clean_text(value, ISLOH_TEXT_MAX)
        if not cleaned:
            raise serializers.ValidationError("Javob matnini kiriting")
        return cleaned


# --- Muhokamalar ------------------------------------------------------------


class DiscussionReplySerializer(serializers.ModelSerializer):
    """Javob. `like_count` va `liked` SO'ROVDA hisoblanadi (annotate) —
    har qator uchun alohida sanash N+1 bo'lardi."""

    author = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True)
    liked = serializers.BooleanField(read_only=True)

    class Meta:
        model = DiscussionReply
        fields = [
            "id",
            "thread",
            "parent",
            "author",
            "text",
            "is_accepted",
            "is_pinned",
            "like_count",
            "liked",
            "created_at",
        ]
        # Qabul qilingan/qadalgan — alohida amal, oddiy yozuvda emas:
        # aks holda javob muallifi o'z javobini "qabul qilingan" deb
        # belgilab qo'yardi
        read_only_fields = [
            "id",
            "thread",
            "author",
            "is_accepted",
            "is_pinned",
            "like_count",
            "liked",
            "created_at",
        ]

    def get_author(self, obj):
        return isloh_author_payload(obj.author, self.context.get("course_owner_id"))

    def validate_text(self, value):
        cleaned = isloh_clean_text(value, ISLOH_TEXT_MAX)
        if not cleaned:
            raise serializers.ValidationError("Javob matnini kiriting")
        return cleaned


class DiscussionThreadSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    module_title = serializers.CharField(source="module.title", read_only=True, default="")
    like_count = serializers.IntegerField(read_only=True)
    reply_count = serializers.IntegerField(read_only=True)
    liked = serializers.BooleanField(read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = DiscussionThread
        fields = [
            "id",
            "course",
            "module",
            "module_title",
            "author",
            "kind",
            "title",
            "body",
            "category",
            "is_pinned",
            "is_solved",
            "like_count",
            "reply_count",
            "liked",
            "replies",
            "created_at",
            "updated_at",
        ]
        # Qadash va "hal qilindi" — alohida amal (ruxsati boshqa)
        read_only_fields = [
            "id",
            "module_title",
            "author",
            "is_pinned",
            "is_solved",
            "like_count",
            "reply_count",
            "liked",
            "replies",
            "created_at",
            "updated_at",
        ]

    def get_author(self, obj):
        return isloh_author_payload(obj.author, obj.course.owner_id)

    def get_replies(self, obj):
        """Javoblar mavzu bilan BIRGA keladi.

        Alohida so'rov qilinmadi: sahifa ro'yxatdagi har bir mavzuni
        javoblari bilan chizadi ("6 ta javobni ko'rish" bosilganda ular
        allaqachon DOM'da) va har mavzu uchun so'rov yuborish o'nlab
        so'rov bo'lardi.
        """
        rows = getattr(obj, "prefetched_replies", None)
        if rows is None:
            rows = obj.replies.all()
        return DiscussionReplySerializer(
            rows, many=True, context={"course_owner_id": obj.course.owner_id}
        ).data

    def validate_title(self, value):
        cleaned = isloh_clean_text(value, ISLOH_TITLE_MAX)
        if not cleaned:
            raise serializers.ValidationError("Sarlavhani kiriting")
        return cleaned

    def validate_body(self, value):
        return isloh_clean_text(value, ISLOH_TEXT_MAX)

    def validate_category(self, value):
        return isloh_clean_text(value, 60)

    def validate(self, attrs):
        if self.instance is not None and "course" in attrs:
            if attrs["course"].pk != self.instance.course_id:
                raise serializers.ValidationError({"course": "Mavzuning kursini o'zgartirib bo'lmaydi"})
        return attrs
