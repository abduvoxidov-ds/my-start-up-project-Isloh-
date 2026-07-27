# ISLOH Frontend — Sprint 2 Summary

Foundation, project structure, shared layout & component architecture. **UI is visually unchanged** — see confirmation in §10.

---

## 1. Summary of Architecture Improvements
- Reorganized the flat `pages/` folder into role-based folders: `auth/`, `student/`, `shared/`, `instructor/` (reserved).
- Split the single 362-line `style.css` into 7 focused partials (`tokens`, `base`, `layout`, `components`, `utilities`, `animations`, `responsive`), loaded via one `@import` chain from `style.css` so every page's `<link>` tag is untouched.
- Removed the sidebar-markup duplication across all 9 pages that have one: the sidebar is now rendered at runtime from a single `NAV_CONFIG` object (`js/navigation.js`) by `js/sidebar.js`.
- Fixed every dead sidebar link (Kalendar, Saqlangan, Profil, Sozlamalar were inert `<div>`s) — they're now real links to `pages/shared/coming-soon.html`, a generic placeholder (not the real features — those are still future sprints, per this sprint's "do not implement yet" list).
- Fixed a pre-existing bug: the notification bell on `marketplace.html` was a `<button>` with no link at all; it's now a working link like every other page.
- Consolidated 11 duplicated component styles (switch, dropdown, tooltip, toast, chip/tag, breadcrumb, spinner, skeleton, modal) out of `components.html`'s local `<style>` block into `css/components.css` / `css/animations.css`, so any future page can use them without redefinition.
- Added design tokens that didn't exist before: transition durations, easing curve, and a z-index scale — replacing hardcoded `.2s` / `z-index:5` values with named tokens.
- Added baseline accessibility: `:focus-visible` outlines, `aria-current="page"` on the active nav item (set by `sidebar.js`), `aria-label` on every icon button and search input, `role="navigation"` + `aria-label` on the nav landmark.
- Prepared (not implemented) the Instructor role: `NAV_CONFIG.instructor`, `.sidebar.theme-teach` (green accent, reusing the existing `--teach-green` token), and a reserved `pages/instructor/` folder with a README documenting the Sprint 6+ build order.

