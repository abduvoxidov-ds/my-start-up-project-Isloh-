/* ==========================================================================
   ISLOH — Certificate engine module
   Single source of truth: localStorage key ISLOH_CERTIFICATES_KEY. Powers
   pages/student/certificates.html (Earned/Jarayonda/Qulflangan grid) and
   pages/student/certificate-preview.html (preview + public verification) —
   same pattern js/progress-metrics.js uses for Analitika: one get/save
   pair, everything else derived from state at render time.

   Depends on (loaded before this script on both pages, guarded with
   typeof checks so this file degrades safely if either is missing):
     js/marketplace.js    -> ISLOH_MARKETPLACE_DATA, isloh_isPurchased()
     js/lesson-viewer.js  -> isloh_getCourseProgress()

   Course IDs are standardized on the Marketplace catalog ids (py-101,
   react-201, ...). NOTE: pages/student/course-player.html and
   lesson-player.html currently hardcode data-course-id="docker-for-beginners",
   which has no matching Marketplace entry, so real lesson-by-lesson
   progress for that demo course never surfaces here. Flagged in the
   Certificates audit — out of scope for this module to fix.

   Persisted record shape (ISLOH_CERTIFICATES_KEY, keyed by cert id):
     { [certId]: { id, courseId, courseTitle, instructorName, studentName,
         studentId, issuedAt, verificationId, verificationHash, status,
         organization: { name, logoUrl, sealUrl } | null,
         stats: { totalLessons, completedLessons, averageQuizScore,
                   studyMinutes } } }
   Only "issued" certificates are persisted — the earned/in-progress/locked
   split on certificates.html is recomputed live from isloh_course_progress
   + isloh_purchased_courses on every render, so it can never drift out of
   sync with the underlying state.

   Optional instructor org co-branding (ISLOH_COURSE_SETTINGS_KEY, keyed by
   courseId, set from pages/instructor/course-settings.html): { [courseId]:
   { organization: { name, logoUrl, sealUrl } } }. Read at issuance time and
   snapshotted onto the certificate record above, same denormalization
   rationale as courseTitle/instructorName — a certificate is a historical
   document and shouldn't silently change if settings are edited later.

   File deliberately NOT named certificate.js/cert-generator.js — ad
   blockers commonly flag local paths combining "cert"/"certificate" with
   "generator"/"download" as tracker/creative heuristics, same reasoning
   js/progress-metrics.js documents for why it isn't analytics.js.
   ========================================================================== */

const ISLOH_CERTIFICATES_KEY = 'isloh_certificates';
const ISLOH_USER_KEY = 'isloh_user';
const ISLOH_COURSE_SETTINGS_KEY = 'isloh_course_settings';
const ISLOH_CERT_MONTH_LABELS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

/* --- Identity fallback --------------------------------------------------
   Mock Auth (login/register -> isloh_user) isn't wired yet (see
   CLAUDE.md Phase 2), so the certificate module seeds a minimal student
   profile the first time it's needed instead of blocking on that work. */
function isloh_seedUserFallback() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem(ISLOH_USER_KEY)); } catch (e) { user = null; }
  if (!user) {
    user = { id: 'std-001', name: 'Samar Mirzayev', role: 'student' };
    localStorage.setItem(ISLOH_USER_KEY, JSON.stringify(user));
  }
  return user;
}

/* --- Deterministic id / verification helpers (djb2-style, no crypto lib) */
function isloh_hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function isloh_generateVerificationId(certId, issuedAt) {
  const year = new Date(issuedAt || Date.now()).getFullYear();
  const num = parseInt(isloh_hashString(certId).slice(0, 5), 16) % 100000;
  return `ISL-${year}-${String(num).padStart(5, '0')}`;
}

function isloh_lookupCourseCatalog(courseId) {
  if (typeof ISLOH_MARKETPLACE_DATA === 'undefined') return null;
  return ISLOH_MARKETPLACE_DATA.featured_courses.find((c) => c.id === courseId) || null;
}

/* --- Instructor organization affiliation ---------------------------------
   Optional co-branding, set from pages/instructor/course-settings.html's
   "Sertifikatlar" panel. Keyed by courseId (an instructor can teach both
   independently and on behalf of an org across different courses), so it
   lives in its own isloh_course_settings store rather than isloh_user.
   Seeds py-101 with a sample org so the effect is visible immediately —
   same "demo isn't empty on first load" convention as isloh_certificates. */
