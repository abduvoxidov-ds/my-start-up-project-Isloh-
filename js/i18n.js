/* ==========================================================================
   ISLOH — Interfeys tili (i18n)  (Sprint 7B)

   Sozlamalardagi "Interfeys tili" (lang_ui) saqlanardi, lekin hech narsani
   o'zgartirmasdi — tarjima qatlami umuman yo'q edi. Endi mavjud:

   --- Manba tili — o'zbekcha ------------------------------------------------
   Loyihaning barcha matnlari HTML'da o'zbek tilida yozilgan va shundayligicha
   qoladi. Lug'atda faqat `en` va `ru` bor. Ya'ni:
     - o'zbekcha tanlanganda hech qanday almashtirish bo'lmaydi (markupdagi
       matn — asl matn);
     - tarjimasi yo'q kalit ham markupdagi o'zbekcha matnda qoladi, ekran
       bo'sh qolmaydi.
   Bu "kalit → barcha tillar" yondashuvidan farq qiladi, lekin 67 sahifalik
   mavjud loyiha uchun xavfsizroq: tarjima bosqichma-bosqich to'ldiriladi.

   --- Qamrov (halol chegara) ----------------------------------------------
   Hozir tarjima qilingan: yon menyu (barcha 67 sahifada ko'rinadi) va uchta
   sozlamalar sahifasi — ya'ni tilni almashtirgan foydalanuvchi darhol
   natijani ko'radi. Qolgan sahifalarning matnlari hali o'zbekcha; mexanizm
   tayyor, kalitlar vaqt o'tishi bilan qo'shiladi (sozlamalar sahifasidagi
   izoh ham shuni aytadi).

   Markup shartnomasi:
     data-i18n="<kalit>"                  -> elementning matni
     data-i18n-placeholder="<kalit>"      -> placeholder atributi
     data-i18n-aria-label="<kalit>"       -> aria-label atributi
     data-i18n-title="<kalit>"            -> title atributi

   Belgi (<i class="bi ...">) va boshqa bola elementlar saqlanadi: faqat
   matn tugunlari almashtiriladi (pastdagi izohga qara).
   ========================================================================== */

const ISLOH_I18N_SETTINGS_KEY = 'isloh_settings';
const ISLOH_I18N_DEFAULT_LANG = 'uz';

/* <html lang> uchun kod — skrin-riderlar to'g'ri talaffuz qilishi uchun */
const ISLOH_I18N_HTML_LANG = { uz: 'uz', en: 'en', ru: 'ru' };

/* --- Lug'at ---------------------------------------------------------------
   Kalitlar bo'lim bo'yicha guruhlangan: nav.* (yon menyu), set.* (sozlamalar),
   ui.* (umumiy tugma/xabarlar). O'zbekcha yo'q — u markupda.               */
