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
  /**
   * Paste your rotated Gemini browser key here (Generative Language API).
   * Leave "" to use apiKey for Gemini too. Restrict the key by HTTP referrer in Google Cloud.
   */
  geminiApiKey: "AIzaSyD0_nvTFX2R4H0pSxRTc5JNQN973z5eClQ",
};

/** Key used for all Gemini HTTP calls (dispatcher, technician, invoice, equipment manager). */
function getGeminiApiKey() {
  if (typeof firebaseConfig === "undefined") return "";
  const g = firebaseConfig.geminiApiKey;
  if (g != null && String(g).trim() !== "") return String(g).trim();
  return firebaseConfig.apiKey || "";
}

/**
 * Model id for generativelanguage.googleapis.com .../models/MODEL:generateContent
 * (gemini-1.5-flash was retired; change here if Google renames again.)
 */
var GEMINI_GENERATE_MODEL = "gemini-2.5-flash";

// Initialize Firebase (only official fields; geminiApiKey is app-only)
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
