/* ==========================================================================
   ISLOH — Comments module  (Sprint 8B)
   Reusable .comment-card behavior — used inside Discussion threads, Q&A
   answers, and (via the same markup contract) anywhere else a threaded
   reply list appears. Delegated from `document` so it also covers reply
   boxes rendered after this script runs (js/course-builder.js's cloning
   pattern is the precedent for this approach in this codebase).

   Markup contract (each .comment-card):
     [data-comment-reply]     → shows a nested reply composer
     [data-comment-edit]      → toggles contenteditable on [data-comment-text]
     [data-comment-delete]    → removes the comment-card
     [data-comment-react]     → like/heart reaction toggle + count
     [data-comment-pin]       → instructor-only pin toggle (adds .pinned)

   Yangi izoh yozish formasi (avval hech qayerga ulanmagan edi — tugma
   bosilganda hech narsa bo'lmasdi):
     [data-comment-thread]    → forma va ro'yxatni bir doiraga oladi
       [data-comment-list]    → yangi izoh shu ro'yxat BOSHIGA qo'shiladi
       [data-comment-count]   → ro'yxatdagi izohlar soni (avtomat yangilanadi)
       [data-comment-composer]→ <form>; ichida [data-comment-input]

   ESLATMA: yuborilgan izoh saqlanmaydi — muhokama serverga tegishli va
   backend hali yo'q (CLAUDE.md 4-bosqich). Shaxsiy ma'lumot (izohlar,
   xatcho'plar) localStorage'da saqlanadi, lekin boshqalarga ko'rinadigan
   post'ni mahalliy saqlash uni "yuborilgan" qilib ko'rsatib qo'yardi.
   ========================================================================== */

/* Joriy foydalanuvchi — js/profile.js ulangan sahifada haqiqiy profil,
   aks holda umumiy zaxira */
function isloh_commentAuthor() {
  if (typeof isloh_getUserProfile === 'function') {
    const user = isloh_getUserProfile();
    const initials = typeof isloh_getUserInitials === 'function' ? isloh_getUserInitials(user.name) : 'SM';
    return { name: user.name || 'Siz', initials: initials };
  }
  return { name: 'Siz', initials: 'SM' };
}

/* Bitta izoh kartochkasi — javob va yangi izoh uchun umumiy */
function isloh_buildCommentCard(text, options) {
  const author = isloh_commentAuthor();
  const card = document.createElement('div');
  card.className = 'comment-card' + (options && options.nested ? ' nested' : '');
  card.innerHTML =
    '<div class="avatar-sm"></div>' +
    '<div class="comment-body">' +
      '<div class="comment-head"><span class="comment-name"></span>' +
        '<span class="role-badge student">Talaba</span><span class="comment-time">hozir</span></div>' +
      '<div class="comment-text" data-comment-text></div>' +
      '<div class="comment-actions">' +
        '<button data-comment-react><i class="bi bi-hand-thumbs-up"></i> <span data-react-count>0</span></button>' +
        '<button data-comment-reply><i class="bi bi-reply"></i> Javob berish</button>' +
      '</div>' +
    '</div>';
  // Matnlar textContent orqali — foydalanuvchi kiritgani HTML sifatida talqin qilinmasin
  card.querySelector('.avatar-sm').textContent = author.initials;
  card.querySelector('.comment-name').textContent = author.name;
  card.querySelector('[data-comment-text]').textContent = text;
  return card;
}

function isloh_refreshCommentCounts() {
  document.querySelectorAll('[data-comment-list]').forEach((list) => {
    const scope = list.closest('[data-comment-thread]') || list.parentElement;
    const label = scope && scope.querySelector('[data-comment-count]');
    if (!label) return;
    label.textContent = list.querySelectorAll(':scope > .comment-card').length + ' ta muhokama';
  });
}

