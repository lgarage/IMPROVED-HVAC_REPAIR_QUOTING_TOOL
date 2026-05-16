/*
 * ═══════════════════════════════════════════════════════════════════
 *  VERTEX DISPATCHER — Service Worker  (Slice 56b)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  SCOPE ASYMMETRY: Dispatcher has a SW; tech app does not.
 *  ─────────────────────────────────────────────────────────────────
 *  • The DISPATCHER (root index.html) registers this service worker
 *    at scope '/' and benefits from offline caching, network-first
 *    HTML, and PWA install prompts (manifest.json).
 *
 *  • The TECH APP (technician/index.html) intentionally has NO
 *    service-worker registration of its own and is not a PWA.
 *    Firebase Hosting serves technician/ with cache-control headers
 *    that keep it fresh. Because this SW's scope is '/' it will
 *    intercept same-origin requests from technician/ pages (e.g.
 *    shared JS files fetched by the tech app shell), but those
 *    requests fall into the cache-first branch for assets, which is
 *    fine — shared modules are versioned via ?v= query strings.
 *    technician/index.html itself is handled by the network-first
 *    branch so tech-app users always get the latest shell on a
 *    good connection and only fall back to cache when offline.
 *
 *  CACHE LIFECYCLE
 *  ─────────────────────────────────────────────────────────────────
 *  INSTALL  → Precache all listed assets; call skipWaiting() so the
 *             new worker activates without waiting for old clients.
 *  ACTIVATE → Delete every cache whose name ≠ CACHE_NAME so stale
 *             resources from old deployments are never served; then
 *             claim all clients immediately.
 *  FETCH    → HTML pages (index.html shells) → network-first:
 *               try network → update cache → return response;
 *               on failure → serve cached copy.
 *             All other assets → cache-first:
 *               serve from cache → fall back to network.
 * ═══════════════════════════════════════════════════════════════════
 */

const CACHE_NAME = 'vertex-cache-v3';

/* ── Precache list ──────────────────────────────────────────────────
   Only root-relative assets that the dispatcher shell (and shared
   modules loaded from the root) need to be available offline.
   Technician-only assets (technician/js/*.js) are served by the
   network-first or cache-first fetch branches on demand.
   ─────────────────────────────────────────────────────────────────*/
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './manifest.json',

    // ── Shared modules ──────────────────────────────────────────────
    './shared/offline_storage_outbox.js',   // Slice 56a — offline photo outbox

    // ── Phase 41–53: Vertex Conversational Field Capture modules ────
    // Added in Slices 41a–53x; loaded by technician/index.html.
    // Precaching here keeps them available offline via SW intercept.
    './field_chronicle.js',
    './job_context_engine.js',
    './edge_intent_engine.js',
    './checklist_reminder_engine.js',
    './learning_sync.js',
    './teaching_layer.js',
    './conversational_timeline.js',
    './tech_job_history.js',
];

/* ── HTML shells that must use network-first ────────────────────────
   Stale HTML can silently load outdated JS bundles and break the app.
   Both app shells are listed so fresh markup is always attempted.   */
const NETWORK_FIRST_PATHS = [
    '/',
    '/index.html',
    '/technician/',
    '/technician/index.html',
];

function isNetworkFirst(requestUrl) {
    try {
        var pathname = new URL(requestUrl).pathname;
        return NETWORK_FIRST_PATHS.some(function (p) {
            return pathname === p || pathname.endsWith('/index.html');
        });
    } catch (e) {
        return false;
    }
}

/* ── Install: populate cache ────────────────────────────────────────*/
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log('[SW] Installing cache:', CACHE_NAME);
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    // Activate immediately without waiting for old clients to close.
    self.skipWaiting();
});

/* ── Activate: prune stale caches ───────────────────────────────────*/
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function (name) { return name !== CACHE_NAME; })
                    .map(function (name) {
                        console.log('[SW] Deleting stale cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(function () {
            // Claim existing clients so new fetch strategy takes effect
            // without requiring a page reload.
            return self.clients.claim();
        })
    );
});

/* ── Fetch: network-first for HTML shells, cache-first for assets ───*/
self.addEventListener('fetch', function (event) {
    // Only handle GET; skip non-http(s) (chrome-extension://, data:, etc.).
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    if (isNetworkFirst(event.request.url)) {
        // Network-first: fresh HTML on every request; cache is the fallback.
        event.respondWith(
            fetch(event.request).then(function (response) {
                if (response && response.status === 200) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(function () {
                return caches.match(event.request);
            })
        );
    } else {
        // Cache-first: serve assets instantly from cache; network is the fallback.
        event.respondWith(
            caches.match(event.request).then(function (response) {
                return response || fetch(event.request);
            })
        );
    }
});
