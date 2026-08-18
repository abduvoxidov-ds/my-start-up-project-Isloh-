/* ==========================================================================
   ISLOH — Muhokamalar sahifasi (student/discussions.html, instructor/…)

   M6 DA QAYTA YOZILDI. Ilgari bu modul faqat DOM'ni qimirlatardi: mavzu
   kartochkalari HTML ichida qo'lda yozilgan edi, like soni `textContent`
   dan o'qilib bittaga oshirilardi, "Qadash" esa shunchaki sinf qo'shardi.
   Sahifa yangilanishi bilan hammasi yo'qolardi va ikkala sahifa (talaba va
   o'qituvchi) bir-biridan mutlaqo bexabar edi.

   Endi manba — js/discussion-store.js (server: `/discussions`).

   MEHNAT TAQSIMOTI:
     RO'YXAT + JAVOBLAR -> shu fayl
     FILTR va QIDIRUV   -> js/filterable.js (`data-filter-item`)
     SARALASH           -> shu fayl (`[data-discussion-sort]`)
     RAQAMLAR           -> shu fayl (`[data-discussion-stat]`)

   MATN EKRANLANADI. Sarlavha, tavsif, javob va MUALLIF ISMI boshqa
   foydalanuvchidan keladi — hammasi `isloh_escapeHtml` orqali o'tadi
   (js/escape.js). Bu M6 ning eng muhim frontend qoidasi.

   Markup shartnomasi:
     [data-thread-list="discussion|qa"]  → mavzular shu yerga chiziladi
     [data-discussion-stat="total|unanswered|solved|pinned"]
     [data-new-thread-form]              → yangi mavzu formasi (modal ichida)
     [data-thread-empty]                 → ro'yxat bo'sh bo'lgandagi holat
   ========================================================================== */

/* Sahifaning roli — yon menyudan. O'qituvchi tomonida qo'shimcha
   tugmalar bor (qadash, moderatsiya), talabada esa yo'q. */
function isloh_discussionRole() {
  const sidebar = document.querySelector('.sidebar[data-role]');
  return (sidebar && sidebar.dataset.role) || 'student';
}

function isloh_discussionCourseId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('course') || params.get('id') || '';
}

/* Joriy foydalanuvchi mavzu/javob muallifimi — tahrirlash va o'chirish
   tugmalari shunga qarab chiziladi. Server baribir qayta tekshiradi;
   bu yerdagisi faqat ishlamaydigan tugma ko'rsatmaslik uchun.

   SOLISHTIRISH ID BO'YICHA. Ism bo'yicha qilib ko'rilgan edi va u
   brauzerda yiqildi: mahalliy profildagi ism serverdagi ism bilan mos
   kelmasa, muallif o'z mavzusida hech qanday tugma ko'rmasdi
   (js/api.js -> isloh_currentUserId). */
function isloh_isMine(author) {
  if (!author || !author.id) return false;
  const me = typeof islohApi !== 'undefined' ? islohApi.currentUserId() : '';
  return Boolean(me) && String(author.id) === me;
}

/* --- Markup --------------------------------------------------------------- */

function isloh_authorAvatarHtml(author, extraClass) {
  const name = (author && author.name) || '?';
  const initials = typeof isloh_getUserInitials === 'function'
    ? isloh_getUserInitials(name)
    : String(name).charAt(0).toUpperCase();
  const teach = (author && author.role === 'instructor') ? ' avatar-teach' : '';
  const value = String((author && author.avatar) || '');

  if (/^(\/|https?:)/.test(value)) {
    return `<div class="avatar-sm${teach}${extraClass || ''}">${isloh_escapeHtml(initials)}<img class="avatar-img" alt="" src="${isloh_escapeAttr(value)}"></div>`;
  }
  const css = isloh_safeCssValue(value);
  const style = css ? ` style="background:${css};"` : '';
  return `<div class="avatar-sm${teach}${extraClass || ''}"${style}>${isloh_escapeHtml(initials)}</div>`;
}

