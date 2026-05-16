/**
 * Client Proof of Service — shared URL helpers, parsing, and Gemini client memo (dispatcher + proof page).
 */
(function (global) {
  "use strict";

  function generatePortalTokenId() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < 16; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  /**
   * @param {string} text
   * @returns {{ inspection: string, action: string, verification: string, remainder: string }}
   */
  function parseWorkOrderBlocks(text) {
    var raw = String(text || "");
    var out = { inspection: "", action: "", verification: "", remainder: raw.trim() };
    function grab(label) {
      var re = new RegExp(
        "\\[" + label + "\\]\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*\\[|$)",
        "i"
      );
      var m = raw.match(re);
      return m ? String(m[1]).trim() : "";
    }
    out.inspection = grab("INSPECTION");
    out.action = grab("ACTION");
    out.verification = grab("VERIFICATION");
    if (!out.inspection && !out.action && !out.verification) {
      out.remainder = raw.trim();
    }
    return out;
  }

  function buildProofOfServiceUrl(tenantId, token) {
    var base =
      typeof global.location !== "undefined" && global.location.origin
        ? global.location.origin
        : "";
    var tid = encodeURIComponent(String(tenantId || "").trim());
    var t = encodeURIComponent(String(token || "").trim());
    return base + "/proof_of_service.html?tid=" + tid + "&t=" + t;
  }

  /** Public-facing work description (no inter-office channel). */
  function pickPublicWorkDescription(issue, techNotes, clientPortalMemo) {
    var memo = String(clientPortalMemo || "").trim();
    if (memo) return memo;
    var tn = String(techNotes || "").trim();
    if (tn) return tn;
    return String(issue || "").trim();
  }

  /**
   * @param {string} roughNotes
   * @param {string} customerName
   * @returns {Promise<string>}
   */
  async function generateClientSummaryLetter(roughNotes, customerName) {
    var raw = String(roughNotes || "").trim();
    if (!raw) {
      throw new Error("Add technician notes or reported issue text first.");
    }
    if (typeof global.getGeminiApiKey !== "function") {
      throw new Error("Gemini API key is not available. Add it under Settings → Integrations.");
    }
    var geminiKey = await global.getGeminiApiKey();
    if (!geminiKey) {
      throw new Error("Gemini API key is not available.");
    }
    var cust = String(customerName || "Valued Customer").trim() || "Valued Customer";
    var safeRaw = raw.replace(/"""|```/g, " ");
    var prompt = [
      "You write short, professional customer letters for an HVAC service company.",
      "Format: a letter with greeting, 2–4 short paragraphs, and a closing signature line (company name only).",
      "Tone: warm, clear, confident. No technical jargon unless the notes already use it.",
      "Do NOT invent work that was not implied by the notes. Do NOT include internal dispatch notes or pricing.",
      "If equipment types are mentioned (RTU, furnace, etc.), keep them accurate to the notes.",
      "",
      "Customer name for greeting: " + cust,
      "",
      "Technician / dispatch notes to summarize:",
      '"""',
      safeRaw,
      '"""',
      "",
      "Output ONLY the letter text — no preamble.",
    ].join("\n");

    var model =
      typeof global.GEMINI_GENERATE_MODEL !== "undefined"
        ? global.GEMINI_GENERATE_MODEL
        : "gemini-2.5-flash";
    var response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
        encodeURIComponent(geminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 1024 },
        }),
      }
    );
    var data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || "Gemini request failed.");
    }
    var part =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0];
    var out = part && part.text ? String(part.text).trim() : "";
    out = out.replace(/^["']|["']$/g, "").trim();
    return out;
  }

  /**
   * Normalize one evidence entry: legacy string URLs become public by default.
   * @param {string|{url?:string,isPublic?:boolean,caption?:string}} raw
   * @returns {{url:string,isPublic:boolean,caption:string}|null}
   */
  function normalizeEvidenceEntry(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "string") {
      var u = String(raw).trim();
      return u ? { url: u, isPublic: true, caption: "" } : null;
    }
    if (typeof raw === "object") {
      var url = raw.url != null ? String(raw.url).trim() : "";
      if (!url) return null;
      return {
        url: url,
        isPublic: raw.isPublic !== false,
        caption: raw.caption != null ? String(raw.caption) : "",
      };
    }
    return null;
  }

  /**
   * @param {Array} arr
   * @returns {Array<{url:string,isPublic:boolean,caption:string}>}
   */
  function normalizeEvidencePhotoArray(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var e = normalizeEvidenceEntry(arr[i]);
      if (e) out.push(e);
    }
    return out;
  }

  /** URLs safe to show on Proof of Service / customer-facing surfaces. */
  function filterPublicEvidencePhotoUrls(arr) {
    return normalizeEvidencePhotoArray(arr)
      .filter(function (e) {
        return e.isPublic;
      })
      .map(function (e) {
        return e.url;
      });
  }

  global.VCClientPortal = {
    generatePortalTokenId: generatePortalTokenId,
    parseWorkOrderBlocks: parseWorkOrderBlocks,
    buildProofOfServiceUrl: buildProofOfServiceUrl,
    pickPublicWorkDescription: pickPublicWorkDescription,
    generateClientSummaryLetter: generateClientSummaryLetter,
    normalizeEvidenceEntry: normalizeEvidenceEntry,
    normalizeEvidencePhotoArray: normalizeEvidencePhotoArray,
    filterPublicEvidencePhotoUrls: filterPublicEvidencePhotoUrls,
  };
})(typeof window !== "undefined" ? window : this);
