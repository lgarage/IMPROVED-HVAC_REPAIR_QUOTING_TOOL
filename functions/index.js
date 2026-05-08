const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const DEFAULT_MODEL = "gemini-2.5-flash";

exports.callGeminiVision = onCall(
  { secrets: [GEMINI_API_KEY], maxInstances: 20 },
  async (request) => {
    const { base64Data, mimeType, promptText, model } = request.data;

    if (!base64Data || !promptText) {
      throw new HttpsError(
        "invalid-argument",
        "base64Data and promptText are required."
      );
    }

    const key = GEMINI_API_KEY.value();
    if (!key) {
      throw new HttpsError(
        "failed-precondition",
        "Gemini API key not configured. Run: firebase functions:secrets:set GEMINI_API_KEY"
      );
    }

    const modelId = model || DEFAULT_MODEL;
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(modelId) +
      ":generateContent?key=" +
      encodeURIComponent(key);

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg =
        (data && data.error && data.error.message) || res.statusText || "Gemini request failed";
      throw new HttpsError("internal", msg);
    }

    const parts =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts;

    if (!parts || !parts.length) return { text: "" };

    const text = parts.map((p) => p.text || "").join("\n");
    return { text };
  }
);
