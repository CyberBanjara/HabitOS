(function () {
  'use strict';

  window.HB_PUBLIC_CONFIG = {
  "APP_API_BASE_URL": "/api",
  "RAZORPAY_KEY_ID": "rzp_live_Sqwcp3qoO8p8Om",
  "APP_FIREBASE_CONFIG": {
    "apiKey": "AIzaSyD9VZq79ZZ3TAGqb_XNDkAokt8OeXe7XtQ",
    "authDomain": "himalayanhoney308.firebaseapp.com",
    "projectId": "himalayanhoney308",
    "storageBucket": "himalayanhoney308.firebasestorage.app",
    "messagingSenderId": "77678631049",
    "appId": "1:77678631049:web:339f99247cb4bd90528e58",
    "measurementId": "G-DH8DDKKMPS"
  },
  "APP_TEMPLATE_SHEET_URL": "https://docs.google.com/spreadsheets/d/1LUFhc-1i6uYH4jMGNjPba_zMFkmf9NRKpF9uXpjUXtI/edit?usp=sharing"
};

  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('hb:env:ready', { detail: window.HB_PUBLIC_CONFIG }));
  }
})();