function isloh_roleBadgeHtml(author) {
  return (author && author.role === 'instructor')
    ? '<span class="role-badge instructor">O\'qituvchi</span>'
    : '<span class="role-badge student">Talaba</span>';
}

function isloh_replyCardHtml(reply, thread, canModerate) {
  const nested = reply.parentId ? ' nested' : '';
  const accepted = reply.isAccepted
    ? '<span class="comment-resolved-tag"><i class="bi bi-check-circle-fill"></i> Qabul qilingan</span>'
    : '';

  /* Javobni "qabul qilingan" deb belgilash — savol muallifi yoki
     o'qituvchi (apps/social/views.py). Faqat Savol-Javob turida. */
  const canAccept = thread.kind === 'qa' && !reply.isAccepted
    && (canModerate || isloh_isMine(thread.author));
  const acceptBtn = canAccept
    ? `<button data-reply-accept="${isloh_escapeAttr(reply.id)}"><i class="bi bi-check2-circle"></i> Qabul qilish</button>`
    : '';

  const mine = isloh_isMine(reply.author);
  const editBtn = mine
    ? `<button data-reply-edit="${isloh_escapeAttr(reply.id)}"><i class="bi bi-pencil"></i> Tahrirlash</button>` : '';
  const delBtn = (mine || canModerate)
    ? `<button data-reply-delete="${isloh_escapeAttr(reply.id)}"><i class="bi bi-trash3"></i> O'chirish</button>` : '';

  return `<div class="comment-card${nested}${reply.isPinned ? ' pinned' : ''}" data-reply="${isloh_escapeAttr(reply.id)}">
    ${isloh_authorAvatarHtml(reply.author)}
    <div class="comment-body">
      <div class="comment-head">
        <span class="comment-name">${isloh_escapeHtml((reply.author && reply.author.name) || '')}</span>
        ${isloh_roleBadgeHtml(reply.author)}
        <span class="comment-time">${isloh_escapeHtml(isloh_threadTimeLabel(reply))}</span>
        ${accepted}
      </div>
      <div class="comment-text" data-reply-text>${isloh_escapeHtml(reply.text)}</div>
      <div class="comment-actions">
        <button class="${reply.liked ? 'active' : ''}" data-reply-like="${isloh_escapeAttr(reply.id)}"><i class="bi bi-hand-thumbs-up"></i> <span>${reply.likeCount}</span></button>
        <button data-reply-to="${isloh_escapeAttr(reply.id)}"><i class="bi bi-reply"></i> Javob berish</button>
        ${acceptBtn}${editBtn}${delBtn}
      </div>
    </div>
  </div>`;
}

