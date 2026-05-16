/**
 * Messy Note Parser — extracts structured work items from natural-language notes.
 *
 * The user pastes messy notes like:
 *   "I'm trying the quoting tool again but I still cannot remove the TRUCK/DISPATCH CHARGE..."
 *
 * The parser extracts: primary goal, bugs, UI requests, business logic requests,
 * business rules, verification expectations, risks, likely files.
 *
 * Two modes:
 *   1. Rule-based (default, no AI) — keyword matching, always available
 *   2. AI-powered (optional) — sends notes to Gemini Flash for smarter classification
 */

export interface ParsedNote {
  rawText: string;
  primaryGoal: string;
  bugs: string[];
  uiRequests: string[];
  logicRequests: string[];
  businessRules: string[];
  verificationExpectations: string[];
  risks: string[];
  likelyFiles: string[];
  uncertainties: string[];
  followUpQuestion: string | null;
  confidence: number;
  aiParsed?: boolean;
}

const BUG_SIGNALS = [
  /can'?t\s+\w+/i, /cannot\s+\w+/i, /doesn'?t\s+work/i, /not\s+working/i,
  /broken/i, /bug/i, /error/i, /crash/i, /fail/i, /wrong/i,
  /still\s+(can'?t|cannot|doesn'?t|won'?t|not)/i,
  /should\s+(be|show|display|work|hide)\s+but/i,
  /expected\s+.+\s+but/i, /instead\s+of/i,
  /keeps?\s+(showing|appearing|happening|failing)/i,
];

const UI_SIGNALS = [
  /button/i, /modal/i, /popup/i, /layout/i, /css/i, /style/i,
  /font/i, /color/i, /margin/i, /padding/i, /align/i, /center/i,
  /responsive/i, /mobile/i, /desktop/i, /header/i, /footer/i,
  /sidebar/i, /nav/i, /menu/i, /tab/i, /card/i, /toast/i,
  /visible/i, /hidden/i, /show/i, /hide/i, /display/i,
  /scroll/i, /overflow/i, /z-?index/i,
  /move\s+.+\s+(to|above|below|left|right)/i,
  /make\s+.+\s+(bigger|smaller|wider|taller)/i,
];

const LOGIC_SIGNALS = [
  /calculat/i, /compute/i, /formula/i, /total/i, /sum/i,
  /filter/i, /sort/i, /search/i, /query/i, /fetch/i,
  /save/i, /update/i, /delete/i, /remove/i, /add/i, /create/i,
  /validate/i, /check/i, /verify/i, /condition/i,
  /if\s+.+\s+then/i, /when\s+.+\s+(should|must|needs)/i,
  /price/i, /cost/i, /tax/i, /discount/i, /charge/i, /fee/i,
  /invoice/i, /quote/i, /billing/i, /payment/i,
];

const RULE_SIGNALS = [
  /must\s+(always|never)/i, /should\s+(always|never)/i,
  /rule/i, /requirement/i, /constraint/i,
  /only\s+when/i, /only\s+if/i, /unless/i,
  /\bif\s+.+\s+is\s+(set|zero|null|empty|true|false)/i,
  /never\s+(show|allow|delete|overwrite)/i,
  /always\s+(show|require|include|preserve)/i,
];

const VERIFY_SIGNALS = [
  /confirm/i, /make\s+sure/i, /verify/i, /test/i, /check\s+that/i,
  /should\s+(still|now)\s+(work|show|display|be)/i,
  /after\s+.+\s+(works?|still)/i,
];

const FILE_PATTERNS = [
  /\b[\w-]+\.(js|ts|jsx|tsx|html|css|json|py|rb|go|rs|vue|svelte)\b/gi,
  /\b[\w-]+\.(md|yml|yaml|toml|env)\b/gi,
];

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function extractFileReferences(text: string): string[] {
  const files = new Set<string>();
  for (const pattern of FILE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) files.add(m);
    }
  }
  return [...files];
}

