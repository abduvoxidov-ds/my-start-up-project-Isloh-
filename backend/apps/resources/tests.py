"""
ISLOH — fayl va resurs testlari (M5).

BIRINCHI NAVBATDAGI QOIDA: yuklangan faylni FAQAT unga haqli odam ola
oladi. `DownloadPermissionTests` aynan shuni qulflaydi — u buzilsa
kursga yozilmagan (ya'ni pul to'lamagan) odam butun kutubxonani yuklab
olardi.

Ikkinchi qoida: chegarani MIJOZ belgilamaydi. Hajm ham, tur ham serverda
tekshiriladi va tekshiruv IKKI MARTA bo'ladi — e'lon qilingan hajm
bo'yicha (tejamkorlik) va diskdagi haqiqiy hajm bo'yicha (xavfsizlik).
"""

import shutil
import tempfile
from unittest.mock import patch

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import ROLE_INSTRUCTOR, ROLE_STUDENT, User, UserRole
from apps.assessment.models import Assignment, Submission
from apps.courses.models import STATUS_PUBLISHED, Course, CourseSettings
from apps.learning.models import Enrollment
from apps.resources.models import (
    PURPOSE_AVATAR,
    PURPOSE_LESSON_VIDEO,
    PURPOSE_RESOURCE,
    PURPOSE_SUBMISSION,
    File,
    Resource,
)
from apps.resources.rules import GENERAL_EXTS, UPLOAD_RULES

PRESIGN = "/api/v1/uploads/presign"
RESOURCES = "/api/v1/instructor/resources"
AVATAR = "/api/v1/users/me/avatar"


def make_user(email, role):
    user = User.objects.create_user(email=email, password="TestParol2026!", full_name="Test")
    UserRole.objects.create(user=user, role=role)
    return user


def make_course(owner):
    course = Course.objects.create(
        owner=owner,
        slug=f"kurs-{Course.objects.count() + 1}",
        title="Kurs",
        description="Tavsif",
        price_cents=1000,
        status=STATUS_PUBLISHED,
    )
    CourseSettings.objects.create(course=course)
    return course


