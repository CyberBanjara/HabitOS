(function () {
  'use strict';

  const DEFAULT_RESEND_SECONDS = 60;
  const MAX_SEND_ATTEMPTS = 3;
  const MAX_VERIFY_ATTEMPTS = 5;

  const state = {
    verifier: null,
    widgetId: null,
    mode: '',
    lastContainerId: '',
    sendAttempts: 0,
    verifyAttempts: 0,
    resendUntil: 0,
  };

  function isLocalhost() {
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }

  function isHttpsProduction() {
    return isLocalhost() || window.location.protocol === 'https:';
  }

  function normalizeIndiaPhone(value) {
    const raw = String(value || '').trim();
    if (/^\+\d{8,15}$/.test(raw)) {
      return raw;
    }
    const digits = raw.replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(digits)) {
      return `+91${digits}`;
    }
    // On localhost, also accept test phone numbers that don't start with 6-9
    // (e.g. Firebase test number +91 1111111111)
    if (isLocalhost() && /^\d{10,}$/.test(digits)) {
      return `+91${digits}`;
    }
    return '';
  }

  function assertCanRequestOtp(phoneNumber) {
    if (!/^\+\d{8,15}$/.test(phoneNumber || '')) {
      const error = new Error('Enter a valid phone number in E.164 format, for example +919876543210.');
      error.code = 'auth/invalid-phone-number';
      throw error;
    }

    if (!isHttpsProduction()) {
      throw new Error('Firebase Phone Auth requires HTTPS in production. Use HTTPS on Vercel or localhost for development.');
    }

    if (Date.now() < state.resendUntil) {
      const seconds = Math.ceil((state.resendUntil - Date.now()) / 1000);
      const error = new Error(`Please wait ${seconds}s before requesting another OTP.`);
      error.code = 'auth/resend-not-ready';
      throw error;
    }

    if (state.sendAttempts >= MAX_SEND_ATTEMPTS) {
      const error = new Error('Too many OTP requests. Please wait a few minutes and try again.');
      error.code = 'auth/too-many-requests';
      throw error;
    }
  }

  async function ensureRecaptcha(options) {
    const config = options || {};
    const mode = config.mode || 'invisible';
    const invisibleTargetId = config.invisibleTargetId || 'send-otp-btn';
    const visibleContainerId = config.visibleContainerId || 'recaptcha-container';
    const containerId = mode === 'visible' ? visibleContainerId : invisibleTargetId;
    const container = document.getElementById(containerId);

    if (!container) {
      throw new Error(`Missing reCAPTCHA container: #${containerId}`);
    }

    if (state.verifier && state.mode === mode && state.lastContainerId === containerId) {
      return state.verifier;
    }

    clearRecaptcha();

    const resources = await window.Auth.ensureFirebaseReady();
    const auth = resources.auth;
    const RecaptchaVerifier = resources.modules.auth.RecaptchaVerifier;

    const params =
      mode === 'visible'
        ? { size: 'normal' }
        : {
            size: 'invisible',
            callback: function () {
              console.log('[Firebase Phone Auth] reCAPTCHA solved');
            },
            'expired-callback': function () {
              console.warn('[Firebase Phone Auth] reCAPTCHA expired');
            },
          };

    console.log('[Firebase Phone Auth] reCAPTCHA render start', {
      mode,
      containerId,
      domain: window.location.hostname,
    });

    state.verifier = new RecaptchaVerifier(auth, containerId, params);
    state.mode = mode;
    state.lastContainerId = containerId;
    window.recaptchaVerifier = state.verifier;

    try {
      state.widgetId = await state.verifier.render();
      window.recaptchaWidgetId = state.widgetId;
      console.log('[Firebase Phone Auth] reCAPTCHA rendered', { widgetId: state.widgetId, mode });
      return state.verifier;
    } catch (error) {
      clearRecaptcha();
      console.error('[Firebase Phone Auth] reCAPTCHA render failed', error);
      throw addRecaptchaHint(error);
    }
  }

  async function sendOTP(phoneNumber, options) {
    const config = options || {};
    const mode = config.mode || 'invisible';
    const normalized = normalizeIndiaPhone(phoneNumber);
    assertCanRequestOtp(normalized);

    if (isLocalhost()) {
      console.warn(
        '[Firebase Phone Auth] Localhost mode: use Firebase test phone numbers. Real OTP delivery should be tested on your HTTPS Vercel domain.'
      );
    }

    console.log('[Firebase Phone Auth] OTP request prepared', {
      phoneNumber: normalized,
      localhost: isLocalhost(),
      protocol: window.location.protocol,
      domain: window.location.hostname,
      recaptchaMode: mode,
    });

    try {
      const verifier = await ensureRecaptcha(config);
      const confirmationResult = await window.Auth.signInWithPhoneNumber(normalized, verifier);
      window.confirmationResult = confirmationResult;
      state.sendAttempts += 1;
      state.verifyAttempts = 0;
      state.resendUntil = Date.now() + (config.resendSeconds || DEFAULT_RESEND_SECONDS) * 1000;
      console.log('[Firebase Phone Auth] OTP sent successfully', { phoneNumber: normalized });
      return { confirmationResult, phoneNumber: normalized, resendUntil: state.resendUntil };
    } catch (error) {
      console.error('[Firebase Phone Auth] OTP Error:', error);
      resetRecaptcha();

      if (mode !== 'visible' && config.allowVisibleFallback !== false) {
        console.warn('[Firebase Phone Auth] Trying visible reCAPTCHA fallback');
        return sendOTP(normalized, Object.assign({}, config, { mode: 'visible', allowVisibleFallback: false }));
      }

      throw error;
    }
  }

  async function verifyOTP(code, confirmationResult) {
    const otp = String(code || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(otp)) {
      const error = new Error('Enter the 6-digit OTP.');
      error.code = 'auth/invalid-verification-code';
      throw error;
    }

    if (state.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      const error = new Error('Too many OTP verification attempts. Request a new OTP and try again.');
      error.code = 'auth/too-many-requests';
      throw error;
    }

    try {
      const result = await (confirmationResult || window.confirmationResult).confirm(otp);
      console.log('[Firebase Phone Auth] User verified', result.user);
      return result;
    } catch (error) {
      state.verifyAttempts += 1;
      console.error('[Firebase Phone Auth] Invalid OTP:', error);
      throw error;
    }
  }

  function getResendSecondsRemaining() {
    return Math.max(0, Math.ceil((state.resendUntil - Date.now()) / 1000));
  }

  function resetRecaptcha() {
    if (window.grecaptcha && state.widgetId !== null && typeof window.grecaptcha.reset === 'function') {
      try {
        window.grecaptcha.reset(state.widgetId);
      } catch (error) {
        console.warn('[Firebase Phone Auth] grecaptcha.reset failed', error);
      }
    }
    clearRecaptcha();
  }

  function clearRecaptcha() {
    if (state.verifier && typeof state.verifier.clear === 'function') {
      try {
        state.verifier.clear();
      } catch (error) {
        console.warn('[Firebase Phone Auth] reCAPTCHA clear failed', error);
      }
    }
    state.verifier = null;
    state.widgetId = null;
    window.recaptchaVerifier = null;
    window.recaptchaWidgetId = null;
  }

  function addRecaptchaHint(error) {
    if (error && /recaptcha|network|script|blocked|captcha/i.test(error.message || '')) {
      error.message = `${error.message} Check ad blockers, privacy extensions, third-party cookie settings, and CSP for https://www.google.com, https://www.gstatic.com, and https://www.googleapis.com.`;
    }
    return error;
  }

  function friendlyError(error) {
    const code = error && error.code ? error.code : '';
    const message = error && error.message ? error.message : 'Something went wrong. Please try again.';

    switch (code) {
      case 'auth/invalid-phone-number':
        return 'Enter a valid phone number in E.164 format, for example +919876543210.';
      case 'auth/too-many-requests':
      case 'auth/quota-exceeded':
        return 'Firebase has blocked or throttled OTP requests. Please wait before trying again.';
      case 'auth/billing-not-enabled':
        return 'Phone authentication requires a billing account on your Firebase/GCP project. Enable billing in the Google Cloud Console to use this feature.';
      case 'auth/captcha-check-failed':
      case 'auth/missing-app-credential':
      case 'auth/invalid-app-credential':
        return 'reCAPTCHA verification failed. Disable ad blockers, allow third-party cookies, then try again.';
      case 'auth/network-request-failed':
        return 'Network error while contacting Firebase. Check your connection and try again.';
      case 'auth/invalid-verification-code':
        return 'That OTP is not correct. Please check the code and try again.';
      case 'auth/code-expired':
        return 'That OTP has expired. Request a new code.';
      default:
        if (/configuration|apiKey|firebase/i.test(message)) {
          return 'Phone verification is not configured yet. Check APP_FIREBASE_CONFIG and Firebase Authorized Domains.';
        }
        return message;
    }
  }

  function debugEnvironment() {
    const info = {
      domain: window.location.hostname,
      origin: window.location.origin,
      protocol: window.location.protocol,
      localhost: isLocalhost(),
      productionHttpsOk: isHttpsProduction(),
      recaptchaLoaded: Boolean(window.grecaptcha),
    };
    console.log('[Firebase Phone Auth] debug environment', info);
    if (!info.localhost && window.location.protocol !== 'https:') {
      console.warn('[Firebase Phone Auth] Production Phone Auth should run on HTTPS.');
    }
    console.info('[Firebase Phone Auth] Verify this domain is listed in Firebase Auth > Settings > Authorized domains.');
    return info;
  }

  window.FirebasePhoneAuth = {
    isLocalhost,
    normalizeIndiaPhone,
    ensureRecaptcha,
    sendOTP,
    verifyOTP,
    resetRecaptcha,
    clearRecaptcha,
    friendlyError,
    getResendSecondsRemaining,
    debugEnvironment,
  };
})();