function extractPrimaryGoal(sentences: string[]): string {
  const goalSignals = [/trying\s+to/i, /want\s+to/i, /need\s+to/i, /goal/i, /objective/i, /task/i];
  for (const s of sentences) {
    if (goalSignals.some((p) => p.test(s))) {
      return s;
    }
  }
  return sentences[0] || "Could not determine primary goal from notes.";
}

function assessConfidence(parsed: ParsedNote): number {
  let conf = 50;

  if (parsed.primaryGoal && !parsed.primaryGoal.startsWith("Could not")) conf += 10;
  if (parsed.bugs.length > 0) conf += 10;
  if (parsed.uiRequests.length > 0 || parsed.logicRequests.length > 0) conf += 10;
  if (parsed.likelyFiles.length > 0) conf += 10;
  if (parsed.businessRules.length > 0) conf += 5;
  if (parsed.uncertainties.length > 2) conf -= 10;
  if (parsed.rawText.length < 30) conf -= 15;

  return Math.max(20, Math.min(95, conf));
}

function determineFollowUp(parsed: ParsedNote): string | null {
  if (parsed.bugs.length === 0 && parsed.uiRequests.length === 0 && parsed.logicRequests.length === 0) {
    return "Could you describe the specific change or problem in more detail?";
  }
  if (parsed.likelyFiles.length === 0 && parsed.confidence < 60) {
    return "Which part of the app does this affect (e.g., quoting, invoicing, field app, settings)?";
  }
  return null;
}

export function parseNotes(rawText: string): ParsedNote {
  const sentences = extractSentences(rawText);
  const bugs: string[] = [];
  const uiRequests: string[] = [];
  const logicRequests: string[] = [];
  const businessRules: string[] = [];
  const verificationExpectations: string[] = [];
  const uncertainties: string[] = [];

  for (const sentence of sentences) {
    let classified = false;

    if (matchesAny(sentence, BUG_SIGNALS)) {
      bugs.push(sentence);
      classified = true;
    }
    if (matchesAny(sentence, UI_SIGNALS)) {
      uiRequests.push(sentence);
      classified = true;
    }
    if (matchesAny(sentence, LOGIC_SIGNALS)) {
      logicRequests.push(sentence);
      classified = true;
    }
    if (matchesAny(sentence, RULE_SIGNALS)) {
      businessRules.push(sentence);
      classified = true;
    }
    if (matchesAny(sentence, VERIFY_SIGNALS)) {
      verificationExpectations.push(sentence);
      classified = true;
    }

    if (!classified && sentence.length > 20) {
      uncertainties.push(sentence);
    }
  }

  const likelyFiles = extractFileReferences(rawText);
  const primaryGoal = extractPrimaryGoal(sentences);

  const parsed: ParsedNote = {
    rawText,
    primaryGoal,
    bugs,
    uiRequests,
    logicRequests,
    businessRules,
    verificationExpectations,
    risks: [],
    likelyFiles,
    uncertainties,
    followUpQuestion: null,
    confidence: 0,
  };

  // Infer risks from bug + logic overlap
  if (bugs.length > 0 && logicRequests.some((r) => /price|cost|tax|charge|invoice|quote|billing/i.test(r))) {
    parsed.risks.push("Business-critical financial logic involved — verify calculations carefully");
  }
  if (logicRequests.some((r) => /delete|remove/i.test(r))) {
    parsed.risks.push("Destructive operation mentioned — ensure safety checks");
  }

  parsed.confidence = assessConfidence(parsed);
  parsed.followUpQuestion = determineFollowUp(parsed);

  return parsed;
}