# Har bir sinf o'z vaqtinchalik `MEDIA_ROOT` ida ishlaydi — testlar
# repodagi haqiqiy `backend/media/` ga fayl qoldirmasin
class UploadTestCase(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media = tempfile.mkdtemp(prefix="isloh-test-media-")
        cls._override = override_settings(MEDIA_ROOT=cls._media)
        cls._override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._override.disable()
        shutil.rmtree(cls._media, ignore_errors=True)
        super().tearDownClass()

    def upload(self, name, content, purpose=PURPOSE_RESOURCE, assignment=None):
        """Uch qadamli oqim: presign -> PUT -> complete."""
        body = {"purpose": purpose, "name": name, "size_bytes": len(content)}
        if assignment is not None:
            body["assignment"] = str(assignment.id)

        presigned = self.client.post(PRESIGN, body)
        self.assertEqual(presigned.status_code, status.HTTP_201_CREATED, presigned.data)

        file_id = presigned.data["file"]["id"]
        put = self.client.put(
            presigned.data["upload_url"], content, content_type="application/octet-stream"
        )
        self.assertEqual(put.status_code, status.HTTP_204_NO_CONTENT, put.data)

        done = self.client.post(f"/api/v1/uploads/{file_id}/complete")
        self.assertEqual(done.status_code, status.HTTP_200_OK, done.data)
        return done.data


class UploadFlowTests(UploadTestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(self.instructor)

    def test_uch_qadamli_oqim_faylni_saqlaydi(self):
        data = self.upload("qollanma.pdf", b"%PDF-1.4 salom")

        self.assertEqual(data["status"], "ready")
        self.assertEqual(data["size_bytes"], 14)
        self.assertEqual(data["name"], "qollanma.pdf")
        self.assertTrue(data["download_url"].endswith("/download"))

    def test_presign_hajmni_rad_etadi(self):
        res = self.client.post(PRESIGN, {
            "purpose": PURPOSE_AVATAR, "name": "rasm.png", "size_bytes": 50 * 1024 * 1024,
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("size_bytes", res.data["error"]["fields"])

    def test_bajariladigan_fayl_qabul_qilinmaydi(self):
        res = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "virus.exe", "size_bytes": 10,
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", res.data["error"]["fields"])

    def test_svg_avatar_sifatida_qabul_qilinmaydi(self):
        """SVG ichida `<script>` bo'lishi mumkin, avatar esa yagona INLINE
        ko'rsatiladigan tur (apps/resources/rules.py)."""
        res = self.client.post(PRESIGN, {
            "purpose": PURPOSE_AVATAR, "name": "avatar.svg", "size_bytes": 10,
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        ok = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "chizma.svg", "size_bytes": 10,
        })
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)

    def test_hajm_diskdagi_haqiqiy_qiymatdan_olinadi(self):
        """E'lon qilingan hajm — shunchaki mijoz aytgan son."""
        presigned = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "fayl.txt", "size_bytes": 999999,
        })
        file_id = presigned.data["file"]["id"]
        self.client.put(
            presigned.data["upload_url"], b"qisqa", content_type="application/octet-stream"
        )
        done = self.client.post(f"/api/v1/uploads/{file_id}/complete")
        self.assertEqual(done.data["size_bytes"], 5)

    def test_yuklash_paytida_chegara_tekshiriladi(self):
        """Yolg'on `size_bytes` yozgan mijoz diskni to'ldira olmaydi."""
        with patch.dict(UPLOAD_RULES, {
            PURPOSE_RESOURCE: {"max_bytes": 10, "extensions": GENERAL_EXTS}
        }):
            presigned = self.client.post(PRESIGN, {
                "purpose": PURPOSE_RESOURCE, "name": "fayl.txt", "size_bytes": 8,
            })
            self.assertEqual(presigned.status_code, status.HTTP_201_CREATED)

            put = self.client.put(
                presigned.data["upload_url"], b"x" * 40, content_type="application/octet-stream"
            )
            self.assertEqual(put.status_code, status.HTTP_400_BAD_REQUEST)

    def test_complete_chegaradan_oshgan_faylni_tozalaydi(self):
        presigned = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "fayl.txt", "size_bytes": 40,
        })
        file_id = presigned.data["file"]["id"]
        self.client.put(
            presigned.data["upload_url"], b"x" * 40, content_type="application/octet-stream"
        )

        with patch.dict(UPLOAD_RULES, {
            PURPOSE_RESOURCE: {"max_bytes": 10, "extensions": GENERAL_EXTS}
        }):
            done = self.client.post(f"/api/v1/uploads/{file_id}/complete")

        self.assertEqual(done.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(File.objects.filter(pk=file_id).exists())

    def test_bosh_fayl_qabul_qilinmaydi(self):
        presigned = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "fayl.txt", "size_bytes": 10,
        })
        put = self.client.put(
            presigned.data["upload_url"], b"", content_type="application/octet-stream"
        )
        self.assertEqual(put.status_code, status.HTTP_400_BAD_REQUEST)

    def test_soxta_yuklash_havolasi_404(self):
        res = self.client.put(
            "/api/v1/uploads/local/soxta-token", b"x", content_type="application/octet-stream"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_tayyor_faylni_qayta_yozib_bolmaydi(self):
        presigned = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "fayl.txt", "size_bytes": 3,
        })
        file_id = presigned.data["file"]["id"]
        self.client.put(presigned.data["upload_url"], b"bir", content_type="application/octet-stream")
        self.client.post(f"/api/v1/uploads/{file_id}/complete")

        again = self.client.put(
            presigned.data["upload_url"], b"boshqa", content_type="application/octet-stream"
        )
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

    def test_yuklanmagan_faylni_yakunlab_bolmaydi(self):
        presigned = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "fayl.txt", "size_bytes": 3,
        })
        done = self.client.post(f"/api/v1/uploads/{presigned.data['file']['id']}/complete")
        self.assertEqual(done.status_code, status.HTTP_400_BAD_REQUEST)

    def test_begona_faylni_yakunlab_bolmaydi(self):
        presigned = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "fayl.txt", "size_bytes": 3,
        })
        file_id = presigned.data["file"]["id"]

        self.client.force_authenticate(make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR))
        done = self.client.post(f"/api/v1/uploads/{file_id}/complete")
        self.assertEqual(done.status_code, status.HTTP_404_NOT_FOUND)

    def test_saqlash_kaliti_javobga_chiqmaydi(self):
        """`storage_key` — ichki yo'l, tashqariga chiqmaydi."""
        data = self.upload("fayl.txt", b"salom")
        self.assertNotIn("storage_key", data)

    def test_avtorizatsiyasiz_401(self):
        self.client.force_authenticate(None)
        res = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "fayl.txt", "size_bytes": 3,
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class DownloadPermissionTests(UploadTestCase):
    """M5 ning eng muhim testi — begona odam faylni ololmaydi."""

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.course = make_course(self.instructor)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.outsider = make_user("begona@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=self.student, course=self.course)

        self.client.force_authenticate(self.instructor)
        file_data = self.upload("qollanma.pdf", b"mazmun")
        self.file = File.objects.get(pk=file_data["id"])
        self.resource = Resource.objects.create(
            owner=self.instructor, course=self.course, file=self.file,
            name="qollanma.pdf", type="pdf", size_kb=self.file.size_kb,
        )
        self.url = f"/api/v1/files/{self.file.id}/download"

    def _get(self, user):
        self.client.force_authenticate(user)
        return self.client.get(self.url)

    def test_yozilgan_talaba_oladi(self):
        res = self._get(self.student)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(res.streaming_content), b"mazmun")

    def test_yozilmagan_talaba_404(self):
        """403 EMAS: 403 javobning o'zi fayl borligini oshkor qilardi."""
        self.assertEqual(self._get(self.outsider).status_code, status.HTTP_404_NOT_FOUND)

    def test_egasi_har_doim_oladi(self):
        self.assertEqual(self._get(self.instructor).status_code, status.HTTP_200_OK)

    def test_arxivlangan_resursni_talaba_ololmaydi(self):
        self.resource.status = Resource.STATUS_ARCHIVED
        self.resource.save()

        self.assertEqual(self._get(self.student).status_code, status.HTTP_404_NOT_FOUND)
        # O'qituvchi o'zi ko'raveradi
        self.assertEqual(self._get(self.instructor).status_code, status.HTTP_200_OK)

    def test_kutubxonaga_bogliq_bolmagan_fayl_talabaga_korinmaydi(self):
        self.resource.delete()
        self.assertEqual(self._get(self.student).status_code, status.HTTP_404_NOT_FOUND)

    def test_tugallanmagan_fayl_yuklab_olinmaydi(self):
        self.client.force_authenticate(self.instructor)
        presigned = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "yarim.pdf", "size_bytes": 3,
        })
        pending = self.client.get(f"/api/v1/files/{presigned.data['file']['id']}/download")
        self.assertEqual(pending.status_code, status.HTTP_404_NOT_FOUND)

    def test_avtorizatsiyasiz_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_fayl_ilova_sifatida_beriladi(self):
        """Yuklangan fayl brauzerda OCHILMAYDI — u boshqa foydalanuvchidan
        kelgan mazmun."""
        res = self._get(self.student)
        self.assertIn("attachment", res["Content-Disposition"])
        self.assertEqual(res["X-Content-Type-Options"], "nosniff")


