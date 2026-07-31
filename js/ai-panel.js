/* ==========================================================================
   ISLOH — AI Drawer renderer  (Sprint 8A)
   Injects the drawer markup into <div id="ai-drawer-mount"></div>, the same
   "render once from a single source" approach js/sidebar.js uses for the
   nav — so no page hand-writes the drawer HTML.

   Runs as a plain top-level script (NOT inside a DOMContentLoaded listener)
   so the markup exists in the DOM before any other script's own
   DOMContentLoaded handler fires — js/tabs.js (drawer's internal tabs) and
   js/modal.js (backdrop click / Escape-to-close, via the shared
   .modal-overlay contract) both then pick it up automatically.

   Requires js/ai-assistant.js (ISLOH_AI_CONTEXTS) to be included first.
   Markup contract: an element anywhere on the page carrying
   [data-ai-context="<key>"] tells the drawer which context to render.
   ========================================================================== */

function isloh_aiRenderSuggestCard(t) {
  return `<button class="suggest-card" type="button" data-ai-run="${t.key}"><i class="bi ${t.icon}"></i><div class="txt">${t.title}</div></button>`;
}

function isloh_aiRenderPromptCard(t) {
  return `<button class="ai-prompt-card" type="button" data-ai-run="${t.key}">
    <i class="bi ${t.icon}"></i>
    <div><div class="apc-title">${t.title}</div><div class="apc-sub">${t.sub}</div></div>
  </button>`;
}

function isloh_aiRenderHistoryRow(t, favored) {
  return `<div class="ai-history-row"><i class="bi bi-clock-history"></i> ${t.title}
    <button class="fav-toggle${favored ? ' active' : ''}" data-ai-fav aria-label="Sevimlilarga qo'shish"><i class="bi bi-star${favored ? '-fill' : ''}"></i></button>
  </div>`;
}

function isloh_aiRenderDrawer(mount) {
  const contextEl = document.querySelector('[data-ai-context]');
  const contextKey = contextEl ? contextEl.dataset.aiContext : null;
  const ctx = (typeof isloh_aiContext === 'function' && contextKey) ? isloh_aiContext(contextKey) : null;
  if (!ctx) return;

  const isInstructor = ctx.role === 'instructor';
  const suggestions = ctx.templates.slice(0, 3).map(isloh_aiRenderSuggestCard).join('');
  const promptCards = ctx.templates.map(isloh_aiRenderPromptCard).join('');
  const historyRows = ctx.templates.slice(0, 4).map((t, i) => isloh_aiRenderHistoryRow(t, i === 0)).join('');

  mount.innerHTML = `
<div class="modal-overlay ai-drawer-overlay" id="ai-drawer-overlay" hidden>
  <div class="ai-drawer-panel${isInstructor ? ' theme-teach' : ''}" id="ai-drawer-panel" data-ai-context-key="${contextKey}">
    <div class="ai-drawer-head">
      <div class="ai-drawer-title"><i class="bi bi-stars"></i> AI Yordamchi</div>
      <div class="ai-drawer-head-actions">
        <button class="icon-btn" data-ai-pin aria-label="Qadab qo'yish"><i class="bi bi-pin-angle"></i></button>
        <button class="icon-btn" data-ai-minimize aria-label="Kichraytirish"><i class="bi bi-dash-lg"></i></button>
        <button class="icon-btn" data-ai-clear aria-label="Suhbatni tozalash"><i class="bi bi-trash3"></i></button>
        <button class="icon-btn" data-ai-drawer-close aria-label="Yopish"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="ai-drawer-context"><i class="bi bi-bookmark-star-fill"></i> Kontekst: ${ctx.label}</div>

    <div data-tabs style="display:contents;">
      <div class="ai-drawer-tabs tab-strip" role="tablist">
        <div class="tab-item active" data-tab-target="ai-tab-chat">Suhbat</div>
        <div class="tab-item" data-tab-target="ai-tab-templates">Shablonlar</div>
        <div class="tab-item" data-tab-target="ai-tab-history">Tarix</div>
      </div>

      <div class="ai-drawer-body">
        <div data-tab-panel="ai-tab-chat">
          <div class="ai-drawer-empty" data-ai-empty>
            <i class="bi bi-stars"></i>
            <div style="font-weight:700; font-size:14px; margin-top:8px;">Nima bilan yordam beray?</div>
            <p style="font-size:12.5px; color:var(--ink-500); margin-top:4px;">${ctx.label} bo'yicha savol bering yoki quyidagi takliflardan birini tanlang.</p>
          </div>
          <div class="suggest-row" data-ai-suggestions style="margin-top:16px;">${suggestions}</div>
          <div data-ai-messages style="margin-top:18px;"></div>
        </div>

        <div data-tab-panel="ai-tab-templates" hidden>
          <div class="ai-prompt-grid">${promptCards}</div>
        </div>

        <div data-tab-panel="ai-tab-history" hidden>
          <div data-ai-history-list>${historyRows}</div>
        </div>
      </div>
    </div>

    <div class="ai-drawer-foot">
      <div class="ai-input-box">
        <input placeholder="Xabar yozing..." aria-label="Xabar yozing" data-ai-input>
        <button class="send-btn btn btn-primary" style="width:38px;height:38px;padding:0;border-radius:50%;" data-ai-send aria-label="Yuborish" type="button"><i class="bi bi-send-fill"></i></button>
      </div>
      <div class="ai-disclaimer">AI yordamchi xato qilishi mumkin. Muhim ma'lumotlarni tekshiring.</div>
    </div>
  </div>
</div>`;
}

/* Drawer'ni ochish/yopish.

   Sahifalarda `[data-ai-drawer-trigger]` atributi allaqachon bor edi, lekin
   hech qachon ulanmagan — tugmalar inline `onclick="isloh_openModal(...)"`
   bilan ishlardi, bu esa CLAUDE.md §2 da taqiqlangan. Endi bog'lash shu
   yerda, ya'ni atribut qo'yilgan har bir sahifada avtomat ishlaydi
   (course-player, lesson-player, learning-progress). Fon bosish va Escape
   avvalgidek js/modal.js zimmasida. */
function isloh_initAiDrawerControls() {
  document.querySelectorAll('[data-ai-drawer-trigger]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof isloh_openModal === 'function') isloh_openModal('ai-drawer-overlay');
    });
  });

  document.querySelectorAll('[data-ai-drawer-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof isloh_closeModal === 'function') isloh_closeModal('ai-drawer-overlay');
    });
  });
}

(function isloh_aiPanelInit() {
  const mount = document.getElementById('ai-drawer-mount');
  if (!mount) return;
  isloh_aiRenderDrawer(mount);
  document.addEventListener('DOMContentLoaded', isloh_initAiDrawerControls);
})();
