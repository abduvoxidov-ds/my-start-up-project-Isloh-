/* ==========================================================================
   ISLOH — Sortable module  (Sprint 5B)
   Generic drag-to-reorder engine for any list, driven entirely by data
   attributes so Module Builder, Lesson Builder and the Lesson Editor
   Resource Panel all share one implementation instead of three ad-hoc
   drag handlers. Frontend-only: reordering is visual/in-DOM, nothing is
   persisted (per Sprint 5B scope — "No backend. No persistence.").

   Markup contract:
     [data-sortable-list]   → the container whose children get reordered
       [data-sortable-item] draggable="true"  → one per reorderable row
         [data-drag-handle]                    → the only element allowed
                                                  to start the drag
   Works on dynamically-added items automatically (listeners are bound to
   the list container, not to individual items).
   ========================================================================== */

function isloh_initSortable() {
  document.querySelectorAll('[data-sortable-list]').forEach((list) => {
    let dragEl = null;

    list.addEventListener('dragstart', (e) => {
      const item = e.target.closest('[data-sortable-item]');
      const startedFromHandle = e.target.closest('[data-drag-handle]');
      if (!item || !list.contains(item) || !startedFromHandle) {
        e.preventDefault();
        return;
      }
      dragEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    list.addEventListener('dragend', () => {
      dragEl?.classList.remove('dragging');
      dragEl = null;
      list.querySelectorAll('.drag-over').forEach((n) => n.classList.remove('drag-over'));
    });

    list.addEventListener('dragover', (e) => {
      if (!dragEl) return;
      e.preventDefault();
      const target = e.target.closest('[data-sortable-item]');
      if (!target || target === dragEl || !list.contains(target)) return;
      list.querySelectorAll('.drag-over').forEach((n) => n.classList.remove('drag-over'));
      target.classList.add('drag-over');
      const rect = target.getBoundingClientRect();
      const after = (e.clientY - rect.top) / rect.height > 0.5;
      list.insertBefore(dragEl, after ? target.nextSibling : target);
    });

    list.addEventListener('drop', (e) => e.preventDefault());
  });
}

document.addEventListener('DOMContentLoaded', isloh_initSortable);
