(function () {
  'use strict';

  let modalOptions = {};

  function init() {
    if (!document.body || !document.body.classList.contains('product-page')) {
      return;
    }

    injectAuthModal();

    if (window.Auth) {
      window.Auth.showLoginModal = showLoginModal;
      window.Auth.hideLoginModal = hideLoginModal;
    }

    update();

    if (window.Auth && typeof window.Auth.on === 'function') {
      window.Auth.on(update);
    }

    if (window.Auth && typeof window.Auth.getIdToken === 'function') {
      window.Auth.getIdToken()
        .then(update)
        .catch(update);
    }

    window.addEventListener('hb:layout:ready', update);
  }

  function update() {
    const authLink = document.querySelector('[data-product-auth-link]');
    const accountMenu = document.querySelector('[data-product-account-menu]');
    const accountDropdown = document.querySelector('[data-product-account-dropdown]');
    const logoutButton = document.querySelector('[data-product-logout]');
    if (!authLink) return;

    const label = authLink.querySelector('span') || authLink;
    const icon = authLink.querySelector('i');
    const user = window.Auth && window.Auth.getUser ? window.Auth.getUser() : null;
    const isAuthed = Boolean(user && window.Auth && window.Auth.isAuthenticated && window.Auth.isAuthenticated());

    bindAccountMenu(authLink, accountMenu, accountDropdown);

    if (isAuthed) {
      const display = user.displayName || user.email || 'Account';
      authLink.href = '#account';
      authLink.classList.add('is-authenticated');
      authLink.title = display;
      authLink.setAttribute('aria-haspopup', 'true');
      authLink.setAttribute('aria-expanded', 'false');
      label.textContent = display;
      if (icon) {
        icon.className = user.photoURL ? 'bi bi-person-circle' : 'bi bi-person-check';
      }
      if (logoutButton) {
        if (!logoutButton.dataset.bound) {
          logoutButton.dataset.bound = 'true';
          logoutButton.addEventListener('click', function () {
            if (window.Auth && typeof window.Auth.signOut === 'function') {
              closeAccountMenu(accountMenu, accountDropdown, authLink);
              window.Auth.signOut().finally(update);
            }
          });
        }
      }
      return;
    }

    authLink.href = 'login.html';
    authLink.classList.remove('is-authenticated');
    authLink.removeAttribute('title');
    authLink.removeAttribute('aria-haspopup');
    authLink.setAttribute('aria-expanded', 'false');
    label.textContent = 'Login';
    if (icon) {
      icon.className = 'bi bi-person';
    }
    closeAccountMenu(accountMenu, accountDropdown, authLink);
  }

  function bindAccountMenu(authLink, accountMenu, accountDropdown) {
    if (!authLink || !accountMenu || !accountDropdown || authLink.dataset.accountBound === 'true') {
      return;
    }

    authLink.dataset.accountBound = 'true';

    authLink.addEventListener('click', function (event) {
      const isAuthed = authLink.classList.contains('is-authenticated');
      if (!isAuthed) {
        event.preventDefault();
        showLoginModal();
        return;
      }

      event.preventDefault();
      const willOpen = accountDropdown.hidden;
      accountMenu.classList.toggle('is-open', willOpen);
      accountDropdown.hidden = !willOpen;
      authLink.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function (event) {
      if (!accountMenu.contains(event.target)) {
        closeAccountMenu(accountMenu, accountDropdown, authLink);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeAccountMenu(accountMenu, accountDropdown, authLink);
        hideLoginModal();
      }
    });
  }

  function closeAccountMenu(accountMenu, accountDropdown, authLink) {
    if (accountMenu) {
      accountMenu.classList.remove('is-open');
    }
    if (accountDropdown) {
      accountDropdown.hidden = true;
    }
    if (authLink) {
      authLink.setAttribute('aria-expanded', 'false');
    }
  }

  function injectAuthModal() {
    if (document.getElementById('authModalOverlay')) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'auth-modal-overlay';
    overlay.id = 'authModalOverlay';
    overlay.setAttribute('hidden', 'hidden');

    overlay.innerHTML = `
      <div class="auth-modal-container">
        <div class="auth-modal-header">
          <button type="button" class="auth-modal-close" id="authModalClose" aria-label="Close">
            <i class="bi bi-x-lg"></i>
          </button>
          <div class="auth-modal-title" id="authModalTitle">Log in or sign up</div>
        </div>
        
        <div class="auth-modal-body">
          <div id="authModalError" class="inline-alert error" hidden></div>
          <div id="authModalSuccess" class="inline-alert success" hidden></div>
          
          <!-- State: Login -->
          <div id="authModalLoginView">
            <h3 class="auth-modal-welcome">Welcome to HabitOS</h3>
            
            <div class="auth-providers-group">
              <button type="button" class="google-auth-button" id="authModalGoogleBtn">
                <span class="google-g" aria-hidden="true">G</span>
                <span>Continue with <span class="google-word"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></span></span>
              </button>

              <button type="button" class="facebook-auth-button" id="authModalFacebookBtn">
                <i class="bi bi-facebook facebook-icon"></i>
                <span>Continue with <span class="facebook-word">Facebook</span></span>
              </button>

              <button type="button" class="anonymous-auth-button" id="authModalAnonymousBtn">
                <i class="bi bi-incognito anonymous-icon"></i>
                <span>Continue as <span class="anonymous-word">Guest</span></span>
              </button>
            </div>
            
            <div class="auth-alt-strip">
              <span></span>
              <small>or email</small>
              <span></span>
            </div>
            
            <form id="authModalLoginForm" novalidate>
              <div class="auth-modal-form-group">
                <label for="authModalLoginEmail">Email</label>
                <input id="authModalLoginEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
              </div>
              <div class="auth-modal-form-group mt-3">
                <label for="authModalLoginPassword">Password</label>
                <input id="authModalLoginPassword" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required minlength="6" />
              </div>
              <button type="submit" class="btn-product btn-product-primary checkout-pay-btn mt-4" id="authModalLoginSubmitBtn">
                <i class="bi bi-envelope-lock"></i>
                Login
              </button>
            </form>
            
            <p class="auth-switch-copy mt-4">
              New here? <a href="#" id="authModalToSignup">Create an account</a>
            </p>
          </div>
          
          <!-- State: Signup -->
          <div id="authModalSignupView" hidden>
            <h3 class="auth-modal-welcome">Create your account</h3>
            
            <form id="authModalSignupForm" novalidate>
              <div class="auth-modal-form-group">
                <label for="authModalSignupName">Full Name</label>
                <input id="authModalSignupName" name="name" type="text" autocomplete="name" placeholder="John Doe" required />
              </div>
              <div class="auth-modal-form-group mt-3">
                <label for="authModalSignupEmail">Email</label>
                <input id="authModalSignupEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
              </div>
              <div class="auth-modal-form-group mt-3">
                <label for="authModalSignupPassword">Password</label>
                <input id="authModalSignupPassword" name="password" type="password" autocomplete="new-password" placeholder="At least 6 characters" required minlength="6" />
              </div>
              <div class="auth-modal-form-group mt-3">
                <label for="authModalSignupConfirmPassword">Confirm Password</label>
                <input id="authModalSignupConfirmPassword" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat your password" required minlength="6" />
              </div>
              <button type="submit" class="btn-product btn-product-primary checkout-pay-btn mt-4" id="authModalSignupSubmitBtn">
                <i class="bi bi-person-plus"></i>
                Sign Up
              </button>
            </form>
            
            <p class="auth-switch-copy mt-4">
              Already have an account? <a href="#" id="authModalToLogin">Log in</a>
            </p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    setupModalEvents(overlay);
  }

  function setupModalEvents(overlay) {
    const closeBtn = overlay.querySelector('#authModalClose');
    const toSignupLink = overlay.querySelector('#authModalToSignup');
    const toLoginLink = overlay.querySelector('#authModalToLogin');
    
    const loginView = overlay.querySelector('#authModalLoginView');
    const signupView = overlay.querySelector('#authModalSignupView');
    const titleEl = overlay.querySelector('#authModalTitle');
    
    const loginForm = overlay.querySelector('#authModalLoginForm');
    const signupForm = overlay.querySelector('#authModalSignupForm');
    const googleBtn = overlay.querySelector('#authModalGoogleBtn');
    const facebookBtn = overlay.querySelector('#authModalFacebookBtn');
    const anonymousBtn = overlay.querySelector('#authModalAnonymousBtn');
    
    const errAlert = overlay.querySelector('#authModalError');
    const successAlert = overlay.querySelector('#authModalSuccess');

    function setAlert(type, message) {
      errAlert.setAttribute('hidden', 'hidden');
      successAlert.setAttribute('hidden', 'hidden');
      if (!message) return;
      if (type === 'error') {
        errAlert.textContent = message;
        errAlert.removeAttribute('hidden');
      } else if (type === 'success') {
        successAlert.textContent = message;
        successAlert.removeAttribute('hidden');
      } else {
        // info state (use success alert styling for simplicity or keep alert-info style)
        successAlert.textContent = message;
        successAlert.removeAttribute('hidden');
      }
    }

    function toggleFormDisabled(form, isDisabled) {
      const elements = form.querySelectorAll('input, button');
      elements.forEach(el => {
        if (isDisabled) el.setAttribute('disabled', 'disabled');
        else el.removeAttribute('disabled');
      });
    }

    function mapAuthError(error) {
      if (!error || !error.code) {
        return error && error.message ? error.message : 'Something went wrong. Please try again.';
      }
      switch (error.code) {
        case 'auth/invalid-email':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          return 'Email or password is incorrect';
        case 'auth/user-disabled':
          return 'This account has been disabled. Contact support for assistance.';
        case 'auth/too-many-requests':
          return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/email-already-in-use':
          return 'User already exists. Please sign in';
        case 'auth/weak-password':
          return 'Choose a stronger password with at least 6 characters.';
        default:
          return error.message || error.code || 'Something went wrong. Please try again.';
      }
    }

    toSignupLink.addEventListener('click', function(e) {
      e.preventDefault();
      loginView.setAttribute('hidden', 'hidden');
      signupView.removeAttribute('hidden');
      titleEl.textContent = 'Sign up';
      setAlert();
    });

    toLoginLink.addEventListener('click', function(e) {
      e.preventDefault();
      signupView.setAttribute('hidden', 'hidden');
      loginView.removeAttribute('hidden');
      titleEl.textContent = 'Log in or sign up';
      setAlert();
    });

    closeBtn.addEventListener('click', () => hideLoginModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideLoginModal();
    });

    googleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      setAlert('info', 'Connecting to Google...');
      googleBtn.disabled = true;
      try {
        await window.Auth.signInWithGoogle();
        setAlert('success', 'Logged in successfully!');
        setTimeout(() => {
          hideLoginModal();
          googleBtn.disabled = false;
          if (modalOptions && modalOptions.onSuccess) {
            modalOptions.onSuccess();
          } else if (modalOptions && modalOptions.redirectTo) {
            window.location.assign(modalOptions.redirectTo);
          } else if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
            window.location.assign('index.html');
          }
        }, 800);
      } catch (error) {
        console.error(error);
        if (error.code !== 'auth/popup-closed-by-user') {
          setAlert('error', mapAuthError(error));
        } else {
          setAlert();
        }
        googleBtn.disabled = false;
      }
    });

    facebookBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      setAlert('info', 'Connecting to Facebook...');
      facebookBtn.disabled = true;
      try {
        await window.Auth.signInWithFacebook();
        setAlert('success', 'Logged in successfully!');
        setTimeout(() => {
          hideLoginModal();
          facebookBtn.disabled = false;
          if (modalOptions && modalOptions.onSuccess) {
            modalOptions.onSuccess();
          } else if (modalOptions && modalOptions.redirectTo) {
            window.location.assign(modalOptions.redirectTo);
          } else if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
            window.location.assign('index.html');
          }
        }, 800);
      } catch (error) {
        console.error(error);
        if (error.code !== 'auth/popup-closed-by-user') {
          setAlert('error', mapAuthError(error));
        } else {
          setAlert();
        }
        facebookBtn.disabled = false;
      }
    });

    anonymousBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      setAlert('info', 'Logging in as Guest...');
      anonymousBtn.disabled = true;
      try {
        await window.Auth.signInAnonymously();
        setAlert('success', 'Logged in successfully!');
        setTimeout(() => {
          hideLoginModal();
          anonymousBtn.disabled = false;
          if (modalOptions && modalOptions.onSuccess) {
            modalOptions.onSuccess();
          } else if (modalOptions && modalOptions.redirectTo) {
            window.location.assign(modalOptions.redirectTo);
          } else if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
            window.location.assign('index.html');
          }
        }, 800);
      } catch (error) {
        console.error(error);
        setAlert('error', mapAuthError(error));
        anonymousBtn.disabled = false;
      }
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      if (!email || !password) {
        setAlert('error', 'Please fill in all fields.');
        return;
      }

      setAlert('info', 'Logging in...');
      toggleFormDisabled(loginForm, true);

      try {
        await window.Auth.signInWithEmail(email, password);
        setAlert('success', 'Logged in successfully!');
        setTimeout(() => {
          hideLoginModal();
          toggleFormDisabled(loginForm, false);
          if (modalOptions && modalOptions.onSuccess) {
            modalOptions.onSuccess();
          } else if (modalOptions && modalOptions.redirectTo) {
            window.location.assign(modalOptions.redirectTo);
          } else if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
            window.location.assign('index.html');
          }
        }, 800);
      } catch (error) {
        setAlert('error', mapAuthError(error));
        toggleFormDisabled(loginForm, false);
      }
    });

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = signupForm.name.value.trim();
      const email = signupForm.email.value.trim();
      const password = signupForm.password.value;
      const confirmPassword = signupForm.confirmPassword.value;

      if (!name || !email || !password || !confirmPassword) {
        setAlert('error', 'Please fill in all fields.');
        return;
      }

      if (password !== confirmPassword) {
        setAlert('error', 'Passwords do not match.');
        return;
      }

      setAlert('info', 'Creating account...');
      toggleFormDisabled(signupForm, true);

      try {
        await window.Auth.createUserWithEmail(email, password, name);
        setAlert('success', 'Account created successfully!');
        setTimeout(() => {
          hideLoginModal();
          toggleFormDisabled(signupForm, false);
          if (modalOptions && modalOptions.onSuccess) {
            modalOptions.onSuccess();
          } else if (modalOptions && modalOptions.redirectTo) {
            window.location.assign(modalOptions.redirectTo);
          } else if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
            window.location.assign('index.html');
          }
        }, 800);
      } catch (error) {
        setAlert('error', mapAuthError(error));
        toggleFormDisabled(signupForm, false);
      }
    });
  }

  function showLoginModal(options) {
    injectAuthModal();
    modalOptions = options || {};
    const overlay = document.getElementById('authModalOverlay');
    if (overlay) {
      overlay.removeAttribute('hidden');
      
      const loginView = overlay.querySelector('#authModalLoginView');
      const signupView = overlay.querySelector('#authModalSignupView');
      const titleEl = overlay.querySelector('#authModalTitle');
      const errAlert = overlay.querySelector('#authModalError');
      const successAlert = overlay.querySelector('#authModalSuccess');
      
      loginView.removeAttribute('hidden');
      signupView.setAttribute('hidden', 'hidden');
      titleEl.textContent = 'Log in or sign up';
      errAlert.setAttribute('hidden', 'hidden');
      errAlert.textContent = '';
      successAlert.setAttribute('hidden', 'hidden');
      successAlert.textContent = '';
      
      overlay.querySelectorAll('input').forEach(input => { input.value = ''; });
    }
  }

  function hideLoginModal() {
    const overlay = document.getElementById('authModalOverlay');
    if (overlay) {
      overlay.setAttribute('hidden', 'hidden');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
