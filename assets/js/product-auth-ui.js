(function () {
  'use strict';

  function init() {
    if (!document.body || !document.body.classList.contains('product-page')) {
      return;
    }

    update();

    if (window.Auth && typeof window.Auth.on === 'function') {
      window.Auth.on(update);
    }

    if (window.Auth && typeof window.Auth.getIdToken === 'function') {
      window.Auth.getIdToken()
        .then(update)
        .catch(update);
    }

    window.addEventListener('hb:layout:ready', update);
  }

  function update() {
    const authLink = document.querySelector('[data-product-auth-link]');
    const accountMenu = document.querySelector('[data-product-account-menu]');
    const accountDropdown = document.querySelector('[data-product-account-dropdown]');
    const logoutButton = document.querySelector('[data-product-logout]');
    if (!authLink) return;

    const label = authLink.querySelector('span') || authLink;
    const icon = authLink.querySelector('i');
    const user = window.Auth && window.Auth.getUser ? window.Auth.getUser() : null;
    const isAuthed = Boolean(user && window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated());

    bindAccountMenu(authLink, accountMenu, accountDropdown);

    if (isAuthed) {
      const display = user.displayName || user.email || 'Account';
      authLink.href = '#account';
      authLink.classList.add('is-authenticated');
      authLink.title = display;
      authLink.setAttribute('aria-haspopup', 'true');
      authLink.setAttribute('aria-expanded', 'false');
      label.textContent = display;
      if (icon) {
        icon.className = user.photoURL ? 'bi bi-person-circle' : 'bi bi-person-check';
      }
      if (logoutButton) {
        if (!logoutButton.dataset.bound) {
          logoutButton.dataset.bound = 'true';
          logoutButton.addEventListener('click', function () {
            if (window.Auth && typeof window.Auth.signOut === 'function') {
              closeAccountMenu(accountMenu, accountDropdown, authLink);
              window.Auth.signOut().finally(update);
            }
          });
        }
      }
      return;
    }

    authLink.href = 'login.html';
    authLink.classList.remove('is-authenticated');
    authLink.removeAttribute('title');
    authLink.removeAttribute('aria-haspopup');
    authLink.setAttribute('aria-expanded', 'false');
    label.textContent = 'Login';
    if (icon) {
      icon.className = 'bi bi-person';
    }
    closeAccountMenu(accountMenu, accountDropdown, authLink);
  }

  function bindAccountMenu(authLink, accountMenu, accountDropdown) {
    if (!authLink || !accountMenu || !accountDropdown || authLink.dataset.accountBound === 'true') {
      return;
    }

    authLink.dataset.accountBound = 'true';

    authLink.addEventListener('click', function (event) {
      const isAuthed = authLink.classList.contains('is-authenticated');
      if (!isAuthed) {
        return;
      }

      event.preventDefault();
      const willOpen = accountDropdown.hidden;
      accountMenu.classList.toggle('is-open', willOpen);
      accountDropdown.hidden = !willOpen;
      authLink.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function (event) {
      if (!accountMenu.contains(event.target)) {
        closeAccountMenu(accountMenu, accountDropdown, authLink);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeAccountMenu(accountMenu, accountDropdown, authLink);
      }
    });
  }

  function closeAccountMenu(accountMenu, accountDropdown, authLink) {
    if (accountMenu) {
      accountMenu.classList.remove('is-open');
    }
    if (accountDropdown) {
      accountDropdown.hidden = true;
    }
    if (authLink) {
      authLink.setAttribute('aria-expanded', 'false');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
