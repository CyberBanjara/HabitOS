(function () {
  'use strict';

  const state = {
    step: 'phone',
    phoneE164: '',
    confirmationResult: null,
    recaptchaVerifier: null,
  };

  const dom = {};

  function init() {
    dom.form = document.getElementById('phoneLoginForm');
    if (!dom.form) return;

    dom.phone = document.getElementById('loginPhone');
    dom.otp = document.getElementById('loginOtp');
    dom.button = document.getElementById('loginButton');
    dom.error = document.getElementById('loginError');
    dom.success = document.getElementById('loginSuccess');
    dom.phoneStep = document.querySelector('[data-step="phone"]');
    dom.otpStep = document.querySelector('[data-step="otp"]');

    dom.phone.addEventListener('input', () => {
      dom.phone.value = dom.phone.value.replace(/\D/g, '').slice(0, 10);
    });
    dom.form.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    hideMessages();
    if (state.step === 'phone') {
      await sendOtp();
    } else {
      await verifyOtp();
    }
  }

  async function sendOtp() {
    const phone = normalizePhone(dom.phone.value);
    if (!phone) {
      showError('Enter a valid 10-digit phone number.');
      return;
    }

    try {
      setLoading('Sending OTP...');
      state.phoneE164 = phone;
      const verifier = await getRecaptchaVerifier();
      state.confirmationResult = await window.Auth.signInWithPhoneNumber(phone, verifier);
      state.step = 'otp';
      dom.phoneStep.classList.remove('active');
      dom.otpStep.classList.add('active');
      dom.otp.setAttribute('required', 'required');
      dom.otp.focus();
      showSuccess('OTP sent. Enter the code to continue.');
      setIdle('Log In');
    } catch (error) {
      resetRecaptcha();
      setIdle('Send OTP');
      showError(getFriendlyError(error));
    }
  }

  async function verifyOtp() {
    const otp = (dom.otp.value || '').replace(/\D/g, '');
    if (otp.length !== 6) {
      showError('Enter the 6-digit OTP.');
      return;
    }

    try {
      setLoading('Logging in...');
      await state.confirmationResult.confirm(otp);
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      window.location.assign(resolveRedirect(redirect));
    } catch (error) {
      setIdle('Log In');
      showError(getFriendlyError(error));
    }
  }

  async function getRecaptchaVerifier() {
    if (!window.Auth || typeof window.Auth.ensureFirebaseReady !== 'function') {
      throw new Error('Phone login is not initialized.');
    }
    const { firebase } = await window.Auth.ensureFirebaseReady();
    if (state.recaptchaVerifier) return state.recaptchaVerifier;
    state.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('loginRecaptcha', {
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
    const host = document.getElementById('loginRecaptcha');
    if (host) host.innerHTML = '';
  }

  function normalizePhone(value) {
    const digits = (value || '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return '';
    return `+91${digits}`;
  }

  function resolveRedirect(value) {
    if (!value) return 'access.html';
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin) return 'access.html';
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (error) {
      return 'access.html';
    }
  }

  function setLoading(text) {
    dom.button.disabled = true;
    dom.button.innerHTML = `<span class="loading-spinner"></span>${text}`;
  }

  function setIdle(text) {
    dom.button.disabled = false;
    dom.button.innerHTML = `<i class="bi bi-shield-lock"></i>${text}`;
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
      return 'Phone login is not configured yet. Enable Firebase phone auth and check APP_FIREBASE_CONFIG.';
    }
    if (/auth\/invalid-verification-code/i.test(message)) {
      return 'That OTP is not correct. Please check the code and try again.';
    }
    return message;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
