/**
 * Vertex-Core — Firestore offline persistence (IndexedDB).
 * Primary enable runs in firebase-config.js immediately after the first Firestore instance.
 * This module is safe to load in pages that share the same Firebase app: duplicate
 * enablePersistence calls are ignored (failed-precondition).
 */
(function () {
  "use strict";
  if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
  try {
    firebase
      .firestore()
      .enablePersistence({ synchronizeTabs: true })
      .catch(function (err) {
        if (err.code === "failed-precondition" || err.code === "unimplemented") return;
        console.warn("[Vertex-Core] shared/firebase_config persistence:", err.code || err);
      });
  } catch (e) {
    console.warn("[Vertex-Core] shared/firebase_config:", e);
  }
})();
