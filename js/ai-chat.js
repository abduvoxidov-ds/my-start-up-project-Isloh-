/* ==========================================================================
   ISLOH — AI Chat interactions  (Sprint 8A)
   Runtime behavior for the drawer rendered by js/ai-panel.js. Frontend
   only — "AI replies" are canned content from js/ai-assistant.js's
   ISLOH_AI_CONTEXTS, no network calls.

   Markup contract (all inside #ai-drawer-panel, rendered by ai-panel.js):
     [data-ai-run="<templateKey>"]   → suggestion / prompt-template card
     [data-ai-input] / [data-ai-send] → free-text prompt box
     [data-ai-pin] / [data-ai-minimize] / [data-ai-clear] → head actions
     [data-ai-fav]                   → favorite-star toggle in history rows
     [data-ai-quick="<context>:<templateKey>"] → inline chip anywhere on the
       page (e.g. next to an editor-toolbar) that opens the drawer and runs
       that template immediately
   ========================================================================== */

function isloh_aiPanel() { return document.getElementById('ai-drawer-panel'); }
function isloh_aiContextKey() { return isloh_aiPanel()?.dataset.aiContextKey || null; }

function isloh_aiAvatar(role) {
  return role === 'ai'
    ? '<div class="avatar-sm"><i class="bi bi-stars"></i></div>'
    : '<div class="avatar-sm">SM</div>';
}

function isloh_aiScrollToBottom() {
  const body = document.querySelector('.ai-drawer-body');
  if (body) body.scrollTop = body.scrollHeight;
}

function isloh_aiSetEmptyVisible(visible) {
  const empty = document.querySelector('[data-ai-empty]');
  const suggestions = document.querySelector('[data-ai-suggestions]');
  if (empty) empty.hidden = !visible;
  if (suggestions) suggestions.hidden = !visible;
}

function isloh_aiAppendUserMessage(text) {
  const list = document.querySelector('[data-ai-messages]');
  if (!list) return;
  isloh_aiSetEmptyVisible(false);
  const row = document.createElement('div');
  row.className = 'msg user';
  row.innerHTML = `${isloh_aiAvatar('user')}<div class="msg-bubble"></div>`;
  row.querySelector('.msg-bubble').textContent = text;
  list.appendChild(row);
  isloh_aiScrollToBottom();
}

function isloh_aiAppendTyping() {
  const list = document.querySelector('[data-ai-messages]');
  if (!list) return null;
  const row = document.createElement('div');
  row.className = 'msg ai';
  row.dataset.aiTyping = '';
  row.innerHTML = `${isloh_aiAvatar('ai')}<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  list.appendChild(row);
  isloh_aiScrollToBottom();
  return row;
}

function isloh_aiFlashcardsHtml() {
  const cards = [
    { front:"Docker image", back:"Konteyner ishga tushirish uchun o'zgarmas andoza (shablon)." },
    { front:"Konteyner", back:"Image asosida ishga tushirilgan, izolyatsiyalangan jonli jarayon." },
    { front:"Dockerfile", back:"Image qanday qurilishini belgilaydigan matnli ko'rsatmalar fayli." }
  ];
  const cardHtml = cards.map((c) => `
    <div class="flashcard" data-flashcard tabindex="0" role="button" aria-label="Fleshkartani ag'darish">
      <div class="flashcard-inner">
        <div class="flashcard-face front">${c.front}</div>
        <div class="flashcard-face back">${c.back}</div>
      </div>
    </div>`).join('');
  return `<div style="display:grid; grid-template-columns:1fr; gap:10px;">${cardHtml}</div>`;
}

function isloh_aiInsertIntoEditor(sourceEl) {
  const target = document.querySelector('[data-ai-insert-target]') || document.querySelector('.editor-textarea');
  if (!target) {
    if (typeof isloh_showToast === 'function') isloh_showToast("Muharrirda joy topilmadi", 'error');
    return;
  }
  target.value = (target.value ? target.value + '\n\n' : '') + sourceEl.innerText.trim();
  target.dispatchEvent(new Event('input', { bubbles: true }));
  if (typeof isloh_showToast === 'function') isloh_showToast("Muharrirga qo'shildi", 'success');
}

function isloh_aiAppendAiMessage(templateKey, html) {
  const list = document.querySelector('[data-ai-messages]');
  if (!list) return;

  if (html === '__FLASHCARDS__') html = isloh_aiFlashcardsHtml();

  const isGenerate = ['outline','generate-lesson','generate-quiz','generate-assignment','outcomes','seo','rubric'].includes(templateKey);
  const row = document.createElement('div');
  row.className = 'msg ai';
  const bubbleClass = isGenerate ? 'response-card' + (isloh_aiPanel()?.classList.contains('theme-teach') ? ' teach' : '') : 'msg-bubble';
  row.innerHTML = `${isloh_aiAvatar('ai')}<div>
    <div class="${bubbleClass}" data-ai-response>${html}</div>
    <div class="msg-actions">
      <button data-ai-copy><i class="bi bi-clipboard"></i> Nusxalash</button>
      ${isGenerate ? '<button data-ai-insert><i class="bi bi-box-arrow-in-down"></i> Muharrirga qo\'shish</button>' : ''}
      <button data-ai-regen data-key="${templateKey || ''}"><i class="bi bi-arrow-clockwise"></i> Qayta yaratish</button>
    </div>
  </div>`;
  list.appendChild(row);
  isloh_aiScrollToBottom();

  row.querySelector('[data-ai-copy]')?.addEventListener('click', () => {
    const text = row.querySelector('[data-ai-response]').innerText;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    if (typeof isloh_showToast === 'function') isloh_showToast('Nusxalandi', 'success');
  });
  row.querySelector('[data-ai-insert]')?.addEventListener('click', () => {
    isloh_aiInsertIntoEditor(row.querySelector('[data-ai-response]'));
  });
  row.querySelector('[data-ai-regen]')?.addEventListener('click', () => {
    if (templateKey) isloh_aiRunTemplate(templateKey);
  });

  row.querySelectorAll('[data-flashcard]').forEach((card) => {
    card.addEventListener('click', () => card.classList.toggle('flipped'));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('flipped'); }
    });
  });
}

function isloh_aiRunTemplate(templateKey) {
  const ctxKey = isloh_aiContextKey();
  const template = (typeof isloh_aiFindTemplate === 'function') ? isloh_aiFindTemplate(ctxKey, templateKey) : null;
  if (!template) return;

  isloh_aiAppendUserMessage(template.title);
  const typingRow = isloh_aiAppendTyping();
  setTimeout(() => {
    typingRow?.remove();
    isloh_aiAppendAiMessage(template.key, template.response);
  }, 900);
}

function isloh_aiSendFreeText() {
  const input = document.querySelector('[data-ai-input]');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';
  isloh_aiAppendUserMessage(text);
  const typingRow = isloh_aiAppendTyping();
  setTimeout(() => {
    typingRow?.remove();
    isloh_aiAppendAiMessage(null, `<p>Savolingiz uchun rahmat! Bu demo rejim — real AI javobi hozircha ulanmagan, lekin yuqoridagi shablonlardan birini sinab ko'rishingiz mumkin.</p>`);
  }, 900);
}

