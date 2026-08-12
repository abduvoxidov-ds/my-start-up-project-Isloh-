/* ==========================================================================
   ISLOH — Kursni oldindan ko'rish (pages/instructor/course-preview.html)

   Bu sahifa talaba ko'radigan kurs sahifasining taxminiy ko'rinishi. Uning
   kontenti hali namuna, lekin `?id=` bilan ochiladi, shuning uchun
   "Tahrirlash" va "Nashr etish sahifasiga qaytish" havolalari AYNI SHU
   kursga qaytishi kerak edi — ilgari ular parametrsiz bo'lib, boshqa
   kursni ochib yuborardi.

   Sahifada sarlavha ham do'kondan olinadi: preview boshqa kursniki
   bo'lib ko'rinmasin.
   ========================================================================== */

function isloh_initCoursePreview() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('id') || params.get('course') || '';
  if (!courseId) return;

  isloh_applyCourseLinks(courseId);

  const course = isloh_getCourse(courseId);
  if (!course) return;

  document.querySelectorAll('[data-preview-course-title]').forEach((el) => { el.textContent = course.title; });
  document.title = course.title + " — Oldindan ko'rish — Isloh";
}

document.addEventListener('DOMContentLoaded', isloh_initCoursePreview);