function isloh_threadCardHtml(thread, role) {
  const canModerate = role === 'instructor';
  const mine = isloh_isMine(thread.author);
  const state = isloh_threadState(thread);

  const pinIcon = thread.isPinned
    ? '<i class="bi bi-pin-angle-fill pin-thread-ic" title="Qadalgan mavzu"></i>' : '';
  const solvedBadge = thread.isSolved
    ? '<span class="solved-badge"><i class="bi bi-check-circle-fill"></i> Hal qilindi</span>' : '';
  const categoryChip = thread.category
    ? `<span class="category-chip">${isloh_escapeHtml(thread.category)}</span>` : '';

  const meta = [
    (thread.author && thread.author.name) || '',
    isloh_threadTimeLabel(thread),
    thread.moduleTitle
  ].filter(Boolean).map((part) => `<span>${isloh_escapeHtml(part)}</span>`).join('<span>&middot;</span>');

  /* Tugmalar rolga qarab. Qadash — faqat o'qituvchi; "hal qilindi" —
     o'qituvchi yoki mavzu muallifi (server ham shunday tekshiradi). */
  const pinBtn = canModerate
    ? `<button class="dt-stat-btn${thread.isPinned ? ' active' : ''}" data-thread-pin="${isloh_escapeAttr(thread.id)}"><i class="bi ${thread.isPinned ? 'bi-pin-fill' : 'bi-pin-angle'}"></i> ${thread.isPinned ? 'Qadalgan' : 'Qadash'}</button>` : '';
  const solveBtn = (canModerate || mine)
    ? `<button class="dt-stat-btn${thread.isSolved ? ' active' : ''}" data-thread-solve="${isloh_escapeAttr(thread.id)}"><i class="bi bi-check2-circle"></i> ${thread.isSolved ? 'Hal qilingan' : 'Hal qilindi deb belgilash'}</button>` : '';
  const delBtn = (canModerate || mine)
    ? `<button class="dt-stat-btn" data-thread-delete="${isloh_escapeAttr(thread.id)}"><i class="bi bi-trash3"></i> O'chirish</button>` : '';

  const excerpt = thread.body
    ? `<div class="dt-excerpt">${isloh_escapeHtml(thread.body)}</div>` : '';

  const replyToggle = thread.replyCount
    ? `<button class="dt-stat-btn" data-thread-replies="${isloh_escapeAttr(thread.id)}"><i class="bi bi-chevron-down"></i> ${thread.replyCount} ta javobni ko'rish</button>`
    : '<span class="dt-stat-btn is-static"><i class="bi bi-chat"></i> Javob yo\'q</span>';

  return `<div class="card discussion-thread${thread.isPinned ? ' dt-pinned' : ''}" data-thread="${isloh_escapeAttr(thread.id)}"
       data-filter-item data-mtype="${state}" data-qcat="${isloh_escapeAttr(thread.category || 'all')}"
       data-filter-text="${isloh_escapeAttr(thread.title + ' ' + thread.body)}"
       data-sort-date="${new Date(thread.createdAt || 0).getTime()}"
       data-sort-likes="${thread.likeCount}" data-sort-replies="${thread.replyCount}">
    <div class="dt-head">
      ${isloh_authorAvatarHtml(thread.author)}
      <div class="dt-head-main">
        <div class="dt-title-row">
          ${pinIcon}
          <div class="dt-title filter-title">${isloh_escapeHtml(thread.title)}</div>
          ${isloh_roleBadgeHtml(thread.author)}
          ${categoryChip}
        </div>
        <div class="dt-meta-row">${meta}</div>
        ${excerpt}
        ${solvedBadge}
        <div class="dt-stats">
          <button class="dt-stat-btn like-btn${thread.liked ? ' active' : ''}" data-thread-like="${isloh_escapeAttr(thread.id)}"><i class="bi bi-hand-thumbs-up"></i> <span>${thread.likeCount}</span></button>
          ${replyToggle}
          ${pinBtn}${solveBtn}${delBtn}
          <button class="dt-stat-btn ml-auto" data-thread-reply-toggle="${isloh_escapeAttr(thread.id)}"><i class="bi bi-reply"></i> Javob berish</button>
        </div>

        <form class="comment-composer comment-composer-reply" data-thread-reply-form="${isloh_escapeAttr(thread.id)}" hidden>
          <input data-reply-input placeholder="Javobingizni yozing..." aria-label="Javobingizni yozing">
          <button type="submit" class="btn btn-teach btn-sm">Yuborish</button>
        </form>

        <div class="reply-list" data-reply-list hidden>
          ${thread.replies.map((reply) => isloh_replyCardHtml(reply, thread, canModerate)).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

/* --- Render --------------------------------------------------------------- */

function isloh_renderDiscussions() {
  const lists = document.querySelectorAll('[data-thread-list]');
  if (!lists.length) return;

  const role = isloh_discussionRole();
  const courseId = isloh_discussionCourseId();

  lists.forEach((list) => {
    /* `data-thread-list="qa"` — Savol-Javob tabi; qiymatsiz bo'lsa
       (o'qituvchi sahifasi) hamma turdagi mavzular chiziladi. */
    const kind = list.dataset.threadList || '';
    const threads = isloh_getCourseThreads(courseId, kind || '');
    list.innerHTML = threads.map((thread) => isloh_threadCardHtml(thread, role)).join('');
  });

  const stats = isloh_discussionStats(courseId);
  document.querySelectorAll('[data-discussion-stat]').forEach((el) => {
    const key = el.dataset.discussionStat;
    if (key in stats) el.textContent = stats[key];
  });

  document.querySelectorAll('[data-filterable]').forEach((scope) => {
    if (typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
  });
}

/* --- Amallar -------------------------------------------------------------- */

function isloh_discussionToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

/* Javob ro'yxatini ochish/yopish — DOM holati, do'konga tegmaydi. */
function isloh_toggleReplyList(threadId) {
  const card = document.querySelector(`[data-thread="${CSS.escape(threadId)}"]`);
  const list = card && card.querySelector('[data-reply-list]');
  if (!list) return;

  list.hidden = !list.hidden;
  const btn = card.querySelector('[data-thread-replies]');
  if (btn) {
    const count = list.querySelectorAll(':scope > .comment-card').length;
    btn.innerHTML = list.hidden
      ? `<i class="bi bi-chevron-down"></i> ${count} ta javobni ko'rish`
      : '<i class="bi bi-chevron-up"></i> Javoblarni yashirish';
  }
}