const ISLOH_I18N = {
  en: {
    /* Yon menyu — kalitlar js/navigation.js dagi NAV_CONFIG `key` maydoni
       bilan bir xil bo'lishi SHART, aks holda tarjima topilmaydi. */
    'nav.dashboard': 'Dashboard',
    'nav.courses': 'My courses',
    'nav.marketplace': 'Marketplace',
    'nav.bookmarks': 'Saved',
    'nav.calendar': 'Assignments',
    'nav.chat': 'Chat',
    'nav.ai-assistant': 'AI assistant',
    'nav.certificates': 'Certificates',
    'nav.settings': 'Settings',
    'nav.components': 'Components',
    'nav.students': 'Students',
    'nav.assignments': 'Assignments',
    'nav.analytics': 'Analytics',
    'nav.messages': 'Messages',
    'nav.reviews': 'Reviews',
    'nav.revenue': 'Revenue',
    'nav.admin-dashboard': 'Dashboard',
    'nav.admin-users': 'Users',
    'nav.admin-courses': 'Courses',
    'nav.admin-marketplace': 'Marketplace',
    'nav.admin-settings': 'Settings',
    'nav.logout': 'Log out',

    /* Topbar avatar menyusi (js/user-menu.js) */
    'menu.profile': 'Profile',
    'menu.account': 'Account',
    'menu.settings': 'Settings',
    'menu.admin-settings': 'Settings',

    /* Breadcrumb'dagi rol nomi */
    'bc.student': 'Student',
    'bc.instructor': 'Instructor',
    'bc.admin': 'Admin',

    /* Select variantlari */
    'opt.lang.uz': 'Uzbek',
    'opt.lang.en': 'English',
    'opt.lang.ru': 'Russian',
    'opt.tz.tashkent': '(GMT+5) Tashkent',
    'opt.tz.moscow': '(GMT+3) Moscow',

    /* Sozlamalar — bo'lim nomlari */
    'set.title': 'Settings',
    'set.sub.student': 'Manage your account, privacy and app settings.',
    'set.sub.instructor': 'Manage payouts, privacy and app settings.',
    'set.reset': 'Reset to defaults',
    'set.nav.notifications': 'Notifications',
    'set.nav.payments': 'Payouts',
    'set.nav.appearance': 'Appearance',
    'set.nav.language': 'Language & region',
    'set.nav.privacy': 'Privacy',
    'set.nav.security': 'Security',
    'set.nav.accessibility': 'Accessibility',
    'set.nav.danger-label': 'Danger zone',
    'set.nav.danger': 'Delete account',

    'set.notif.title': 'Notifications',
    'set.notif.sub': 'Choose which events you want to hear about.',
    'set.notif.email': 'Email notifications',
    'set.notif.email.desc': 'Important updates are sent to your email',
    'set.notif.lessons': 'Lesson reminders',
    'set.notif.lessons.desc': 'A reminder before scheduled lessons',
    'set.notif.deadlines': 'Assignment deadlines',
    'set.notif.deadlines.desc': 'A warning as the deadline approaches',
    'set.notif.students': 'When a new student enrols',
    'set.notif.students.desc': 'Get notified when someone joins your course',
    'set.notif.submissions': 'When work is submitted',
    'set.notif.submissions.desc': 'A reminder about submissions waiting to be graded',
    'set.notif.reviews': 'When a review is left',
    'set.notif.reviews.desc': 'Get notified when students leave a review',
    'set.notif.payouts': 'Payments and revenue',
    'set.notif.payouts.desc': 'Get notified when a new payment arrives',
    'set.notif.ai': 'AI suggestions',
    'set.notif.ai.desc.student': 'Personal suggestions from the AI assistant',
    'set.notif.ai.desc.instructor': 'Course and student insights from the AI assistant',
    'set.notif.marketing': 'Marketing messages',
    'set.notif.marketing.desc.student': 'Discounts and new courses',
    'set.notif.marketing.desc.instructor': 'Platform news and recommendations',
    'set.notif.pending': 'Your choices are saved. Sending messages will work once the email/push service is connected.',

    'set.pay.title': 'Payouts',
    'set.pay.sub': 'Manage how you withdraw your earnings.',
    'set.pay.primary': 'Primary method',
    'set.pay.backup': 'Backup method',
    'set.pay.verified': 'Verified',
    'set.pay.manage': 'Manage',
    'set.pay.add': 'Add a new method',
    'set.pay.auto.title': 'Automatic withdrawal',
    'set.pay.auto': 'Withdraw automatically each month',
    'set.pay.auto.desc': 'Transferred automatically once the balance passes $100',
    'set.pay.tin': 'Tax identification number (TIN)',
    'set.pay.tin.ph': 'Enter your TIN',

    'set.appear.title': 'Appearance',
    'set.appear.sub': 'Adjust how the app looks.',
    'set.appear.theme': 'Theme',
    'set.appear.theme.desc': '"Auto" follows your system setting',
    'set.appear.light': 'Light',
    'set.appear.dark': 'Dark',
    'set.appear.auto': 'Auto',
    'set.appear.compact': 'Compact mode',
    'set.appear.compact.desc': 'Reduce the spacing between elements',
    'set.appear.anim': 'Animations',
    'set.appear.anim.desc': 'Enable transition effects',

    'set.lang.title': 'Language & region',
    'set.lang.sub': 'Interface language and time zone.',
    'set.lang.ui': 'Interface language',
    'set.lang.tz': 'Time zone',
    'set.lang.pending': 'The time zone and language apply to dates and times (visible the next time a page opens). Translation currently covers the navigation and this page; the remaining pages are being translated.',

    'set.priv.title': 'Privacy',
    'set.priv.sub': 'Control who can see your information.',
    'set.priv.profile': 'Profile visibility',
    'set.priv.profile.desc.student': 'Other students can see your profile',
    'set.priv.profile.desc.instructor': 'Students can see your profile',
    'set.priv.stats': 'Learning statistics',
    'set.priv.stats.desc': 'Show your achievements on the leaderboard',
    'set.priv.stats.instructor': 'Show statistics',
    'set.priv.stats.desc.instructor': 'Show ratings and achievements on your public profile',
    'set.priv.online': 'Online status',
    'set.priv.online.desc.student': 'Show when you are active',
    'set.priv.online.desc.instructor': 'Show your activity to students',
    'set.priv.pending.student': 'Your choices are saved. Hiding your profile from others happens on the server — once the backend is connected.',
    'set.priv.pending.instructor': 'Your choices are saved. Hiding your profile from students happens on the server — once the backend is connected.',

    'set.sec.title': 'Security',
    'set.sec.sub': 'Password, two-factor authentication and active sessions.',
    'set.sec.current': 'Current password',
    'set.sec.current.ph': 'Your current password',
    'set.sec.new': 'New password',
    'set.sec.new.ph': 'At least 6 characters',
    'set.sec.confirm': 'Confirm new password',
    'set.sec.confirm.ph': 'Repeat the new password',
    'set.sec.submit': 'Update password',
    'set.sec.2fa': 'Two-factor authentication (2FA)',
    'set.sec.2fa.desc': 'An extra layer of security',
    'set.sec.sessions': 'Active sessions',
    'set.sec.current-session': 'Current',
    'set.sec.revoke': 'Sign out',
    'set.sec.empty': 'No other active sessions.',
    'set.sec.pending': 'The password fields only check the format — actually changing your password and 2FA will work once the authentication server is connected.',

    'set.a11y.title': 'Accessibility',
    'set.a11y.sub': 'Settings that make the app easier to use.',
    'set.a11y.large': 'Large text',
    'set.a11y.large.desc': 'Show text at a larger size',
    'set.a11y.contrast': 'High contrast',
    'set.a11y.contrast.desc': 'Increase the difference between colours',
    'set.a11y.shortcuts': 'Keyboard shortcuts',
    'set.a11y.shortcuts.desc': 'Alt+1…9 jump to the sidebar menu',

    'set.danger.title': 'Danger zone',
    'set.danger.sub': 'These actions cannot be undone. Be careful.',
    'set.danger.deactivate': 'Temporarily deactivate account',
    'set.danger.deactivate.desc.student': 'Your profile will be hidden for a while',
    'set.danger.deactivate.desc.instructor': 'Your courses will be hidden for a while',
    'set.danger.deactivate.btn': 'Deactivate',
    'set.danger.delete': 'Delete account permanently',
    'set.danger.delete.desc.student': 'All your data will be deleted',
    'set.danger.delete.desc.instructor': 'All courses and data will be deleted',
    'set.danger.delete.btn': 'Delete',

    /* Umumiy */
    'ui.cancel': 'Cancel',
    'ui.close': 'Close',
    'ui.reset.title': 'Reset settings to defaults',
    'ui.reset.warn': 'This cannot be undone. Your profile, courses and learning progress are untouched.',
    'ui.reset.confirm': 'Yes, reset'
  },

  ru: {
    'nav.dashboard': 'Панель',
    'nav.courses': 'Мои курсы',
    'nav.marketplace': 'Маркетплейс',
    'nav.bookmarks': 'Сохранённое',
    'nav.calendar': 'Задания',
    'nav.chat': 'Чат',
    'nav.ai-assistant': 'ИИ-помощник',
    'nav.certificates': 'Сертификаты',
    'nav.settings': 'Настройки',
    'nav.components': 'Компоненты',
    'nav.students': 'Студенты',
    'nav.assignments': 'Задания',
    'nav.analytics': 'Аналитика',
    'nav.messages': 'Сообщения',
    'nav.reviews': 'Отзывы',
    'nav.revenue': 'Доход',
    'nav.admin-dashboard': 'Панель',
    'nav.admin-users': 'Пользователи',
    'nav.admin-courses': 'Курсы',
    'nav.admin-marketplace': 'Маркетплейс',
    'nav.admin-settings': 'Настройки',
    'nav.logout': 'Выйти',

    'menu.profile': 'Профиль',
    'menu.account': 'Аккаунт',
    'menu.settings': 'Настройки',
    'menu.admin-settings': 'Настройки',

    'bc.student': 'Студент',
    'bc.instructor': 'Преподаватель',
    'bc.admin': 'Админ',

    'opt.lang.uz': 'Узбекский',
    'opt.lang.en': 'Английский',
    'opt.lang.ru': 'Русский',
    'opt.tz.tashkent': '(GMT+5) Ташкент',
    'opt.tz.moscow': '(GMT+3) Москва',

    'set.title': 'Настройки',
    'set.sub.student': 'Управляйте аккаунтом, приватностью и настройками приложения.',
    'set.sub.instructor': 'Управляйте выплатами, приватностью и настройками приложения.',
    'set.reset': 'Сбросить настройки',
    'set.nav.notifications': 'Уведомления',
    'set.nav.payments': 'Выплаты',
    'set.nav.appearance': 'Внешний вид',
    'set.nav.language': 'Язык и регион',
    'set.nav.privacy': 'Приватность',
    'set.nav.security': 'Безопасность',
    'set.nav.accessibility': 'Доступность',
    'set.nav.danger-label': 'Опасная зона',
    'set.nav.danger': 'Удалить аккаунт',

    'set.notif.title': 'Уведомления',
    'set.notif.sub': 'Выберите, о каких событиях вы хотите знать.',
    'set.notif.email': 'Уведомления по email',
    'set.notif.email.desc': 'Важные новости придут на вашу почту',
    'set.notif.lessons': 'Напоминания об уроках',
    'set.notif.lessons.desc': 'Напоминание перед запланированными уроками',
    'set.notif.deadlines': 'Сроки заданий',
    'set.notif.deadlines.desc': 'Предупреждение при приближении срока',
    'set.notif.students': 'Когда записывается новый студент',
    'set.notif.students.desc': 'Уведомление о новом студенте на курсе',
    'set.notif.submissions': 'Когда сдают работу',
    'set.notif.submissions.desc': 'Напоминание о работах, ожидающих проверки',
    'set.notif.reviews': 'Когда оставляют отзыв',
    'set.notif.reviews.desc': 'Уведомление о новых отзывах студентов',
    'set.notif.payouts': 'Платежи и доход',
    'set.notif.payouts.desc': 'Уведомление о новом платеже',
    'set.notif.ai': 'Рекомендации ИИ',
    'set.notif.ai.desc.student': 'Персональные советы от ИИ-помощника',
    'set.notif.ai.desc.instructor': 'Аналитика по курсам и студентам от ИИ-помощника',
    'set.notif.marketing': 'Маркетинговые сообщения',
    'set.notif.marketing.desc.student': 'Скидки и новые курсы',
    'set.notif.marketing.desc.instructor': 'Новости платформы и рекомендации',
    'set.notif.pending': 'Ваш выбор сохранён. Отправка сообщений заработает после подключения email/push-сервиса.',

    'set.pay.title': 'Выплаты',
    'set.pay.sub': 'Управляйте способами вывода дохода.',
    'set.pay.primary': 'Основной способ',
    'set.pay.backup': 'Резервный способ',
    'set.pay.verified': 'Подтверждён',
    'set.pay.manage': 'Управлять',
    'set.pay.add': 'Добавить способ',
    'set.pay.auto.title': 'Автоматический вывод',
    'set.pay.auto': 'Выводить автоматически каждый месяц',
    'set.pay.auto.desc': 'Перевод произойдёт автоматически, когда баланс превысит $100',
    'set.pay.tin': 'Идентификационный номер налогоплательщика (ИНН)',
    'set.pay.tin.ph': 'Введите ваш ИНН',

    'set.appear.title': 'Внешний вид',
    'set.appear.sub': 'Настройте внешний вид приложения.',
    'set.appear.theme': 'Тема',
    'set.appear.theme.desc': '«Авто» следует системной настройке',
    'set.appear.light': 'Светлая',
    'set.appear.dark': 'Тёмная',
    'set.appear.auto': 'Авто',
    'set.appear.compact': 'Компактный режим',
    'set.appear.compact.desc': 'Уменьшить отступы между элементами',
    'set.appear.anim': 'Анимации',
    'set.appear.anim.desc': 'Включить эффекты переходов',

    'set.lang.title': 'Язык и регион',
    'set.lang.sub': 'Язык интерфейса и часовой пояс.',
    'set.lang.ui': 'Язык интерфейса',
    'set.lang.tz': 'Часовой пояс',
    'set.lang.pending': 'Часовой пояс и язык применяются к датам и времени (видно при следующем открытии страницы). Перевод пока охватывает навигацию и эту страницу; остальные страницы переводятся.',

    'set.priv.title': 'Приватность',
    'set.priv.sub': 'Контролируйте, кто видит ваши данные.',
    'set.priv.profile': 'Видимость профиля',
    'set.priv.profile.desc.student': 'Другие студенты могут видеть ваш профиль',
    'set.priv.profile.desc.instructor': 'Студенты могут видеть ваш профиль',
    'set.priv.stats': 'Статистика обучения',
    'set.priv.stats.desc': 'Показывать ваши достижения в рейтинге',
    'set.priv.stats.instructor': 'Показывать статистику',
    'set.priv.stats.desc.instructor': 'Показывать рейтинг и достижения в открытом профиле',
    'set.priv.online': 'Статус «в сети»',
    'set.priv.online.desc.student': 'Показывать вашу активность',
    'set.priv.online.desc.instructor': 'Показывать вашу активность студентам',
    'set.priv.pending.student': 'Ваш выбор сохранён. Скрытие профиля от других происходит на сервере — после подключения бэкенда.',
    'set.priv.pending.instructor': 'Ваш выбор сохранён. Скрытие профиля от студентов происходит на сервере — после подключения бэкенда.',

    'set.sec.title': 'Безопасность',
    'set.sec.sub': 'Пароль, двухфакторная проверка и активные сеансы.',
    'set.sec.current': 'Текущий пароль',
    'set.sec.current.ph': 'Ваш текущий пароль',
    'set.sec.new': 'Новый пароль',
    'set.sec.new.ph': 'Не менее 6 символов',
    'set.sec.confirm': 'Подтвердите новый пароль',
    'set.sec.confirm.ph': 'Повторите новый пароль',
    'set.sec.submit': 'Обновить пароль',
    'set.sec.2fa': 'Двухфакторная проверка (2FA)',
    'set.sec.2fa.desc': 'Дополнительный уровень безопасности',
    'set.sec.sessions': 'Активные сеансы',
    'set.sec.current-session': 'Текущий',
    'set.sec.revoke': 'Выйти',
    'set.sec.empty': 'Других активных сеансов нет.',
    'set.sec.pending': 'Поля пароля проверяют только формат — реальная смена пароля и 2FA заработают после подключения сервера аутентификации.',

    'set.a11y.title': 'Доступность',
    'set.a11y.sub': 'Настройки, которые упрощают работу с приложением.',
    'set.a11y.large': 'Крупный текст',
    'set.a11y.large.desc': 'Показывать текст крупнее',
    'set.a11y.contrast': 'Высокий контраст',
    'set.a11y.contrast.desc': 'Увеличить различие между цветами',
    'set.a11y.shortcuts': 'Горячие клавиши',
    'set.a11y.shortcuts.desc': 'Alt+1…9 переходят по боковому меню',

    'set.danger.title': 'Опасная зона',
    'set.danger.sub': 'Эти действия необратимы. Будьте внимательны.',
    'set.danger.deactivate': 'Временно отключить аккаунт',
    'set.danger.deactivate.desc.student': 'Ваш профиль будет временно скрыт',
    'set.danger.deactivate.desc.instructor': 'Ваши курсы будут временно скрыты',
    'set.danger.deactivate.btn': 'Отключить',
    'set.danger.delete': 'Удалить аккаунт навсегда',
    'set.danger.delete.desc.student': 'Все ваши данные будут удалены',
    'set.danger.delete.desc.instructor': 'Все курсы и данные будут удалены',
    'set.danger.delete.btn': 'Удалить',

    'ui.cancel': 'Отмена',
    'ui.close': 'Закрыть',
    'ui.reset.title': 'Сбросить настройки к значениям по умолчанию',
    'ui.reset.warn': 'Это действие необратимо. Профиль, курсы и прогресс обучения не затрагиваются.',
    'ui.reset.confirm': 'Да, сбросить'
  }
};

