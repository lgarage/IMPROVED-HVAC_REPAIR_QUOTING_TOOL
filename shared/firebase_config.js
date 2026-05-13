/**
 * Vertex-Core — Firestore offline persistence (IndexedDB).
 * Primary enable runs in firebase-config.js immediately after the first Firestore instance.
 * This module is a safety-net for pages that share the same Firebase app; the primary
 * enablePersistence already ran, so any error here (failed-precondition, already-started,
 * unimplemented, etc.) is expected and silently swallowed.
 */
(function () {
  "use strict";
  if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
  try {
    firebase
      .firestore()
      .enablePersistence({ synchronizeTabs: true })
      .catch(function () {
        // Silently swallow — primary persistence runs in firebase-config.js;
        // any error here is expected (already-started, failed-precondition, unimplemented).
      });
  } catch (e) {
    // Synchronous guard — same rationale.
  }
})();
