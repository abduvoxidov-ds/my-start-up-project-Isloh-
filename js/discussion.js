/* ==========================================================================
   ISLOH — Discussion module  (Sprint 8B)
   Powers pages/student/discussions.html and pages/instructor/discussions.html.
   List filtering + search reuse js/filterable.js ([data-filterable] /
   [data-filter-item]) — this module only adds what filterable.js doesn't
   cover: thread-level actions and sort order. Reply-level actions (edit /
   delete / reaction / pin) live in js/comments.js.

   Markup contract:
     [data-thread]                     → one .discussion-thread / .qa-card
       [data-thread-like]              → like toggle + count in [data-like-count]
       [data-thread-bookmark]          → bookmark toggle (reuses .fav-toggle)
       [data-thread-pin]               → instructor-only pin toggle
       [data-thread-solve]             → mark-as-solved toggle
       [data-thread-replies-toggle]    → expand/collapse the reply list
     [data-discussion-sort]            → <select> reordering [data-thread]
       rows within their [data-filter-item] list by data-sort-date /
       data-sort-likes / data-sort-replies
     [data-reply-box-toggle] / [data-reply-box]  → per-thread reply composer
   ========================================================================== */

function isloh_initThreadToggles() {
  document.querySelectorAll('[data-thread-like]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const countEl = btn.querySelector('[data-like-count]');
      let count = parseInt(countEl?.textContent || '0', 10);
      const active = btn.classList.toggle('active');
      count += active ? 1 : -1;
      if (countEl) countEl.textContent = Math.max(0, count);
    });
  });

  document.querySelectorAll('[data-thread-bookmark]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const icon = btn.querySelector('i');
      if (icon) icon.className = btn.classList.contains('active') ? 'bi bi-bookmark-fill' : 'bi bi-bookmark';
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(btn.classList.contains('active') ? "Saqlangan mavzularga qo'shildi" : "Saqlangandan olib tashlandi", 'info');
      }
    });
  });

  document.querySelectorAll('[data-thread-pin]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const thread = btn.closest('[data-thread]');
      thread?.classList.toggle('dt-pinned');
      const pinned = thread?.classList.contains('dt-pinned');
      if (typeof isloh_showToast === 'function') isloh_showToast(pinned ? 'Mavzu qadaldi' : 'Mavzu qadashdan olindi', 'info');
    });
  });
}

function isloh_toggleSolved(btn) {
  const thread = btn.closest('[data-thread]');
  const badge = thread?.querySelector('[data-solved-badge]');
  if (!badge) return;
  badge.hidden = !badge.hidden;
  btn.classList.toggle('active', !badge.hidden);
}

function isloh_initReplyToggles() {
  document.querySelectorAll('[data-thread-replies-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const thread = btn.closest('[data-thread]');
      const list = thread?.querySelector('[data-reply-list]');
      if (!list) return;
      const show = list.hidden;
      list.hidden = !show;
      btn.innerHTML = show
        ? `<i class="bi bi-chevron-up"></i> Javoblarni yashirish`
        : `<i class="bi bi-chevron-down"></i> ${list.querySelectorAll('.comment-card').length} ta javobni ko'rish`;
    });
  });

  document.querySelectorAll('[data-reply-box-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const thread = btn.closest('[data-thread]');
      const box = thread?.querySelector('[data-reply-box]');
      if (box) box.hidden = !box.hidden;
      const list = thread?.querySelector('[data-reply-list]');
      if (box && !box.hidden && list) list.hidden = false;
    });
  });
}

function isloh_initDiscussionSort() {
  document.querySelectorAll('[data-discussion-sort]').forEach((select) => {
    select.addEventListener('change', () => {
      const list = document.querySelector(select.dataset.discussionSort);
      if (!list) return;
      const items = [...list.querySelectorAll('[data-thread]')];
      const key = select.value; // "date" | "likes" | "replies"
      items.sort((a, b) => (parseInt(b.dataset[`sort${key[0].toUpperCase()}${key.slice(1)}`] || 0, 10)
                          - parseInt(a.dataset[`sort${key[0].toUpperCase()}${key.slice(1)}`] || 0, 10)));
      items.forEach((item) => list.appendChild(item));
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initThreadToggles();
  isloh_initReplyToggles();
  isloh_initDiscussionSort();

  document.querySelectorAll('[data-thread-solve]').forEach((btn) => {
    btn.addEventListener('click', () => isloh_toggleSolved(btn));
  });
});
