/* ==========================================================================
   ISLOH — Live Session module  (Sprint 8B)
   Powers pages/student/live-sessions.html and pages/instructor/live-sessions.html.
   List filtering (Upcoming / Live / Ended) reuses js/filterable.js.

   Markup contract:
     [data-countdown="<ISO timestamp>"]  → ticking countdown text
     [data-ls-join]                      → join button (disabled unless the
       parent .live-session-card carries data-status="live")
     [data-ls-agenda-toggle] / [data-ls-agenda] → agenda accordion
     [data-ls-participants-more]         → "+N" expands the full list
   ========================================================================== */

function isloh_formatCountdown(ms) {
  if (ms <= 0) return "Boshlandi";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function isloh_tickCountdowns() {
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const target = new Date(el.dataset.countdown).getTime();
    if (Number.isNaN(target)) return;
    el.textContent = isloh_formatCountdown(target - Date.now());
  });
}

function isloh_initJoinButtons() {
  document.querySelectorAll('[data-ls-join]').forEach((btn) => {
    const card = btn.closest('.live-session-card');
    if (card?.dataset.status !== 'live') {
      btn.disabled = true;
      btn.title = card?.dataset.status === 'ended' ? "Sessiya tugagan" : "Sessiya hali boshlanmagan";
    } else {
      btn.addEventListener('click', () => {
        if (typeof isloh_showToast === 'function') isloh_showToast("Jonli sessiyaga qo'shilmoqda... (demo)", 'success');
      });
    }
  });
}

function isloh_initAgendaToggles() {
  document.querySelectorAll('[data-ls-agenda-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card') || btn.closest('.live-session-card');
      const agenda = card?.querySelector('[data-ls-agenda]');
      if (!agenda) return;
      agenda.hidden = !agenda.hidden;
      btn.querySelector('i')?.classList.toggle('bi-chevron-down');
      btn.querySelector('i')?.classList.toggle('bi-chevron-up');
    });
  });
}

function isloh_initParticipantsOverflow() {
  document.querySelectorAll('[data-ls-participants-more]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hiddenAvatars = btn.closest('[data-ls-participants]')?.querySelectorAll('[data-participant-hidden]');
      hiddenAvatars?.forEach((a) => { a.hidden = false; });
      btn.hidden = true;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_tickCountdowns();
  setInterval(isloh_tickCountdowns, 1000);
  isloh_initJoinButtons();
  isloh_initAgendaToggles();
  isloh_initParticipantsOverflow();
});