function isloh_openThreadReplyForm(threadId, parentId) {
  const card = document.querySelector(`[data-thread="${CSS.escape(threadId)}"]`);
  const form = card && card.querySelector('[data-thread-reply-form]');
  if (!form) return;

  form.hidden = false;
  /* Javobga javob — otasi shu formada saqlanadi va yuborishda o'qiladi
     (har javob uchun alohida forma yasash o'rniga). */
  form.dataset.parent = parentId || '';
  const input = form.querySelector('[data-reply-input]');
  if (input) {
    input.placeholder = parentId ? 'Javobga javob yozing...' : 'Javobingizni yozing...';
    input.focus();
  }
}

function isloh_initDiscussionActions() {
  document.addEventListener('click', (e) => {
    const like = e.target.closest('[data-thread-like]');
    if (like) { isloh_toggleThreadLike(like.dataset.threadLike); return; }

    const replies = e.target.closest('[data-thread-replies]');
    if (replies) { isloh_toggleReplyList(replies.dataset.threadReplies); return; }

    const replyToggle = e.target.closest('[data-thread-reply-toggle]');
    if (replyToggle) { isloh_openThreadReplyForm(replyToggle.dataset.threadReplyToggle, ''); return; }

    const pin = e.target.closest('[data-thread-pin]');
    if (pin) {
      const thread = isloh_toggleThreadPin(pin.dataset.threadPin);
      isloh_discussionToast(thread && thread.isPinned ? 'Mavzu qadaldi' : 'Mavzu qadashdan olindi', 'info');
      return;
    }

    const solve = e.target.closest('[data-thread-solve]');
    if (solve) {
      const thread = isloh_toggleThreadSolved(solve.dataset.threadSolve);
      isloh_discussionToast(thread && thread.isSolved ? 'Mavzu hal qilindi' : 'Belgi olib tashlandi', 'info');
      return;
    }

    const del = e.target.closest('[data-thread-delete]');
    if (del) {
      isloh_deleteThread(del.dataset.threadDelete);
      isloh_discussionToast("Mavzu o'chirildi", 'info');
      return;
    }

    const replyLike = e.target.closest('[data-reply-like]');
    if (replyLike) { isloh_toggleReplyLike(replyLike.dataset.replyLike); return; }

    const replyTo = e.target.closest('[data-reply-to]');
    if (replyTo) {
      const card = replyTo.closest('[data-thread]');
      if (card) isloh_openThreadReplyForm(card.dataset.thread, replyTo.dataset.replyTo);
      return;
    }

    const accept = e.target.closest('[data-reply-accept]');
    if (accept) {
      isloh_acceptReply(accept.dataset.replyAccept);
      isloh_discussionToast('Javob qabul qilindi');
      return;
    }

    const replyDelete = e.target.closest('[data-reply-delete]');
    if (replyDelete) {
      isloh_deleteReply(replyDelete.dataset.replyDelete);
      isloh_discussionToast("Javob o'chirildi", 'info');
      return;
    }

    const replyEdit = e.target.closest('[data-reply-edit]');
    if (replyEdit) { isloh_startReplyEdit(replyEdit); return; }
  });

  /* Javob yuborish — forma `submit` orqali (Enter tugmasi ham ishlasin). */
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-thread-reply-form]');
    if (!form) return;

    e.preventDefault();
    const input = form.querySelector('[data-reply-input]');
    const text = input ? input.value.trim() : '';
    if (!text) { if (input) input.focus(); return; }

    isloh_addThreadReply(form.dataset.threadReplyForm, text, form.dataset.parent || '');
    if (input) input.value = '';
    form.dataset.parent = '';
    isloh_discussionToast('Javobingiz yuborildi');
  });
}

