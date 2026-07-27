# ISLOH Frontend — Sprint 3B Summary

Student Personal Workspace: **Profile**, **Settings**, **Certificates**, **Bookmarks** (all new) and the **Notification Center** (upgraded). With this, the Student module is feature-complete. UI language is unchanged — see §10.

Scope discipline: only the five deliverables above were built. No Instructor, Course Builder, or Admin work — those routes still point to the existing `coming-soon.html` placeholder.

---

## 1. Student Personal Workspace Summary
- **Profile** — cover + overlapping avatar header, editable-looking personal info, bio, skills (leveled tags), learning goals (with done/pending state), achievements grid (earned + locked badges), a 4-card stat row (completed courses / certificates / study hours / streak), recent courses, favorite categories, and an activity timeline.
- **Settings** — a modular settings center with a sticky left-nav that switches between 8 sections: Account, Notifications, Appearance, Language & region, Privacy, Security (password + 2FA + active sessions), Accessibility, and a visually-distinct Danger Zone (UI only). Toggles reuse the existing `.switch` component.
- **Certificates** — earned / in-progress / locked cards in a responsive grid, each with seal, verification badge, issued date, instructor, and a download (earned) or continue (in-progress) / view (locked) action. Status filters + search + empty state, all functional.
- **Bookmarks** — saved courses / lessons / notes / articles as cards with type badges and a remove button; a collections sidebar + recent-saves rail; type filters, search, sort (recent / title), live remove with count update, and an empty state.
- **Notification Center** — the old static list upgraded into a real center: category filter rail (All / Courses / Tasks / Calendar / Messages / AI / Achievements / System), search, per-item mark-read + delete, mark-all-read, live unread recount + topbar badge sync, a shortcut to notification settings, and an empty state.

## 2. Files Modified
- `js/navigation.js` — pointed `profile`, `settings`, `certificates`, `bookmarks` to their real pages (no more student `coming-soon` links).
- `js/notifications.js` — upgraded from a Sprint-2 stub into full center logic (mark read / mark all / delete / recount), integrated with the shared filter engine.
- `css/widgets.css` — appended the Sprint 3B widget section (profile, settings, certificate, bookmark, notification-action widgets).
- `pages/shared/notifications.html` — replaced the static list with the filterable, actionable Notification Center; added filterable + notifications scripts; made the filter rail buttons real `<button>`s.

## 3. Files Created
```
pages/student/profile.html
pages/student/settings.html
pages/student/certificates.html
pages/student/bookmarks.html
js/filterable.js    — generic filter-chips + search + empty-state engine
js/settings.js      — settings section-nav switching
js/bookmarks.js     — bookmark remove + sort
docs/SPRINT-3B-SUMMARY.md  (this file)
```

## 4. Components Reused (unchanged)
Sidebar + `NAV_CONFIG`, topbar, `.card`/`.card-pad`, `.btn` variants, `.badge` variants, `.stat-card`/`.stat-icon`/`.stat-value`, `.progress-track`/`.progress-fill`, `.switch` (settings toggles), `.avatar`, `.filter-chip`/`.filter-bar` (from 3A), `.view-switch` (3A, reused for appearance theme picker), `.timeline` (3A, reused on profile), `.empty-state` (3A), `.upcoming-row` (3A), design tokens.

## 5. Newly Created Reusable Components (`css/widgets.css`)
Profile cover + header + large avatar, skill tag, achievement badge (earned/locked), goal item, settings layout + settings-nav-item + settings-item + device/session row + danger-zone, certificate card (earned/in-progress/locked) + certificate grid, bookmark card + collection card, notification-action buttons. Plus one reusable **JS** engine: `filterable.js` (used by Certificates, Bookmarks, Notifications — one implementation, three pages).

## 6. Updated Routing Map (student — now fully connected, no placeholders)
```
Dashboard → dashboard.html            Sertifikatlar → certificates.html   ← NEW
Kurslar → courses.html                Saqlangan     → bookmarks.html      ← NEW
Marketplace → marketplace.html        Profil        → profile.html        ← NEW
Kalendar → calendar.html              Sozlamalar    → settings.html       ← NEW
Vazifalar → tasks.html                Bildirishnomalar → ../shared/notifications.html (upgraded)
Chat → chat.html                      Komponentlar  → ../shared/components.html
AI Yordamchi → ai-assistant.html      Chiqish       → ../auth/login.html
Analitika → analytics.html
```
Cross-links added: profile↔settings, certificates→marketplace/course-detail, bookmarks→course-detail, notifications→settings. Every student sidebar item resolves to a real page.

## 7. Responsive Verification
All new widgets use the project breakpoints (1100 / 900 / 700). At ≤1100px: settings collapses to a single column with a horizontal nav, certificate grid drops 3→2, profile/bookmarks side rails move below content. At ≤700px: certificate grid → 1 column, profile header stacks. Reuses existing `.wk-grid-*` collapse rules from 3A.

## 8. Accessibility Verification
Settings nav items are keyboard-operable (`role="button"`, `tabindex="0"`, Enter/Space). Every action button (mark-read, delete, remove-bookmark, download) and every search/select carries an `aria-label`. Filter rails use real `<button>`s. Active sidebar item gets `aria-current="page"`. Focus-visible outlines from `base.css` apply throughout. Notification filter sidebar is a labeled control group.

## 9. Performance Notes
No duplicated styling or logic: the three filterable pages share one `filterable.js` (67 lines) instead of three copies; notification actions live in one module. New CSS is additive to `widgets.css` — no new stylesheet link tags, no token changes, so the cascade cost is unchanged. Static pages carry only the small modules they need.

## 10. Confirmation: Existing Isloh Design NOT Modified
- No token (color/type/radius/shadow/spacing) was altered; every new widget references existing variables.
- Existing pages were untouched except `notifications.html` (upgraded in place, same visual row style) and `navigation.js` (href targets only). Dashboard/Calendar/Tasks/Courses/etc. from earlier sprints are unchanged.
- New pages reuse the exact sidebar/topbar/card/button/badge visuals; nothing was redesigned.
- Verified headless (jsdom): all five pages render the 14-item sidebar with correct active state; settings switches to a single visible panel on nav click; certificates filter 7→2 on "locked"; bookmarks go 7→2 on "courses" and 7→6 on remove; notifications show 5 unread → 0 after mark-all and 2 visible under the course filter.

---

Student module complete and ready for backend integration. Per the Sprint 3B boundary, stopping here — not continuing to Sprint 4 (Instructor).
