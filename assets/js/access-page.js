(function () {
  'use strict';

  const FALLBACK_TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a/edit?usp=sharing';

  function init() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id') || params.get('razorpay_order_id') || '-';
    const orderEl = document.getElementById('orderId');
    const dateEl = document.getElementById('orderDate');
    const openLink = document.getElementById('openSheetLink');
    const copyLink = document.getElementById('makeCopyLink');
    const status = document.getElementById('accessStatus');

    if (orderEl) orderEl.textContent = orderId;
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    const templateUrl = window.APP_TEMPLATE_SHEET_URL || FALLBACK_TEMPLATE_URL;
    const copyUrl = templateUrl.includes('/edit')
      ? templateUrl.replace(/\/edit.*$/, '/copy')
      : templateUrl;

    if (openLink) openLink.href = templateUrl;
    if (copyLink) copyLink.href = copyUrl;

    if (!params.get('order_id') && !params.get('razorpay_order_id')) {
      verifyReturningAccess(status, orderEl);
    }
  }

  async function verifyReturningAccess(status, orderEl) {
    const token = await waitForToken();
    if (!token) {
      setStatus(status, 'Log in with your HabitOS account to access your tracker.', 'error');
      setAccessButtonsDisabled(true);
      return;
    }

    try {
      const response = await window.Auth.apiFetch('/api/access', { method: 'GET' });
      if (!response || !response.hasAccess) {
        setStatus(status, 'No paid tracker order was found for this account.', 'error');
        setAccessButtonsDisabled(true);
        return;
      }
      if (orderEl && response.order_id) orderEl.textContent = response.order_id;
      setStatus(status, 'Access verified for your account. Your tracker links are ready.', 'success');
      setAccessButtonsDisabled(false);
    } catch (error) {
      setStatus(status, 'Log in with your HabitOS account to access your tracker.', 'error');
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
