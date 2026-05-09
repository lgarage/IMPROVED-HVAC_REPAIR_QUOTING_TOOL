// firebase-config.js

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBSb5b6Or-7yoiRV_gPLx4ZrZjh5Srx5r0",
  authDomain: "twin-pillars-app.firebaseapp.com",
  projectId: "twin-pillars-app",
  storageBucket: "twin-pillars-app.firebasestorage.app",
  messagingSenderId: "845074873991",
  appId: "1:845074873991:web:1e5e404570ca09f6690222",
  measurementId: "G-8V6PXJJFW8",
};

/**
 * Model id for generativelanguage.googleapis.com .../models/MODEL:generateContent
 * Used by equipment_manager.js (callGeminiVision) for data-plate OCR and dictation nameplate promotion.
 * (gemini-1.5-flash was retired; change here if Google renames again.)
 */
var GEMINI_GENERATE_MODEL = "gemini-2.5-flash";

// Initialize Firebase
firebase.initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
  measurementId: firebaseConfig.measurementId,
});

// Initialize Firestore Database (we will use this 'db' variable in our other files)
const db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
  if (err.code === "failed-precondition") {
    console.warn(
      "[Vertex-Core] Firestore persistence: multiple tabs open — use one tab for a single offline cache."
    );
  } else if (err.code === "unimplemented") {
    console.warn("[Vertex-Core] Firestore persistence is not supported in this browser.");
  } else {
    console.warn("[Vertex-Core] Firestore persistence:", err.code || err);
  }
});

/** Cached Gemini key from Firestore app_config/api_keys field gemini (null = not loaded yet). */
let _geminiKeyCache = null;
let _geminiKeyLoadPromise = null;

/**
 * Gemini API key from Firestore: collection app_config, document api_keys, field gemini.
 * @returns {Promise<string>}
 */
async function getGeminiApiKey() {
  if (_geminiKeyCache !== null) {
    return _geminiKeyCache;
  }
  if (_geminiKeyLoadPromise) {
    return _geminiKeyLoadPromise;
  }
  _geminiKeyLoadPromise = (async function () {
    try {
      const snap = await db.collection("app_config").doc("api_keys").get();
      const data = snap.exists ? snap.data() : {};
      const g =
        data && data.gemini != null ? String(data.gemini).trim() : "";
      _geminiKeyCache = g;
      return g;
    } catch (e) {
      console.error("getGeminiApiKey:", e);
      _geminiKeyCache = "";
      return "";
    } finally {
      _geminiKeyLoadPromise = null;
    }
  })();
  return _geminiKeyLoadPromise;
}

/** Call after updating api_keys in Firestore so the next getGeminiApiKey() refetches. */
function invalidateGeminiApiKeyCache() {
  _geminiKeyCache = null;
  _geminiKeyLoadPromise = null;
}