function isloh_aiOpenAndRun(contextKey, templateKey) {
  const panelCtx = isloh_aiContextKey();
  if (panelCtx !== contextKey) return; // drawer on this page is scoped to a different context
  isloh_openModal('ai-drawer-overlay');
  document.getElementById('ai-drawer-panel')?.classList.remove('minimized');
  isloh_aiRunTemplate(templateKey);
}

function isloh_initAiDrawerEvents() {
  const mount = document.getElementById('ai-drawer-mount');
  if (!mount) return;

  mount.addEventListener('click', (e) => {
    const runBtn = e.target.closest('[data-ai-run]');
    if (runBtn) { isloh_aiRunTemplate(runBtn.dataset.aiRun); return; }

    const favBtn = e.target.closest('[data-ai-fav]');
    if (favBtn) {
      favBtn.classList.toggle('active');
      favBtn.querySelector('i').className = favBtn.classList.contains('active') ? 'bi bi-star-fill' : 'bi bi-star';
      return;
    }

    if (e.target.closest('[data-ai-send]')) { isloh_aiSendFreeText(); return; }

    if (e.target.closest('[data-ai-pin]')) {
      const btn = e.target.closest('[data-ai-pin]');
      btn.classList.toggle('pinned');
      if (typeof isloh_showToast === 'function') isloh_showToast(btn.classList.contains('pinned') ? 'Panel qadaldi' : 'Panel qadashdan olindi', 'info');
      return;
    }

    if (e.target.closest('[data-ai-minimize]')) {
      const panel = isloh_aiPanel();
      panel?.classList.toggle('minimized');
      const icon = e.target.closest('[data-ai-minimize]').querySelector('i');
      if (icon) icon.className = panel?.classList.contains('minimized') ? 'bi bi-chevron-up' : 'bi bi-dash-lg';
      return;
    }

    if (e.target.closest('[data-ai-clear]')) {
      const list = document.querySelector('[data-ai-messages]');
      if (list) list.innerHTML = '';
      isloh_aiSetEmptyVisible(true);
      if (typeof isloh_showToast === 'function') isloh_showToast('Suhbat tozalandi', 'info');
      return;
    }
  });

  mount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-ai-input]')) { e.preventDefault(); isloh_aiSendFreeText(); }
  });
}

function isloh_initAiQuickChips() {
  document.querySelectorAll('[data-ai-quick]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const [ctxKey, tplKey] = chip.dataset.aiQuick.split(':');
      isloh_aiOpenAndRun(ctxKey, tplKey);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initAiDrawerEvents();
  isloh_initAiQuickChips();
});
