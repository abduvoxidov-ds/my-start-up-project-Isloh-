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
    'nav.chat': 'Messages',
    'nav.ai-assistant': 'AI assistant',
    'nav.certificates': 'Certificates',
    'nav.settings': 'Settings',
    'nav.components': 'Components',
    'nav.students': 'Students',
    'nav.assignments': 'Assignments',
    'nav.analytics': 'Analytics',
    'nav.market': 'Marketplace',
    'nav.messages': 'Messages',
    'nav.reviews': 'Reviews',
    'nav.revenue': 'Revenue',
    'nav.admin-dashboard': 'Dashboard',
    'nav.admin-users': 'Users',
    'nav.admin-courses': 'Courses',
    'nav.admin-marketplace': 'Marketplace',
    'nav.admin-messages': 'Messages',
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
    'ui.reset.confirm': 'Yes, reset',
    /* --- Xabarlar moduli (chat) --- uchala rol sahifasida bir xil */
    'chat.title': 'Messages',
    'chat.new': 'New chat',
    'chat.tab.all': 'Chats',
    'chat.tab.groups': 'Groups',
    'chat.tab.archive': 'Archive',
    'chat.search.ph': 'Search a chat or person...',
    'chat.empty.list.title': 'No chats found',
    'chat.empty.list.sub': 'Start one by email with "New chat".',
    'chat.empty.thread.title': 'Select a chat',
    'chat.empty.thread.sub': 'Pick one from the list on the left, or start one with "New chat".',
    'chat.input.ph': 'Write a message...',
    'chat.attach': 'Attach a file',
    'chat.send': 'Send',
    'chat.back': 'Back to the chat list',
    'chat.actions': 'Chat actions',
    'chat.mute': 'Mute notifications',
    'chat.unmute': 'Unmute notifications',
    'chat.archive': 'Archive',
    'chat.unarchive': 'Move out of archive',
    'chat.unpin': 'Remove announcement',
    'chat.announce': 'Post an announcement',
    'chat.modal.new.title': 'Start a new chat',
    'chat.modal.new.ph': "Enter the person's email address...",
    'chat.modal.new.submit': 'Start',
    'chat.modal.ann.title': 'Post an announcement to the group',
    'chat.modal.ann.subject': 'Subject',
    'chat.modal.ann.subjectPh': 'For example: module 6 class tomorrow at 18:00',
    'chat.modal.ann.body': 'Text',
    'chat.modal.ann.bodyPh': 'The full announcement — it is also sent to the group as a message',
    'chat.modal.ann.note': 'The subject is pinned to the top of the chat; the text is sent to the group as a message and appears on the Discussions page.',
    'chat.modal.ann.submit': 'Post',
    'chat.time.now': 'now',
    'chat.time.min': '{n} min',
    'chat.time.hour': '{n} h',
    'chat.time.yesterday': 'Yesterday',
    'chat.time.day': '{n} d',
    'chat.members': '{n} members · {online} online',
    'chat.presence.online': 'Online',
    'chat.presence.busy': 'Busy',
    'chat.presence.offline': 'Offline',
    'chat.you': 'You',
    'chat.group': 'Group',
    'chat.unknownUser': 'Unknown user',
    'chat.badge.aria': '{n} unread messages',
    'chat.toast.notFound': 'No user found with that email',
    'chat.toast.self': 'You cannot start a chat with yourself',
    'chat.toast.createFail': 'Could not create the chat',
    'chat.toast.started': 'Chat with {name} started',
    'chat.toast.quota': 'Could not save the message — browser storage is full',
    'chat.toast.archived': 'Chat archived',
    'chat.toast.unarchived': 'Chat moved out of the archive',
    'chat.toast.muted': 'Notifications muted',
    'chat.toast.unmuted': 'Notifications unmuted',
    'chat.toast.userNotFound': 'This user was not found',
    'chat.toast.openFail': 'Could not open the chat',
    'chat.toast.annSubject': 'Enter the announcement subject',
    'chat.toast.annBody': 'Enter the announcement text',
    'chat.toast.annSaveFail': 'Could not save the announcement — browser storage is full',
    'chat.toast.annPosted': 'Announcement posted',
    'chat.toast.unpinned': 'Announcement removed',

    /* --- AI Yordamchi (js/ai-*.js) ---
       Shablon JAVOBLARI (`response`) ataylab tarjima qilinmagan: ular demo
       ma'lumot, real AI ulanganda butunlay almashadi (CLAUDE.md §4). */
    'ai.new': 'New chat',
    'ai.thread': 'Conversation',
    'ai.threads': 'Conversations',
    'ai.close': 'Close',
    'ai.cancel': 'Cancel',
    'ai.context': 'Context: {label}',
    'ai.greeting': 'Hi, {name}! ✨',
    'ai.sub.student': "I've reviewed your learning analytics",
    'ai.sub.instructor': "I've reviewed the analytics for your courses and students",
    'ai.templates.all': 'All templates',
    'ai.input.ph': 'Type a message...',
    'ai.attach': 'Attach a file',
    'ai.send': 'Send',
    'ai.disclaimer': 'The AI assistant can make mistakes. Verify important information.',
    'ai.history.empty.title': 'No saved conversations',
    'ai.history.empty.sub': 'Your conversation is saved here once you ask a question.',
    'ai.history.meta': '{n} messages',
    'ai.history.del': 'Delete conversation',
    'ai.act.copy': 'Copy',
    'ai.act.insert': 'Insert into editor',
    'ai.act.regen': 'Regenerate',
    'ai.copy.done': 'Copied',
    'ai.copy.fail': 'Could not copy',
    'ai.copy.unsupported': 'Your browser does not support copying',
    'ai.insert.done': 'Inserted into the editor',
    'ai.insert.nospot': 'No editor found on this page',
    'ai.cleared': 'Conversation cleared',
    'ai.thread.other': 'That conversation belongs to another course',
    'ai.quota': 'Storage is full — the conversation is not being saved. Delete old conversations.',
    'ai.del.title': 'Delete conversation',
    'ai.del.note': '"{title}" will be deleted permanently. This cannot be undone.',
    'ai.del.ok': 'Delete',
    'ai.del.done': 'Conversation deleted',
    'ai.demo.lead': 'Answering this properly needs a real AI connection — this is demo mode for now.',
    'ai.demo.hint': 'In the meantime, one of these might help:',
    'ai.time.now': 'just now',
    'ai.time.min': '{n} min ago',
    'ai.time.hour': '{n} h ago',
    'ai.time.yesterday': 'yesterday',
    'ai.time.day': '{n} days ago',

    /* Kontekst yorliqlari */
    'ai.ctx.student-chat': 'AI assistant',
    'ai.ctx.instructor-chat': 'AI assistant',
    'ai.ctx.course-player': 'Course lesson',
    'ai.ctx.learning-progress': 'Learning progress',
    'ai.ctx.course-builder': 'Course structure',
    'ai.ctx.lesson-editor': 'Lesson editing',
    'ai.ctx.quiz-builder': 'Quizzes',
    'ai.ctx.assignment-builder': 'Assignment drafts',

    /* Shablon guruhlari */
    'ai.group.Kundalik': 'Daily',
    'ai.group.O\'rganish': 'Learning',
    'ai.group.Xulosa': 'Summary',
    'ai.group.Talabalar': 'Students',
    'ai.group.Kurs ustida ish': 'Course work',
    'ai.group.Hisobot': 'Reports',

    /* Shablonlar — to'liq sahifali AI Yordamchi (student-chat) */
    'ai.tpl.today-plan.title': 'What should I learn today?',
    'ai.tpl.today-plan.sub': 'Suggests today’s lessons based on your study plan',
    'ai.tpl.focus-check.title': 'How do I check my focus?',
    'ai.tpl.focus-check.sub': 'Analyses your focus level from recent sessions',
    'ai.tpl.motivation.title': 'Analyse my motivation',
    'ai.tpl.motivation.sub': 'Rates your motivation from recent activity and progress',
    'ai.tpl.explain-topic.title': 'Explain the topic simply',
    'ai.tpl.explain-topic.sub': 'Re-explains a concept you missed with different examples',
    'ai.tpl.practice-me.title': 'Give me practice questions',
    'ai.tpl.practice-me.sub': 'Writes 3 questions on the topic you studied last',
    'ai.tpl.exam-plan.title': 'Exam preparation plan',
    'ai.tpl.exam-plan.sub': 'Builds a revision schedule for the time you have left',
    'ai.tpl.week-summary.title': 'Summarise this week',
    'ai.tpl.week-summary.sub': 'Collects what you learned this week into a short summary',
    'ai.tpl.next-course.title': 'Which course should I take next?',
    'ai.tpl.next-course.sub': 'Suggests a next step that fits the courses you finished',

    /* Shablonlar — to'liq sahifali AI Yordamchi (instructor-chat) */
    'ai.tpl.at-risk.title': 'Find students at risk',
    'ai.tpl.at-risk.sub': 'Analyses and finds students whose activity has dropped',
    'ai.tpl.nudge-message.title': 'Write a message to an inactive student',
    'ai.tpl.nudge-message.sub': 'Drafts a short, low-pressure reminder',
    'ai.tpl.review-reply.title': 'Reply to a review',
    'ai.tpl.review-reply.sub': 'Drafts a calm, useful answer to a critical review',
    'ai.tpl.rubric-chat.title': 'Build a rubric for an assignment',
    'ai.tpl.rubric-chat.sub': 'Shapes grading criteria for a practical assignment',
    'ai.tpl.improve-course.title': 'How do I improve my course?',
    'ai.tpl.improve-course.sub': 'Gives improvement ideas based on course statistics',
    'ai.tpl.lesson-ideas.title': 'Suggest new lesson topics',
    'ai.tpl.lesson-ideas.sub': 'Lists extra topics that fit the existing course',
    'ai.tpl.weekly-report.title': 'Prepare a weekly summary',
    'ai.tpl.weekly-report.sub': 'Collects course statistics into a short report',
    'ai.tpl.announcement.title': 'Write an announcement for students',
    'ai.tpl.announcement.sub': 'Drafts an announcement about a course update'
  },

  ru: {
    'nav.dashboard': 'Панель',
    'nav.courses': 'Мои курсы',
    'nav.marketplace': 'Маркетплейс',
    'nav.bookmarks': 'Сохранённое',
    'nav.calendar': 'Задания',
    'nav.chat': 'Сообщения',
    'nav.ai-assistant': 'ИИ-помощник',
    'nav.certificates': 'Сертификаты',
    'nav.settings': 'Настройки',
    'nav.components': 'Компоненты',
    'nav.students': 'Студенты',
    'nav.assignments': 'Задания',
    'nav.analytics': 'Аналитика',
    'nav.market': 'Маркетплейс',
    'nav.messages': 'Сообщения',
    'nav.reviews': 'Отзывы',
    'nav.revenue': 'Доход',
    'nav.admin-dashboard': 'Панель',
    'nav.admin-users': 'Пользователи',
    'nav.admin-courses': 'Курсы',
    'nav.admin-marketplace': 'Маркетплейс',
    'nav.admin-messages': 'Сообщения',
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
    'ui.reset.confirm': 'Да, сбросить',
    /* --- Xabarlar moduli (chat) --- uchala rol sahifasida bir xil */
    'chat.title': 'Сообщения',
    'chat.new': 'Новый чат',
    'chat.tab.all': 'Чаты',
    'chat.tab.groups': 'Группы',
    'chat.tab.archive': 'Архив',
    'chat.search.ph': 'Поиск чата или человека...',
    'chat.empty.list.title': 'Чаты не найдены',
    'chat.empty.list.sub': 'Начните по email через «Новый чат».',
    'chat.empty.thread.title': 'Выберите чат',
    'chat.empty.thread.sub': 'Выберите чат слева или начните через «Новый чат».',
    'chat.input.ph': 'Напишите сообщение...',
    'chat.attach': 'Прикрепить файл',
    'chat.send': 'Отправить',
    'chat.back': 'Назад к списку чатов',
    'chat.actions': 'Действия с чатом',
    'chat.mute': 'Отключить уведомления',
    'chat.unmute': 'Включить уведомления',
    'chat.archive': 'В архив',
    'chat.unarchive': 'Из архива',
    'chat.unpin': 'Убрать объявление',
    'chat.announce': 'Опубликовать объявление',
    'chat.modal.new.title': 'Начать новый чат',
    'chat.modal.new.ph': 'Введите email пользователя...',
    'chat.modal.new.submit': 'Начать',
    'chat.modal.ann.title': 'Объявление для группы',
    'chat.modal.ann.subject': 'Заголовок',
    'chat.modal.ann.subjectPh': 'Например: занятие по модулю 6 завтра в 18:00',
    'chat.modal.ann.body': 'Текст',
    'chat.modal.ann.bodyPh': 'Полный текст объявления — он также уйдёт в группу сообщением',
    'chat.modal.ann.note': 'Заголовок закрепляется сверху чата, текст уходит в группу и появляется на странице Обсуждений.',
    'chat.modal.ann.submit': 'Опубликовать',
    'chat.time.now': 'сейчас',
    'chat.time.min': '{n} мин',
    'chat.time.hour': '{n} ч',
    'chat.time.yesterday': 'Вчера',
    'chat.time.day': '{n} дн',
    'chat.members': '{n} участников · {online} онлайн',
    'chat.presence.online': 'Онлайн',
    'chat.presence.busy': 'Занят',
    'chat.presence.offline': 'Не в сети',
    'chat.you': 'Вы',
    'chat.group': 'Группа',
    'chat.unknownUser': 'Неизвестный пользователь',
    'chat.badge.aria': '{n} непрочитанных сообщений',
    'chat.toast.notFound': 'Пользователь с таким email не найден',
    'chat.toast.self': 'Нельзя начать чат с самим собой',
    'chat.toast.createFail': 'Не удалось создать чат',
    'chat.toast.started': 'Чат с {name} начат',
    'chat.toast.quota': 'Не удалось сохранить сообщение — память браузера заполнена',
    'chat.toast.archived': 'Чат архивирован',
    'chat.toast.unarchived': 'Чат возвращён из архива',
    'chat.toast.muted': 'Уведомления отключены',
    'chat.toast.unmuted': 'Уведомления включены',
    'chat.toast.userNotFound': 'Этот пользователь не найден',
    'chat.toast.openFail': 'Не удалось открыть чат',
    'chat.toast.annSubject': 'Введите заголовок объявления',
    'chat.toast.annBody': 'Введите текст объявления',
    'chat.toast.annSaveFail': 'Не удалось сохранить объявление — память браузера заполнена',
    'chat.toast.annPosted': 'Объявление опубликовано',
    'chat.toast.unpinned': 'Объявление убрано',

    /* --- ИИ-помощник (js/ai-*.js) --- */
    'ai.new': 'Новый чат',
    'ai.thread': 'Диалог',
    'ai.threads': 'Диалоги',
    'ai.close': 'Закрыть',
    'ai.cancel': 'Отмена',
    'ai.context': 'Контекст: {label}',
    'ai.greeting': 'Привет, {name}! ✨',
    'ai.sub.student': 'Я просмотрел вашу учебную аналитику',
    'ai.sub.instructor': 'Я просмотрел аналитику по вашим курсам и студентам',
    'ai.templates.all': 'Все шаблоны',
    'ai.input.ph': 'Напишите сообщение...',
    'ai.attach': 'Прикрепить файл',
    'ai.send': 'Отправить',
    'ai.disclaimer': 'ИИ-помощник может ошибаться. Проверяйте важную информацию.',
    'ai.history.empty.title': 'Сохранённых диалогов нет',
    'ai.history.empty.sub': 'Диалог сохранится здесь после вашего первого вопроса.',
    'ai.history.meta': 'сообщений: {n}',
    'ai.history.del': 'Удалить диалог',
    'ai.act.copy': 'Копировать',
    'ai.act.insert': 'Вставить в редактор',
    'ai.act.regen': 'Сгенерировать заново',
    'ai.copy.done': 'Скопировано',
    'ai.copy.fail': 'Не удалось скопировать',
    'ai.copy.unsupported': 'Браузер не поддерживает копирование',
    'ai.insert.done': 'Вставлено в редактор',
    'ai.insert.nospot': 'На этой странице нет редактора',
    'ai.cleared': 'Диалог очищен',
    'ai.thread.other': 'Этот диалог относится к другому курсу',
    'ai.quota': 'Память заполнена — диалог не сохраняется. Удалите старые диалоги.',
    'ai.del.title': 'Удалить диалог',
    'ai.del.note': '«{title}» будет удалён навсегда. Это действие необратимо.',
    'ai.del.ok': 'Удалить',
    'ai.del.done': 'Диалог удалён',
    'ai.demo.lead': 'Для точного ответа нужно подключение к реальному ИИ — сейчас работает демо-режим.',
    'ai.demo.hint': 'А пока может помочь одно из этого:',
    'ai.time.now': 'только что',
    'ai.time.min': '{n} мин назад',
    'ai.time.hour': '{n} ч назад',
    'ai.time.yesterday': 'вчера',
    'ai.time.day': '{n} дн. назад',

    /* Метки контекста */
    'ai.ctx.student-chat': 'ИИ-помощник',
    'ai.ctx.instructor-chat': 'ИИ-помощник',
    'ai.ctx.course-player': 'Урок курса',
    'ai.ctx.learning-progress': 'Учебный прогресс',
    'ai.ctx.course-builder': 'Структура курса',
    'ai.ctx.lesson-editor': 'Редактирование урока',
    'ai.ctx.quiz-builder': 'Тесты',
    'ai.ctx.assignment-builder': 'Черновики заданий',

    /* Группы шаблонов */
    'ai.group.Kundalik': 'Ежедневно',
    'ai.group.O\'rganish': 'Обучение',
    'ai.group.Xulosa': 'Итоги',
    'ai.group.Talabalar': 'Студенты',
    'ai.group.Kurs ustida ish': 'Работа над курсом',
    'ai.group.Hisobot': 'Отчёты',

    /* Шаблоны — student-chat */
    'ai.tpl.today-plan.title': 'Что мне учить сегодня?',
    'ai.tpl.today-plan.sub': 'Предлагает сегодняшние уроки по вашему учебному плану',
    'ai.tpl.focus-check.title': 'Как проверить концентрацию?',
    'ai.tpl.focus-check.sub': 'Анализирует уровень внимания по последним сессиям',
    'ai.tpl.motivation.title': 'Проанализируй мою мотивацию',
    'ai.tpl.motivation.sub': 'Оценивает мотивацию по активности и прогрессу',
    'ai.tpl.explain-topic.title': 'Объясни тему простыми словами',
    'ai.tpl.explain-topic.sub': 'Заново объясняет непонятое другими примерами',
    'ai.tpl.practice-me.title': 'Дай вопросы для практики',
    'ai.tpl.practice-me.sub': 'Составляет 3 вопроса по последней изученной теме',
    'ai.tpl.exam-plan.title': 'План подготовки к экзамену',
    'ai.tpl.exam-plan.sub': 'Строит график повторения на оставшееся время',
    'ai.tpl.week-summary.title': 'Подведи итоги недели',
    'ai.tpl.week-summary.sub': 'Собирает изученное за неделю в краткий итог',
    'ai.tpl.next-course.title': 'Какой курс взять дальше?',
    'ai.tpl.next-course.sub': 'Предлагает следующий шаг по завершённым курсам',

    /* Шаблоны — instructor-chat */
    'ai.tpl.at-risk.title': 'Найди студентов в зоне риска',
    'ai.tpl.at-risk.sub': 'Находит студентов со снизившейся активностью',
    'ai.tpl.nudge-message.title': 'Напиши сообщение неактивному студенту',
    'ai.tpl.nudge-message.sub': 'Готовит короткое ненавязчивое напоминание',
    'ai.tpl.review-reply.title': 'Ответь на отзыв',
    'ai.tpl.review-reply.sub': 'Составляет спокойный и полезный ответ на критику',
    'ai.tpl.rubric-chat.title': 'Составь рубрику для задания',
    'ai.tpl.rubric-chat.sub': 'Формирует критерии оценки практического задания',
    'ai.tpl.improve-course.title': 'Как улучшить мой курс?',
    'ai.tpl.improve-course.sub': 'Даёт идеи улучшения на основе статистики курса',
    'ai.tpl.lesson-ideas.title': 'Предложи новые темы уроков',
    'ai.tpl.lesson-ideas.sub': 'Перечисляет дополнительные темы для курса',
    'ai.tpl.weekly-report.title': 'Подготовь недельный отчёт',
    'ai.tpl.weekly-report.sub': 'Собирает статистику курса в краткий отчёт',
    'ai.tpl.announcement.title': 'Напиши объявление для студентов',
    'ai.tpl.announcement.sub': 'Готовит объявление об обновлении курса'
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

/* --- JS ichida yasaladigan matnlar ----------------------------------------
   `data-i18n` faqat markupdagi matnni almashtiradi. JS bilan qurilgan
   satrlar (masalan "3 daq", "5 a'zo · 2 tasi onlayn", toast xabarlari)
   uchun shu funksiya: tarjimasi bo'lsa — o'sha, bo'lmasa berilgan
   o'zbekcha matn. Ya'ni qoida markupdagi bilan bir xil — manba tili
   o'zbekcha, lug'atda faqat en/ru.

   O'rin egallovchilar `{nom}` ko'rinishida:
     isloh_tx('chat.time.min', '{n} daq', { n: 5 })  ->  "5 daq" / "5 min"  */
function isloh_tx(key, uz, vars) {
  let text = isloh_t(key);
  if (text === null) text = uz;
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
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
