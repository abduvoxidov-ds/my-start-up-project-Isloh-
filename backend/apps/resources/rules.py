"""
ISLOH — yuklash qoidalari (M5).

Reja M5: "MIME va hajm chegarasi SERVERDA". Frontendda ular allaqachon bor
(`assignments.max_size_mb`, `file_types`, avatar uchun 4 MB) — lekin
frontenddagi tekshiruv faqat qulaylik: `presign` ga to'g'ridan-to'g'ri
so'rov yuborgan odam uni umuman ko'rmaydi.

CHEGARA IKKI MARTA TEKSHIRILADI:
  1. `presign` da — mijoz E'LON QILGAN hajm bo'yicha. Bu tejamkorlik:
     2 GB lik faylni yuklab bo'lgandan keyin rad etish behuda.
  2. `complete` da — DISKDAGI haqiqiy hajm bo'yicha. Bu esa xavfsizlik:
     e'lon qilingan hajm shunchaki mijoz aytgan son.

KENGAYTMA, MIME EMAS — nega. `Content-Type` ni mijoz o'zi yozadi va uni
istalgancha o'zgartirishi mumkin. Kengaytma esa faylning qayerda va qanday
ochilishini belgilaydi, ya'ni haqiqiy xavf o'sha yerda. MIME baribir
saqlanadi (yuklab olishda qaytariladi), lekin qaror kengaytma bo'yicha
qabul qilinadi.

SVG AVATAR SIFATIDA QABUL QILINMAYDI. SVG — bu XML va uning ichida
`<script>` bo'lishi mumkin; avatar esa yagona INLINE ko'rsatiladigan tur
(qolgan hammasi `Content-Disposition: attachment` bilan ketadi). Boshqa
foydalanuvchining profilini ochgan odam o'sha skriptni o'z sessiyasida
ishga tushirardi.
"""

from rest_framework.exceptions import ValidationError

from .models import (
    PURPOSE_AVATAR,
    PURPOSE_LESSON_VIDEO,
    PURPOSE_RESOURCE,
    PURPOSE_SUBMISSION,
)
from .storage import isloh_safe_extension

MB = 1024 * 1024

# Kengaytma -> kutubxonadagi tur. js/resource-manager.js dagi
# ISLOH_RESOURCE_EXT_TYPES bilan bir xil ro'yxat: turni endi SERVER
# aniqlaydi, mijoz yuborgan `type` esa e'tiborga olinmaydi.
EXT_TO_TYPE = {
    ".pdf": "pdf",
    ".zip": "zip", ".rar": "zip", ".7z": "zip", ".tar": "zip", ".gz": "zip",
    ".mp4": "video", ".mov": "video", ".avi": "video", ".webm": "video", ".m4v": "video",
    ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".ogg": "audio",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image",
    ".webp": "image", ".svg": "image",
    ".ppt": "presentation", ".pptx": "presentation", ".odp": "presentation",
    ".xls": "spreadsheet", ".xlsx": "spreadsheet", ".csv": "spreadsheet", ".ods": "spreadsheet",
    ".doc": "document", ".docx": "document", ".txt": "document", ".rtf": "document", ".odt": "document",
    ".py": "code", ".js": "code", ".ts": "code", ".yml": "code", ".yaml": "code",
    ".json": "code", ".sh": "code", ".sql": "code", ".md": "code", ".css": "code",
}

# Rasm turlari — avatar uchun. `.svg` ATAYLAB yo'q (fayl boshidagi izoh).
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}

# Umumiy oq ro'yxat: bajariladigan formatlar (.exe, .bat, .dll, .msi, .apk)
# va HTML ATAYLAB yo'q — `.html` yuklab olinganda emas, ochilganda ishga
# tushadi va bizning domenimizda turadi.
GENERAL_EXTS = set(EXT_TO_TYPE.keys())

UPLOAD_RULES = {
    # 4 MB — js/profile.js dagi ISLOH_AVATAR_MAX_BYTES bilan bir xil
    PURPOSE_AVATAR: {"max_bytes": 4 * MB, "extensions": IMAGE_EXTS},
    PURPOSE_RESOURCE: {"max_bytes": 200 * MB, "extensions": GENERAL_EXTS},
    PURPOSE_LESSON_VIDEO: {"max_bytes": 2048 * MB, "extensions": VIDEO_EXTS},
    # Topshiriqning O'Z chegarasi bor (`max_size_mb`, `file_types`) va u shu
    # sukut qiymatlarning ustiga qo'yiladi — pastdagi `isloh_rules_for` ga
    # qarang
    PURPOSE_SUBMISSION: {"max_bytes": 25 * MB, "extensions": GENERAL_EXTS},
}


def isloh_resource_type(name):
    """Fayl nomidan kutubxona turi (`pdf`, `video`, ...)."""
    return EXT_TO_TYPE.get(isloh_safe_extension(name), "document")


def isloh_rules_for(purpose, assignment=None):
    """Maqsad bo'yicha chegara. Topshiriq berilsa — uning sozlamalari.

    `file_types` frontendda `[".pdf", ".zip"]` ko'rinishida saqlanadi
    (js/assignment-store.js). Bo'sh bo'lsa umumiy oq ro'yxat qoladi:
    "cheklov yo'q" degani "hamma narsa mumkin" degani emas.
    """
    rules = dict(UPLOAD_RULES.get(purpose, UPLOAD_RULES[PURPOSE_RESOURCE]))
    if assignment is None:
        return rules

    if assignment.max_size_mb:
        rules["max_bytes"] = assignment.max_size_mb * MB

    declared = [str(item).strip().lower() for item in (assignment.file_types or []) if item]
    if declared:
        allowed = {item if item.startswith(".") else "." + item for item in declared}
        # Topshiriq faqat TORAYTIRA oladi: o'qituvchi `.exe` yozib qo'ysa
        # ham u umumiy oq ro'yxatdan o'tmaydi
        rules["extensions"] = allowed & GENERAL_EXTS
    return rules


def isloh_validate_upload(name, size_bytes, purpose, assignment=None):
    """Nom va hajmni tekshiradi; xato bo'lsa 400 (§0.2 shaklida).

    Xato matni MAYDON ostida ko'rinadi, shuning uchun u aniq: nima mumkin
    emasligini emas, nima MUMKINligini aytadi.
    """
    rules = isloh_rules_for(purpose, assignment)
    extension = isloh_safe_extension(name)

    if not str(name).strip():
        raise ValidationError({"name": "Fayl nomi bo'sh"})

    if extension not in rules["extensions"]:
        allowed = ", ".join(sorted(rules["extensions"])[:12])
        raise ValidationError({"name": f"Bu turdagi fayl qabul qilinmaydi. Ruxsat etilgan: {allowed}"})

    size = int(size_bytes or 0)
    if size <= 0:
        raise ValidationError({"size_bytes": "Fayl hajmi noma'lum"})

    if size > rules["max_bytes"]:
        raise ValidationError(
            {"size_bytes": f"Fayl hajmi {rules['max_bytes'] // MB} MB dan oshmasligi kerak"}
        )

    return rules
