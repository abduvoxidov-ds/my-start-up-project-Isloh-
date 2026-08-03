/* ==========================================================================
   ISLOH — Tabs module  (Sprint 5B)
   Generic switcher for the `.tab-strip` / `.tab-item` components (see the
   "Tabs" entry in pages/shared/components.html — visual-only until now).
   Powers pages/instructor/lesson-editor.html's Content/Resources/Settings/
   Preview tabs, and is reusable anywhere `.tab-strip` appears.

   Markup contract:
     [data-tabs]
       .tab-strip                          → role="tablist" avtomat qo'yiladi
         .tab-item[data-tab-target="<id>"]   (.active = current)
       [data-tab-panel="<id>"]               → one per tab, sibling or
                                                 descendant of [data-tabs]

   A11y (WAI-ARIA Tabs Pattern):
     Ilgari faqat role="tab" va tabindex="0" qo'yilardi — tablist,
     tabpanel, aria-selected va strelka bilan yurish yo'q edi. Yolg'iz
     role="tab" skrin-riderga topa olmaydigan naqshni va'da qiladi, ya'ni
     ARIA'siz holatdan ham yomonroq. Endi to'liq naqsh:
       - .tab-strip  → role="tablist"
       - .tab-item   → role="tab" + aria-selected + aria-controls
       - panel       → role="tabpanel" + aria-labelledby
       - roving tabindex: faqat faol tab Tab bilan olinadi, qolganlariga
         ←/→ (Home/End) strelkalari bilan o'tiladi

   ESLATMA: kurs pleeridagi dars ro'yxati ilgari shu shartnomani ishlatardi
   (`.tab-item` + data-tab-target), lekin u tab emas — navigatsiya. 2-bosqichda
   u js/course-player.js ga ko'chirildi, shuning uchun bu modul endi faqat
   haqiqiy tablar bilan ishlaydi.

   Chiqaradigan hodisa:
     isloh:tab-change → { id }  ([data-tabs] doirasida, bubbles)
   ========================================================================== */

function isloh_initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((scope) => {
    const tabs = [...scope.querySelectorAll('.tab-item[data-tab-target]')];
    if (!tabs.length) return;
    const panels = [...scope.querySelectorAll('[data-tab-panel]')];

    const strip = scope.querySelector('.tab-strip');
    if (strip) strip.setAttribute('role', 'tablist');

    function activate(id, focusTab) {
      tabs.forEach((t) => {
        const on = t.dataset.tabTarget === id;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;          // roving tabindex
      });
      panels.forEach((p) => { p.hidden = p.dataset.tabPanel !== id; });
      if (focusTab) tabs.find((t) => t.dataset.tabTarget === id)?.focus();

      /* Boshqa modullar tab almashganini click tartibiga emas, shu hodisaga
         qarab bilsin (masalan: panel ochilganda ro'yxatni qayta chizish). */
      scope.dispatchEvent(new CustomEvent('isloh:tab-change', {
        detail: { id }, bubbles: true
      }));
    }

    tabs.forEach((tab, i) => {
      const id = tab.dataset.tabTarget;
      tab.id = tab.id || 'tab-' + id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'panel-' + id);
      tab.addEventListener('click', () => activate(id));

      const panel = panels.find((p) => p.dataset.tabPanel === id);
      if (panel) {
        panel.id = 'panel-' + id;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.tabIndex = 0;   // panel matni klaviatura bilan skroll qilinsin
      }

      // ←/→ bilan tablar orasida yurish, Home/End bilan chetlarga
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(id); return; }
        const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        const next = tabs[(map[e.key] + tabs.length) % tabs.length];
        activate(next.dataset.tabTarget, true);
      });
    });

    /* Markupdagi .active hurmat qilinadi. Ilgari har doim tabs[0] majburan
       yoqilardi — sahifada qo'lda belgilangan faol tab e'tiborsiz qolar va
       chuqur havola (deep link) qilish imkonsiz edi. */
    const initial = tabs.find((t) => t.classList.contains('active')) || tabs[0];
    activate(initial.dataset.tabTarget);
  });
}

document.addEventListener('DOMContentLoaded', isloh_initTabs);
