# ISLOH Frontend — Sprint 4A (Part 1 of 3)
## Instructor Workspace Foundation — Analysis, Plan & Architecture Prep

This part is analysis + planning + architecture preparation **only**. No Instructor Dashboard, widgets, or pages are built here — that begins in Part 2. The one concrete change made in this part is a config-only sidebar alignment (see §3.1), which the Part-1 spec explicitly asks for under "Create only Instructor configuration."

---

## PHASE 1 — Analysis of the Current Project

### 1.1 Architecture as it stands (after Sprints 1–3B)
The project is a build-step-free static site: HTML pages + a split CSS system (`@import` chain in `css/style.css`) + vanilla JS modules loaded per page. There is no framework and no bundler, which constrains some choices (see §1.5). Role is a first-class concept already: pages declare `data-role` / `data-active` on their `<aside class="sidebar">`, and the sidebar is rendered at runtime — no page hand-writes nav markup.

### 1.2 Reusable layout (all in `css/layout.css`) — reuse as-is for Instructor
`.app-shell`, `.sidebar` (+ `.sidebar.theme-teach` green variant), `.nav-group`, `.nav-item`, `.sidebar-footer`, `.main-col`, `.topbar`, `.topbar-search`, `.topbar-actions`, `.content`. The Instructor workspace needs **no new layout** — it uses this shell exactly like the Student pages, only with `data-role="instructor"`.

### 1.3 Reusable JS modules (in `js/`) — reuse, do not duplicate
- `navigation.js` — `NAV_CONFIG` single source of truth (has a `student`, `instructor`, and `footer` block already).
- `sidebar.js` — renders any role's sidebar from `NAV_CONFIG[role]`, sets `.active` + `aria-current`, and **auto-applies `.theme-teach` when `data-role="instructor"`**. Instructor theming is already wired.
- `theme.js` — mirrors role onto `<body data-role>`.
- `filterable.js` — generic filter-chips + search + empty-state engine (built in 3B). Directly reusable for the future Students roster, Reviews list, Assignments list.
- `dropdown.js`, `modal.js`, `toast.js`, `search.js`, `notifications.js`, `settings.js`, `bookmarks.js`, `calendar.js`, `tasks.js` — feature/interaction modules. `modal.js`/`toast.js` provide the Modal/Toast layers the Instructor layout requires; `notifications.js` + `settings.js` are directly reusable for the Instructor Notifications + Settings pages.

