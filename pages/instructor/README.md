# Instructor pages — reserved

This folder is intentionally empty as of Sprint 2.

The Instructor role's routing, sidebar theme (`.sidebar.theme-teach` in
`css/layout.css`) and navigation config (`NAV_CONFIG.instructor` in
`js/navigation.js`) are already prepared. Every Instructor nav item
currently points to `pages/shared/coming-soon.html?role=instructor`.

Real Instructor pages are built starting Sprint 4B/4C (see
`docs/SPRINT-4A-PLAN.md`). The Part-1 sidebar order is:

1. `dashboard.html`
2. `courses.html`       (My Courses)
3. `students.html`
4. `assignments.html`
5. `analytics.html`
6. `messages.html`
7. `reviews.html`
8. `revenue.html`
9. `ai-assistant.html`
10. `notifications.html`  (or reuse the shared one with `?role=instructor`)
11. `profile.html`
12. `settings.html`

Course Builder / Lesson Editor are deferred beyond Sprint 4 and are NOT a
top-level nav item (they'll live as an action on My Courses).

Each should follow the same pattern as `pages/student/*.html`: a
`<aside class="sidebar" data-role="instructor" data-active="...">` mount
point, reusing `css/style.css` and `js/navigation.js` + `js/sidebar.js` —
no new sidebar markup needs to be written by hand.
