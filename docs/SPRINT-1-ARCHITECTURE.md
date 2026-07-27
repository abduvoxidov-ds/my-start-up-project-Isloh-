# ISLOH Frontend — Sprint 1: Architecture Analysis & Roadmap

> Scope of this document: analysis only, per Sprint 1 objectives. No new pages are generated here. Everything below is derived directly from the existing codebase (`css/style.css` + the 12 pages in `pages/`) and the target reference mockup (Student + Instructor dashboards, all pages).

---

## 1. Executive Summary

The existing project is a **student-only** HTML/CSS prototype (Bootstrap Icons + custom design system, no JS framework, no build step). It correctly establishes the ISLOH visual identity: deep indigo/violet sidebar, lavender app background, white elevated cards, Manrope headings + Inter body text, a violet primary brand color and a green "Teach/Instructor" accent color that is already reserved in the palette but not yet used for a full instructor experience.

**Built (8 real pages + 2 auth + 1 system page):**
Login, Register (role select), Register (student form), Dashboard, Courses, Course Detail, Marketplace, Analytics, Chat, AI Assistant, Notifications, Components (design-system gallery).

**Not built, but already referenced in the sidebar as dead links (`<div class="nav-item">` instead of `<a>`):**
Calendar, Bookmarks/Saqlangan, Profile, Settings.

**Not started at all:**
Tasks, Certificates, the entire Instructor role (Dashboard, My Courses, Students, Analytics, Revenue, Reviews, Messages, Profile, Settings, Course Editor/Create Course, Chat), and the Admin role (architecture placeholder only, per instructions — no Admin implementation yet).

