/* ==========================================================================
   ISLOH — Instruktor xabarlar oynasining o'ziga xos qatlami
   (pages/instructor/messages.html)

   js/chat.js uchala rol uchun bir xil: ro'yxat, thread, yuborish, tab'lar.
   Bu fayl esa faqat instruktorda ma'noga ega bo'lgan uch narsani qo'shadi:

     1) E'lon joylash   — kurs guruhiga qadalgan xabar (`pinnedNote`)
     2) Suhbat menyusi  — arxivlash / ovozni o'chirish / e'lonni olib tashlash
     3) Chuqur havola   — messages.html?u=<talabaId> aynan o'sha talaba bilan
                          suhbatni ochadi (pages/instructor/students.html dan)

   NEGA ALOHIDA FAYL: talaba va admin sahifalarida bu boshqaruvlar yo'q, shu
   sababli ularni umumiy chat.js ga qo'shish har bir sahifaga keraksiz kod
   yuklardi. Aloqa bir tomonlama — chat.js `isloh:chat-thread-opened`
   hodisasini yuboradi, bu fayl esa uni tinglaydi (chat.js bu fayl haqida
   bilmaydi).

   Markup shartnomasi:
     [data-chat-announce]        → megafon tugmasi (faqat guruhda ko'rinadi)
       #chat-announce-modal + #chat-announce-title / #chat-announce-body
       [data-chat-announce-submit]
     [data-thread-archive] / [data-thread-archive-label]
     [data-thread-mute]    / [data-thread-mute-label]
     [data-thread-unpin]
   ========================================================================== */

/* Toast matni tarjima kalitidan olinadi, topilmasa o'zbekcha qoladi —
   js/chat.js dagi bir xil qoida (manba tili o'zbekcha). */
function isloh_imToast(key, uz, type, vars) {
  isloh_chatToast(key, uz, type, vars);
}

/* --- 1) Chuqur havola: ?u=<foydalanuvchi id> -----------------------------
   students.html dagi "Xabar yozish" havolasi shu ko'rinishda keladi.
   Email emas, id ishlatiladi — manzil qatorida shaxsiy ma'lumot
   qolmasligi uchun. */
function isloh_imDeepLinkUserId() {
  const match = /[?&]u=([^&]*)/.exec(window.location.search);
  return match ? decodeURIComponent(match[1]) : '';
}

function isloh_imOpenDeepLink() {
  const userId = isloh_imDeepLinkUserId();
  if (!userId) return;

  if (!isloh_chatUser(userId)) {
    isloh_imToast('chat.toast.userNotFound', 'Bu foydalanuvchi topilmadi', 'error');
    return;
  }

  const thread = isloh_chatOpenDirect(userId);
  if (!thread) {
    isloh_imToast('chat.toast.openFail', "Suhbatni ochib bo'lmadi", 'error');
    return;
  }

  /* Tab ochilayotgan suhbatga moslanadi: arxivlangan talabaga havola
     kelsa "Arxiv" tab'i ochiladi, aks holda suhbat panelda ko'rinar,
     lekin ro'yxatda topilmasdi. Arxivdan chiqarish — foydalanuvchining
     o'z qaroriga qoldiriladi, havola uni o'zgartirmaydi. */
  isloh_setChatTab(thread.archived ? 'archive' : ISLOH_CHAT_DEFAULT_TAB);
  isloh_openThread(thread.id);
}

/* --- 2) E'lon boshqaruvlarining ko'rinishi -------------------------------
   Arxivlash va ovozni o'chirish umumiy qatlamda (js/chat.js) — ular admin
   support qutisida ham ishlaydi. Bu yerda faqat e'longa tegishli ikki
   boshqaruv: megafon va "E'lonni olib tashlash". */
function isloh_imSyncAnnounceControls(thread) {
  /* E'lon faqat kurs guruhiga qo'yiladi */
  const announceBtn = document.querySelector('[data-chat-announce]');
  if (announceBtn) announceBtn.hidden = thread.type !== 'group';

  /* Olib tashlash faqat e'lon bor bo'lsa ko'rinadi */
  const unpinBtn = document.querySelector('[data-thread-unpin]');
  if (unpinBtn) unpinBtn.hidden = !thread.pinnedNote;
}