/* --- Til va tarjima ------------------------------------------------------- */

function isloh_i18nLang() {
  if (typeof isloh_getSettings === 'function') return isloh_getSettings().lang_ui || ISLOH_I18N_DEFAULT_LANG;
  try {
    const stored = JSON.parse(localStorage.getItem(ISLOH_I18N_SETTINGS_KEY));
    return (stored && stored.lang_ui) || ISLOH_I18N_DEFAULT_LANG;
  } catch (e) {
    return ISLOH_I18N_DEFAULT_LANG;
  }
}

/* Kalitning tarjimasi yoki null (tarjima yo'q -> markupdagi matn qoladi) */
function isloh_t(key) {
  const dict = ISLOH_I18N[isloh_i18nLang()];
  return (dict && dict[key]) || null;
}

/* --- DOM ga qo'llash ------------------------------------------------------
   Asl (o'zbekcha) matn birinchi qo'llashda elementda saqlanadi, shuning
   uchun o'zbekchaga qaytganda yoki tarjimasi yo'q tilda matn tiklanadi. */

const ISLOH_I18N_ATTRS = [
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-title', 'title']
];

/* Matnni almashtirish. Element ichida belgi (<i class="bi ...">) bo'lishi
   mumkin, shuning uchun `textContent` bilan hammasini o'chirib tashlamaymiz:
   oxirgi matn tugunini almashtiramiz, bola elementlar joyida qoladi. */