The codebase is in good shape to extend, with one structural debt item flagged in §2.4 that should be fixed *while* building new pages, not as a separate rewrite (Rule #1/#2 compliant — see recommendation).

---

## 2. Existing Component Inventory

### 2.1 Design tokens (`css/style.css` — already global, reusable, do not touch)
| Category | Tokens |
|---|---|
| Brand colors | `--indigo-950/900/800`, `--violet-600/500/100`, `--teach-green`, `--teach-green-100` |
| Neutrals | `--bg-app`, `--bg-card`, `--ink-900/700/500/300`, `--border-soft` |
| Semantic | `--success`, `--warning`, `--danger` |
| Elevation | `--shadow-sm/md/lg` |
| Radius | `--r-sm 8px`, `--r-md 14px`, `--r-lg 20px`, `--r-pill 999px` |
| Type | Manrope (headings/display), Inter (body/UI) |

### 2.2 Global reusable classes (defined once in `style.css`, used everywhere — keep using these)
- **Shell/layout:** `.app-shell`, `.sidebar`, `.nav-group`, `.nav-label`, `.nav-item(.active)`, `.sidebar-footer`, `.main-col`, `.topbar`, `.topbar-search`, `.topbar-actions`, `.icon-btn`, `.avatar`, `.content`
- **Surfaces:** `.card`, `.card-pad`
- **Actions:** `.btn` + `.btn-primary`, `.btn-teach`, `.btn-outline`, `.btn-ghost`, `.btn-sm`, `.btn-block`
- **Forms:** `.field`, `.field-hint`
- **Feedback:** `.badge` + `.badge-violet/green/neutral`, `.progress-track`, `.progress-fill`
- **Stats:** `.stat-card`, `.stat-value`, `.stat-label`, `.stat-icon`
- **Auth:** `.auth-split`, `.auth-panel`, `.auth-form-side`, `.auth-form-inner`
- **Onboarding:** `.role-card`, `.role-icon`
- **Course:** `.course-cover`
- **Navigation:** `.tab-strip`, `.tab-item(.active)`

### 2.3 Page-local components (currently duplicated as `<style>` blocks *inside* each HTML file — candidates to promote to shared CSS, see §2.4)
| Page | Page-local components found |
|---|---|
| `dashboard.html` | `.grid-4`, `.grid-2`, `.plan-row`, `.bar-chart` |
| `courses.html` | `.chip-row`, `.chip(.active)`, `.course-grid`, `.course-meta`, `.pager` |
| `marketplace.html` | `.hero-banner`, `.mkt-grid`, `.mkt-card`, `.mkt-cover`, `.price-row/-now/-old/-tag`, `.discount-badge`, `.bundle-card`, `.bundle-icons`, `.coupon-row`, `.coupon-code`, `.section-head` |
| `analytics.html` | `.grid-3`, `.grid-2b`, `.donut`, `.donut-inner`, `.legend-row/-dot`, `.heatmap`, `.trend-pill(.up/.down)`, `.bars`, `.stack`, `.col`, `.lbl` |
| `chat.html` | `.chat-shell`, `.chat-list-col`, `.chat-list-head`, `.chat-search`, `.chat-tabs`, `.chat-tab(.active)`, `.chat-item(.active)`, `.unread`, `.last-msg`, `.thread-head/-body/-input/-actions`, `.bubble-row(.me)`, `.bubble`, `.bubble-time`, `.pin-banner`, `.send-btn`
| `ai-assistant.html` | `.ai-shell`, `.ai-history-col`, `.hist-item(.active)`, `.new-chat-btn`, `.ai-main`, `.ai-body`, `.msg(.user/.ai)`, `.msg-bubble`, `.msg-actions`, `.typing-dots`, `.suggest-card/-row`, `.code-block`, `.ai-input-box/-wrap`, `.ai-disclaimer`, `.avatar-sm`
| `notifications.html` | `.notif-layout`, `.filter-col`, `.notif-row(.unread)`, `.notif-icon/-title/-desc/-time`, `.count`
| `course-detail.html` | `.detail-grid`, `.back-link`, `.includes-row`, `.lesson-row`, `.lesson-time`, `.module-title`
| `components.html` | `.switch/.slider`, `.opt-row`, `.dropdown/.dropdown-menu/.dropdown-item`, `.tooltip-wrap/.tooltip-box`, `.toast-demo`, `.chip-demo`, `.tag-demo`, `.breadcrumb-demo`, `.spinner`, `.skeleton`, `.modal-demo`, `code.inline` |
| `register-role.html` | `.page-wrap`, `.role-grid`, `.role-list` |
| `register-student.html` | `.steps`, `.checkbox-row`, `.done` |

### 2.4 Structural debt to resolve *during* extension (not a separate refactor sprint — Rule #1 compliant)
1. **Duplicated `<style>` blocks per page.** Components like `.grid-3`, `.pager`, `.trend-pill` are redefined locally instead of living in `style.css`. As Instructor pages are built, they will need near-identical grids/stat-rows/pagers — this is the natural moment to **move genuinely shared page-local components into `style.css` under a new "Shared Patterns" section**, and only keep truly page-specific rules local. This directly serves Rule #6/#7 (no duplication, reusable architecture) without touching any existing visual output.
2. **Inline `style="..."` attributes** are used heavily for one-off spacing/color (e.g. `style="font-size:24px;"` on page headers, gradient icon backgrounds). Acceptable for a static prototype; should be tightened to utility classes as the page count grows, so 20 pages don't each hand-roll the same `style="margin-top:22px;"`.
3. **Dead sidebar links** (`<div class="nav-item">` for Calendar/Bookmarks/Profile/Settings) must become `<a href="...">` the moment those pages exist — currently every existing page needs this same one-line fix in 4 places.
4. No JS file exists yet (`assets/` has empty `icons/`, `images/` only). Interactions (dropdown open/close, chat send, tab switching, AI streaming placeholder, sidebar active-state on load) are currently static/hardcoded per page. A shared `js/app.js` should be introduced when the first real interaction is needed (recommended: Sprint on Chat/Tasks/Calendar).

---

## 3. Missing Pages Inventory

### 3.1 Student module — gaps
| Page | Status | Notes from reference mockup |
|---|---|---|
| Calendar | **Missing** | Month grid, "Today's Schedule" list, event chips by time |
| Tasks | **Missing** | Priority-grouped list (High/Medium/Low), "+ Add New Task" |
| Certificates | **Missing** | Certificate cards with issue date + Download action |
| Bookmarks/Saqlangan | **Missing** | Saved-course cards with price + provider |
| Profile | **Missing** | Avatar, personal info grid, stats row (Courses/Completed/Certificates/Study time) |
| Settings | **Missing** | Account/Notifications/Privacy/Language/Appearance section list |

### 3.2 Instructor module — not started (entire green-themed role)
| Page | Notes from reference mockup |
|---|---|
| Instructor Dashboard | Revenue/Students/Active courses/Completion-rate stat row, enrollments, pending questions, latest review, AI suggestion card |
| My Courses (instructor) | All/Published/Draft/Archived tabs, course rows w/ student count + status |
| Students | Searchable roster with per-student progress %, enrolled date |
| Analytics (instructor) | Views-over-time line chart, totals/watch-time/enrollments/revenue stat row |
| Revenue | Balance/payouts stat row, Withdraw action, transaction history |
| Reviews | Average rating + total count, per-review rows with reply capability |
| Messages (instructor) | Same chat pattern as student Chat, instructor-side inbox |
| Profile (instructor) | Specialization/experience/courses/member-since, About Me |
| Settings (instructor) | Same section pattern as student Settings, reusable |
| Course Editor / Create Course | Multi-step: 1 Basic Info → 2 Curriculum → 3 Pricing → 4 Publish; curriculum builder with reorderable sections |

### 3.3 Shared/system
- Auth pages exist for student registration only — **Instructor registration form** is missing (role-select page already has an instructor card, but no destination page).
- Admin role: **architecture placeholder only** for this phase (per instructions, no pages yet).

---

## 4. Shared Component Gap List (new components needed, not yet in the design system)

| New component | Needed by |
|---|---|
| `calendar-widget` (month grid + day cell states: today/has-event/selected) | Calendar |
| `schedule-list` / `plan-row` variant with time-left indicator | Calendar, Dashboard (already has a `.plan-row` seed) |
| `task-card` + priority group headers (High/Medium/Low) | Tasks |
| `certificate-card` (cover + issued date + download btn) | Certificates |
| `saved-course-row` (reuse `.course-cover` + `.price-tag` from Marketplace) | Bookmarks |
| `profile-header` (avatar, name, role tag, edit action) + `profile-stat-row` | Profile (student & instructor) |
| `settings-nav-list` (icon + label + chevron rows) | Settings (student & instructor) |
| `student-roster-row` (avatar, name, progress bar, enrolled date) | Instructor Students |
| `revenue-stat-row` + `transaction-row` | Instructor Revenue |
| `review-card` (rating stars, comment, reply box) | Instructor Reviews |
| `wizard-steps` (numbered step header, reusable beyond `register-student.html`'s `.steps`) | Course Editor |
| `curriculum-builder-row` (drag handle, section title, lesson count) | Course Editor |
| `line-chart` pattern (currently only bar/donut/heatmap exist) | Instructor Analytics "Views Over Time" |

All of the above should be built as **extensions of existing primitives** (`.card`, `.badge`, `.avatar`, `.progress-track`, `.stat-card`) — none require a new visual language.

---

## 5. Student Module Roadmap
1. Calendar — reuse `.card`, new `calendar-widget`
2. Tasks — reuse `.card`, `.badge`, new `task-card`
3. Certificates — reuse `.course-cover` pattern, new `certificate-card`
4. Bookmarks — reuse Marketplace's `.mkt-card`/`.price-tag`
5. Profile — new `profile-header`/`profile-stat-row`
6. Settings — new `settings-nav-list`
7. Wire up all sidebar links across **every existing student page** (fix §2.4 point 3) once these six exist.

## 6. Instructor Module Roadmap
1. Instructor auth: role card → **Instructor registration form** (mirror `register-student.html`, green accent via `.btn-teach`)
2. Instructor Dashboard (green sidebar variant)
3. My Courses (instructor) — reuse `.tab-strip`, `.course-grid` patterns
4. Students — new `student-roster-row`
5. Analytics (instructor) — reuse `.grid-3`/`.stat-card`, add line-chart pattern
6. Revenue — new `revenue-stat-row`, `transaction-row`
7. Reviews — new `review-card`
8. Messages — reuse `.chat-shell` wholesale (identical pattern to student Chat)
9. Profile / Settings (instructor) — reuse student versions with role-specific fields
10. Course Editor — new `wizard-steps` + `curriculum-builder-row`

## 7. Shared Module Roadmap
- Promote genuinely shared page-local CSS into `style.css` (§2.4.1) incrementally, page by page, as each is touched — never a standalone rewrite pass.
- Introduce `js/app.js` for: sidebar active-state, dropdown/tab toggling, mobile sidebar collapse, chat send interaction, calendar day selection.
- Introduce an **Instructor sidebar variant**: same `.sidebar` structure, active state color switches from `--violet-600` to `--teach-green` (token already exists — zero new CSS needed beyond one modifier class, e.g. `.sidebar.theme-teach .nav-item.active`).

## 8. Responsive Strategy
Existing pages already follow a consistent pattern: desktop-first grids with a single `@media (max-width: 1100px)` breakpoint collapsing multi-column grids to fewer columns, and in `courses.html` a second breakpoint at `700px` collapsing to one column. **Continuation rule for all new pages:**
- Reuse the same two breakpoints (`1100px`, `700px`) rather than inventing new ones.
- Sidebar collapses to icon-only or off-canvas below `900px` (not yet implemented anywhere — first page needing it should introduce the pattern once, in `style.css`, for all pages to inherit).
- All new grid components (`calendar-widget`, roster tables, revenue tables) must define both breakpoints from the start, matching `course-grid`'s existing convention.

## 9. Component Hierarchy (target folder structure)
Per Sprint 1 instructions, prefer `pages/student/`, `pages/instructor/`, `pages/shared/`. Since the existing project currently has a **flat** `pages/` folder with no role split, the recommended migration is additive and non-breaking:

```
isloh_project/
├── index.html
├── css/
│   └── style.css                (extended, not replaced)
├── js/
│   └── app.js                   (new)
├── assets/{icons,images}/
├── docs/
│   └── SPRINT-1-ARCHITECTURE.md (this file)
└── pages/
    ├── shared/        → login.html, register-role.html, components.html
    ├── student/        → dashboard, courses, course-detail, marketplace, analytics,
    │                     chat, ai-assistant, notifications, calendar, tasks,
    │                     certificates, bookmarks, profile, settings, register-student
    └── instructor/    → dashboard, courses, students, analytics, revenue, reviews,
                          messages, profile, settings, course-editor, register-instructor
```
This move only changes file **locations**, not markup/CSS — all `../css/style.css` relative paths stay valid one level up. Recommended timing: do this reorg once, right before Sprint 2 begins, so all new pages are authored directly into the correct folder instead of moving twice.

## 10. Routing / Dependency Map (current + planned)
```
index.html → pages/shared/login.html
login.html → register-role.html | student/dashboard.html
register-role.html → student/register-student.html | instructor/register-instructor.html (NEW)
student/dashboard.html ↔ courses ↔ course-detail ↔ marketplace ↔ analytics ↔ chat ↔ ai-assistant
                        ↔ notifications ↔ calendar(NEW) ↔ tasks(NEW) ↔ certificates(NEW)
                        ↔ bookmarks(NEW) ↔ profile(NEW) ↔ settings(NEW)
instructor/dashboard.html(NEW) ↔ courses(NEW) ↔ students(NEW) ↔ analytics(NEW) ↔ revenue(NEW)
                        ↔ reviews(NEW) ↔ messages(NEW) ↔ profile(NEW) ↔ settings(NEW)
                        ↔ course-editor(NEW, 4-step wizard)
shared: components.html (design-system reference, linked from every sidebar)
```

## 11. Implementation Roadmap — Sprints 2–10
| Sprint | Deliverable |
|---|---|
| 2 | Folder reorg (§9) + promote shared page-local CSS into `style.css` + fix dead sidebar links on all existing student pages |
| 3 | Student: Calendar + Tasks |
| 4 | Student: Certificates + Bookmarks |
| 5 | Student: Profile + Settings (+ `js/app.js` v1: sidebar/dropdown/tabs) |
| 6 | Instructor: Registration + Dashboard + sidebar theme variant |
| 7 | Instructor: My Courses + Students |
| 8 | Instructor: Analytics + Revenue |
| 9 | Instructor: Reviews + Messages |
| 10 | Instructor: Profile + Settings + Course Editor (wizard) |

Admin role architecture (routing stubs only, no UI) can be scaffolded alongside Sprint 6 once the Instructor sidebar variant pattern proves out the "theme modifier" approach, so Admin can reuse the same mechanism with a third accent.

---

### Ready for Sprint 2
This analysis identifies zero conflicts with the existing visual language — every missing page and component is an extension of a primitive that already exists in `style.css` or in a page-local `<style>` block. Say the word and Sprint 2 (folder reorg + CSS consolidation + dead-link fixes) starts.