/* Tahrirlash joyida: matn `contenteditable` bo'ladi, ikkinchi bosishda
   do'konga yoziladi. Saqlashda `textContent` o'qiladi — HTML EMAS: aks
   holda foydalanuvchi tahrir maydoniga teg joylashi mumkin edi. */
function isloh_startReplyEdit(btn) {
  const card = btn.closest('[data-reply]');
  const textEl = card && card.querySelector('[data-reply-text]');
  if (!textEl) return;

  if (textEl.getAttribute('contenteditable') === 'true') {
    textEl.removeAttribute('contenteditable');
    isloh_saveReplyText(card.dataset.reply, textEl.textContent);
    isloh_discussionToast('Javob yangilandi');
    return;
  }

  textEl.setAttribute('contenteditable', 'true');
  textEl.focus();
  btn.innerHTML = '<i class="bi bi-check2"></i> Saqlash';
}

/* --- Yangi mavzu ----------------------------------------------------------- */

function isloh_initNewThreadForm() {
  const form = document.querySelector('[data-new-thread-form]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[data-thread-title]');
    const body = form.querySelector('[data-thread-body]');
    const kindField = form.querySelector('[data-thread-kind]');

    const value = title ? title.value.trim() : '';
    if (!value) {
      isloh_discussionToast('Mavzu sarlavhasini kiriting', 'error');
      if (title) title.focus();
      return;
    }

    const courseId = isloh_discussionCourseId();
    if (!courseId) {
      isloh_discussionToast('Kurs aniqlanmadi — sahifani kurs havolasi orqali oching', 'error');
      return;
    }

    isloh_saveThread({
      courseId: courseId,
      title: value,
      body: body ? body.value.trim() : '',
      kind: (kindField && kindField.value) || 'discussion'
    });

    form.reset();
    if (typeof isloh_closeModal === 'function') isloh_closeModal(form.dataset.newThreadForm || 'new-thread-modal');
    isloh_discussionToast('Mavzu joylandi');
  });
}

/* --- Saralash -------------------------------------------------------------- */

function isloh_initDiscussionSort() {
  document.querySelectorAll('[data-discussion-sort]').forEach((select) => {
    select.addEventListener('change', () => {
      const list = document.querySelector(select.dataset.discussionSort);
      if (!list) return;

      const key = select.value; // "date" | "likes" | "replies"
      const attr = 'sort' + key.charAt(0).toUpperCase() + key.slice(1);
      const items = [...list.querySelectorAll('[data-thread]')];
      items.sort((a, b) => (parseInt(b.dataset[attr] || 0, 10) - parseInt(a.dataset[attr] || 0, 10)));
      items.forEach((item) => list.appendChild(item));
    });
  });
}

document.addEventListener('isloh:discussions-updated', isloh_renderDiscussions);
/* Profil yuklangach muallif "meniki"ligi aniqlanadi — tugmalar qayta
   chiziladi (aks holda o'z mavzusida "O'chirish" ko'rinmasdi). */
document.addEventListener('isloh:user-updated', isloh_renderDiscussions);

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderDiscussions();
  isloh_initDiscussionActions();
  isloh_initNewThreadForm();
  isloh_initDiscussionSort();
});
