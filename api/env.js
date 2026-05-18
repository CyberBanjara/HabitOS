(function () {
  'use strict';

  var http = require('./_http');

  function send(res, statusCode, payload) {
    http.setCorsHeaders(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(JSON.stringify(payload));
  }

  function parseFirebaseConfig(rawConfig) {
    if (!rawConfig) {
      return null;
    }

    if (typeof rawConfig !== 'string') {
      return null;
    }

    try {
      var parsed = JSON.parse(rawConfig);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function buildClientEnv() {
    var env = {};

    if (process.env.APP_API_BASE_URL) {
      env.APP_API_BASE_URL = process.env.APP_API_BASE_URL;
    }
    if (process.env.APP_TEMPLATE_SHEET_URL) {
      env.APP_TEMPLATE_SHEET_URL = process.env.APP_TEMPLATE_SHEET_URL;
    }
    if (process.env.RAZORPAY_KEY_ID) {
      env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
    }

    var firebaseConfig = parseFirebaseConfig(process.env.APP_FIREBASE_CONFIG);
    if (firebaseConfig) {
      env.APP_FIREBASE_CONFIG = firebaseConfig;
    }

    return env;
  }

  module.exports = function handler(req, res) {
    if (http.handleOptions(req, res)) {
      return;
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      send(res, 405, { error: 'Method not allowed' });
      return;
    }

    try {
      var payload = buildClientEnv();
      send(res, 200, payload);
    } catch (error) {
      console.error('api/env: Failed to resolve client environment.', error);
      send(res, 500, { error: 'Failed to resolve configuration.' });
    }
  };
})();