function isloh_courseSettingsSeedDefaults() {
  const all = { 'py-101': { organization: { name: 'Isloh IT Academy', logoUrl: '', sealUrl: '' } } };
  isloh_saveCourseSettings(all);
  return all;
}

function isloh_getCourseSettings() {
  let all = null;
  try { all = JSON.parse(localStorage.getItem(ISLOH_COURSE_SETTINGS_KEY)); } catch (e) { all = null; }
  if (!all) all = isloh_courseSettingsSeedDefaults();
  return all;
}

function isloh_saveCourseSettings(all) {
  localStorage.setItem(ISLOH_COURSE_SETTINGS_KEY, JSON.stringify(all));
}

function isloh_getCourseOrganization(courseId) {
  const org = isloh_getCourseSettings()[courseId]?.organization;
  return org && org.name && org.name.trim() ? org : null;
}

function isloh_setCourseOrganization(courseId, organization) {
  const all = isloh_getCourseSettings();
  if (!all[courseId]) all[courseId] = {};
  if (organization && organization.name && organization.name.trim()) {
    all[courseId].organization = organization;
  } else {
    delete all[courseId].organization;
  }
  isloh_saveCourseSettings(all);
}

/* Course-level affiliation wins; isloh_user.organization is a secondary
   fallback for a future instructor-wide default (not populated by any UI
   yet, but harmless to support since certificates should never break if
   it's ever added to a profile page later). */
function isloh_resolveCertificateOrganization(courseId, user) {
  const courseOrg = isloh_getCourseOrganization(courseId);
  if (courseOrg) return courseOrg;
  if (user && user.organization && user.organization.name && String(user.organization.name).trim()) return user.organization;
  return null;
}

function isloh_buildCertificateRecord(courseId, user, details) {
  const course = isloh_lookupCourseCatalog(courseId);
  const organization = isloh_resolveCertificateOrganization(courseId, user);
  const id = 'cr-' + isloh_hashString(`${courseId}:${user.id}`);
  const issuedAt = details.issuedAt || new Date().toISOString();
  const verificationId = isloh_generateVerificationId(id, issuedAt);
  const record = {
    id,
    courseId,
    courseTitle: course ? course.title : courseId,
    instructorName: course ? course.instructor : "Noma'lum o'qituvchi",
    studentName: user.name,
    studentId: user.id,
    issuedAt,
    verificationId,
    status: 'issued',
    organization: organization ? { name: organization.name, logoUrl: organization.logoUrl || '', sealUrl: organization.sealUrl || '' } : null,
    stats: {
      totalLessons: details.totalLessons ?? null,
      completedLessons: details.completedLessons ?? null,
      averageQuizScore: details.averageQuizScore ?? null,
      studyMinutes: details.studyMinutes ?? null
    }
  };
  record.verificationHash = isloh_hashString(`${record.id}:${verificationId}:${issuedAt}`);
  return record;
}

/* --- Storage -------------------------------------------------------------
   Seeds two demo "earned" certificates on first-ever read only, so the
   page isn't empty before any real course has been completed — mirrors
   js/progress-metrics.js's isloh_analyticsDefaultState() / js/chat.js's
   seeded users+threads. Never reseeds once a (possibly empty) object has
   been saved. */
function isloh_certificatesSeedDefaults() {
  const user = isloh_seedUserFallback();
  const seeds = [
    { courseId: 'py-101', issuedAt: '2026-06-18T00:00:00.000Z', totalLessons: 48, completedLessons: 48, averageQuizScore: 92, studyMinutes: 2530 },
    { courseId: 'uiux-301', issuedAt: '2026-05-10T00:00:00.000Z', totalLessons: 32, completedLessons: 32, averageQuizScore: 88, studyMinutes: 1610 }
  ];
  const all = {};
  seeds.forEach((seed) => {
    const record = isloh_buildCertificateRecord(seed.courseId, user, seed);
    all[record.id] = record;
  });
  isloh_saveCertificates(all);
  return all;
}

function isloh_getCertificates() {
  let all = null;
  try { all = JSON.parse(localStorage.getItem(ISLOH_CERTIFICATES_KEY)); } catch (e) { all = null; }
  if (!all) all = isloh_certificatesSeedDefaults();
  return all;
}