function isloh_initCommentComposer() {
  document.querySelectorAll('[data-comment-composer]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault(); // file:// ostida sahifa qayta yuklanmasin

      const input = form.querySelector('[data-comment-input]');
      const text = input ? input.value.trim() : '';
      if (!text) { if (input) input.focus(); return; }

      const scope = form.closest('[data-comment-thread]');
      const list = scope && scope.querySelector('[data-comment-list]');
      if (!list) return;

      list.prepend(isloh_buildCommentCard(text));
      input.value = '';
      isloh_refreshCommentCounts();
      if (typeof isloh_showToast === 'function') isloh_showToast('Izohingiz yuborildi', 'success');
    });
  });

  isloh_refreshCommentCounts();
}

function isloh_commentsInit() {
  document.addEventListener('click', (e) => {
    const reactBtn = e.target.closest('[data-comment-react]');
    if (reactBtn) {
      const countEl = reactBtn.querySelector('[data-react-count]');
      let count = parseInt(countEl?.textContent || '0', 10);
      const active = reactBtn.classList.toggle('active');
      count += active ? 1 : -1;
      if (countEl) countEl.textContent = Math.max(0, count);
      return;
    }

    const editBtn = e.target.closest('[data-comment-edit]');
    if (editBtn) {
      const card = editBtn.closest('.comment-card');
      const textEl = card?.querySelector('[data-comment-text]');
      if (!textEl) return;
      const editing = textEl.getAttribute('contenteditable') === 'true';
      if (editing) {
        textEl.removeAttribute('contenteditable');
        editBtn.innerHTML = '<i class="bi bi-pencil"></i> Tahrirlash';
        if (typeof isloh_showToast === 'function') isloh_showToast('Izoh yangilandi', 'success');
      } else {
        textEl.setAttribute('contenteditable', 'true');
        textEl.focus();
        editBtn.innerHTML = '<i class="bi bi-check2"></i> Saqlash';
      }
      return;
    }

    const delBtn = e.target.closest('[data-comment-delete]');
    if (delBtn) {
      delBtn.closest('.comment-card')?.remove();
      if (typeof isloh_showToast === 'function') isloh_showToast("Izoh o'chirildi", 'info');
      return;
    }

    const pinBtn = e.target.closest('[data-comment-pin]');
    if (pinBtn) {
      const card = pinBtn.closest('.comment-card');
      card?.classList.toggle('pinned');
      return;
    }

    const replyBtn = e.target.closest('[data-comment-reply]');
    if (replyBtn) {
      const card = replyBtn.closest('.comment-card');
      let box = card?.querySelector(':scope > .comment-body > [data-comment-reply-box]');
      if (box) { box.hidden = !box.hidden; if (!box.hidden) box.querySelector('input')?.focus(); return; }
      box = document.createElement('div');
      box.dataset.commentReplyBox = '';
      box.style.cssText = 'display:flex; gap:8px; margin-top:8px;';
      box.innerHTML = `<input placeholder="Javob yozing..." aria-label="Javob yozing" style="flex:1; border:1px solid var(--border-soft); border-radius:var(--r-sm); padding:7px 10px; font-size:12.5px;">
        <button class="btn btn-teach btn-sm" data-comment-reply-send>Yuborish</button>`;
      card?.querySelector('.comment-body')?.appendChild(box);
      box.querySelector('input')?.focus();
      return;
    }

    const sendBtn = e.target.closest('[data-comment-reply-send]');
    if (sendBtn) {
      const box = sendBtn.closest('[data-comment-reply-box]');
      const input = box?.querySelector('input');
      const card = sendBtn.closest('.comment-card');
      const list = card?.closest('[data-reply-list]') || card?.parentElement;
      if (!input?.value.trim() || !list) return;
      card.after(isloh_buildCommentCard(input.value.trim(), { nested: true }));
      box.remove();
      isloh_refreshCommentCounts();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_commentsInit();
  isloh_initCommentComposer();
});