export async function aiParseNotes(rawText: string, geminiApiKey: string): Promise<ParsedNote> {
  const prompt = `You are a technical project manager. Analyze the following messy notes from a user/client and classify them into structured categories. The notes may contain bug reports, feature requests, UI/layout complaints, business logic changes, and contextual explanations.

RULES:
- Deduplicate: if the same issue appears in multiple phrasings, include it only once in the most appropriate category
- Context paragraphs that explain WHY something should change (background info, legal details, industry rules) should be summarized into a single actionable item, not split line-by-line
- A sentence about layout, spacing, sizing, or visual appearance is a UI request even if it mentions business terms
- A sentence about calculations, pricing, toggling features on/off, or data behavior is business logic
- "Return key" / "new line" / multiline input behavior = UI request
- Only flag risks for genuinely dangerous operations (financial calculations, data deletion, security)

Return ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{
  "primaryGoal": "one sentence summary of what the user most wants",
  "bugs": ["list of actual bugs — things that are broken or not working as expected"],
  "uiRequests": ["list of visual/layout/input behavior changes"],
  "logicRequests": ["list of business logic / feature / calculation changes"],
  "businessRules": ["list of rules or constraints the implementation must follow"],
  "verificationExpectations": ["list of things the user wants verified after changes"],
  "risks": ["list of genuine risks — only financial, data loss, or security concerns"],
  "likelyFiles": ["list of filenames mentioned or strongly implied"],
  "uncertainties": ["anything genuinely unclear that needs clarification"],
  "confidence": 85
}

Set confidence 70-95 based on how clear and actionable the notes are.

--- USER NOTES ---
${rawText}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data: any = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${cleaned.substring(0, 200)}`);
  }

  const uncertainties = Array.isArray(parsed.uncertainties) ? parsed.uncertainties : [];
  return {
    rawText,
    primaryGoal: parsed.primaryGoal || "Could not determine primary goal",
    bugs: Array.isArray(parsed.bugs) ? parsed.bugs : [],
    uiRequests: Array.isArray(parsed.uiRequests) ? parsed.uiRequests : [],
    logicRequests: Array.isArray(parsed.logicRequests) ? parsed.logicRequests : [],
    businessRules: Array.isArray(parsed.businessRules) ? parsed.businessRules : [],
    verificationExpectations: Array.isArray(parsed.verificationExpectations) ? parsed.verificationExpectations : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    likelyFiles: Array.isArray(parsed.likelyFiles) ? parsed.likelyFiles : [],
    uncertainties,
    followUpQuestion: uncertainties.length > 0 ? "Some items need clarification — see 'Unclassified' section above" : null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 75,
    aiParsed: true,
  };
}

export function formatParsedNote(p: ParsedNote): string {
  const aiLabel = p.aiParsed ? " (AI-assisted)" : "";
  const sections: string[] = [
    `## Parsed Notes${aiLabel}`,
    "",
    `**Primary Goal:** ${p.primaryGoal}`,
    `**Confidence:** ${p.confidence}%`,
    "",
  ];

  if (p.bugs.length > 0) {
    sections.push("### Bugs");
    p.bugs.forEach((b) => sections.push(`- ${b}`));
    sections.push("");
  }
  if (p.uiRequests.length > 0) {
    sections.push("### UI / Layout Requests");
    p.uiRequests.forEach((r) => sections.push(`- ${r}`));
    sections.push("");
  }
  if (p.logicRequests.length > 0) {
    sections.push("### Business Logic Requests");
    p.logicRequests.forEach((r) => sections.push(`- ${r}`));
    sections.push("");
  }
  if (p.businessRules.length > 0) {
    sections.push("### Business Rules");
    p.businessRules.forEach((r) => sections.push(`- ${r}`));
    sections.push("");
  }
  if (p.verificationExpectations.length > 0) {
    sections.push("### Verification Expectations");
    p.verificationExpectations.forEach((v) => sections.push(`- ${v}`));
    sections.push("");
  }
  if (p.risks.length > 0) {
    sections.push("### Risks");
    p.risks.forEach((r) => sections.push(`- ⚠️ ${r}`));
    sections.push("");
  }
  if (p.likelyFiles.length > 0) {
    sections.push("### Likely Files");
    p.likelyFiles.forEach((f) => sections.push(`- \`${f}\``));
    sections.push("");
  }
  if (p.uncertainties.length > 0) {
    sections.push("### Unclassified (needs review)");
    p.uncertainties.forEach((u) => sections.push(`- ${u}`));
    sections.push("");
  }
  if (p.followUpQuestion) {
    sections.push(`---`);
    sections.push(`**Follow-up question:** ${p.followUpQuestion}`);
  }

  return sections.join("\n");
}
