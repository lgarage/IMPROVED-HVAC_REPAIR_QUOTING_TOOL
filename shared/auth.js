/**
 * Vertex Core — Firebase Auth & admin identity (Slice 1, 2026-05-06).
 *
 * Foundation for the Per-User Feature Toggle work. This module does NOT
 * gate any UI by itself; it exposes a small `VCAuth` API that future
 * slices (Settings UI, /admin standalone page) hook into.
 *
 * v1 admin model (no Cloud Functions):
 *   isAdmin === true if EITHER:
 *     (a) Firebase Auth user's verified email is in
 *         APP_CONFIG.bootstrapAdminEmails (case-insensitive), OR
 *     (b) user's uid is in tenants/{tid}/admins/by_uid.uids
 *         (map<uid, true>), OR
 *     (c) the user's roster profile (matched by email) has
 *         isAdmin === true.
 *
 * Mirrors Firestore rules in `firestore.rules` (`isBootstrapAdmin()`
 * + `isStoredAdmin(tid)`); see DECISIONS.md → ADR-015.
 *
 * Boot order (in index.html / proof_of_service.html):
 *   1. firebase-app-compat.js
 *   2. firebase-firestore-compat.js
 *   3. firebase-auth-compat.js              <-- required for this module
 *   4. shared/config.js
 *   5. shared/firebase_logic.js
 *   6. shared/auth.js                       <-- THIS FILE
 *
 * Public API:
 *   VCAuth.onReady(cb)          → unsubscribe; cb({user, profile, isAdmin})
 *   VCAuth.signIn(email, pwd)   → Promise<UserCredential>
 *   VCAuth.signOut()            → Promise<void>
 *   VCAuth.currentUser()        → firebase.User | null
 *   VCAuth.currentProfile()     → object | null   (last resolved roster row)
 *   VCAuth.isAdmin()            → boolean
 *   VCAuth.isPinUnlocked()      → boolean (existing dispatcher PIN gate)
 *   VCAuth.requireAdmin(label)  → throws if not admin (call before writes)
 *   VCAuth.isReady()            → boolean (auth state has resolved at least once)
 */