class AvatarTests(UploadTestCase):
    def setUp(self):
        self.user = make_user("t@isloh.uz", ROLE_STUDENT)
        self.client.force_authenticate(self.user)

    def test_avatar_biriktiriladi_va_inline_beriladi(self):
        file_data = self.upload("men.png", b"\x89PNG rasm", purpose=PURPOSE_AVATAR)

        res = self.client.put(AVATAR, {"file": file_data["id"]})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["avatar"], file_data["download_url"])

        download = self.client.get(file_data["download_url"])
        self.assertIn("inline", download["Content-Disposition"])

    def test_avatarni_hamma_kora_oladi(self):
        """Avatar sharhlarda, chatda va katalogda ko'rinadi."""
        file_data = self.upload("men.png", b"rasm", purpose=PURPOSE_AVATAR)
        self.client.put(AVATAR, {"file": file_data["id"]})

        self.client.force_authenticate(make_user("boshqa@isloh.uz", ROLE_STUDENT))
        self.assertEqual(self.client.get(file_data["download_url"]).status_code, status.HTTP_200_OK)

    def test_avatar_avtorizatsiyasiz_ham_beriladi(self):
        """`<img src>` `Authorization` sarlavhasini yubora olmaydi — token
        talab qilinsa yuklangan avatar hech qachon ko'rinmasdi
        (apps/resources/permissions.py -> isloh_is_public_file)."""
        file_data = self.upload("men.png", b"rasm", purpose=PURPOSE_AVATAR)
        self.client.put(AVATAR, {"file": file_data["id"]})

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(file_data["download_url"]).status_code, status.HTTP_200_OK)

    def test_boshqa_maqsaddagi_fayl_avatar_bolmaydi(self):
        file_data = self.upload("hujjat.pdf", b"mazmun")
        res = self.client.put(AVATAR, {"file": file_data["id"]})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_begona_fayl_avatar_bolmaydi(self):
        file_data = self.upload("men.png", b"rasm", purpose=PURPOSE_AVATAR)

        self.client.force_authenticate(make_user("boshqa@isloh.uz", ROLE_STUDENT))
        res = self.client.put(AVATAR, {"file": file_data["id"]})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_almashtirilgan_avatar_diskda_qolmaydi(self):
        birinchi = self.upload("bir.png", b"rasm-1", purpose=PURPOSE_AVATAR)
        self.client.put(AVATAR, {"file": birinchi["id"]})

        ikkinchi = self.upload("ikki.png", b"rasm-2", purpose=PURPOSE_AVATAR)
        self.client.put(AVATAR, {"file": ikkinchi["id"]})

        self.assertFalse(File.objects.filter(pk=birinchi["id"]).exists())

    def test_avatarni_olib_tashlash(self):
        file_data = self.upload("men.png", b"rasm", purpose=PURPOSE_AVATAR)
        self.client.put(AVATAR, {"file": file_data["id"]})

        res = self.client.delete(AVATAR)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar, "")
        self.assertFalse(File.objects.filter(pk=file_data["id"]).exists())


