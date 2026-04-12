/**
 * Dispatcher portal — labor math and duration parsing (shared with service_call.js).
 */
(function (global) {
  "use strict";

  var DURATION_CHOICES = ["0.5", "1.0", "1.5", "2.0", "3.0", "4.0", "6.0", "8.0", "Multi-Day"];

  /**
   * Numeric hours used for gantt width, time range, and man-hour math.
   * "Multi-Day" is treated as one 8h scheduled block per product convention.
   */
  function parseScheduledDurationHours(durationStr) {
    var s = String(durationStr == null ? "" : durationStr).trim();
    if (s === "Multi-Day" || /^multi[\s-]?day$/i.test(s)) {
      return 8;
    }
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 1.5;
  }

  function computeTotalBillableHours(techCount, durationStr) {
    var t = Math.max(0, parseInt(techCount, 10) || 0);
    var h = parseScheduledDurationHours(durationStr);
    return Math.round(t * h * 100) / 100;
  }

  function isStandardDurationValue(v) {
    return DURATION_CHOICES.indexOf(String(v == null ? "" : v).trim()) !== -1;
  }

  global.DispatcherTicketManager = {
    DURATION_CHOICES: DURATION_CHOICES,
    parseScheduledDurationHours: parseScheduledDurationHours,
    computeTotalBillableHours: computeTotalBillableHours,
    isStandardDurationValue: isStandardDurationValue,
  };
})(typeof window !== "undefined" ? window : this);
