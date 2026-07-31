/* ==========================================================================
   ISLOH — Sozlamalar / Xavfli hudud  (Sprint 6C)
   pages/student/settings.html dagi "Xavfli hudud" paneli: hisobni vaqtincha
   to'xtatish va butunlay o'chirish. Ikkala amal ham FAQAT tasdiqlash
   dialogidan keyin bajariladi — tugmani bosishning o'zi hech narsani
   o'chirmaydi.

   Dialoglar loyihaning mavjud `.modal` / `.modal-overlay` komponentidan va
   js/modal.js dagi ochish/yopish yordamchilaridan foydalanadi (fon bosish va
   Escape o'sha yerda hal qilingan) — bu yerda faqat fokus boshqaruvi va
   tasdiqlash mantig'i qo'shiladi. js/modal.js o'zgartirilmagan.

   Ikki amal orasidagi farq:
     To'xtatish  -> faqat `isloh_user` va `isloh_settings` o'chiriladi.
                    O'quv ma'lumotlari (xatcholar, kurslar, sertifikatlar,
                    progress) joyida qoladi — "vaqtincha" ma'nosi shu.
     O'chirish   -> `isloh_` bilan boshlanadigan BARCHA kalitlar o'chiriladi.
                    Qaytarib bo'lmaydi, shuning uchun tasdiq so'zi yoziladi.

   ESLATMA: real backend ulangach bu amallar serverga so'rov yuborishi kerak;
   hozircha faqat mahalliy localStorage tozalanadi (CLAUDE.md 4-bosqich).

   Markup shartnomasi:
     [data-danger-deactivate]      -> to'xtatish tugmasi
     [data-danger-delete]          -> o'chirish tugmasi
     [data-modal-close="<id>"]     -> dialogni yopadigan tugmalar
     [data-modal-autofocus]        -> dialog ochilganda fokus oladigan element
     [data-deactivate-confirm]     -> to'xtatishni yakuniy tasdiqlash
     [data-delete-confirm-input]   -> tasdiq so'zi yoziladigan maydon
     [data-delete-confirm]         -> o'chirishni yakuniy tasdiqlash
   ========================================================================== */

const ISLOH_STORE_PREFIX = 'isloh_';
const ISLOH_SESSION_KEYS = ['isloh_user', 'isloh_settings'];
const ISLOH_DELETE_CONFIRM_WORD = "O'CHIRISH";
const ISLOH_DANGER_REDIRECT = '../auth/login.html';
const ISLOH_DANGER_REDIRECT_DELAY = 1400;

function isloh_dangerToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

/* --- Ma'lumotlarni tozalash ----------------------------------------------- */

/* js/profile.js o'qilganda profilni qayta ekadi — tozalashdan oldin shuni
   to'xtatamiz, aks holda o'chirilgan profil darhol tiklanib qoladi. */
function isloh_stopStoreReseeding() {
  if (typeof isloh_suppressUserSeeding === 'function') isloh_suppressUserSeeding();
}

/* Vaqtincha to'xtatish: profil va sozlamalar olib tashlanadi, o'quv
   ma'lumotlari saqlanib qoladi. */
function isloh_clearSessionData() {
  isloh_stopStoreReseeding();
  ISLOH_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

/* Butunlay o'chirish: faqat `isloh_` prefiksli kalitlar — bir domenda
   yashayotgan boshqa ma'lumotlarga tegilmaydi. */
function isloh_wipeAllData() {
  isloh_stopStoreReseeding();
  Object.keys(localStorage)
    .filter((key) => key.indexOf(ISLOH_STORE_PREFIX) === 0)
    .forEach((key) => localStorage.removeItem(key));
}

/* --- Dialog boshqaruvi ---------------------------------------------------- */

let isloh_dangerLastTrigger = null;

function isloh_openDangerModal(modalId, trigger) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;

  isloh_dangerLastTrigger = trigger || null;
  if (typeof isloh_openModal === 'function') isloh_openModal(modalId);
  else overlay.hidden = false;

  const focusTarget = overlay.querySelector('[data-modal-autofocus]');
  if (focusTarget) focusTarget.focus();
}

function isloh_closeDangerModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;

  if (typeof isloh_closeModal === 'function') isloh_closeModal(modalId);
  else overlay.hidden = true;

  // Fokusni dialogni ochgan tugmaga qaytaramiz
  if (isloh_dangerLastTrigger) {
    isloh_dangerLastTrigger.focus();
    isloh_dangerLastTrigger = null;
  }
}

