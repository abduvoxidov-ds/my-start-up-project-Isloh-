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
    { key: 'courses',        label: 'Kurslar',           icon: 'bi-journal-bookmark-fill',  href: 'courses.html' },
    { key: 'marketplace',    label: 'Marketplace',       icon: 'bi-bag-fill',               href: 'marketplace.html' },
    { key: 'calendar',       label: 'Kalendar',          icon: 'bi-calendar3',              href: 'calendar.html' },
    { key: 'tasks',          label: 'Vazifalar',         icon: 'bi-check2-square',          href: 'tasks.html' },
    { key: 'chat',           label: 'Chat',               icon: 'bi-chat-dots-fill',         href: 'chat.html' },
    { key: 'ai-assistant',   label: 'AI Yordamchi',      icon: 'bi-stars',                  href: 'ai-assistant.html' },
    { key: 'analytics',      label: 'Analitika',         icon: 'bi-bar-chart-fill',         href: 'analytics.html' },
    { key: 'certificates',   label: 'Sertifikatlar',     icon: 'bi-patch-check-fill',       href: 'certificates.html' },
    { key: 'bookmarks',      label: 'Saqlangan',         icon: 'bi-bookmark-star',          href: 'bookmarks.html' },
    { key: 'profile',        label: 'Profil',            icon: 'bi-person-circle',          href: 'profile.html' },
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
    { key: 'profile',       label: 'Profil',       icon: 'bi-person-circle',         href: '../instructor/profile.html' },
    { key: 'settings',      label: 'Sozlamalar',   icon: 'bi-gear-fill',             href: '../instructor/settings.html' }
  ],

  /* Admin role (Sprint 9 — Admin Foundation). Frontend-only management
     views over existing entities (users, courses, marketplace) plus
     platform settings — no new backend workflows. */
  admin: [
    { key: 'admin-dashboard',    label: 'Dashboard',        icon: 'bi-grid-1x2-fill',    href: '../admin/admin-dashboard.html' },
    { key: 'admin-users',        label: 'Foydalanuvchilar', icon: 'bi-people-fill',      href: '../admin/admin-users.html' },
    { key: 'admin-courses',      label: 'Kurslar',          icon: 'bi-journal-bookmark-fill', href: '../admin/admin-courses.html' },
    { key: 'admin-marketplace',  label: 'Marketplace',      icon: 'bi-bag-fill',         href: '../admin/admin-marketplace.html' },
    { key: 'admin-settings',     label: 'Sozlamalar',       icon: 'bi-gear-fill',        href: '../admin/admin-settings.html' }
  ],

  /* Rendered under every sidebar regardless of role. */
  footer: [
    { key: 'logout', label: 'Chiqish', icon: 'bi-box-arrow-right', href: '../auth/login.html' }
  ]
};
