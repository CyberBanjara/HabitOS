(function () {
  'use strict';

  const PRODUCT_PRICE_PAISE = 900;
  const PRODUCT_NAME = 'HabitOS Google Sheets Habit Tracker';

  const state = {
    step: 'phone',
    phoneE164: '',
    confirmationResult: null,
    recaptchaVerifier: null,
    razorpayReady: false,
    autoPaymentStarted: false,
  };

  const dom = {};

  function init() {
    dom.form = document.getElementById('phoneCheckoutForm');
    if (!dom.form) return;

    dom.phone = document.getElementById('checkoutPhone');
    dom.otp = document.getElementById('checkoutOtp');
    dom.button = document.getElementById('payButton');
    dom.error = document.getElementById('checkoutError');
    dom.success = document.getElementById('checkoutSuccess');
    dom.phoneStep = document.querySelector('[data-step="phone"]');
    dom.otpStep = document.querySelector('[data-step="otp"]');
    dom.authAlt = document.querySelector('.auth-alt-strip');
    dom.authSecondary = document.querySelector('.auth-secondary-link');

    dom.form.addEventListener('submit', handleSubmit);
    dom.phone.addEventListener('input', () => {
      dom.phone.value = dom.phone.value.replace(/\D/g, '').slice(0, 10);
    });

    loadRazorpayScript().catch((error) => showError(error.message));
    syncAuthenticatedCheckout();
    if (window.Auth && typeof window.Auth.on === 'function') {
      window.Auth.on((eventName) => {
        if (eventName === 'signed-in' || eventName === 'changed') {
          syncAuthenticatedCheckout();
        }
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    hideMessages();

    if (state.step === 'phone') {
      await sendOtp();
      return;
    }

    if (state.step === 'payment') {
      await beginPayment();
      return;
    }

    await verifyOtpAndPay();
  }

  async function syncAuthenticatedCheckout() {
    const token = await waitForAuthToken();
    const isAuthed = Boolean(token && window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated());
    if (!isAuthed) return;

    const user = window.Auth.getUser ? window.Auth.getUser() : null;
    state.step = 'payment';
    state.phoneE164 = user && user.phoneNumber ? user.phoneNumber : '';

    if (dom.phoneStep) dom.phoneStep.classList.remove('active');
    if (dom.otpStep) dom.otpStep.classList.remove('active');
    if (dom.otp) dom.otp.removeAttribute('required');
    if (dom.authAlt) dom.authAlt.hidden = true;
    if (dom.authSecondary) dom.authSecondary.hidden = true;

    const label = user && (user.email || user.phoneNumber || user.displayName)
      ? `Signed in as ${user.email || user.phoneNumber || user.displayName}. Click below to pay.`
      : 'You are signed in. Click below to pay.';
    showSuccess(label);
    setIdle('Pay Securely ₹9');

    if (!state.autoPaymentStarted) {
      state.autoPaymentStarted = true;
      window.setTimeout(() => {
        beginPayment();
      }, 350);
    }
  }

  async function sendOtp() {
    const phone = normalizePhone(dom.phone.value);
    if (!phone) {
      showError('Enter a valid 10-digit phone number.');
      dom.phone.focus();
      return;
    }

    try {
      setLoading('Sending OTP...');
      const user = window.Auth && window.Auth.getUser ? window.Auth.getUser() : null;
      if (window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated() && user && user.phoneNumber === phone) {
        state.phoneE164 = phone;
        await beginPayment();
        return;
      }

      state.phoneE164 = phone;
      const verifier = await getRecaptchaVerifier();
      state.confirmationResult = await window.Auth.signInWithPhoneNumber(phone, verifier);
      state.step = 'otp';
      dom.phoneStep.classList.remove('active');
      dom.otpStep.classList.add('active');
      dom.otp.setAttribute('required', 'required');
      dom.otp.focus();
      showSuccess('OTP sent. Enter it once, then payment opens.');
      setIdle('Verify & Pay ₹9');
    } catch (error) {
      resetRecaptcha();
      setIdle('Continue to Payment');
      showError(getFriendlyError(error));
    }
  }

  async function verifyOtpAndPay() {
    const otp = (dom.otp.value || '').replace(/\D/g, '');
    if (otp.length !== 6) {
      showError('Enter the 6-digit OTP.');
      dom.otp.focus();
      return;
    }

    try {
      setLoading('Verifying...');
      await state.confirmationResult.confirm(otp);
      await waitForAuthToken();
      await beginPayment();
    } catch (error) {
      setIdle('Verify & Pay ₹9');
      showError(getFriendlyError(error));
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
          phone: state.phoneE164,
        },
      });

      if (!orderResponse || !orderResponse.id) {
        throw new Error('Could not create payment order. Please try again.');
      }

      const options = {
        key: orderResponse.key,
        amount: orderResponse.amount,
        currency: orderResponse.currency,
        name: 'HabitOS',
        description: PRODUCT_NAME,
        order_id: orderResponse.id,
        prefill: {
          contact: state.phoneE164 ? state.phoneE164.replace('+91', '') : '',
          email: getCurrentUserEmail(),
        },
        notes: {
          product: PRODUCT_NAME,
          phone: state.phoneE164,
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
      setIdle(getIdleButtonText());
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
          phone: state.phoneE164,
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

  function normalizePhone(value) {
    const digits = (value || '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return '';
    return `+91${digits}`;
  }

  async function getRecaptchaVerifier() {
    if (!window.Auth || typeof window.Auth.ensureFirebaseReady !== 'function' || typeof window.Auth.signInWithPhoneNumber !== 'function') {
      throw new Error('Phone login is not initialized.');
    }

    const { firebase } = await window.Auth.ensureFirebaseReady();
    if (state.recaptchaVerifier) {
      return state.recaptchaVerifier;
    }

    state.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('checkoutRecaptcha', {
      size: 'invisible',
      callback: function () {},
    });
    await state.recaptchaVerifier.render();
    return state.recaptchaVerifier;
  }

  function resetRecaptcha() {
    if (state.recaptchaVerifier && typeof state.recaptchaVerifier.clear === 'function') {
      state.recaptchaVerifier.clear();
    }
    state.recaptchaVerifier = null;
    const host = document.getElementById('checkoutRecaptcha');
    if (host) host.innerHTML = '';
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

  function setLoading(text) {
    dom.button.disabled = true;
    dom.button.innerHTML = `<span class="loading-spinner"></span>${text}`;
  }

  function setIdle(text) {
    dom.button.disabled = false;
    dom.button.innerHTML = `<i class="bi bi-lock-fill"></i>${text}`;
  }

  function getIdleButtonText() {
    if (state.step === 'otp') return 'Verify & Pay ₹9';
    if (state.step === 'payment') return 'Pay Securely ₹9';
    return 'Continue to Payment';
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
    const message = error && error.message ? error.message : 'Something went wrong. Please try again.';
    if (/firebase|configuration|apiKey/i.test(message)) {
      return 'Phone verification is not configured yet. Enable Firebase phone auth and check APP_FIREBASE_CONFIG.';
    }
    if (/auth\/invalid-verification-code/i.test(message)) {
      return 'That OTP is not correct. Please check the code and try again.';
    }
    if (/auth\/too-many-requests/i.test(message)) {
      return 'Too many attempts. Please wait a few minutes and try again.';
    }
    return message;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