function isloh_i18nSetText(el, text) {
  const nodes = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());

  if (!nodes.length) {
    el.appendChild(document.createTextNode(text));
    return;
  }
  // Belgidan keyin bo'shliq saqlansin ("<i></i> Sozlamalar")
  const first = nodes[0];
  const lead = /^\s/.test(first.textContent) ? ' ' : '';
  first.textContent = lead + text;
  nodes.slice(1).forEach((n) => { n.textContent = ''; });
}

function isloh_i18nApply() {
  const lang = isloh_i18nLang();
  document.documentElement.lang = ISLOH_I18N_HTML_LANG[lang] || ISLOH_I18N_DEFAULT_LANG;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    if (el.dataset.i18nSource === undefined) el.dataset.i18nSource = el.textContent.trim();
    const text = isloh_t(el.dataset.i18n);
    isloh_i18nSetText(el, text !== null ? text : el.dataset.i18nSource);
  });

  ISLOH_I18N_ATTRS.forEach(([dataAttr, htmlAttr]) => {
    document.querySelectorAll('[' + dataAttr + ']').forEach((el) => {
      const store = 'i18nSource' + htmlAttr.replace('-', '');
      if (el.dataset[store] === undefined) el.dataset[store] = el.getAttribute(htmlAttr) || '';
      const text = isloh_t(el.getAttribute(dataAttr));
      el.setAttribute(htmlAttr, text !== null ? text : el.dataset[store]);
    });
  });

  /* Matnga tayangan modullar (masalan js/sidebar.js dagi klaviatura yorliqlari
     tooltip'i) tarjimadan KEYIN qayta ishlashi kerak — shuning uchun hodisa. */
  document.dispatchEvent(new CustomEvent('isloh:i18n-applied'));
}

/* Til o'zgarganda darhol qo'llanadi (shu tabda ham, boshqa tabda ham) */
document.addEventListener('isloh:settings-updated', (e) => {
  const key = e.detail && e.detail.key;
  if (key === null || key === 'lang_ui') isloh_i18nApply();
});

window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_I18N_SETTINGS_KEY) isloh_i18nApply();
});

/* Yon menyu js/sidebar.js tomonidan DOMContentLoaded'da yasaladi, shuning
   uchun tarjima undan KEYIN ishlashi kerak. `isloh:sidebar-rendered`
   hodisasini sidebar.js chiqaradi. */
document.addEventListener('isloh:sidebar-rendered', isloh_i18nApply);
document.addEventListener('DOMContentLoaded', isloh_i18nApply);
