/* ==========================================================================
   ISLOH — Navigation config
   Single source of truth for sidebar menu items, per role. Every page in
   pages/student/ and (from Sprint 6 onward) pages/instructor/ renders its
   sidebar from this file via js/sidebar.js — the menu is defined ONCE here
   instead of being copy-pasted into every HTML file.

   Paths are written relative to any file inside pages/<role>/, which is
   why same-role links have no folder prefix (all student pages live in the
   same folder) while cross-role/shared links go up one level.
   ========================================================================== */

const NAV_CONFIG = {
  student: [
    { key: 'dashboard',      label: 'Dashboard',         icon: 'bi-grid-1x2-fill',          href: 'dashboard.html' },
    /* Kurs darajasidagi ma'lumot (sotib olingan + saqlangan kurslar) shu
       sahifada — "Saqlanganlar" endi faqat dars materiallari bilan ishlaydi. */
    { key: 'courses',        label: 'Mening kurslarim',  icon: 'bi-journal-bookmark-fill',  href: 'courses.html' },
    /* Buyurtmalar tarixi (orders.html) ataylab menyuda yo'q — unga
       Marketplace'dagi "Xaridlar tarixi" bo'limi orqali kiriladi. */
    { key: 'marketplace',    label: 'Marketplace',       icon: 'bi-bag-fill',               href: 'marketplace.html' },
    { key: 'bookmarks',      label: 'Saqlanganlar',      icon: 'bi-bookmark-star',          href: 'bookmarks.html' },
    { key: 'calendar',       label: 'Vazifalar',         icon: 'bi-check2-square',          href: 'calendar.html' },
    /* Nom uch rolda ham bir xil — "Xabarlar". Fayl nomi `chat.html`
       bo'lib qoldi (havolalar buzilmasligi uchun), tarjima kaliti ham
       shundan olinadi: `nav.chat`. */
    { key: 'chat',           label: 'Xabarlar',          icon: 'bi-chat-dots-fill',         href: 'chat.html' },
    { key: 'ai-assistant',   label: 'AI Yordamchi',      icon: 'bi-stars',                  href: 'ai-assistant.html' },
    { key: 'certificates',   label: 'Sertifikatlar',     icon: 'bi-patch-check-fill',       href: 'certificates.html' },
    /* "Profil" ataylab yon menyuda yo'q — u topbar'dagi avatar menyusiga
       ko'chirilgan (USER_MENU_CONFIG + js/user-menu.js). */
    { key: 'settings',       label: 'Sozlamalar',        icon: 'bi-gear-fill',              href: 'settings.html' },
    { key: 'components',     label: 'Komponentlar',      icon: 'bi-grid-3x3-gap-fill',      href: '../shared/components.html' }
  ],

  /* All Instructor pages now exist as of Sprint 4B (dashboard/courses/
     students/assignments/analytics/notifications shipped in Sprint 4A;
     messages/reviews/revenue/ai-assistant/profile/settings shipped in
     Sprint 4B) — see docs/SPRINT-4A-PLAN.md. No coming-soon placeholders
     remain for this role. Item list + order follow the Sprint 4A Part-1
     sidebar specification exactly. */
  instructor: [
    { key: 'dashboard',     label: 'Dashboard',    icon: 'bi-grid-1x2-fill',         href: '../instructor/dashboard.html' },
    { key: 'courses',       label: 'Kurslarim',    icon: 'bi-journal-bookmark-fill', href: '../instructor/courses.html' },
    { key: 'students',      label: 'Talabalar',    icon: 'bi-people-fill',           href: '../instructor/students.html' },
    { key: 'assignments',   label: 'Topshiriqlar', icon: 'bi-file-earmark-text-fill', href: '../instructor/assignments.html' },
    { key: 'analytics',     label: 'Analitika',    icon: 'bi-bar-chart-fill',        href: '../instructor/analytics.html' },
    { key: 'messages',      label: 'Xabarlar',     icon: 'bi-chat-dots-fill',        href: '../instructor/messages.html' },
    { key: 'reviews',       label: 'Sharhlar',     icon: 'bi-star-fill',             href: '../instructor/reviews.html' },
    { key: 'revenue',       label: 'Daromad',      icon: 'bi-cash-stack',            href: '../instructor/revenue.html' },
    { key: 'ai-assistant',  label: 'AI Yordamchi', icon: 'bi-stars',                 href: '../instructor/ai-assistant.html' },
    /* Talaba menyusidagi kabi — "Profil" avatar menyusida (USER_MENU_CONFIG). */
    { key: 'settings',      label: 'Sozlamalar',   icon: 'bi-gear-fill',             href: '../instructor/settings.html' }
  ],

  /* Admin role (Sprint 9 — Admin Foundation). Frontend-only management
     views over existing entities (users, courses, marketplace) plus
     platform settings — no new backend workflows.

     `admin-messages` — qo'llab-quvvatlash qutisi. Ilgari talaba chatidagi
     "Isloh Support" suhbatdoshining ikkinchi tomoni umuman yo'q edi:
     savol yozilardi-yu, unga javob beradigan ekran mavjud emasdi. */
  admin: [
    { key: 'admin-dashboard',    label: 'Dashboard',        icon: 'bi-grid-1x2-fill',    href: '../admin/admin-dashboard.html' },
    { key: 'admin-users',        label: 'Foydalanuvchilar', icon: 'bi-people-fill',      href: '../admin/admin-users.html' },
    { key: 'admin-courses',      label: 'Kurslar',          icon: 'bi-journal-bookmark-fill', href: '../admin/admin-courses.html' },
    { key: 'admin-marketplace',  label: 'Marketplace',      icon: 'bi-bag-fill',         href: '../admin/admin-marketplace.html' },
    { key: 'admin-messages',     label: 'Xabarlar',         icon: 'bi-chat-dots-fill',   href: '../admin/admin-messages.html' },
    { key: 'admin-settings',     label: 'Sozlamalar',       icon: 'bi-gear-fill',        href: '../admin/admin-settings.html' }
  ],

  /* Rendered under every sidebar regardless of role. */
  footer: [
    { key: 'logout', label: 'Chiqish', icon: 'bi-box-arrow-right', href: '../auth/login.html' }
  ]
};

