/**
 * Dispatcher map helpers: geocoding via OpenStreetMap Nominatim (free, no API key).
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
(function (global) {
  var sessionGeoCache = Object.create(null);
  var lastNominatimAt = 0;
  var MIN_NOMINATIM_INTERVAL_MS = 1100;

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /**
   * @param {string} address Full street / city / state string
   * @returns {Promise<{ lat: number, lng: number } | null>}
   */
  async function getCoordinatesForAddress(address) {
    var key = String(address || "").trim();
    if (!key || key.indexOf("UNKNOWN") !== -1) return null;
    if (sessionGeoCache[key]) return sessionGeoCache[key];

    var now = Date.now();
    var wait = Math.max(0, MIN_NOMINATIM_INTERVAL_MS - (now - lastNominatimAt));
    if (wait > 0) await sleep(wait);
    lastNominatimAt = Date.now();

    try {
      var url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
        encodeURIComponent(key);
      var res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
          "User-Agent": "TwinPillarsDispatch/1.0 (HVAC service dispatch board)",
        },
      });
      if (!res.ok) return null;
      var data = await res.json();
      if (!data || !data.length) return null;
      var lat = parseFloat(data[0].lat);
      var lng = parseFloat(data[0].lon);
      if (!isFinite(lat) || !isFinite(lng)) return null;
      var out = { lat: lat, lng: lng };
      sessionGeoCache[key] = out;
      return out;
    } catch (e) {
      console.warn("getCoordinatesForAddress:", e);
      return null;
    }
  }

  global.getCoordinatesForAddress = getCoordinatesForAddress;
})(typeof window !== "undefined" ? window : globalThis);
