(function () {
  'use strict';

  function lockLightTheme() {
    document.body.classList.remove('dark-theme');
    try {
      window.localStorage.setItem('theme', 'light');
    } catch (error) {
      // Ignore storage errors in private browsing or restricted contexts.
    }
  }

  if (document.body && document.body.classList.contains('product-page')) {
    lockLightTheme();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.body.classList.contains('product-page')) {
        lockLightTheme();
      }
    });
  }
})();
