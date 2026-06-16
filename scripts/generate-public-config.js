const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const outputPath = path.join(__dirname, '..', 'assets', 'js', 'public-config.js');

function getEnv(name) {
  return process.env[name] || '';
}

function readFirebaseConfig() {
  const rawConfig = getEnv('APP_FIREBASE_CONFIG') || getEnv('FIREBASE_WEB_CONFIG');
  if (rawConfig) {
    try {
      return JSON.parse(rawConfig);
    } catch (error) {
      throw new Error('APP_FIREBASE_CONFIG/FIREBASE_WEB_CONFIG must be valid JSON');
    }
  }

  const config = {
    apiKey: getEnv('FIREBASE_WEB_API_KEY'),
    authDomain: getEnv('FIREBASE_WEB_AUTH_DOMAIN'),
    projectId: getEnv('FIREBASE_WEB_PROJECT_ID'),
    storageBucket: getEnv('FIREBASE_WEB_STORAGE_BUCKET'),
    messagingSenderId: getEnv('FIREBASE_WEB_MESSAGING_SENDER_ID'),
    appId: getEnv('FIREBASE_WEB_APP_ID'),
    measurementId: getEnv('FIREBASE_WEB_MEASUREMENT_ID'),
  };

  const hasAnyValue = Object.values(config).some(Boolean);
  return hasAnyValue ? config : null;
}

const publicConfig = {
  APP_API_BASE_URL: getEnv('APP_API_BASE_URL'),
  RAZORPAY_KEY_ID: getEnv('RAZORPAY_KEY_ID'),
  APP_FIREBASE_CONFIG: readFirebaseConfig(),
};

const contents = `(function () {
  'use strict';

  window.HB_PUBLIC_CONFIG = ${JSON.stringify(publicConfig, null, 2)};

  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('hb:env:ready', { detail: window.HB_PUBLIC_CONFIG }));
  }
})();
`;

fs.writeFileSync(outputPath, contents);
console.log(`Generated ${path.relative(process.cwd(), outputPath)} from environment variables.`);