function isloh_saveCertificates(all) {
  localStorage.setItem(ISLOH_CERTIFICATES_KEY, JSON.stringify(all));
}

function isloh_findCertificateByCourseAndStudent(all, courseId, studentId) {
  return Object.values(all).find((c) => c.courseId === courseId && c.studentId === studentId) || null;
}

/* Reads isloh_course_progress's {lessonId: true/false} map for a course.
   course-player.html seeds every lesson row it renders into that map on
   first visit (see js/lesson-viewer.js isloh_restoreLessonProgress), so
   Object.keys(...).length is a reliable stand-in for "total lessons"
   without this module needing its own lesson-count source. */
function isloh_certificateProgressStats(courseId) {
  if (typeof isloh_getCourseProgress !== 'function') return null;
  const progress = isloh_getCourseProgress()[courseId];
  if (!progress) return null;
  const lessonIds = Object.keys(progress);
  if (!lessonIds.length) return null;
  const completedLessons = lessonIds.filter((lid) => progress[lid]).length;
  return { totalLessons: lessonIds.length, completedLessons };
}

/* --- Public API: issue / verify / share ---------------------------------- */
function isloh_issueCertificate(courseId) {
  const user = isloh_seedUserFallback();
  const all = isloh_getCertificates();
  const existing = isloh_findCertificateByCourseAndStudent(all, courseId, user.id);
  if (existing) return existing;

  const progressStats = isloh_certificateProgressStats(courseId);
  if (!progressStats || progressStats.completedLessons < progressStats.totalLessons) return null;

  const record = isloh_buildCertificateRecord(courseId, user, {
    issuedAt: new Date().toISOString(),
    totalLessons: progressStats.totalLessons,
    completedLessons: progressStats.completedLessons,
    averageQuizScore: null,
    studyMinutes: null
  });
  all[record.id] = record;
  isloh_saveCertificates(all);
  return record;
}

function isloh_verifyCertificate(query) {
  if (!query) return null;
  const all = isloh_getCertificates();
  return Object.values(all).find((c) => c.verificationId === query || c.id === query) || null;
}

function isloh_certificateVerifyUrl(certificate) {
  return new URL(`certificate-preview.html?verify=${encodeURIComponent(certificate.verificationId)}`, window.location.href).href;
}

function isloh_getLinkedInShareUrl(certificate) {
  const issued = new Date(certificate.issuedAt);
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: certificate.courseTitle,
    organizationName: 'Isloh LMS',
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: isloh_certificateVerifyUrl(certificate),
    certId: certificate.verificationId
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

/* --- Formatting ------------------------------------------------------- */
function isloh_formatCertMonthYear(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-yil ${ISLOH_CERT_MONTH_LABELS[d.getMonth()]}`;
}

function isloh_formatCertFullDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-yil ${d.getDate()}-${ISLOH_CERT_MONTH_LABELS[d.getMonth()].toLowerCase()}`;
}

function isloh_formatCertDuration(totalMinutes) {
  return `${Math.floor(totalMinutes / 60)}s ${totalMinutes % 60}m`;
}

/* --- Clipboard (Share button) --------------------------------------------
   navigator.clipboard requires a secure context; Chrome treats file://
   as insecure, so the async Clipboard API silently doesn't exist there.
   This project is required to run under file:// (see CLAUDE.md), so a
   textarea+execCommand fallback is not optional here. */
function isloh_copyToClipboardFallback(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); } catch (e) { /* clipboard unavailable, ignore */ }
  document.body.removeChild(el);
}

function isloh_copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => isloh_copyToClipboardFallback(text));
  }
  isloh_copyToClipboardFallback(text);
  return Promise.resolve();
}