### 1.4 Reusable CSS component/widget inventory — reuse for Instructor
- `css/components.css`: `.card`, `.btn` (+ `.btn-primary`, **`.btn-teach`** already exists for instructor CTAs), `.badge`, `.progress-track`, `.stat-card`, `.avatar`, `.icon-btn`, `.switch`, `.dropdown`, `.modal`/`.modal-overlay`, `.toast-container`, `.tab-strip`.
- `css/widgets.css`: `.section-header`, `.wk-grid-4/3/2`, `.wk-col`, `.progress-ring`, `.quick-action`(s), `.timeline`, `.priority-badge`, `.filter-bar`/`.filter-chip`, `.empty-state`, `.upcoming-row`, `.stat-card` usage patterns, `.settings-*`, `.cert-*`, `.bookmark-*`, `.profile-*`, `.achievement-*`, `.skill-tag`. Many transfer directly (e.g. `.settings-*` → Instructor Settings; `.profile-*` → Instructor Profile; `.timeline` → Instructor activity feed; `.stat-card` + `.wk-grid-4` → the Instructor dashboard's revenue/students/courses/completion row).

### 1.5 Constraints & notes carried forward
- No `fetch()`-based HTML includes (fails under `file://` CORS) — the sidebar-via-JS approach is the include mechanism. Instructor pages follow the same `<aside data-role="instructor">` + mount-point pattern.
- `coming-soon.html` already reads `?role=instructor` and applies the instructor theme, so every not-yet-built Instructor link degrades gracefully today.
- The `pages/instructor/` folder exists (with a README) and is empty, ready to receive pages in Part 2.

### 1.6 What already supports Instructor (no work needed)
Role-based routing ✓ · instructor NAV block ✓ · green sidebar theme (`.theme-teach` + `--teach-green` token) ✓ · `.btn-teach` CTA ✓ · shared topbar/layout ✓ · modal/toast/notification/filter/settings modules ✓. The foundation from Sprint 2 was deliberately built to make this sprint mostly assembly, not new infrastructure.

---

## PHASE 2 — Implementation Plan (for Part 2 onward — NOT executed here)

### 2.1 Files to be MODIFIED (in later parts)
| File | Why |
|---|---|
| `js/navigation.js` | As each Instructor page ships, flip its `coming-soon` href to the real page — one at a time. (In Part 1, only the item list/order is corrected; see §3.1.) |
| `css/widgets.css` | Append an "Instructor widgets" section for genuinely new widgets (revenue card, student roster row, enrollment card, review card, teaching-goal card, views-over-time line chart) — only those with no existing equivalent. Reuse `.stat-card`, `.timeline`, `.progress-ring`, `.section-header`, `.filter-bar`, `.empty-state`, `.settings-*`, `.profile-*` unchanged. |
| `pages/instructor/README.md` | Update build-order references (Sprint 6 → Sprint 4B/4C) so docs stay accurate. |

No existing Student page, no token file, and no layout file will be modified — the Student module stays byte-for-byte intact.

### 2.2 Files to be CREATED (across Part 2 and Part 3 — NOT now)
Part 2 (Foundation → Dashboard):
- `pages/instructor/dashboard.html` — the instructor home, built from `.stat-card` + `.wk-grid-*` + new revenue/enrollment/review widgets.
- New reusable widgets appended to `css/widgets.css` (see 2.1).
- Possibly `js/charts.js` — a tiny shared line/area-chart renderer (the Student analytics used pure-CSS bars; the instructor "Views over time" needs a line, and a shared renderer avoids per-page duplication). Created only if reuse across Analytics + Revenue + Dashboard justifies it.

Part 3 (remaining pages):
- `pages/instructor/courses.html`, `students.html`, `assignments.html`, `analytics.html`, `messages.html`, `reviews.html`, `revenue.html`, `ai-assistant.html`, `profile.html`, `settings.html`.
- `pages/instructor/notifications.html` OR reuse the shared one with `role=instructor` (decision deferred to when that page is scheduled).
- Small feature modules only where an interaction isn't already covered (e.g. a students-roster module may just reuse `filterable.js`; reviews may reuse it too).

### 2.3 Reuse-first component decisions (applying the Shared Component Policy)
| Instructor need | Decision |
|---|---|
| Dashboard stat row (revenue/students/courses/completion) | **Reuse** `.stat-card` + `.wk-grid-4` |
| Settings | **Reuse** `.settings-*` + `settings.js` verbatim |
| Profile | **Reuse** `.profile-*`, `.skill-tag`, `.timeline` |
| Notifications | **Reuse** `.notif-*` + `filterable.js` + `notifications.js` |
| Students roster / Reviews / Assignments lists | **Reuse** `filterable.js` + `.filter-bar`; add a thin row widget only if the card shape is new |
| Activity feed | **Reuse** `.timeline` |
| Modal/Toast/Loading layers | **Reuse** `modal.js` / `toast.js` / `.skeleton` / `.spinner` |
| Revenue transaction row, student roster row, review card, enrollment card, teaching-goal card, views-over-time line chart | **New** (no existing equivalent) — build as reusable widgets |

### 2.4 Component hierarchy (target, unchanged from Sprint 2)
```
App Shell (.app-shell)
├── Sidebar (data-role="instructor", theme-teach)  ← rendered by sidebar.js from NAV_CONFIG.instructor
├── Main Column (.main-col)
│   ├── Topbar (search / notifications / avatar / quick actions)
│   └── Content (.content) — instructor page body
└── On-demand layers: modal-overlay (modal.js), toast-container (toast.js), skeleton/spinner
```

---

## PHASE 3 — Architecture Preparation (done in this part)

### 3.1 Instructor sidebar configuration aligned to the Part-1 spec
`NAV_CONFIG.instructor` now matches the required sidebar exactly, in order: **Dashboard, Kurslarim (My Courses), Talabalar (Students), Topshiriqlar (Assignments), Analitika (Analytics), Xabarlar (Messages), Sharhlar (Reviews), Daromad (Revenue), AI Yordamchi (AI Assistant), Bildirishnomalar (Notifications), Profil (Profile), Sozlamalar (Settings)** + the shared **Chiqish (Logout)** footer.

Changes from the previous placeholder config: added `assignments`, `ai-assistant`, `notifications`; removed `course-editor` (Course Builder is explicitly out of scope and not in the Part-1 sidebar list — it will later live as an action on My Courses, not a top-level nav item); reordered to the spec. Every href still points to `coming-soon.html?role=instructor` — **no Instructor page was created.**

### 3.2 Verification (headless, jsdom)
Visiting `coming-soon.html?role=instructor` now renders: `role=instructor`, `theme-teach=true` (green active accent), the shared Logout footer, and all **12** nav items in the correct order. Confirms the shared renderer + theme + routing already support the Instructor role with zero new infrastructure.

### 3.3 What is intentionally NOT touched
No new layout engine, no token/color/spacing/typography change, no new CSS system, no duplicated JS, no Student-page edits, and none of the deferred features (Course Builder, Lesson/Quiz editors, Revenue reports, Payments, Certificates, Admin, Backend/API/Auth).

---

## Success criteria (Part 1) — status
✓ Existing Student UI unchanged (no student file touched) · ✓ Instructor workspace will follow the same design language (verified via shared renderer/theme) · ✓ Architecture clean (config-only change) · ✓ Components remain reusable (reuse plan in §2.3) · ✓ No duplicated logic introduced · ✓ No broken routing (all instructor links resolve to the themed placeholder) · ✓ Responsive + accessibility preserved (inherits shared shell).

## STOP POINT
Analysis, planning, and architecture preparation are complete. Halting here as instructed — awaiting Sprint 4A **Part 2** before implementing the Instructor Dashboard, widgets, and pages.