function isloh_imActiveThread() {
  return isloh_activeChatThread();
}

function isloh_imRemovePin() {
  const thread = isloh_imActiveThread();
  if (!thread) return;

  isloh_chatSetPinnedNote(thread.id, '');
  isloh_openThread(thread.id);   // banner va menyu shu yerda yangilanadi
  isloh_imToast('chat.toast.unpinned', "E'lon olib tashlandi");
}

/* --- 3) E'lon joylash ----------------------------------------------------
   E'lon uch joyga boradi:
     a) thread tepasidagi qadalgan banner  (`pinnedNote`)
     b) guruhga oddiy xabar sifatida — talabalar uni suhbatda ko'radi
     c) `isloh_announcements` do'koniga, ya'ni Muhokamalar sahifasida ham
        chiqadi (js/instructor-compose.js bilan umumiy kalit)

   (c) faqat instructor-compose.js ulangan bo'lsa bajariladi — do'kon
   kalitini bu yerda takrorlamaymiz (CLAUDE.md §2). */
function isloh_imSaveAnnouncementToDiscussions(title, body, courseId) {
  if (typeof isloh_readList !== 'function' || typeof ISLOH_ANNOUNCEMENTS_KEY === 'undefined') return;

  const list = isloh_readList(ISLOH_ANNOUNCEMENTS_KEY);
  list.push({ id: 'ann-' + Date.now(), title: title, body: body, courseId: courseId || '', createdAt: new Date().toISOString() });
  isloh_writeList(ISLOH_ANNOUNCEMENTS_KEY, list);
}

function isloh_imSubmitAnnouncement() {
  const thread = isloh_imActiveThread();
  if (!thread || thread.type !== 'group') return;

  const titleEl = document.getElementById('chat-announce-title');
  const bodyEl = document.getElementById('chat-announce-body');
  const title = (titleEl.value || '').trim();
  const body = (bodyEl.value || '').trim();

  if (!title) { isloh_imToast('chat.toast.annSubject', "E'lon sarlavhasini kiriting", 'error'); return; }
  if (!body) { isloh_imToast('chat.toast.annBody', "E'lon matnini kiriting", 'error'); return; }

  isloh_chatSetPinnedNote(thread.id, title);
  /* Xabar ham yuboriladi: banner faqat sarlavhani ko'rsatadi, to'liq matn
     esa suhbatda qolishi kerak. */
  if (!isloh_chatSend(thread.id, body)) {
    isloh_imToast('chat.toast.annSaveFail', "E'lonni saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
    return;
  }
  isloh_imSaveAnnouncementToDiscussions(title, body, thread.courseId);

  titleEl.value = '';
  bodyEl.value = '';
  if (typeof isloh_closeModal === 'function') isloh_closeModal('chat-announce-modal');

  isloh_openThread(thread.id);
  isloh_imToast('chat.toast.annPosted', "E'lon joylandi");
}

/* --- Ishga tushirish ------------------------------------------------------ */

function isloh_initInstructorMessages() {
  /* Faqat instruktor xabarlar sahifasida ishlaydi */
  if (!document.querySelector('[data-chat-announce]')) return;

  document.addEventListener('isloh:chat-thread-opened', (e) => {
    const thread = isloh_chatThread(e.detail.threadId);
    if (thread) isloh_imSyncAnnounceControls(thread);
  });

  document.querySelector('[data-thread-unpin]')?.addEventListener('click', isloh_imRemovePin);

  document.querySelector('[data-chat-announce]')?.addEventListener('click', () => {
    if (typeof isloh_openModal === 'function') isloh_openModal('chat-announce-modal');
    document.getElementById('chat-announce-title')?.focus();
  });
  document.querySelector('[data-chat-announce-submit]')?.addEventListener('click', isloh_imSubmitAnnouncement);

  /* chat.js o'z init'ini shu fayldan OLDIN bajaradi (skript tartibi), ya'ni
     bu paytda birinchi suhbat allaqachon ochilgan — chuqur havola uni
     kerakli suhbatga almashtiradi. */
  isloh_imOpenDeepLink();
}

document.addEventListener('DOMContentLoaded', isloh_initInstructorMessages);