(function (global) {
  "use strict";

  var AUTH_VERSION = 1;

  var STATE = {
    user: null,
    profile: null,
    isAdmin: false,
    ready: false,
    listeners: []
  };

  var ADMIN_DOC_CACHE = {
    tid: null,
    uids: null,
    at: 0
  };
  var ADMIN_DOC_TTL_MS = 60 * 1000;

  function bootstrapEmails() {
    try {
      if (typeof APP_CONFIG !== "undefined" && Array.isArray(APP_CONFIG.bootstrapAdminEmails)) {
        return APP_CONFIG.bootstrapAdminEmails
          .map(function (e) { return String(e || "").trim().toLowerCase(); })
          .filter(Boolean);
      }
    } catch (e) {}
    return [];
  }

  function tenantId() {
    try {
      if (typeof global.VCFirestore !== "undefined" && VCFirestore.getTenantId) {
        return VCFirestore.getTenantId();
      }
    } catch (e) {}
    try {
      if (typeof APP_CONFIG !== "undefined" && APP_CONFIG.tenantId) {
        return String(APP_CONFIG.tenantId);
      }
    } catch (e2) {}
    return "";
  }

  function isFirebaseAppReady() {
    return typeof firebase !== "undefined"
      && firebase.apps && firebase.apps.length > 0;
  }

  function isAuthSdkReady() {
    return isFirebaseAppReady() && typeof firebase.auth === "function";
  }

  function isFirestoreReady() {
    return isFirebaseAppReady() && typeof firebase.firestore === "function";
  }

  function whenSdkReady() {
    return new Promise(function (resolve) {
      if (isAuthSdkReady() && isFirestoreReady()) {
        resolve(true);
        return;
      }
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if ((isAuthSdkReady() && isFirestoreReady()) || tries > 100) {
          clearInterval(iv);
          resolve(isAuthSdkReady() && isFirestoreReady());
        }
      }, 50);
    });
  }

  function notifyAll() {
    var snap = {
      user: STATE.user,
      profile: STATE.profile,
      isAdmin: STATE.isAdmin,
      error: null
    };
    var ls = STATE.listeners.slice();
    for (var i = 0; i < ls.length; i++) {
      try { ls[i](snap); } catch (e) {
        try { console.warn("[VCAuth] listener", e); } catch (e2) {}
      }
    }
  }

  function loadAdminUids(tid) {
    if (!isFirestoreReady() || !tid) return Promise.resolve({});
    var now = Date.now();
    if (
      ADMIN_DOC_CACHE.tid === tid
      && (now - ADMIN_DOC_CACHE.at) < ADMIN_DOC_TTL_MS
      && ADMIN_DOC_CACHE.uids
    ) {
      return Promise.resolve(ADMIN_DOC_CACHE.uids);
    }
    var db = firebase.firestore();
    return db.doc("tenants/" + tid + "/admins/by_uid").get().then(function (snap) {
      var uids = {};
      if (snap.exists) {
        var data = snap.data() || {};
        if (data.uids && typeof data.uids === "object") {
          Object.keys(data.uids).forEach(function (k) {
            if (data.uids[k] === true) uids[k] = true;
          });
        }
      }
      ADMIN_DOC_CACHE.tid = tid;
      ADMIN_DOC_CACHE.uids = uids;
      ADMIN_DOC_CACHE.at = now;
      return uids;
    }).catch(function (err) {
      try { console.warn("[VCAuth] loadAdminUids:", err); } catch (e) {}
      return {};
    });
  }

  function loadProfileForUser(user, tid) {
    if (!user || !tid || !isFirestoreReady()) return Promise.resolve(null);
    var db = firebase.firestore();
    var col = db.collection("tenants").doc(tid).collection("users");
    var emailRaw = String(user.email || "").trim();
    var emailLower = emailRaw.toLowerCase();
    if (!emailRaw) return Promise.resolve(null);

    return col.where("emailLower", "==", emailLower).limit(1).get()
      .then(function (snap1) {
        if (!snap1.empty) {
          var d1 = snap1.docs[0];
          var p1 = d1.data() || {};
          p1._docId = d1.id;
          return p1;
        }
        return col.where("email", "==", emailRaw).limit(1).get().then(function (snap2) {
          if (snap2.empty) return null;
          var d2 = snap2.docs[0];
          var p2 = d2.data() || {};
          p2._docId = d2.id;
          return p2;
        });
      })
      .catch(function (err) {
        try { console.warn("[VCAuth] loadProfileForUser:", err); } catch (e) {}
        return null;
      });
  }

  function computeIsAdmin(user, profile, adminUids) {
    if (!user) return false;
    var email = String(user.email || "").trim().toLowerCase();
    var bootstrap = bootstrapEmails();
    // No emailVerified check for bootstrap — mirrors firestore.rules isBootstrapAdmin()
    // (the list is deploy-gated so the email is already trusted).
    if (email && bootstrap.indexOf(email) !== -1) return true;
    if (adminUids && adminUids[user.uid] === true) return true;
    if (profile && profile.isAdmin === true) return true;
    return false;
  }

  function attachAuthState() {
    if (!isAuthSdkReady()) return;
    var auth = firebase.auth();
    auth.onAuthStateChanged(function (user) {
      var tid = tenantId();
      STATE.user = user || null;
      if (!user) {
        STATE.profile = null;
        STATE.isAdmin = false;
        STATE.ready = true;
        notifyAll();
        return;
      }
      Promise.all([
        loadProfileForUser(user, tid),
        loadAdminUids(tid)
      ]).then(function (parts) {
        STATE.profile = parts[0] || null;
        STATE.isAdmin = computeIsAdmin(user, STATE.profile, parts[1] || {});
        STATE.ready = true;
        notifyAll();
      });
    });
  }

  function onReady(cb) {
    if (typeof cb !== "function") return function () {};
    STATE.listeners.push(cb);
    if (STATE.ready) {
      try {
        cb({
          user: STATE.user,
          profile: STATE.profile,
          isAdmin: STATE.isAdmin,
          error: null
        });
      } catch (e) {}
    }
    return function () {
      var i = STATE.listeners.indexOf(cb);
      if (i >= 0) STATE.listeners.splice(i, 1);
    };
  }

  function signIn(email, password) {
    return whenSdkReady().then(function () {
      if (!isAuthSdkReady()) {
        return Promise.reject(new Error("Firebase Auth SDK not loaded"));
      }
      return firebase.auth().signInWithEmailAndPassword(
        String(email || "").trim(),
        String(password || "")
      );
    });
  }

  function signOutNow() {
    return whenSdkReady().then(function () {
      if (!isAuthSdkReady()) return Promise.resolve();
      return firebase.auth().signOut();
    });
  }

  function currentUser() { return STATE.user; }
  function currentProfile() { return STATE.profile; }
  function isAdmin() { return !!STATE.isAdmin; }
  function isReady() { return !!STATE.ready; }

  function isPinUnlocked() {
    try { return sessionStorage.getItem("vc_admin_unlocked") === "1"; }
    catch (e) { return false; }
  }

  function requireAdmin(label) {
    if (!isAdmin()) {
      var ctx = "VCAuth.requireAdmin:" + (label || "?");
      var err = new Error("Admin required: " + (label || ""));
      try {
        if (typeof global.VCSurfaceWriteFailure === "function") {
          global.VCSurfaceWriteFailure(ctx, err);
        }
      } catch (e) {}
      throw err;
    }
    return true;
  }

  whenSdkReady().then(function (ok) {
    if (ok) {
      attachAuthState();
    } else {
      STATE.ready = true;
      try { console.warn("[VCAuth] Firebase Auth/Firestore SDK missing — VCAuth.isAdmin() will always be false."); } catch (e) {}
      notifyAll();
    }
  });

  global.VCAuth = {
    VERSION: AUTH_VERSION,
    onReady: onReady,
    signIn: signIn,
    signOut: signOutNow,
    currentUser: currentUser,
    currentProfile: currentProfile,
    isAdmin: isAdmin,
    isReady: isReady,
    isPinUnlocked: isPinUnlocked,
    requireAdmin: requireAdmin
  };

  try { console.info("[VC] auth v=" + AUTH_VERSION + " loaded"); } catch (e) {}
})(typeof window !== "undefined" ? window : this);
