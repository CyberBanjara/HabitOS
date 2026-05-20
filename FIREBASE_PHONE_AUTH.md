# Firebase Phone Authentication Setup

## Why Real OTP May Not Arrive

Firebase test phone numbers never send SMS. They bypass real delivery and can work while real numbers fail.

For real phone numbers, Firebase must complete app verification through reCAPTCHA before `signInWithPhoneNumber()` sends SMS. If reCAPTCHA is blocked, the domain is not authorized, production is not HTTPS, quota is exhausted, or the phone region is blocked, the OTP request can fail before SMS delivery.

This app now logs:

- Firebase initialization details
- Current domain and protocol
- Localhost mode
- reCAPTCHA render start/success/failure
- OTP request start/success/failure
- Firebase auth error codes

Open DevTools Console and look for messages prefixed with `[Firebase Auth]` and `[Firebase Phone Auth]`.

## Files Implemented

- `assets/js/auth.js`: Firebase modular SDK initialization and auth wrapper.
- `assets/js/firebase-phone-auth.js`: phone OTP utility, invisible reCAPTCHA, visible fallback, resend timer state, retry limits, and error mapping.
- `assets/js/phone-login.js`: login OTP UI flow.
- `assets/js/phone-checkout.js`: checkout OTP plus payment flow.
- `login.html` and `checkout.html`: phone input, OTP input, send/verify button, resend button, error/success display, and `#recaptcha-container`.

## Environment Setup

Set `APP_FIREBASE_CONFIG` in `assets/js/env.local.js` for local development or through the Vercel `/api/env` environment variables for production:

```js
window.__ENV = {
  APP_FIREBASE_CONFIG: {
    apiKey: '...',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.appspot.com',
    messagingSenderId: '...',
    appId: '...',
  },
};
```

Firebase Console requirements:

- Authentication > Sign-in method > Phone enabled.
- Authentication > Settings > Authorized domains includes your Vercel domain and custom domain.
- SMS region policy includes India and US if those are required.
- Test phone numbers are configured for localhost/dev testing.

Official references:

- Firebase phone auth guide: https://firebase.google.com/docs/auth/web/phone-auth
- Firebase JS `signInWithPhoneNumber` reference: https://firebase.google.com/docs/reference/js/auth#signinwithphonenumber
- Firebase JS `RecaptchaVerifier` reference: https://firebase.google.com/docs/reference/js/auth.recaptchaverifier.md

## Localhost Testing

On `localhost` or `127.0.0.1`, the app enables:

```js
auth.settings.appVerificationDisabledForTesting = true;
```

This is only enabled locally. Use Firebase test phone numbers locally. Real SMS delivery should be tested from the HTTPS Vercel deployment because localhost app verification can be limited by Firebase, browser privacy settings, and reCAPTCHA behavior.

Run locally:

```sh
npm install
npm run dev
```

Open `http://localhost:3000/login.html` or `http://localhost:3000/checkout.html`.

## Vercel Deployment

Set these Vercel environment variables:

- `APP_FIREBASE_CONFIG`: JSON string containing the Firebase web config.
- Razorpay/server variables already required by the API routes.

After deployment:

1. Add the Vercel domain to Firebase Authorized Domains.
2. Use HTTPS only.
3. Open DevTools Console and verify the logged domain matches the authorized domain.
4. Test with a real phone number only after checking quota and SMS region policy.

## reCAPTCHA Debugging

The app first uses invisible reCAPTCHA attached to the submit button. If that fails, it retries with visible reCAPTCHA in:

```html
<div id="recaptcha-container"></div>
```

If reCAPTCHA fails:

- Disable ad blockers and privacy extensions.
- Allow third-party cookies for the site.
- Ensure any CSP allows:
  - `https://www.google.com`
  - `https://www.gstatic.com`
  - `https://www.googleapis.com`
- Confirm the domain is authorized in Firebase.
- Confirm production uses HTTPS.

## Quota And Throttling

Firebase can return `auth/too-many-requests` or quota-related errors after repeated sends. The UI blocks immediate resend for 60 seconds and limits repeated requests in the current page session. If quota is exhausted, wait before retrying and check Firebase usage/quotas.

## Exact Fixes For OTP Not Arriving

1. Test numbers working does not prove real SMS is working; test numbers bypass SMS.
2. Real numbers require successful reCAPTCHA app verification.
3. Test real delivery from the HTTPS Vercel domain, not only localhost.
4. Verify the exact current domain from the console log exists in Firebase Authorized Domains.
5. Confirm SMS Region Policy allows the phone number country.
6. Check browser blockers/cookies/CSP if reCAPTCHA logs fail.
7. Wait after repeated attempts because Firebase throttles OTP requests.