/* --- certificates.html: Earned / Jarayonda / Qulflangan board ----------- */
function isloh_computeCertificateBoard() {
  const board = { earned: [], inProgress: [], locked: [] };
  if (typeof ISLOH_MARKETPLACE_DATA === 'undefined') return board;
  const user = isloh_seedUserFallback();

  ISLOH_MARKETPLACE_DATA.featured_courses.forEach((course) => {
    const certs = isloh_getCertificates();
    const existingCert = isloh_findCertificateByCourseAndStudent(certs, course.id, user.id);
    if (existingCert) { board.earned.push({ course, certificate: existingCert }); return; }

    const progressStats = isloh_certificateProgressStats(course.id);
    const isComplete = progressStats && progressStats.totalLessons > 0 && progressStats.completedLessons === progressStats.totalLessons;
    if (isComplete) {
      const issued = isloh_issueCertificate(course.id);
      if (issued) { board.earned.push({ course, certificate: issued }); return; }
    }

    const purchased = typeof isloh_isPurchased === 'function' && isloh_isPurchased(course.id);
    if (purchased || progressStats) {
      const pct = progressStats ? Math.round((progressStats.completedLessons / progressStats.totalLessons) * 100) : 0;
      board.inProgress.push({ course, pct });
      return;
    }

    board.locked.push({ course });
  });

  return board;
}

function isloh_certEarnedCardHtml(course, certificate) {
  return `
    <div class="card cert-card" data-filter-item data-status="earned" data-filter-text="${course.title}">
      <a href="certificate-preview.html?id=${certificate.id}" class="cert-cover" style="text-decoration:none; color:inherit; background:${course.cover};">
        <div class="cert-seal"><i class="bi bi-patch-check-fill"></i></div>
        <span class="badge badge-green cert-ribbon">Tasdiqlangan</span>
      </a>
      <div class="cert-body">
        <div class="cert-title filter-title">${course.title}</div>
        <div class="cert-meta">O'qituvchi: ${course.instructor} &middot; ${isloh_formatCertMonthYear(certificate.issuedAt)}</div>
        <div class="cert-foot">
          <span class="cert-verify"><i class="bi bi-shield-check"></i> Tasdiqlangan</span>
          <a href="certificate-preview.html?id=${certificate.id}" class="btn btn-primary btn-sm"><i class="bi bi-download"></i> Yuklab olish</a>
        </div>
      </div>
    </div>`;
}

function isloh_certProgressCardHtml(course, pct) {
  return `
    <div class="card cert-card" data-filter-item data-status="progress" data-filter-text="${course.title}">
      <div class="cert-cover" style="background:${course.cover};">
        <div class="cert-seal"><i class="bi bi-hourglass-split"></i></div>
        <span class="badge badge-neutral cert-ribbon" style="background:#FEF3E2; color:var(--warning);">${pct}%</span>
      </div>
      <div class="cert-body">
        <div class="cert-title filter-title">${course.title}</div>
        <div class="cert-meta">Kursni yakunlang &middot; ${pct}%</div>
        <div class="progress-track" style="margin-top:12px;"><div class="progress-fill" style="width:${pct}%;"></div></div>
        <div class="cert-foot">
          <span style="font-size:11.5px; color:var(--ink-500);">${100 - pct}% qoldi</span>
          <a href="course-detail.html?id=${course.id}" class="btn btn-outline btn-sm">Davom etish</a>
        </div>
      </div>
    </div>`;
}

function isloh_certLockedCardHtml(course) {
  return `
    <div class="card cert-card locked" data-filter-item data-status="locked" data-filter-text="${course.title}">
      <div class="cert-cover">
        <div class="cert-locked-overlay"><i class="bi bi-lock-fill" style="font-size:28px;"></i><span style="font-size:12px;">Qulflangan</span></div>
      </div>
      <div class="cert-body">
        <div class="cert-title filter-title">${course.title}</div>
        <div class="cert-meta">Kursni sotib oling va yakunlang</div>
        <div class="cert-foot">
          <span style="font-size:11.5px; color:var(--ink-300);">Hali boshlanmagan</span>
          <a href="marketplace.html" class="btn btn-outline btn-sm">Ko'rish</a>
        </div>
      </div>
    </div>`;
}