/* ==========================================================================
   Topbar avatar menyusi (js/user-menu.js buni o'qiydi)
   Yon menyudan olib tashlangan shaxsiy havolalar shu yerda yashaydi —
   ya'ni menyu elementi baribir YAGONA joyda ta'riflanadi (CLAUDE.md §2).

   Havolalar ataylab `../<rol>/` prefiksi bilan yozilgan: shu ko'rinish
   ham pages/<rol>/ ichidan, ham pages/shared/ ichidan to'g'ri ishlaydi
   (shared sahifalar ham student sidebar'ini ko'rsatadi).

   "Chiqish" bu yerda takrorlanmaydi — u NAV_CONFIG.footer dan olinadi.
   ========================================================================== */
const USER_MENU_CONFIG = {
  student: [
    { label: 'Profil',     icon: 'bi-person-circle', href: '../student/profile.html' },
    { label: 'Hisob',      icon: 'bi-person-gear',   href: '../student/account.html' },
    { label: 'Sozlamalar', icon: 'bi-gear-fill',     href: '../student/settings.html' }
  ],

  instructor: [
    { label: 'Profil',     icon: 'bi-person-circle', href: '../instructor/profile.html' },
    { label: 'Sozlamalar', icon: 'bi-gear-fill',     href: '../instructor/settings.html' }
  ],

  /* Admin rolida alohida profil sahifasi yo'q — faqat platforma sozlamalari. */
  admin: [
    { label: 'Sozlamalar', icon: 'bi-gear-fill',     href: '../admin/admin-settings.html' }
  ]
};
