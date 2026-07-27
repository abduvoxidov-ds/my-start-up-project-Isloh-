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
   ========================================================================== */

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
      const newComment = document.createElement('div');
      newComment.className = 'comment-card nested';
      newComment.innerHTML = `<div class="avatar-sm">SM</div>
        <div class="comment-body">
          <div class="comment-head"><span class="comment-name">Siz</span><span class="role-badge student">Talaba</span><span class="comment-time">hozir</span></div>
          <div class="comment-text" data-comment-text></div>
          <div class="comment-actions">
            <button data-comment-react><i class="bi bi-hand-thumbs-up"></i> <span data-react-count>0</span></button>
            <button data-comment-reply><i class="bi bi-reply"></i> Javob berish</button>
          </div>
        </div>`;
      newComment.querySelector('[data-comment-text]').textContent = input.value.trim();
      card.after(newComment);
      box.remove();
    }
  });
}

document.addEventListener('DOMContentLoaded', isloh_commentsInit);
