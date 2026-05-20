(function () {
  'use strict';

  function normalizeBaseUrl(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/\/$/, '');
  }

  function coerceFirebaseConfig(value) {
    if (!value) {
      return null;
    }
    if (typeof value === 'object') {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn('Auth: unable to parse Firebase config string', error);
      }
    }
    return null;
  }

  const CONFIG = {
    get apiBaseUrl() {
      return normalizeBaseUrl(window.APP_API_BASE_URL || '');
    },
    get firebaseConfig() {
      const direct = coerceFirebaseConfig(window.APP_FIREBASE_CONFIG);
      if (direct) {
        return direct;
      }
      if (window.HBEnv && typeof window.HBEnv.get === 'function') {
        return coerceFirebaseConfig(window.HBEnv.get('APP_FIREBASE_CONFIG'));
      }
      return null;
    },
    authCookieName: 'hbAuthToken',
  };

  const state = {
    user: null,
    idToken: null,
    tokenExpiresAt: null,
    lastLoginAuthTime: null,
    firebaseReady: false,
    firebaseModules: null,
    firebaseApp: null,
    firebaseAuth: null,
    firebaseFirestore: null,
  };

  const dom = {};
  const observers = new Set();

  let envReadyPromise = null;
  let firebaseReadyPromise = null;
  function ensureEnvironmentReady() {
    if (envReadyPromise) {
      return envReadyPromise;
    }

    const loader = window.HBEnv;
    if (loader && typeof loader.load === 'function') {
      envReadyPromise = loader
        .load()
        .catch((error) => {
          console.warn('Auth: environment file failed to load', error);
        })
        .then(() => {
          return loader && loader.data ? loader.data : {};
        });
      return envReadyPromise;
    }

    envReadyPromise = Promise.resolve({});
    return envReadyPromise;
  }

  function init() {
    queryDom();
    registerEvents();
    updateUI();

    ensureFirebaseReady().catch((error) => {
      console.warn('Firebase initialization failed:', error);
      updateStatusMessages('Login is temporarily unavailable.', {
        type: 'error',
        title: error && error.message ? error.message : undefined,
      });
    });
  }

  function queryDom() {
    dom.signedOutDesktop = document.getElementById('authSignedOutDesktop');
    dom.signedInDesktop = document.getElementById('authSignedInDesktop');
    dom.signedOutMobile = document.getElementById('authSignedOutMobile');
    dom.signedInMobile = document.getElementById('authSignedInMobile');
    dom.userNameDesktop = document.getElementById('authUserNameDesktop');
    dom.userRoleDesktop = document.getElementById('authUserRoleDesktop');
    dom.userNameMobile = document.getElementById('authUserNameMobile');
    dom.userRoleMobile = document.getElementById('authUserRoleMobile');
    dom.logoutDesktop = document.getElementById('authLogoutButtonDesktop');
    dom.logoutMobile = document.getElementById('authLogoutButtonMobile');
    dom.loginTriggerDesktop = document.getElementById('authLoginTriggerDesktop');
    dom.loginTriggerMobile = document.getElementById('authLoginTriggerMobile');
    dom.loginMessageDesktop = document.getElementById('authStatusMessageDesktop');
    dom.loginMessageMobile = document.getElementById('authStatusMessageMobile');
  }

  function registerEvents() {
    if (dom.logoutDesktop && !dom.logoutDesktop.dataset.hbBound) {
      dom.logoutDesktop.dataset.hbBound = 'true';
      dom.logoutDesktop.addEventListener('click', (event) => {
        event.preventDefault();
        signOut();
      });
    }

    if (dom.logoutMobile && !dom.logoutMobile.dataset.hbBound) {
      dom.logoutMobile.dataset.hbBound = 'true';
      dom.logoutMobile.addEventListener('click', (event) => {
        event.preventDefault();
        signOut();
      });
    }

    if (dom.loginTriggerDesktop && !dom.loginTriggerDesktop.dataset.hbBound) {
      dom.loginTriggerDesktop.dataset.hbBound = 'true';
      dom.loginTriggerDesktop.addEventListener('click', handleLoginTrigger);
    }

    if (dom.loginTriggerMobile && !dom.loginTriggerMobile.dataset.hbBound) {
      dom.loginTriggerMobile.dataset.hbBound = 'true';
      dom.loginTriggerMobile.addEventListener('click', handleLoginTrigger);
    }
  }

  function updateUI() {
    const authed = isAuthenticated();
    toggleHidden(dom.signedOutDesktop, authed);
    toggleHidden(dom.signedInDesktop, !authed);
    toggleHidden(dom.signedOutMobile, authed);
    toggleHidden(dom.signedInMobile, !authed);

    if (authed && state.user) {
      const displayName = getDisplayName(state.user);
      setText(dom.userNameDesktop, displayName);
      setText(dom.userNameMobile, displayName);
      updateRoleBadge(dom.userRoleDesktop, state.user.role);
      updateRoleBadge(dom.userRoleMobile, state.user.role);
    } else {
      setText(dom.userNameDesktop, '');
      setText(dom.userNameMobile, '');
      updateRoleBadge(dom.userRoleDesktop, null);
      updateRoleBadge(dom.userRoleMobile, null);
    }
  }

  function toggleHidden(element, hidden) {
    if (!element) return;
    if (hidden) {
      element.setAttribute('hidden', 'hidden');
    } else {
      element.removeAttribute('hidden');
    }
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text || '';
    }
  }

  function updateRoleBadge(element, role) {
    if (!element) return;
    if (role) {
      element.textContent = role;
      element.removeAttribute('hidden');
    } else {
      element.textContent = '';
      element.setAttribute('hidden', 'hidden');
    }
  }

  function getDisplayName(user) {
    if (!user) return '';
    if (user.displayName) return user.displayName;
    if (user.first_name || user.last_name) {
      return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    }
    if (user.email) return user.email.split('@')[0];
    return 'Guest';
  }

  function updateStatusMessages(text, options) {
    const elements = [dom.loginMessageDesktop, dom.loginMessageMobile];
    elements.forEach((element) => {
      if (!element) return;
      if (text) {
        element.textContent = text;
        if (options && options.title) {
          element.title = options.title;
        } else {
          element.removeAttribute('title');
        }
        if (options && options.type) {
          element.dataset.statusType = options.type;
        } else {
          delete element.dataset.statusType;
        }
        element.removeAttribute('hidden');
      } else {
        element.textContent = '';
        element.setAttribute('hidden', 'hidden');
        element.removeAttribute('title');
        delete element.dataset.statusType;
      }
    });
  }

  function clearStatusMessages() {
    updateStatusMessages('', {});
  }

  function dispatchAuthEvent(eventName, detail) {
    const payload = detail || {};
    window.dispatchEvent(new CustomEvent(`hb:auth:${eventName}`, { detail: payload }));
    observers.forEach((callback) => {
      try {
        callback(eventName, payload);
      } catch (error) {
        console.warn('Auth observer callback failed', error);
      }
    });
  }

  function handleLoginTrigger(event) {
    if (event) {
      event.preventDefault();
    }
    signInWithFirebase({ redirectTo: window.location.href });
  }

  function ensureFirebaseReady() {
    return ensureEnvironmentReady().then(() => {
      if (state.firebaseReady && window.firebase) {
        return {
          firebase: window.firebase,
          app: state.firebaseApp,
          auth: state.firebaseAuth,
          firestore: state.firebaseFirestore,
          modules: state.firebaseModules,
        };
      }

      if (firebaseReadyPromise) {
        return firebaseReadyPromise;
      }

      const firebaseConfig = CONFIG.firebaseConfig;
      if (!firebaseConfig || !firebaseConfig.apiKey) {
        return Promise.reject(new Error('Missing Firebase configuration. Set window.APP_FIREBASE_CONFIG before loading auth.js.'));
      }

      firebaseReadyPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),
      ])
        .then(([appModule, authModule, firestoreModule]) => {
          if (!appModule || !appModule.initializeApp || !authModule || !authModule.getAuth) {
            throw new Error('Firebase modular SDK failed to load.');
          }

          const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
          const auth = authModule.getAuth(app);
          const firestore = firestoreModule.getFirestore(app);
          const isLocalhost =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

          if (isLocalhost) {
            auth.settings.appVerificationDisabledForTesting = true;
            console.warn(
              '[Firebase Auth] Localhost detected. Real SMS delivery can be limited locally; use Firebase test phone numbers here. App verification is disabled for testing only on localhost.'
            );
          }

          authModule.onIdTokenChanged(auth, handleFirebaseUser);
          state.firebaseModules = { app: appModule, auth: authModule, firestore: firestoreModule };
          state.firebaseApp = app;
          state.firebaseAuth = auth;
          state.firebaseFirestore = firestore;
          state.firebaseReady = true;
          console.log('[Firebase Auth] initialized', {
            projectId: firebaseConfig.projectId,
            authDomain: firebaseConfig.authDomain,
            domain: window.location.hostname,
            protocol: window.location.protocol,
            localhost: isLocalhost,
          });

          window.firebase = {
            app: () => app,
            auth: () => auth,
            firestore: () => firestore,
            modules: state.firebaseModules,
          };

          return { firebase: window.firebase, app, auth, firestore, modules: state.firebaseModules };
        })
        .catch((error) => {
          firebaseReadyPromise = null;
          throw error;
        });

      return firebaseReadyPromise;
    });
  }

  function resolveRedirectTarget(target) {
    const fallback = `${window.location.pathname}${window.location.search}${window.location.hash}` || 'index.html';
    if (!target || typeof target !== 'string') {
      return fallback;
    }
    try {
      const url = new URL(target, window.location.origin);
      if (url.origin !== window.location.origin) {
        return fallback;
      }
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (error) {
      return fallback;
    }
  }

  function redirectToAuthPage(page, options) {
    const redirectTo = resolveRedirectTarget(options && options.redirectTo);
    const url = new URL(page, window.location.origin);
    if (redirectTo) {
      url.searchParams.set('redirect', redirectTo);
    }
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  }

  function signInWithFirebase(options) {
    redirectToAuthPage('login.html', options);
    return Promise.resolve({ redirected: true });
  }

  function signOut() {
    return ensureFirebaseReady()
      .then(({ auth, modules }) => modules.auth.signOut(auth))
      .catch(() => {
        clearAuthState({ silent: true });
      })
      .finally(() => {
        clearAuthState({ silent: true });
      });
  }

  function isAuthenticated() {
    return Boolean(state.user && state.idToken);
  }

  function clearAuthState(options) {
    state.user = null;
    state.idToken = null;
    state.tokenExpiresAt = null;
    state.lastLoginAuthTime = null;
    clearAuthCookie();
    updateUI();
    if (!options || !options.silent) {
      dispatchAuthEvent('changed', { user: null });
      dispatchAuthEvent('signed-out', {});
    }
  }

  function clearAuthCookie() {
    document.cookie = `${CONFIG.authCookieName}=; Max-Age=0; path=/; SameSite=Strict`;
  }

  function persistAuthCookie(token, expiration) {
    if (!token) {
      clearAuthCookie();
      return;
    }

    let maxAge = 3600;
    if (expiration instanceof Date) {
      const diff = Math.floor((expiration.getTime() - Date.now()) / 1000);
      if (Number.isFinite(diff) && diff > 0) {
        maxAge = diff;
      }
    }

    const attributes = ['path=/', 'SameSite=Strict', `Max-Age=${Math.max(300, maxAge)}`];
    if (location.protocol === 'https:') {
      attributes.push('Secure');
    }

    document.cookie = `${CONFIG.authCookieName}=${encodeURIComponent(token)}; ${attributes.join('; ')}`;
  }

  async function handleFirebaseUser(user) {
    if (!user) {
      clearAuthState({ silent: false });
      return;
    }

    try {
      const tokenResult = await user.getIdTokenResult();
      const expiration = tokenResult.expirationTime ? new Date(tokenResult.expirationTime) : null;
      state.user = {
        uid: user.uid,
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: user.role || '',
      };
      state.idToken = tokenResult.token;
      state.tokenExpiresAt = expiration;
      persistAuthCookie(tokenResult.token, expiration);
      updateUI();
      dispatchAuthEvent('changed', { user: state.user });
      dispatchAuthEvent('signed-in', { user: state.user });

      if (tokenResult.authTime && state.lastLoginAuthTime !== tokenResult.authTime) {
        state.lastLoginAuthTime = tokenResult.authTime;
      }
    } catch (error) {
      console.error('Failed to resolve Firebase user token', error);
      updateStatusMessages('Authentication failed. Please try signing in again.', { type: 'error' });
      clearAuthState({ silent: false });
    }
  }

  async function getIdToken(options) {
    const { forceRefresh = false } = options || {};
    await ensureFirebaseReady().catch(() => null);

    const resources = await ensureFirebaseReady().catch(() => null);
    if (!resources || !resources.auth || !resources.modules) {
      return null;
    }

    const auth = resources.auth;
    if (!auth.currentUser) {
      return null;
    }

    try {
      const token = await auth.currentUser.getIdToken(forceRefresh);
      const tokenResult = await auth.currentUser.getIdTokenResult();
      if (!state.user) {
        state.user = {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || '',
          phoneNumber: auth.currentUser.phoneNumber || '',
          displayName: auth.currentUser.displayName || '',
          photoURL: auth.currentUser.photoURL || '',
          role: '',
        };
      }
      state.idToken = token;
      state.tokenExpiresAt = tokenResult.expirationTime ? new Date(tokenResult.expirationTime) : null;
      persistAuthCookie(token, state.tokenExpiresAt);
      return token;
    } catch (error) {
      console.warn('Unable to obtain Firebase ID token', error);
      return null;
    }
  }

  async function signInWithPhoneNumber(phoneNumber, verifier) {
    const resources = await ensureFirebaseReady();
    if (!resources || !resources.auth || !resources.firebase) {
      throw new Error('Phone login is unavailable right now.');
    }
    if (!phoneNumber || !verifier) {
      throw new Error('Phone number and verification challenge are required.');
    }
    await resources.modules.auth.setPersistence(resources.auth, resources.modules.auth.browserLocalPersistence);
    console.log('[Firebase Phone Auth] OTP request start', { phoneNumber, domain: window.location.hostname });
    return resources.modules.auth.signInWithPhoneNumber(resources.auth, phoneNumber, verifier);
  }

  async function signInWithEmail(email, password) {
    const resources = await ensureFirebaseReady();
    await resources.modules.auth.setPersistence(resources.auth, resources.modules.auth.browserLocalPersistence);
    return resources.modules.auth.signInWithEmailAndPassword(resources.auth, email, password);
  }

  async function createUserWithEmail(email, password, displayName) {
    const resources = await ensureFirebaseReady();
    await resources.modules.auth.setPersistence(resources.auth, resources.modules.auth.browserLocalPersistence);
    const credential = await resources.modules.auth.createUserWithEmailAndPassword(resources.auth, email, password);
    if (credential && credential.user && displayName) {
      await resources.modules.auth.updateProfile(credential.user, { displayName });
    }
    return credential;
  }

  async function signInWithGoogle() {
    const resources = await ensureFirebaseReady();
    await resources.modules.auth.setPersistence(resources.auth, resources.modules.auth.browserLocalPersistence);
    const provider = new resources.modules.auth.GoogleAuthProvider();
    return resources.modules.auth.signInWithPopup(resources.auth, provider);
  }

  function buildApiUrl(path) {
    if (/^https?:/i.test(path)) {
      return path;
    }
    const base = CONFIG.apiBaseUrl || '';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
      return `${base}${normalizedPath.slice(4)}`;
    }
    if (!base) {
      return normalizedPath;
    }
    return `${base}${normalizedPath}`;
  }

  function prepareRequestInit(options) {
    const init = Object.assign({}, options);
    const headers = new Headers(options && options.headers ? options.headers : {});

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    let body = options ? options.body : undefined;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body && typeof body === 'object' && !isFormData) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const contentType = headers.get('Content-Type') || '';
      if (contentType.includes('application/json') && typeof body !== 'string') {
        body = JSON.stringify(body);
      }
    }

    init.headers = headers;
    init.body = body;
    init.credentials = options && options.credentials ? options.credentials : 'same-origin';
    return init;
  }

  async function apiFetch(path, options) {
    await ensureEnvironmentReady();
    const init = prepareRequestInit(options || {});
    const token = await getIdToken();
    if (token) {
      init.headers.set('Authorization', `Bearer ${token}`);
    }

    const execute = () => fetch(buildApiUrl(path), init);
    let response = await execute();

    if (response.status === 401) {
      const refreshedToken = await getIdToken({ forceRefresh: true });
      if (refreshedToken) {
        init.headers.set('Authorization', `Bearer ${refreshedToken}`);
        response = await execute();
      }
    }

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      const error = new Error(message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.statusText = response.statusText;
      throw error;
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  async function extractErrorMessage(response) {
    try {
      const data = await response.clone().json();
      if (data) {
        if (typeof data.detail === 'string') {
          return data.detail;
        }
        if (typeof data.message === 'string') {
          return data.message;
        }
        if (Array.isArray(data) && data[0]) {
          return data[0];
        }
      }
    } catch (error) {
      // ignore JSON parse errors
    }
    try {
      const text = await response.text();
      if (text) {
        return text;
      }
    } catch (error) {
      // ignore text errors
    }
    return `Request failed with status ${response.status}`;
  }

  const Auth = {
    isAuthenticated,
    getUser: () => (state.user ? Object.assign({}, state.user) : null),
    signIn: (options) => signInWithFirebase(options),
    signInWithPhoneNumber,
    signInWithEmail,
    createUserWithEmail,
    signInWithGoogle,
    signOut,
    apiFetch,
    ensureFirebaseReady,
    getIdToken,
    redirectToAuthPage: (page, options) => redirectToAuthPage(page, options),
    on: (callback) => {
      if (typeof callback === 'function') {
        observers.add(callback);
        return () => observers.delete(callback);
      }
      return () => { };
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.Auth = Auth;
})();