function isloh_renderCertificatesPage() {
  const grid = document.querySelector('[data-cert-grid]');
  if (!grid) return;

  const board = isloh_computeCertificateBoard();
  const statCounts = { earned: board.earned.length, progress: board.inProgress.length, locked: board.locked.length };
  document.querySelectorAll('[data-cert-stat]').forEach((el) => {
    el.textContent = statCounts[el.dataset.certStat] ?? 0;
  });

  const cards = [
    ...board.earned.map(({ course, certificate }) => isloh_certEarnedCardHtml(course, certificate)),
    ...board.inProgress.map(({ course, pct }) => isloh_certProgressCardHtml(course, pct)),
    ...board.locked.map(({ course }) => isloh_certLockedCardHtml(course))
  ];
  grid.innerHTML = cards.join('');

  // Re-scan now that real [data-filter-item] cards exist in the DOM.
  const scope = grid.closest('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- certificate-preview.html: preview + public verification ------------ */
function isloh_setText(root, selector, text) {
  const el = root.querySelector(selector);
  if (el) el.textContent = text;
}

function isloh_certOrgInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/* Swaps a broken/missing <img> for its fallback markup in place, instead
   of ever leaving a broken-image icon on screen. */
function isloh_wireCertMediaFallback(imgEl, fallbackHtml) {
  if (!imgEl) return;
  imgEl.addEventListener('error', () => { imgEl.outerHTML = fallbackHtml; }, { once: true });
}

/* Co-branding: .cert-org-logo sits top-of-certificate (near the platform's
   own .certificate-seal-lg mark), .cert-org-seal sits in the bottom
   signature row next to the instructor/date/id line and the org name.
   Absent organization -> both wrappers stay [hidden] and empty, so a
   standard individual-instructor certificate renders exactly as before,
   with no gap and no broken <img>. */
function isloh_renderCertOrganization(root, certificate) {
  const logoWrap = root.querySelector('[data-cert-org-logo]');
  const signatureWrap = root.querySelector('[data-cert-org]');
  if (!logoWrap && !signatureWrap) return;

  const org = certificate.organization;
  if (!org) {
    if (logoWrap) { logoWrap.hidden = true; logoWrap.innerHTML = ''; }
    if (signatureWrap) { signatureWrap.hidden = true; signatureWrap.innerHTML = ''; }
    return;
  }

  const logoFallback = `<span class="certificate-org-initials">${isloh_certOrgInitials(org.name)}</span>`;
  const sealFallback = `<i class="bi bi-patch-check-fill"></i>`;

  if (logoWrap) {
    logoWrap.hidden = false;
    logoWrap.innerHTML = org.logoUrl ? `<img src="${org.logoUrl}" alt="${org.name} logotipi">` : logoFallback;
    isloh_wireCertMediaFallback(logoWrap.querySelector('img'), logoFallback);
  }

  if (signatureWrap) {
    signatureWrap.hidden = false;
    signatureWrap.innerHTML = `
      <div class="certificate-org-info">
        <div class="certificate-org-label">Hamkor tashkilot</div>
        <div class="certificate-org-name">${org.name}</div>
      </div>
      <div class="cert-org-seal" data-cert-org-seal>${org.sealUrl ? `<img src="${org.sealUrl}" alt="${org.name} muhri">` : sealFallback}</div>`;
    isloh_wireCertMediaFallback(signatureWrap.querySelector('.cert-org-seal img'), sealFallback);
  }
}

function isloh_initCertificateActions(certificate) {
  const downloadBtn = document.querySelector('[data-cert-action="download"]');
  if (downloadBtn) downloadBtn.addEventListener('click', () => window.print());

  const linkedinBtn = document.querySelector('[data-cert-action="linkedin"]');
  if (linkedinBtn) linkedinBtn.addEventListener('click', () => window.open(isloh_getLinkedInShareUrl(certificate), '_blank'));

  const shareBtn = document.querySelector('[data-cert-action="share"]');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      isloh_copyToClipboard(isloh_certificateVerifyUrl(certificate)).then(() => {
        if (typeof isloh_showToast === 'function') isloh_showToast('Tasdiqlash havolasi nusxalandi!', 'success');
      });
    });
  }
}

