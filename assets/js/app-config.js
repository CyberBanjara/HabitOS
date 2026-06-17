(function () {
  'use strict';

  var didWarnFirebase = false;

  function applyEnvironment(overrides) {
    var env = overrides && typeof overrides === 'object' ? overrides : {};

    window.APP_API_BASE_URL = resolveApiBaseUrl(env.APP_API_BASE_URL || window.APP_API_BASE_URL);

    window.APP_FIREBASE_CONFIG = env.APP_FIREBASE_CONFIG || window.APP_FIREBASE_CONFIG || null;
    window.APP_TEMPLATE_SHEET_URL =
      env.APP_TEMPLATE_SHEET_URL || window.APP_TEMPLATE_SHEET_URL || '';
    window.RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID || window.RAZORPAY_KEY_ID || '';

    if (
      !window.APP_FIREBASE_CONFIG &&
      typeof console !== 'undefined' &&
      console.warn &&
      !didWarnFirebase
    ) {
      console.warn('APP_FIREBASE_CONFIG is not set. Check assets/js/public-config.js.');
      didWarnFirebase = true;
    }

    return env;
  }

  function isLocalHostname(hostname) {
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)
    );
  }

  function resolveApiBaseUrl(configuredValue) {
    var detected = getDetectedApiBaseUrl();

    if (!configuredValue) {
      return detected;
    }

    try {
      var configured = new URL(configuredValue, window.location.origin);
      if (/example\.com/i.test(configured.hostname)) {
        return detected;
      }
      if (
        window.location &&
        isLocalHostname(window.location.hostname) &&
        window.location.port !== '3000' &&
        isLocalHostname(configured.hostname) &&
        (configured.port === '' || configured.port === window.location.port)
      ) {
        return detected;
      }
    } catch (error) {
      return configuredValue;
    }

    return configuredValue;
  }

  function getDetectedApiBaseUrl() {
    if (typeof window === 'undefined' || !window.location) {
      return 'http://localhost:3000/api';
    }

    var protocol = window.location.protocol;
    var hostname = window.location.hostname;
    var port = window.location.port;

    if (protocol === 'file:') {
      return 'http://localhost:3000/api';
    }

    if (isLocalHostname(hostname) && port && port !== '3000') {
      return protocol + '//' + hostname + ':3000/api';
    }

    return window.location.origin + '/api';
  }

  function handleEnvReady(event) {
    var payload = (event && event.detail) || window.HB_PUBLIC_CONFIG || {};
    applyEnvironment(payload);
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('hb:env:ready', handleEnvReady, { once: true });
  }

  applyEnvironment(window.HB_PUBLIC_CONFIG || {});
})();