class ResourceCrudTests(UploadTestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.course = make_course(self.instructor)
        self.client.force_authenticate(self.instructor)

    def _resource(self, name="starter.zip", content=b"zip-baytlari", **extra):
        file_data = self.upload(name, content)
        body = {
            "course": str(self.course.id),
            "file": file_data["id"],
            "name": name,
            "folder": "general",
            "category": "python",
        }
        body.update(extra)
        return self.client.post(RESOURCES, body)

    def test_royxat_massiv(self):
        """Do'kon endpoint'i — o'ram emas (§0.1)."""
        self._resource()
        res = self.client.get(RESOURCES)
        self.assertIsInstance(res.data, list)

    def test_tur_va_hajm_serverda_aniqlanadi(self):
        """Mijoz `type` va `size_kb` yuborsa ham e'tiborga olinmaydi."""
        res = self._resource(type="pdf", size_kb=99999)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["type"], "zip")
        self.assertEqual(res.data["size_kb"], 1)

    def test_tashqi_havola_faylsiz_saqlanadi(self):
        res = self.client.post(RESOURCES, {
            "course": str(self.course.id),
            "name": "docs.docker.com",
            "url": "https://docs.docker.com",
            "folder": "general",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["type"], "url")
        self.assertEqual(res.data["size_kb"], 0)
        self.assertEqual(res.data["download_url"], "")

    def test_faylsiz_va_havolasiz_resurs_yaratilmaydi(self):
        res = self.client.post(RESOURCES, {"course": str(self.course.id), "name": "hech nima"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("form", res.data["error"]["fields"])

    def test_begona_kursga_resurs_qoshib_bolmaydi(self):
        boshqa = make_course(make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR))
        file_data = self.upload("fayl.pdf", b"mazmun")

        res = self.client.post(RESOURCES, {
            "course": str(boshqa.id), "file": file_data["id"], "name": "fayl.pdf",
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_begona_fayl_biriktirilmaydi(self):
        boshqa = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(boshqa)
        file_data = self.upload("begona.pdf", b"mazmun")

        self.client.force_authenticate(self.instructor)
        res = self.client.post(RESOURCES, {
            "course": str(self.course.id), "file": file_data["id"], "name": "begona.pdf",
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tugallanmagan_fayl_biriktirilmaydi(self):
        presigned = self.client.post(PRESIGN, {
            "purpose": PURPOSE_RESOURCE, "name": "yarim.pdf", "size_bytes": 3,
        })
        res = self.client.post(RESOURCES, {
            "course": str(self.course.id),
            "file": presigned.data["file"]["id"],
            "name": "yarim.pdf",
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_begona_resurs_korinmaydi(self):
        boshqa = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        Resource.objects.create(
            owner=boshqa, course=make_course(boshqa), name="begona.pdf", url="https://x.uz",
        )
        self.assertEqual(len(self.client.get(RESOURCES).data), 0)

    def test_nusxa_kengaytmadan_oldin_nomlanadi(self):
        created = self._resource("slides.pptx", b"taqdimot")
        res = self.client.post(f"{RESOURCES}/{created.data['id']}/duplicate")

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "slides (nusxa).pptx")
        # Baytlar ko'chirilmaydi — ikkala yozuv bitta faylga ishora qiladi
        self.assertEqual(res.data["file"], created.data["file"])
        self.assertEqual(res.data["status"], "active")
        self.assertFalse(res.data["favorite"])

    def test_talaba_resurs_yarata_olmaydi(self):
        self.client.force_authenticate(make_user("t@isloh.uz", ROLE_STUDENT))
        res = self.client.get(RESOURCES)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class StudentResourceListTests(UploadTestCase):
    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.course = make_course(self.instructor)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)

        Resource.objects.create(
            owner=self.instructor, course=self.course, name="faol.pdf", url="https://x.uz",
        )
        Resource.objects.create(
            owner=self.instructor, course=self.course, name="arxiv.pdf",
            url="https://y.uz", status=Resource.STATUS_ARCHIVED,
        )
        self.url = f"/api/v1/student/courses/{self.course.id}/resources"

    def test_yozilgan_talaba_faqat_faollarini_koradi(self):
        Enrollment.objects.create(user=self.student, course=self.course)
        self.client.force_authenticate(self.student)

        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([row["name"] for row in res.data], ["faol.pdf"])

    def test_yozilmagan_talaba_404(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_404_NOT_FOUND)


class SubmissionFileTests(UploadTestCase):
    """Topshiriq fayli — chegarani TOPSHIRIQ belgilaydi."""

    def setUp(self):
        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.course = make_course(self.instructor)
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=self.student, course=self.course)

        self.assignment = Assignment.objects.create(
            owner=self.instructor, course=self.course, title="Topshiriq",
            status="published", file_types=[".pdf"], max_size_mb=1, max_files=2,
        )
        self.url = f"/api/v1/student/assignments/{self.assignment.id}/submissions"
        self.client.force_authenticate(self.student)

    def test_fayl_ishga_biriktiriladi(self):
        file_data = self.upload(
            "ish.pdf", b"%PDF ishim", purpose=PURPOSE_SUBMISSION, assignment=self.assignment
        )
        res = self.client.post(self.url, {"text": "Tayyor", "files": [{"file": file_data["id"]}]})

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(len(res.data["files"]), 1)
        # Nom va hajm MIJOZDAN emas, `File` yozuvidan
        self.assertEqual(res.data["files"][0]["name"], "ish.pdf")
        self.assertEqual(res.data["files"][0]["size_bytes"], 10)

    def test_topshiriq_ruxsat_bermagan_tur_rad_etiladi(self):
        res = self.client.post(PRESIGN, {
            "purpose": PURPOSE_SUBMISSION, "name": "ish.zip",
            "size_bytes": 10, "assignment": str(self.assignment.id),
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_topshiriq_hajm_chegarasi(self):
        res = self.client.post(PRESIGN, {
            "purpose": PURPOSE_SUBMISSION, "name": "ish.pdf",
            "size_bytes": 5 * 1024 * 1024, "assignment": str(self.assignment.id),
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("1 MB", res.data["error"]["fields"]["size_bytes"])

    def test_yozilmagan_talaba_topshiriq_chegarasini_bila_olmaydi(self):
        self.client.force_authenticate(make_user("begona@isloh.uz", ROLE_STUDENT))
        res = self.client.post(PRESIGN, {
            "purpose": PURPOSE_SUBMISSION, "name": "ish.pdf",
            "size_bytes": 10, "assignment": str(self.assignment.id),
        })
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_begona_fayl_jimgina_tushiriladi(self):
        """Ish baribir topshiriladi — faqat o'sha fayl ilinmaydi."""
        boshqa = make_user("boshqa@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=boshqa, course=self.course)
        self.client.force_authenticate(boshqa)
        begona = self.upload(
            "begona.pdf", b"mazmun", purpose=PURPOSE_SUBMISSION, assignment=self.assignment
        )

        self.client.force_authenticate(self.student)
        res = self.client.post(self.url, {"files": [{"file": begona["id"]}]})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data["files"]), 0)

    def test_oqituvchi_ishning_faylini_oladi_boshqa_talaba_yoq(self):
        file_data = self.upload(
            "ish.pdf", b"%PDF ishim", purpose=PURPOSE_SUBMISSION, assignment=self.assignment
        )
        self.client.post(self.url, {"files": [{"file": file_data["id"]}]})
        download = file_data["download_url"]

        self.client.force_authenticate(self.instructor)
        self.assertEqual(self.client.get(download).status_code, status.HTTP_200_OK)

        boshqa = make_user("boshqa@isloh.uz", ROLE_STUDENT)
        Enrollment.objects.create(user=boshqa, course=self.course)
        self.client.force_authenticate(boshqa)
        self.assertEqual(self.client.get(download).status_code, status.HTTP_404_NOT_FOUND)

    def test_fayllar_soni_chegarasi(self):
        birinchi = self.upload("bir.pdf", b"1", purpose=PURPOSE_SUBMISSION, assignment=self.assignment)
        ikkinchi = self.upload("ikki.pdf", b"2", purpose=PURPOSE_SUBMISSION, assignment=self.assignment)
        uchinchi = self.upload("uch.pdf", b"3", purpose=PURPOSE_SUBMISSION, assignment=self.assignment)

        res = self.client.post(self.url, {"files": [
            {"file": birinchi["id"]}, {"file": ikkinchi["id"]}, {"file": uchinchi["id"]},
        ]})
        self.assertEqual(len(res.data["files"]), self.assignment.max_files)
        self.assertEqual(Submission.objects.count(), 1)


class LessonVideoTests(UploadTestCase):
    def setUp(self):
        from apps.courses.models import CourseModule, Lesson

        self.instructor = make_user("o@isloh.uz", ROLE_INSTRUCTOR)
        self.course = make_course(self.instructor)
        module = CourseModule.objects.create(course=self.course, title="Modul")
        self.lesson = Lesson.objects.create(module=module, title="Dars")
        self.student = make_user("t@isloh.uz", ROLE_STUDENT)
        self.url = f"/api/v1/instructor/lessons/{self.lesson.id}/video"

    def test_video_biriktiriladi_va_yozilgan_talaba_koradi(self):
        self.client.force_authenticate(self.instructor)
        file_data = self.upload("dars.mp4", b"video-baytlari", purpose=PURPOSE_LESSON_VIDEO)

        res = self.client.put(self.url, {"file": file_data["id"]})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["video_url"], file_data["download_url"])

        Enrollment.objects.create(user=self.student, course=self.course)
        self.client.force_authenticate(self.student)
        self.assertEqual(
            self.client.get(file_data["download_url"]).status_code, status.HTTP_200_OK
        )

    def test_yozilmagan_talaba_videoni_ololmaydi(self):
        self.client.force_authenticate(self.instructor)
        file_data = self.upload("dars.mp4", b"video-baytlari", purpose=PURPOSE_LESSON_VIDEO)
        self.client.put(self.url, {"file": file_data["id"]})

        self.client.force_authenticate(self.student)
        self.assertEqual(
            self.client.get(file_data["download_url"]).status_code, status.HTTP_404_NOT_FOUND
        )

    def test_begona_darsga_video_qoyib_bolmaydi(self):
        boshqa = make_user("boshqa@isloh.uz", ROLE_INSTRUCTOR)
        self.client.force_authenticate(boshqa)
        file_data = self.upload("dars.mp4", b"video", purpose=PURPOSE_LESSON_VIDEO)

        res = self.client.put(self.url, {"file": file_data["id"]})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_boshqa_maqsaddagi_fayl_video_bolmaydi(self):
        """Maqsad yuklashdagi chegarani belgilagan edi — resurs sifatida
        yuklangan fayl darsga video bo'lib o'ta olmaydi."""
        self.client.force_authenticate(self.instructor)
        file_data = self.upload("dars.mp4", b"video")

        res = self.client.put(self.url, {"file": file_data["id"]})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
