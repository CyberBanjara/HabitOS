/**
 * purchase-state.js
 * -----------------
 * Checks the signed-in user's purchase status against /api/purchase-status,
 * caches it in sessionStorage, and swaps all buy buttons to "Open Dashboard"
 * / "Access Your Tracker" when the user has already paid.
 *
 * Depends on: window.Auth (auth.js)
 */
(function () {
  'use strict';

  const CACHE_KEY = 'hb_purchase_status';
  const ACCESS_URL = 'access.html';

  const PurchaseState = {
    _purchased: null,
    _loading: false,
    _checked: false,

    /** @returns {boolean|null} true/false if checked, null if unknown */
    hasPurchased: function () {
      return this._purchased;
    },
  };

  /* ─── Initialisation ───────────────────────────────────── */

  function init() {
    // Attempt to read cache immediately so buttons can swap before the API call
    restoreFromCache();
    if (PurchaseState._purchased === true) {
      updateAllButtons(true);
    }

    // Listen for auth changes
    if (window.Auth && typeof window.Auth.on === 'function') {
      window.Auth.on(handleAuthEvent);
    }

    // Also run once when layout is ready (partials loaded)
    window.addEventListener('hb:layout:ready', function () {
      if (PurchaseState._purchased === true) {
        updateAllButtons(true);
      } else {
        checkIfReady();
      }
    });

    // Kick off a check in case auth is already resolved
    checkIfReady();
  }

  function handleAuthEvent(eventName) {
    if (eventName === 'signed-in' || eventName === 'changed') {
      checkIfReady();
    }
    if (eventName === 'signed-out') {
      clearCache();
      PurchaseState._purchased = null;
      PurchaseState._checked = false;
      updateAllButtons(false);
    }
  }

  function checkIfReady() {
    if (PurchaseState._loading) return;

    var isAuthed =
      window.Auth &&
      typeof window.Auth.isAuthenticated === 'function' &&
      window.Auth.isAuthenticated();

    if (!isAuthed) return;

    // If we already resolved from cache and it was true, no need for API call
    if (PurchaseState._checked && PurchaseState._purchased === true) {
      updateAllButtons(true);
      return;
    }

    fetchPurchaseStatus();
  }

  /* ─── API Call ─────────────────────────────────────────── */

  function fetchPurchaseStatus() {
    if (PurchaseState._loading) return;
    PurchaseState._loading = true;

    waitForToken()
      .then(function (token) {
        if (!token) {
          PurchaseState._loading = false;
          return;
        }
        return window.Auth.apiFetch('/api/purchase-status', { method: 'GET' });
      })
      .then(function (response) {
        if (!response) return;

        var purchased = Boolean(response.purchased);
        PurchaseState._purchased = purchased;
        PurchaseState._checked = true;

        if (purchased) {
          saveToCache(response);
        } else {
          clearCache();
        }

        updateAllButtons(purchased);
        dispatchStatusEvent(purchased, response);
      })
      .catch(function (error) {
        console.warn('[purchase-state] Failed to check purchase status:', error);
      })
      .finally(function () {
        PurchaseState._loading = false;
      });
  }

  function waitForToken() {
    return new Promise(function (resolve) {
      var attempts = 0;
      var tick = function () {
        attempts += 1;
        var tokenPromise =
          window.Auth && typeof window.Auth.getIdToken === 'function'
            ? window.Auth.getIdToken({ forceRefresh: attempts === 1 })
            : Promise.resolve(null);

        tokenPromise.then(function (token) {
          if (token || attempts > 12) {
            resolve(token);
            return;
          }
          setTimeout(tick, 250);
        });
      };
      tick();
    });
  }

  /* ─── DOM Updates ──────────────────────────────────────── */

  function updateAllButtons(purchased) {
    // 1. Navbar buy button
    var navBtn = document.getElementById('navBuyButton');
    if (navBtn) {
      if (purchased) {
        navBtn.href = ACCESS_URL;
        navBtn.innerHTML = '<i class="bi bi-grid-3x3-gap-fill"></i> Open Dashboard';
        navBtn.classList.add('is-purchased');
      } else {
        navBtn.href = 'checkout.html';
        navBtn.innerHTML = '<i class="bi bi-lightning-charge-fill"></i> Buy ₹9';
        navBtn.classList.remove('is-purchased');
      }
    }

    // 2. All elements with [data-buy-button]
    var buyButtons = document.querySelectorAll('[data-buy-button]');
    for (var i = 0; i < buyButtons.length; i++) {
      var btn = buyButtons[i];
      if (purchased) {
        btn.href = ACCESS_URL;
        btn.setAttribute('data-original-text', btn.innerHTML);
        var variant = btn.getAttribute('data-buy-button') || 'default';
        if (variant === 'hero') {
          btn.innerHTML = '<i class="bi bi-grid-3x3-gap-fill"></i> Access Your Tracker';
        } else if (variant === 'pricing') {
          btn.innerHTML = '<i class="bi bi-unlock-fill"></i> Access Your Tracker';
        } else if (variant === 'cta') {
          btn.innerHTML = '<i class="bi bi-grid-3x3-gap-fill"></i> Open Your Tracker';
        } else {
          btn.innerHTML = '<i class="bi bi-grid-3x3-gap-fill"></i> Open Dashboard';
        }
        btn.classList.add('is-purchased');
      } else {
        // Restore original if it was saved
        if (btn.getAttribute('data-original-text')) {
          btn.innerHTML = btn.getAttribute('data-original-text');
          btn.removeAttribute('data-original-text');
        }
        btn.classList.remove('is-purchased');
      }
    }

    // 3. On checkout page — redirect if already purchased
    var pageId = document.body && document.body.getAttribute('data-page-id');
    if (purchased && pageId === 'checkout') {
      window.location.replace(ACCESS_URL);
    }
  }

  /* ─── Cache ────────────────────────────────────────────── */

  function saveToCache(response) {
    try {
      var uid = window.Auth && window.Auth.getUser ? (window.Auth.getUser() || {}).uid : null;
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          purchased: true,
          uid: uid,
          purchasedAt: response.purchasedAt || null,
          cachedAt: Date.now(),
        })
      );
    } catch (e) {
      // sessionStorage may be unavailable
    }
  }

  function restoreFromCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return;
      var cached = JSON.parse(raw);

      // Only use cache for the same user session
      var uid = null;
      if (window.Auth && typeof window.Auth.getUser === 'function') {
        var user = window.Auth.getUser();
        uid = user ? user.uid : null;
      }

      // Cache is valid for 30 minutes
      var MAX_AGE = 30 * 60 * 1000;
      if (
        cached &&
        cached.purchased === true &&
        cached.cachedAt &&
        Date.now() - cached.cachedAt < MAX_AGE
      ) {
        // If we have a uid and it doesn't match, ignore cache
        if (uid && cached.uid && uid !== cached.uid) return;

        PurchaseState._purchased = true;
        PurchaseState._checked = true;
      }
    } catch (e) {
      // ignore
    }
  }

  function clearCache() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch (e) {
      // ignore
    }
  }

  /* ─── Events ───────────────────────────────────────────── */

  function dispatchStatusEvent(purchased, response) {
    window.dispatchEvent(
      new CustomEvent('hb:purchase:status', {
        detail: {
          purchased: purchased,
          purchasedAt: response ? response.purchasedAt : null,
          lastOrderId: response ? response.lastOrderId : null,
        },
      })
    );
  }

  /* ─── Bootstrap ────────────────────────────────────────── */

  window.PurchaseState = PurchaseState;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
