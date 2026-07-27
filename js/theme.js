/* ==========================================================================
   ISLOH — Theme module
   Sidebar theming (violet for Student, green for Instructor) is already
   handled by js/sidebar.js adding `.theme-teach` based on `data-role`. This
   module is the reserved place for anything beyond the sidebar that needs
   to react to role — e.g. a future Admin accent color, or a user-toggled
   light/dark mode — so that logic has one home instead of being duplicated
   per page.
   ========================================================================== */

function isloh_applyBodyRole() {
  const aside = document.querySelector('.sidebar[data-role]');
  if (!aside) return;
  document.body.dataset.role = aside.dataset.role;
}

document.addEventListener('DOMContentLoaded', isloh_applyBodyRole);