function isloh_renderCertificatePreview() {
  const root = document.querySelector('[data-cert-preview]');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const query = params.get('id') || params.get('verify');
  const certificate = isloh_verifyCertificate(query);

  const notFound = root.querySelector('[data-cert-not-found]');
  const content = root.querySelector('[data-cert-content]');
  const banner = root.querySelector('[data-cert-verify-banner]');

  if (!certificate) {
    if (content) content.hidden = true;
    if (banner) banner.hidden = true;
    if (notFound) notFound.hidden = false;
    return;
  }

  if (notFound) notFound.hidden = true;
  if (content) content.hidden = false;
  document.title = `Sertifikat — ${certificate.courseTitle} — Isloh`;

  isloh_setText(root, '[data-cert-name]', certificate.studentName);
  isloh_setText(root, '[data-cert-course]', `"${certificate.courseTitle}" kursini muvaffaqiyatli yakunladi`);
  isloh_setText(root, '[data-cert-instructor]', `O'qituvchi: ${certificate.instructorName}`);
  isloh_setText(root, '[data-cert-date]', `Sana: ${isloh_formatCertMonthYear(certificate.issuedAt)}`);
  isloh_setText(root, '[data-cert-id]', `ID: ${certificate.verificationId}`);

  isloh_setText(root, '[data-cert-stat-course]', certificate.courseTitle);
  isloh_setText(root, '[data-cert-stat-lessons]', `${certificate.stats.completedLessons ?? '—'} / ${certificate.stats.totalLessons ?? '—'}`);
  isloh_setText(root, '[data-cert-stat-quiz]', certificate.stats.averageQuizScore != null ? `${certificate.stats.averageQuizScore}%` : '—');
  isloh_setText(root, '[data-cert-stat-time]', certificate.stats.studyMinutes != null ? isloh_formatCertDuration(certificate.stats.studyMinutes) : '—');
  isloh_setText(root, '[data-cert-stat-completed-date]', isloh_formatCertFullDate(certificate.issuedAt));

  if (banner) {
    banner.hidden = false;
    isloh_setText(root, '[data-cert-verify-timestamp]', `Tasdiqlangan: ${isloh_formatCertFullDate(certificate.issuedAt)} · ID: ${certificate.verificationId}`);
  }

  isloh_renderCertOrganization(root, certificate);
  isloh_initCertificateActions(certificate);
}

/* --- pages/instructor/course-settings.html: organization affiliation form */
function isloh_courseOrgFormValues() {
  return {
    name: (document.querySelector('[data-org-name]')?.value || '').trim(),
    logoUrl: (document.querySelector('[data-org-logo]')?.value || '').trim(),
    sealUrl: (document.querySelector('[data-org-seal]')?.value || '').trim()
  };
}

function isloh_renderOrgPreview() {
  const wrap = document.querySelector('[data-org-preview]');
  if (!wrap) return;
  const { name, logoUrl } = isloh_courseOrgFormValues();
  if (!name) { wrap.hidden = true; return; }
  wrap.hidden = false;

  isloh_setText(wrap, '[data-org-preview-name]', name);
  const mark = wrap.querySelector('[data-org-preview-mark]');
  if (!mark) return;
  const fallback = `<span class="cert-org-preview-initials">${isloh_certOrgInitials(name)}</span>`;
  mark.innerHTML = logoUrl ? `<img src="${logoUrl}" alt="${name} logotipi">` : fallback;
  isloh_wireCertMediaFallback(mark.querySelector('img'), fallback);
}

function isloh_initCourseOrganizationSettings() {
  const nameInput = document.querySelector('[data-org-name]');
  const courseEl = document.querySelector('[data-course-id]');
  if (!nameInput || !courseEl) return;
  const courseId = courseEl.dataset.courseId;

  const existing = isloh_getCourseOrganization(courseId);
  if (existing) {
    nameInput.value = existing.name || '';
    const logoInput = document.querySelector('[data-org-logo]');
    const sealInput = document.querySelector('[data-org-seal]');
    if (logoInput) logoInput.value = existing.logoUrl || '';
    if (sealInput) sealInput.value = existing.sealUrl || '';
  }
  isloh_renderOrgPreview();

  document.querySelectorAll('[data-org-name], [data-org-logo], [data-org-seal]').forEach((input) => {
    input.addEventListener('input', isloh_renderOrgPreview);
  });

  const saveBtn = document.querySelector('[data-org-save]');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const values = isloh_courseOrgFormValues();
      isloh_setCourseOrganization(courseId, values.name ? values : null);
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(values.name ? "Tashkilot ma'lumotlari saqlandi" : 'Tashkilot biriktiruvi olib tashlandi', 'success');
      }
    });
  }
}

function isloh_initCertificateEngine() {
  isloh_seedUserFallback();
  isloh_renderCertificatesPage();
  isloh_renderCertificatePreview();
  isloh_initCourseOrganizationSettings();
}

document.addEventListener('DOMContentLoaded', isloh_initCertificateEngine);
