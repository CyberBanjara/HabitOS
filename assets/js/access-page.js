(function () {
  'use strict';

  const FALLBACK_TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1LUFhc-1i6uYH4jMGNjPba_zMFkmf9NRKpF9uXpjUXtI/edit?usp=sharing';

  const dom = {};

  function init() {
    dom.orderEl = document.getElementById('orderId');
    dom.dateEl = document.getElementById('orderDate');
    dom.openLink = document.getElementById('openSheetLink');
    dom.copyLink = document.getElementById('makeCopyLink');
    dom.status = document.getElementById('accessStatus');

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id') || params.get('razorpay_order_id') || '-';

    if (dom.orderEl) dom.orderEl.textContent = orderId;
    if (dom.dateEl) {
      dom.dateEl.textContent = new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    const templateUrl = window.APP_TEMPLATE_SHEET_URL || FALLBACK_TEMPLATE_URL;
    const copyUrl = templateUrl.includes('/edit')
      ? templateUrl.replace(/\/edit.*$/, '/copy')
      : templateUrl;

    if (dom.openLink) {
      dom.openLink.href = templateUrl;
      dom.openLink.addEventListener('click', handleDisabledClick);
    }
    if (dom.copyLink) {
      dom.copyLink.href = copyUrl;
      dom.copyLink.addEventListener('click', handleDisabledClick);
    }

    // Run verification initially
    verifyReturningAccess();

    // Listen for auth changes and re-verify access dynamically
    if (window.Auth && typeof window.Auth.on === 'function') {
      window.Auth.on((eventName) => {
        if (eventName === 'signed-in' || eventName === 'changed' || eventName === 'signed-out') {
          verifyReturningAccess();
        }
      });
    }
  }

  function handleDisabledClick(e) {
    if (this.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
    }
  }

  async function verifyReturningAccess() {
    const isAuthed = window.Auth && typeof window.Auth.isAuthenticated === 'function' && window.Auth.isAuthenticated();
    if (!isAuthed) {
      setStatus(dom.status, 'Log in with your HabitOS account to access your tracker.', 'error');
      setAccessButtonsDisabled(true);
      return;
    }

    const token = await waitForToken();
    if (!token) {
      setStatus(dom.status, 'Log in with your HabitOS account to access your tracker.', 'error');
      setAccessButtonsDisabled(true);
      return;
    }

    try {
      setStatus(dom.status, 'Verifying access...', 'info');
      const response = await window.Auth.apiFetch('/api/access', { method: 'GET' });
      if (!response || !response.hasAccess) {
        setStatus(dom.status, 'No paid tracker order was found for this account.', 'error');
        setAccessButtonsDisabled(true);
        return;
      }
      if (dom.orderEl && response.order_id) dom.orderEl.textContent = response.order_id;
      setStatus(dom.status, 'Access verified for your account. Your tracker links are ready.', 'success');
      setAccessButtonsDisabled(false);
    } catch (error) {
      setStatus(dom.status, 'No paid tracker order was found for this account.', 'error');
      setAccessButtonsDisabled(true);
    }
  }

  function waitForToken() {
    return new Promise((resolve) => {
      let attempts = 0;
      const tick = async () => {
        attempts += 1;
        const token = window.Auth && window.Auth.getIdToken ? await window.Auth.getIdToken({ forceRefresh: attempts === 1 }) : null;
        if (token || attempts > 12) {
          resolve(token);
          return;
        }
        setTimeout(tick, 250);
      };
      tick();
    });
  }

  function setStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('success', type !== 'error');
    element.classList.toggle('error', type === 'error');
  }

  function setAccessButtonsDisabled(disabled) {
    ['makeCopyLink', 'openSheetLink'].forEach((id) => {
      const link = document.getElementById(id);
      if (!link) return;
      if (disabled) {
        link.setAttribute('aria-disabled', 'true');
        link.tabIndex = -1;
      } else {
        link.removeAttribute('aria-disabled');
        link.tabIndex = 0;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
