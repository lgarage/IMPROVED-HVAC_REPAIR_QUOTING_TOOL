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

/**
 * @deprecated — Gemini API key is now held server-side in Cloud Functions (Secret Manager).
 * This stub remains so any stale code referencing getGeminiApiKey() won't throw at load time.
 * Remove once all callers are confirmed migrated.
 */
async function getGeminiApiKey() {
  console.warn("getGeminiApiKey() is deprecated — OCR now uses Cloud Function proxy.");
  return "";
}
function invalidateGeminiApiKeyCache() {}
