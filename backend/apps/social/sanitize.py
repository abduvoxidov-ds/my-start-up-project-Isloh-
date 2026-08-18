"""
ISLOH — foydalanuvchi matnini tozalash (M6).

M6 DAN BOSHLAB MATN BOSHQA FOYDALANUVCHIDAN KELADI. Shu paytgacha
frontenddagi barcha matn o'z egasining ma'lumoti edi (o'z kursi, o'z izohi)
— eng yomon holatda odam o'z sahifasini buzardi. Sharh va muhokama esa
BEGONA odamning ekranida chiziladi.

IKKI QATLAM, va ularning ROLLARI HAR XIL:

  1. **Chizishda ekranlash** — ASOSIY himoya. Matn `isloh_escapeHtml`
     (js/escape.js) orqali o'tadi va HTML sifatida umuman talqin
     qilinmaydi. Xavfsizlik shu yerda hal bo'ladi.
  2. **Saqlashda tozalash** — SHU FAYL. Bazaga teg tushmasin: kelajakda
     biror ko'rinish (eksport, email, admin paneli, boshqa mijoz) matnni
     ekranlashni unutsa, u yerda ham zarar bo'lmasin.

`strip_tags` ni YAGONA himoya deb hisoblash MUMKIN EMAS va Django hujjati
buni ochiq aytadi (masalan `<<b>b>` kabi ichma-ich yozuvlar bir marta
qo'llanganda to'liq tozalanmaydi). Aynan shuning uchun u bu yerda IKKINCHI
qatlam: birinchisi — ekranlash, u har qanday holatda ishlaydi.
"""

import re

from django.utils.html import strip_tags

# Ketma-ket 3+ bo'sh qator — bitta bo'sh qatorga. Muhokamada uzun "bo'sh"
# post bilan sahifani cho'zib yuborish oddiy bezovtalik usuli.
ISLOH_BLANK_LINES = re.compile(r"\n{3,}")

# Nazorat belgilari (tab va yangi qatordan tashqari) — ko'rinmas, lekin
# nomni yoki matnni buzib ko'rsatishi mumkin
ISLOH_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def isloh_clean_text(value, max_length=None):
    """Foydalanuvchi matnini saqlashga tayyorlaydi.

    Teglar OLIB TASHLANADI, matn esa o'zgarmaydi: `a < b` shundayligicha
    qoladi (u teg emas), `<script>alert(1)</script>` esa `alert(1)` bo'lib
    qoladi — ya'ni odam nima yozganini ko'rib turadi, lekin brauzer uni
    hech qachon kod deb o'qimaydi.
    """
    text = strip_tags(str(value or ""))
    text = ISLOH_CONTROL_CHARS.sub("", text)
    text = ISLOH_BLANK_LINES.sub("\n\n", text).strip()
    if max_length:
        text = text[:max_length]
    return text