/* Xabarni ko'rsatib, so'ng kirish sahifasiga o'tamiz.

   `cleanup` yo'naltirishdan oldin yana bir marta bajariladi: do'konlarning
   bir qismi o'qilganda o'zini qayta ekadi (masalan js/profile.js), shuning
   uchun tozalash bilan yo'naltirish orasidagi qisqa oraliqda ma'lumot
   tiklanib qolishi mumkin. Bayroq (isloh_suppressUserSeeding) buni
   asosiy yo'lda to'xtatadi, bu esa qo'shimcha himoya. */
function isloh_finishDangerAction(message, cleanup) {
  isloh_dangerToast(message);
  setTimeout(() => {
    if (typeof cleanup === 'function') cleanup();
    window.location.href = ISLOH_DANGER_REDIRECT;
  }, ISLOH_DANGER_REDIRECT_DELAY);
}

/* --- Tasdiq so'zini solishtirish -----------------------------------------
   Apostrof turli klaviaturalarda turlicha kiritiladi (' ’ ʻ `), shuning
   uchun solishtirishdan oldin bir ko'rinishga keltiriladi — foydalanuvchi
   to'g'ri so'zni yozib turib "noto'g'ri" javobini olmasin. */
function isloh_normalizeConfirmWord(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[‘’ʻʼ`´]/g, "'");
}

function isloh_isDeleteConfirmed(value) {
  return isloh_normalizeConfirmWord(value) === isloh_normalizeConfirmWord(ISLOH_DELETE_CONFIRM_WORD);
}

/* --- Oqimlar -------------------------------------------------------------- */

function isloh_initDeactivateFlow() {
  const openBtn = document.querySelector('[data-danger-deactivate]');
  const confirmBtn = document.querySelector('[data-deactivate-confirm]');
  if (!openBtn || !confirmBtn) return;

  openBtn.addEventListener('click', () => isloh_openDangerModal('modal-deactivate', openBtn));

  confirmBtn.addEventListener('click', () => {
    isloh_clearSessionData();
    isloh_closeDangerModal('modal-deactivate');
    isloh_finishDangerAction("Hisobingiz vaqtincha to'xtatildi", isloh_clearSessionData);
  });
}

function isloh_initDeleteFlow() {
  const openBtn = document.querySelector('[data-danger-delete]');
  const confirmBtn = document.querySelector('[data-delete-confirm]');
  const input = document.querySelector('[data-delete-confirm-input]');
  if (!openBtn || !confirmBtn || !input) return;

  // Tasdiq so'zi to'g'ri yozilmaguncha tugma o'chiq turadi
  function syncConfirmState() {
    confirmBtn.disabled = !isloh_isDeleteConfirmed(input.value);
    confirmBtn.classList.toggle('btn-disabled', confirmBtn.disabled);
  }

  function resetDeleteModal() {
    input.value = '';
    syncConfirmState();
  }

  openBtn.addEventListener('click', () => {
    resetDeleteModal();
    isloh_openDangerModal('modal-delete', openBtn);
  });

  input.addEventListener('input', syncConfirmState);

  confirmBtn.addEventListener('click', () => {
    // Ikkinchi tekshiruv: tugma disabled bo'lsa ham bosilib qolmasin
    if (!isloh_isDeleteConfirmed(input.value)) {
      isloh_dangerToast('Tasdiqlash uchun ' + ISLOH_DELETE_CONFIRM_WORD + " so'zini yozing", 'error');
      input.focus();
      return;
    }
    isloh_wipeAllData();
    isloh_closeDangerModal('modal-delete');
    isloh_finishDangerAction("Hisobingiz va barcha ma'lumotlaringiz o'chirildi", isloh_wipeAllData);
  });

  syncConfirmState();
}

/* Dialogdagi "Bekor qilish" / "×" tugmalari */
function isloh_initDangerModalClosers() {
  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => isloh_closeDangerModal(btn.dataset.modalClose));
  });
}

function isloh_initSettingsDanger() {
  isloh_initDangerModalClosers();
  isloh_initDeactivateFlow();
  isloh_initDeleteFlow();
}

document.addEventListener('DOMContentLoaded', isloh_initSettingsDanger);
