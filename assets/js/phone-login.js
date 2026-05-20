(function () {
  'use strict';

  const state = {
    step: 'phone',
    phoneE164: '',
    confirmationResult: null,
    resendTimer: null,
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
    dom.resend = document.getElementById('loginResendButton');
    dom.phoneStep = document.querySelector('[data-step="phone"]');
    dom.otpStep = document.querySelector('[data-step="otp"]');

    dom.phone.addEventListener('input', () => {
      dom.phone.value = dom.phone.value.replace(/\D/g, '').slice(0, 10);
    });
    dom.form.addEventListener('submit', handleSubmit);
    if (dom.resend) {
      dom.resend.addEventListener('click', sendOtp);
    }
    if (window.FirebasePhoneAuth) {
      window.FirebasePhoneAuth.debugEnvironment();
    }
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
    const phone = window.FirebasePhoneAuth.normalizeIndiaPhone(dom.phone.value);
    if (!phone) {
      showError('Enter a valid phone number in E.164 format, for example +919876543210.');
      return;
    }

    try {
      setLoading('Sending OTP...');
      state.phoneE164 = phone;
      const result = await window.FirebasePhoneAuth.sendOTP(phone, {
        invisibleTargetId: 'loginButton',
        visibleContainerId: 'recaptcha-container',
        resendSeconds: 60,
      });
      state.confirmationResult = result.confirmationResult;
      state.step = 'otp';
      dom.phoneStep.classList.remove('active');
      dom.otpStep.classList.add('active');
      dom.otp.setAttribute('required', 'required');
      dom.otp.focus();
      showSuccess('OTP sent. Enter the code to continue.');
      setIdle('Log In');
      startResendTimer();
    } catch (error) {
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
      await window.FirebasePhoneAuth.verifyOTP(otp, state.confirmationResult);
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      window.location.assign(resolveRedirect(redirect));
    } catch (error) {
      setIdle('Log In');
      showError(getFriendlyError(error));
    }
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

  function startResendTimer() {
    if (!dom.resend) return;
    window.clearInterval(state.resendTimer);
    dom.resend.hidden = false;
    const tick = () => {
      const seconds = window.FirebasePhoneAuth.getResendSecondsRemaining();
      if (seconds > 0) {
        dom.resend.disabled = true;
        dom.resend.textContent = `Resend OTP in ${seconds}s`;
        return;
      }
      dom.resend.disabled = false;
      dom.resend.textContent = 'Resend OTP';
      window.clearInterval(state.resendTimer);
    };
    tick();
    state.resendTimer = window.setInterval(tick, 1000);
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
    if (window.FirebasePhoneAuth && typeof window.FirebasePhoneAuth.friendlyError === 'function') {
      return window.FirebasePhoneAuth.friendlyError(error);
    }
    return error && error.message ? error.message : 'Something went wrong. Please try again.';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