## 2. Modified Files
- `index.html` (redirect path)
- `README.md` (structure + sidebar docs updated)
- `css/style.css` (rewritten as an `@import` index)
- `pages/student/dashboard.html`, `courses.html`, `course-detail.html`, `marketplace.html`, `analytics.html`, `chat.html`, `ai-assistant.html` (sidebar → mount point, css path depth, script tags, aria-labels)
- `pages/shared/notifications.html`, `components.html` (same, plus `components.html`'s local `<style>` block trimmed of now-shared widget CSS)
- `pages/auth/login.html`, `register-role.html`, `register-student.html` (css path depth only — no sidebar on these pages)

## 3. Newly Created Files
```
css/tokens.css
css/base.css
css/layout.css
css/components.css
css/utilities.css
css/animations.css
css/responsive.css
js/navigation.js
js/sidebar.js
js/dropdown.js
js/modal.js
js/toast.js
js/search.js
js/notifications.js
js/theme.js
js/calendar.js   (reserved stub, Sprint 3)
js/tasks.js      (reserved stub, Sprint 3)
js/chat.js       (reserved stub, Sprint 9)
js/ai.js         (reserved stub, future)
pages/shared/coming-soon.html
pages/instructor/README.md
docs/SPRINT-2-SUMMARY.md   (this file)
```

## 4. Reusable Components (already existed, now de-duplicated / centralized)
Sidebar nav item, topbar (search + icon-btn + avatar), card, button (primary/teach/outline/ghost), form field, badge, progress bar, stat card, role card, course cover, tab strip, switch, custom radio/checkbox, dropdown, tooltip, toast, chip/tag, breadcrumb, spinner, skeleton, modal shell.

## 5. Updated Folder Structure
```
isloh_project/
├── index.html
├── docs/{SPRINT-1-ARCHITECTURE.md, SPRINT-2-SUMMARY.md}
├── css/{style,tokens,base,layout,components,utilities,animations,responsive}.css
├── js/{navigation,sidebar,dropdown,modal,toast,search,notifications,theme,calendar,tasks,chat,ai}.js
├── components/            (reserved — see note in §9)
├── assets/{icons,images}/
└── pages/
    ├── auth/{login,register-role,register-student}.html
    ├── shared/{components,notifications,coming-soon}.html
    ├── student/{dashboard,courses,course-detail,marketplace,analytics,chat,ai-assistant}.html
    └── instructor/README.md   (empty on purpose, Sprint 6+)
```

## 6. Routing Map
```
index.html → pages/auth/login.html
login.html ⇄ register-role.html ⇄ register-student.html
pages/student/* ⇄ each other (same folder, unchanged relative links)
pages/student/* → pages/shared/{notifications,components}.html
pages/student/* → pages/shared/coming-soon.html?page=X&role=student   (Calendar/Bookmarks/Profile/Settings)
sidebar "Chiqish" → pages/auth/login.html   (every page)
[reserved] pages/instructor/* → pages/shared/coming-soon.html?role=instructor   (until Sprint 6+)
```

## 7. Component Hierarchy
```
App Shell
├── Sidebar (rendered by sidebar.js from NAV_CONFIG[role])
│   ├── Brand
│   ├── Nav item × N (icon + label, .active / aria-current)
│   └── Footer nav item (Logout)
├── Main Column
│   ├── Topbar (search input, icon buttons, avatar)
│   └── Content (page-specific: stat cards, tables, chat shell, etc.)
└── [Reserved] Modal overlay / Toast container (mounted on demand by modal.js / toast.js)
```

## 8. CSS Organization
`style.css` → imports, in order: `tokens.css` (variables only) → `base.css` (reset/typography/focus) → `layout.css` (shell/sidebar/topbar/auth-split) → `components.css` (all reusable UI atoms) → `utilities.css` (new helper classes, opt-in) → `animations.css` (keyframes) → `responsive.css` (shared breakpoint rules). Page-local `<style>` blocks remain only for genuinely page-specific layout (e.g. `.course-grid`, `.chat-shell`, `.donut`) — see Sprint 1 §2.4 for the incremental plan to promote any of these later.

## 9. JavaScript Organization
`navigation.js` (data) → `sidebar.js` (renders nav + sets `data-role` theme) → `theme.js` (propagates role to `<body>`) → interaction modules (`dropdown.js`, `modal.js`, `toast.js`, `search.js`, `notifications.js`) → reserved feature stubs (`calendar.js`, `tasks.js`, `chat.js`, `ai.js`) that later sprints fill in instead of writing inline `<script>` per page. No page currently has inline behavioral JS — only the tiny 6-line role-detection snippet in `coming-soon.html` (which exists solely to read `?role=` before `sidebar.js` runs).

**Note on `components/`:** Sprint 2 asked for a `components/` folder. Since this project has no build step or templating engine, HTML partials placed there could not actually be included into pages without either (a) `fetch()`, which fails under `file://` per browser CORS rules — a real constraint for a build-tool-free static prototype — or (b) a templating/build step, which is out of scope for this sprint. `js/sidebar.js` + `js/navigation.js` deliver the *practical* equivalent for the sidebar (the one component duplicated on every page). The `components/` folder is left in place and reserved for the day the project adopts a bundler; documented here so the decision isn't silently lost.

## 10. Confirmation: UI Design Unchanged
- All color, spacing, radius, shadow, and typography values were copied verbatim into their new token/partial locations — none were altered.
- Sidebar/topbar/card/button/badge/etc. markup and rendered classes are identical to before; only *where* the CSS/HTML-generation code lives changed.
- Spot-checked selector survival for `.app-shell`, `.sidebar`, `.nav-item`, `.topbar`, `.card`, `.btn-primary`, `.field input`, `.badge-violet`, `.progress-fill`, `.stat-card`, `.auth-split`, `.role-card`, `.course-cover`, `.tab-strip` — all present in their new files.
- No page's visible content, copy, or layout was touched — only the `<aside>` sidebar block, the `<link>`/`<script>` tags, and a handful of `aria-label` additions (which are invisible attributes, not visual changes).

---

Ready for Sprint 3: Student **Calendar** + **Tasks** pages.
