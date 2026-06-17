(function () {
  'use strict';

  window.HB_PUBLIC_CONFIG = {
  "APP_API_BASE_URL": "/api",
  "RAZORPAY_KEY_ID": "rzp_live_Sqwcp3qoO8p8Om",
  "APP_FIREBASE_CONFIG": {
    "apiKey": "AIzaSyA7APqQBw0-cS9QiZbnA0TB1fESWVrYw1g",
    "authDomain": "habbitos-308.firebaseapp.com",
    "projectId": "habbitos-308",
    "storageBucket": "habbitos-308.firebasestorage.app",
    "messagingSenderId": "906819038012",
    "appId": "1:906819038012:web:211d1a5a50e561ab92cc39",
    "measurementId": "G-L8V0V7P40L"
  },
  "APP_TEMPLATE_SHEET_URL": "https://docs.google.com/spreadsheets/d/1LUFhc-1i6uYH4jMGNjPba_zMFkmf9NRKpF9uXpjUXtI/edit?usp=sharing"
};

  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('hb:env:ready', { detail: window.HB_PUBLIC_CONFIG }));
  }
})();
