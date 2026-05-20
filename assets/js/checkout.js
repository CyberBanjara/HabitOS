(function () {
  'use strict';

  const PRODUCT_PRICE_PAISE = 900;
  const PRODUCT_NAME = 'HabitOS Google Sheets Habit Tracker';

  const state = {
    razorpayReady: false,
    autoPaymentStarted: false,
  };

  const dom = {};

  function init() {
    dom.form = document.getElementById('checkoutForm');
    if (!dom.form) return;

    dom.button = document.getElementById('payButton');
    dom.error = document.getElementById('checkoutError');
    dom.success = document.getElementById('checkoutSuccess');

    dom.form.addEventListener('submit', handleSubmit);
    loadRazorpayScript().catch((error) => showError(error.message));
    syncAuthenticatedCheckout();

    if (window.Auth && typeof window.Auth.on === 'function') {
      window.Auth.on((eventName) => {
        if (eventName === 'signed-in' || eventName === 'changed' || eventName === 'signed-out') {
          syncAuthenticatedCheckout();
        }
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    hideMessages();

    const token = await waitForAuthToken();
    const isAuthed = Boolean(token && window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated());
    if (!isAuthed) {
      redirectToLogin();
      return;
    }

    await beginPayment();
  }

  async function syncAuthenticatedCheckout() {
    const token = await waitForAuthToken();
    const isAuthed = Boolean(token && window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated());
    const user = window.Auth && window.Auth.getUser ? window.Auth.getUser() : null;

    if (!isAuthed) {
      setIdle('Login to Continue');
      showSuccess('Sign in with Google or email to continue to payment.');
      return;
    }

    const display = user && (user.email || user.displayName) ? user.email || user.displayName : 'your account';
    showSuccess(`Signed in as ${display}. Click below to pay.`);
    setIdle('Pay Securely ₹9');

    if (!state.autoPaymentStarted) {
      state.autoPaymentStarted = true;
      window.setTimeout(() => {
        beginPayment();
      }, 350);
    }
  }

  async function beginPayment() {
    try {
      setLoading('Opening payment...');
      await loadRazorpayScript();

      const orderResponse = await window.Auth.apiFetch('/api/create-order', {
        method: 'POST',
        body: {
          amount: PRODUCT_PRICE_PAISE,
          product: PRODUCT_NAME,
        },
      });

      const orderId = orderResponse && (orderResponse.order_id || orderResponse.id);
      const key = orderResponse && (orderResponse.key || orderResponse.key_id || window.RAZORPAY_KEY_ID);

      if (!orderId) {
        throw new Error('Could not create payment order. Please try again.');
      }
      if (!key) {
        throw new Error('Payment key is not configured. Please try again later.');
      }

      const options = {
        key,
        amount: orderResponse.amount,
        currency: orderResponse.currency,
        name: 'HabitOS',
        description: PRODUCT_NAME,
        order_id: orderId,
        prefill: {
          email: getCurrentUserEmail(),
        },
        notes: {
          product: PRODUCT_NAME,
        },
        theme: {
          color: '#15151f',
        },
        handler: async function (response) {
          await verifyPayment(response);
        },
        modal: {
          ondismiss: function () {
            setIdle('Pay Securely ₹9');
          },
        },
      };

      const razorpay = new Razorpay(options);
      razorpay.on('payment.failed', function (response) {
        const description = response && response.error && response.error.description;
        setIdle('Pay Securely ₹9');
        showError(description || 'Payment failed. Please try again.');
      });
      razorpay.open();
      setIdle('Pay Securely ₹9');
    } catch (error) {
      setIdle('Pay Securely ₹9');
      showError(getFriendlyError(error));
    }
  }

  function getCurrentUserEmail() {
    const user = window.Auth && window.Auth.getUser ? window.Auth.getUser() : null;
    return user && user.email ? user.email : '';
  }

  async function verifyPayment(paymentResponse) {
    try {
      setLoading('Confirming access...');
      const verifyResponse = await window.Auth.apiFetch('/api/verify-payment', {
        method: 'POST',
        body: {
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
          product: PRODUCT_NAME,
        },
      });

      if (!verifyResponse || !verifyResponse.success) {
        throw new Error(verifyResponse && verifyResponse.message ? verifyResponse.message : 'Payment verification failed.');
      }

      const params = new URLSearchParams({
        order_id: verifyResponse.order_id || paymentResponse.razorpay_order_id,
        razorpay_order_id: paymentResponse.razorpay_order_id,
      });
      window.location.assign(`access.html?${params.toString()}`);
    } catch (error) {
      setIdle('Pay Securely ₹9');
      showError(getFriendlyError(error));
    }
  }

  function waitForAuthToken() {
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

  function loadRazorpayScript() {
    if (window.Razorpay) {
      state.razorpayReady = true;
      return Promise.resolve();
    }

    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        state.razorpayReady = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Could not load Razorpay checkout. Check your connection and try again.'));
      document.head.appendChild(script);
    });
  }

  function redirectToLogin() {
    if (window.Auth && typeof window.Auth.redirectToAuthPage === 'function') {
      window.Auth.redirectToAuthPage('login.html', { redirectTo: 'checkout.html' });
      return;
    }
    window.location.assign('login.html?redirect=checkout.html');
  }

  function setLoading(text) {
    dom.button.disabled = true;
    dom.button.innerHTML = `<span class="loading-spinner"></span>${text}`;
  }

  function setIdle(text) {
    dom.button.disabled = false;
    dom.button.innerHTML = `<i class="bi bi-lock-fill"></i>${text}`;
  }

  function showError(message) {
    dom.error.textContent = message;
    dom.error.hidden = false;
  }

  function showSuccess(message) {
    dom.success.textContent = message;
    dom.success.hidden = false;
  }

  function hideMessages() {
    dom.error.hidden = true;
    dom.success.hidden = true;
  }

  function getFriendlyError(error) {
    return error && error.message ? error.message : 'Something went wrong. Please try again.';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
