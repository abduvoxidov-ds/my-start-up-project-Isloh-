/* ==========================================================================
   ISLOH — Tab / panel dvigateli  (Sprint 5B, 7A da umumlashtirildi)

   Loyihada bitta vidjet ikki marta yozilgan edi: bu fayl (`.tab-item` +
   `data-tab-target`) va js/settings.js (`.settings-nav-item` +
   `data-settings-target`). Ikkalasi ham "bir vaqtda bitta panel ko'rinadi"
   naqshi, lekin klaviatura va ARIA mantiqi faqat shu faylda bor edi —
   sozlamalar navigatsiyasi esa `role="button"` bilan qolib ketgan.

   Endi mantiq YAGONA nusxada — `isloh_mountTabs()` da. Har bir chaqiruv joyi
   faqat o'z markup shartnomasini beradi:
     - bu fayl        -> .tab-item[data-tab-target]        (gorizontal)
     - js/settings.js -> .settings-nav-item[...]           (vertikal)

   Bu faylning o'z shartnomasi (o'zgarmagan):
     [data-tabs]
       .tab-strip | .settings-vtabs        → role="tablist" avtomat qo'yiladi
         .tab-item[data-tab-target="<id>"]   (.active = joriy)
       [data-tab-panel="<id>"]               → har bir tab uchun bittasi

   A11y (WAI-ARIA Tabs Pattern):
     - tablist konteyner  → role="tablist" (+ vertikalda aria-orientation)
     - .tab-item          → role="tab" + aria-selected + aria-controls
     - panel              → role="tabpanel" + aria-labelledby
     - roving tabindex: faqat faol tab Tab bilan olinadi, qolganlariga
       strelkalar (gorizontalda ←/→, vertikalda ↑/↓) va Home/End bilan
       o'tiladi

   ESLATMA: kurs pleeridagi dars ro'yxati ilgari shu shartnomani ishlatardi
   (`.tab-item` + data-tab-target), lekin u tab emas — navigatsiya. 2-bosqichda
   u js/course-player.js ga ko'chirildi, shuning uchun bu modul endi faqat
   haqiqiy tablar bilan ishlaydi.

   Chiqaradigan hodisa:
     isloh:tab-change → { id }  ([data-tabs] doirasida, bubbles)
   ========================================================================== */

/* --- Umumiy dvigatel ------------------------------------------------------
   config:
     list      — tablist konteyneri (bo'lmasa null)
     tabs      — tab elementlari massivi
     panels    — panel elementlari massivi
     tabId     — (tab) => id
     panelId   — (panel) => id
     vertical  — true bo'lsa ↑/↓, aks holda ←/→
     idPrefix  — DOM id'lar prefiksi (aria-controls / aria-labelledby uchun)
     onChange  — (id) => void, ixtiyoriy

   Qaytaradi: { activate(id, focusTab) } — chaqiruvchi keyinchalik panelni
   programma yo'li bilan almashtira olsin (masalan chuqur havola).           */
function isloh_mountTabs(config) {
  const tabs = config.tabs || [];
  const panels = config.panels || [];
  if (!tabs.length) return null;

  const vertical = config.vertical === true;
  const prefix = config.idPrefix || 'tab';
  const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
  const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';

  if (config.list) {
    config.list.setAttribute('role', 'tablist');
    if (vertical) config.list.setAttribute('aria-orientation', 'vertical');
  }

  function panelFor(id) {
    return panels.find((panel) => config.panelId(panel) === id);
  }

  function activate(id, focusTab) {
    tabs.forEach((tab) => {
      const on = config.tabId(tab) === id;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;          // roving tabindex
      if (on && focusTab) tab.focus();
    });
    panels.forEach((panel) => { panel.hidden = config.panelId(panel) !== id; });

    /* Boshqa modullar tab almashganini click tartibiga emas, shu chaqiruvga
       qarab bilsin (masalan: panel ochilganda ro'yxatni qayta chizish). */
    if (typeof config.onChange === 'function') config.onChange(id);
  }

  tabs.forEach((tab, i) => {
    const id = config.tabId(tab);

    /* role va tabindex JS tomonidan boshqariladi — markupda qo'lda yozilgan
       `role="button" tabindex="0"` bo'lsa ham ustidan yoziladi. */
    tab.id = tab.id || prefix + '-' + id;
    tab.setAttribute('role', 'tab');

    const panel = panelFor(id);
    if (panel) {
      panel.id = panel.id || prefix + '-panel-' + id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;   // panel matni klaviatura bilan skroll qilinsin
      tab.setAttribute('aria-controls', panel.id);
    }

    tab.addEventListener('click', () => activate(id));

    // Strelkalar bilan tablar orasida yurish, Home/End bilan chetlarga
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(id); return; }

      const map = { Home: 0, End: tabs.length - 1 };
      map[nextKey] = i + 1;
      map[prevKey] = i - 1;
      if (!(e.key in map)) return;

      e.preventDefault();
      const next = tabs[(map[e.key] + tabs.length) % tabs.length];
      activate(config.tabId(next), true);
    });
  });

  /* Markupdagi .active hurmat qilinadi. Ilgari har doim tabs[0] majburan
     yoqilardi — sahifada qo'lda belgilangan faol tab e'tiborsiz qolar va
     chuqur havola (deep link) qilish imkonsiz edi. */
  const initial = tabs.find((tab) => tab.classList.contains('active')) || tabs[0];
  activate(config.tabId(initial));

  return { activate: activate };
}

/* --- `[data-tabs]` shartnomasi -------------------------------------------- */

function isloh_initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((scope) => {
    const tabs = [...scope.querySelectorAll('.tab-item[data-tab-target]')];
    if (!tabs.length) return;

    /* .tab-strip — gorizontal chiziq, .settings-vtabs — vertikal ustun
       (admin platforma sozlamalari). Ilgari faqat .tab-strip qidirilgani
       uchun vertikal variantda role="tablist" umuman qo'yilmay qolar va
       role="tab" bolalari yetim turardi. */
    const list = scope.querySelector('.tab-strip, .settings-vtabs');

    isloh_mountTabs({
      list: list,
      tabs: tabs,
      panels: [...scope.querySelectorAll('[data-tab-panel]')],
      tabId: (tab) => tab.dataset.tabTarget,
      panelId: (panel) => panel.dataset.tabPanel,
      vertical: !!(list && list.classList.contains('settings-vtabs')),
      idPrefix: 'tab',
      onChange: (id) => scope.dispatchEvent(new CustomEvent('isloh:tab-change', {
        detail: { id }, bubbles: true
      }))
    });
  });
}

document.addEventListener('DOMContentLoaded', isloh_initTabs);
