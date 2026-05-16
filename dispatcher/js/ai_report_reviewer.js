/**
 * Transparent AI Report Reviewer — side-by-side Inter-Office Comms vs cited Gemini JSON (job-type aware).
 * Depends: firebase, VCFirestore, getGeminiApiKey, GEMINI_GENERATE_MODEL, alertIfGeminiApiDisabled (service_call.js).
 */
(function (global) {
    "use strict";

    var state = {
        ticketId: "",
        rawNotes: "",
        jobType: "",
        schemaKind: "",
        parsed: null,
        quoteRegistry: [],
    };

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function normalizeInternalComms(data) {
        if (!data) return "";
        var ic = data.internal_comms;
        if (ic == null) return "";
        if (Array.isArray(ic)) {
            return ic
                .map(function (x) {
                    return String(x);
                })
                .join("\n\n");
        }
        return String(ic);
    }

    function isPmJobType(jobType) {
        return String(jobType || "").trim() === "Preventative Maintenance";
    }

    function buildPmPrompt(rawNotes) {
        var raw = String(rawNotes || "").trim();
        return [
            "You are an HVAC documentation assistant. Extract structured PREVENTATIVE MAINTENANCE data from Inter-Office / technician notes.",
            "CRITICAL CITATION RULE: For EVERY text field you output, you MUST include a parallel sourceQuote string that is an EXACT contiguous substring copied from RAW_NOTES. If no verbatim substring supports a fact, set that field's text to an empty string and sourceQuote to \"\". Never invent facts. Never guess sourceQuote.",
            "Consolidate identical belts/filters/etc. across units into consolidatedFuturePMSupplyList with aggregated quantities/notes when the raw notes allow.",
            "",
            "Return ONLY valid JSON (no markdown fences) matching exactly:",
            "{",
            '  "schemaKind": "pm",',
            '  "workCompleted": { "text": string, "sourceQuote": string },',
            '  "equipmentDetails": [',
            "    {",
            '      "unitLabel": string,',
            '      "unitLabelSourceQuote": string,',
            '      "workDone": { "text": string, "sourceQuote": string },',
            '      "functionality": { "text": string, "sourceQuote": string },',
            '      "suggestedRepair": { "text": string, "sourceQuote": string },',
            '      "futurePmSupplies": { "text": string, "sourceQuote": string },',
            '      "partsNeeded": { "text": string, "sourceQuote": string }',
            "    }",
            "  ],",
            '  "consolidatedFuturePMSupplyList": [ { "description": string, "quantityOrNote": string, "sourceQuote": string } ]',
            "}",
            "",
            "RAW_NOTES:",
            '"""',
            raw.replace(/"""|```/g, " "),
            '"""',
        ].join("\n");
    }

    function buildDiagnosticPrompt(rawNotes) {
        var raw = String(rawNotes || "").trim();
        return [
            "You are an HVAC documentation assistant. Extract structured diagnostic / service data from Inter-Office / technician notes.",
            "CRITICAL CITATION RULE: For EVERY text field you output, you MUST include a parallel sourceQuote string that is an EXACT contiguous substring copied from RAW_NOTES. If no verbatim substring supports a fact, set that field's text to an empty string and sourceQuote to \"\". Never invent facts.",
            "",
            "Return ONLY valid JSON (no markdown fences) matching exactly:",
            "{",
            '  "schemaKind": "diagnostic",',
            '  "issueReported": { "text": string, "sourceQuote": string },',
            '  "diagnosis": { "text": string, "sourceQuote": string },',
            '  "workPerformed": { "text": string, "sourceQuote": string },',
            '  "recommendedRepairs": [ { "text": string, "sourceQuote": string } ]',
            "}",
            "",
            "RAW_NOTES:",
            '"""',
            raw.replace(/"""|```/g, " "),
            '"""',
        ].join("\n");
    }

    function cleanGeminiJsonString(text) {
        var t = String(text || "").trim();
        if (!t) return t;
        t = t.replace(/```json/gi, "").replace(/```/g, "").trim();
        return t;
    }

    function parseJsonFromGeminiText(text) {
        var t = cleanGeminiJsonString(text);
        if (!t) {
            throw new Error("Empty JSON response from Gemini.");
        }
        try {
            return JSON.parse(t);
        } catch (e1) {
            var o = t.indexOf("{");
            var c = t.lastIndexOf("}");
            if (o >= 0 && c > o) {
                try {
                    return JSON.parse(t.slice(o, c + 1));
                } catch (e2) { /* continue */ }
            }
            o = t.indexOf("[");
            c = t.lastIndexOf("]");
            if (o >= 0 && c > o) {
                try {
                    return JSON.parse(t.slice(o, c + 1));
                } catch (e3) { /* continue */ }
            }
            throw new Error(
                "Could not parse Gemini JSON: " + (e1 && e1.message ? e1.message : String(e1))
            );
        }
    }

    async function callGeminiJson(prompt) {
        if (typeof global.getGeminiApiKey !== "function") {
            throw new Error("Gemini API key is not available (getGeminiApiKey).");
        }
        var geminiKey = await global.getGeminiApiKey();
        if (!geminiKey) {
            throw new Error("Add a Gemini API key under Settings → Integrations.");
        }
        var model =
            typeof global.GEMINI_GENERATE_MODEL !== "undefined"
                ? global.GEMINI_GENERATE_MODEL
                : "gemini-2.0-flash";
        function buildBody(jsonMime) {
            var gen = { temperature: 0.15, maxOutputTokens: 8192 };
            if (jsonMime) gen.responseMimeType = "application/json";
            return JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: gen,
            });
        }
        async function runOnce(jsonMime) {
            var response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                    model +
                    ":generateContent?key=" +
                    encodeURIComponent(geminiKey),
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: buildBody(jsonMime),
                }
            );
            return response.json();
        }
        var data = await runOnce(true);
        if (data.error && /responseMimeType|mime|json/i.test(String(data.error.message || ""))) {
            data = await runOnce(false);
        }
        if (data.error) {
            var msg = data.error.message || "Gemini request failed.";
            if (typeof global.alertIfGeminiApiDisabled === "function") {
                if (global.alertIfGeminiApiDisabled(msg)) return null;
            }
            throw new Error(msg);
        }
        var part =
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts[0];
        var txt = part && part.text ? String(part.text).trim() : "";
        if (!txt) throw new Error("No JSON returned from Gemini.");
        return parseJsonFromGeminiText(txt);
    }

    function nextQuoteIndex(quote) {
        var q = String(quote || "").trim();
        if (!q) return -1;
        var idx = state.quoteRegistry.length;
        state.quoteRegistry.push(q);
        return idx;
    }

    function renderCitedField(label, field) {
        if (!field || typeof field !== "object") return "";
        var text = field.text != null ? String(field.text) : "";
        var sq = field.sourceQuote != null ? String(field.sourceQuote) : "";
        var qidx = nextQuoteIndex(sq);
        var cite =
            qidx >= 0
                ? ' class="vc-ai-cite" data-vc-qidx="' + qidx + '" tabindex="0"'
                : "";
        var head =
            label && String(label).trim()
                ? "<strong>" + escapeHtml(label) + "</strong>"
                : "";
        return (
            '<div class="vc-ai-field">' +
            head +
            '<p class="vc-ai-field-text"' +
            cite +
            ">" +
            escapeHtml(text) +
            "</p>" +
            "</div>"
        );
    }

    function renderPm(obj) {
        var html = '<div class="vc-ai-schema vc-ai-schema--pm">';
        html += "<h4>Work completed</h4>";
        html += renderCitedField("", obj.workCompleted || {});
        html += "<h4>Equipment</h4>";
        var eq = Array.isArray(obj.equipmentDetails) ? obj.equipmentDetails : [];
        if (!eq.length) {
            html += "<p class=\"vc-ai-muted\">No per-unit rows returned.</p>";
        }
        eq.forEach(function (row, i) {
            var ul = row.unitLabel != null ? String(row.unitLabel) : "Unit " + (i + 1);
            var ulSq = row.unitLabelSourceQuote != null ? String(row.unitLabelSourceQuote) : "";
            var uq = nextQuoteIndex(ulSq);
            var head =
                uq >= 0
                    ? '<h5 class="vc-ai-cite" data-vc-qidx="' + uq + '">' + escapeHtml(ul) + "</h5>"
                    : "<h5>" + escapeHtml(ul) + "</h5>";
            html += '<div class="vc-ai-equip-card">' + head;
            html += renderCitedField("Work done", row.workDone || {});
            html += renderCitedField("Functionality", row.functionality || {});
            html += renderCitedField("Suggested repair", row.suggestedRepair || {});
            html += renderCitedField("Future PM supplies", row.futurePmSupplies || {});
            html += renderCitedField("Parts needed", row.partsNeeded || {});
            html += "</div>";
        });
        html += "<h4>Consolidated future PM supply list</h4><ul class=\"vc-ai-supply-list\">";
        var cons = Array.isArray(obj.consolidatedFuturePMSupplyList)
            ? obj.consolidatedFuturePMSupplyList
            : [];
        if (!cons.length) {
            html += "<li class=\"vc-ai-muted\">—</li>";
        } else {
            cons.forEach(function (row) {
                var d = row.description != null ? String(row.description) : "";
                var n = row.quantityOrNote != null ? String(row.quantityOrNote) : "";
                var sq = row.sourceQuote != null ? String(row.sourceQuote) : "";
                var qidx = nextQuoteIndex(sq);
                var cite =
                    qidx >= 0
                        ? ' class="vc-ai-cite" data-vc-qidx="' + qidx + '"'
                        : "";
                html +=
                    "<li" +
                    cite +
                    "><strong>" +
                    escapeHtml(d) +
                    "</strong>" +
                    (n ? " — " + escapeHtml(n) : "") +
                    "</li>";
            });
        }
        html += "</ul></div>";
        return html;
    }

    function renderDiagnostic(obj) {
        var html = '<div class="vc-ai-schema vc-ai-schema--diagnostic">';
        html += renderCitedField("Issue reported", obj.issueReported || {});
        html += renderCitedField("Diagnosis", obj.diagnosis || {});
        html += renderCitedField("Work performed", obj.workPerformed || {});
        html += "<h4>Recommended repairs</h4><ul>";
        var rec = Array.isArray(obj.recommendedRepairs) ? obj.recommendedRepairs : [];
        if (!rec.length) {
            html += "<li class=\"vc-ai-muted\">—</li>";
        } else {
            rec.forEach(function (r) {
                var text = r && r.text != null ? String(r.text) : "";
                var sq = r && r.sourceQuote != null ? String(r.sourceQuote) : "";
                var qidx = nextQuoteIndex(sq);
                var cite =
                    qidx >= 0
                        ? ' class="vc-ai-cite" data-vc-qidx="' + qidx + '"'
                        : "";
                html += "<li" + cite + ">" + escapeHtml(text) + "</li>";
            });
        }
        html += "</ul></div>";
        return html;
    }

    function formatPlainTextForPortal(obj, kind) {
        var lines = [];
        if (kind === "pm") {
            lines.push("PREVENTATIVE MAINTENANCE — CLIENT SUMMARY (AI-reviewed)");
            lines.push("");
            if (obj.workCompleted && obj.workCompleted.text) {
                lines.push("Work completed:");
                lines.push(obj.workCompleted.text);
                lines.push("");
            }
            var eq = Array.isArray(obj.equipmentDetails) ? obj.equipmentDetails : [];
            eq.forEach(function (row, i) {
                lines.push("Equipment " + (i + 1) + ": " + (row.unitLabel || ""));
                ["workDone", "functionality", "suggestedRepair", "futurePmSupplies", "partsNeeded"].forEach(
                    function (k) {
                        var f = row[k];
                        if (f && f.text) {
                            lines.push(
                                "  " +
                                    k.replace(/([A-Z])/g, " $1").replace(/^./, function (x) {
                                        return x.toUpperCase();
                                    }) +
                                    ": " +
                                    f.text
                            );
                        }
                    }
                );
                lines.push("");
            });
            lines.push("Consolidated future PM supplies:");
            (Array.isArray(obj.consolidatedFuturePMSupplyList)
                ? obj.consolidatedFuturePMSupplyList
                : []
            ).forEach(function (r) {
                if (r && r.description) {
                    lines.push(
                        "  • " +
                            r.description +
                            (r.quantityOrNote ? " (" + r.quantityOrNote + ")" : "")
                    );
                }
            });
        } else {
            lines.push("SERVICE REPORT — CLIENT SUMMARY (AI-reviewed)");
            lines.push("");
            if (obj.issueReported && obj.issueReported.text) {
                lines.push("Issue reported:");
                lines.push(obj.issueReported.text);
                lines.push("");
            }
            if (obj.diagnosis && obj.diagnosis.text) {
                lines.push("Diagnosis:");
                lines.push(obj.diagnosis.text);
                lines.push("");
            }
            if (obj.workPerformed && obj.workPerformed.text) {
                lines.push("Work performed:");
                lines.push(obj.workPerformed.text);
                lines.push("");
            }
            lines.push("Recommended repairs:");
            (Array.isArray(obj.recommendedRepairs) ? obj.recommendedRepairs : []).forEach(function (
                r
            ) {
                if (r && r.text) lines.push("  • " + r.text);
            });
        }
        return lines.join("\n").trim();
    }

    function setRawPanelPlain(text) {
        var el = document.getElementById("vcAiReviewRaw");
        if (!el) return;
        el.dataset.fullText = text;
        el.textContent = text;
    }

    function restoreRawHighlight() {
        var el = document.getElementById("vcAiReviewRaw");
        if (!el || el.dataset.fullText == null) return;
        el.textContent = el.dataset.fullText;
    }

    function highlightQuoteInRaw(qidx) {
        var el = document.getElementById("vcAiReviewRaw");
        if (!el || el.dataset.fullText == null) return;
        var raw = el.dataset.fullText;
        var quote =
            typeof qidx === "number" && state.quoteRegistry[qidx] != null
                ? state.quoteRegistry[qidx]
                : "";
        if (!quote || raw.indexOf(quote) === -1) {
            el.textContent = raw;
            return;
        }
        var idx = raw.indexOf(quote);
        var before = escapeHtml(raw.substring(0, idx));
        var mid = escapeHtml(quote);
        var after = escapeHtml(raw.substring(idx + quote.length));
        el.innerHTML = before + '<mark class="vc-highlight-quote">' + mid + "</mark>" + after;
    }

    function wireCitationHover(root) {
        if (!root) return;
        root.querySelectorAll("[data-vc-qidx]").forEach(function (node) {
            node.addEventListener("mouseenter", function () {
                var i = parseInt(node.getAttribute("data-vc-qidx"), 10);
                if (!isNaN(i)) highlightQuoteInRaw(i);
            });
            node.addEventListener("mouseleave", function () {
                restoreRawHighlight();
            });
            node.addEventListener("focus", function () {
                var i = parseInt(node.getAttribute("data-vc-qidx"), 10);
                if (!isNaN(i)) highlightQuoteInRaw(i);
            });
            node.addEventListener("blur", function () {
                restoreRawHighlight();
            });
        });
    }

    function setLoading(isLoading, msg) {
        var gen = document.getElementById("vcAiReviewGenerateBtn");
        var appr = document.getElementById("vcAiReviewApproveBtn");
        if (gen) {
            gen.disabled = !!isLoading;
            if (isLoading) gen.textContent = msg || "⏳ Generating…";
            else gen.textContent = "Generate from Inter-Office notes";
        }
        if (appr && isLoading) appr.disabled = true;
    }

    async function openModal() {
        if (!isFeatureEnabled()) {
            console.warn("[VcAiReportReviewer] aiReportReviewer feature not enabled for this user.");
            return;
        }
        var idEl = document.getElementById("scCurrentId");
        var ticketId = idEl && idEl.value ? String(idEl.value).trim() : "";
        if (!ticketId) {
            alert("Open or create a ticket in Service Call Intake first (saved ticket id required).");
            return;
        }
        if (typeof firebase === "undefined" || !firebase.firestore) {
            alert("Firebase is not ready.");
            return;
        }
        if (typeof VCFirestore === "undefined" || !VCFirestore.getServiceCallOnceBridged) {
            alert("Firestore bridge not loaded.");
            return;
        }
        var db = firebase.firestore();
        var got = await VCFirestore.getServiceCallOnceBridged(db, ticketId);
        if (!got || !got.exists || !got.data) {
            alert("Could not load this ticket from Firestore.");
            return;
        }
        var data = got.data;
        state.ticketId = ticketId;
        state.rawNotes = normalizeInternalComms(data);
        state.jobType = data.jobType != null ? String(data.jobType) : "";
        state.parsed = null;
        state.schemaKind = isPmJobType(state.jobType) ? "pm" : "diagnostic";

        var badge = document.getElementById("vcAiReviewJobTypeBadge");
        if (badge) {
            badge.textContent =
                "Job type: " +
                (state.jobType || "—") +
                " → " +
                (state.schemaKind === "pm" ? "PM schema" : "Diagnostic schema");
        }
        setRawPanelPlain(state.rawNotes || "(No Inter-Office Comms on this ticket yet.)");

        var parsedEl = document.getElementById("vcAiReviewParsed");
        if (parsedEl) {
            parsedEl.innerHTML =
                '<p class="vc-ai-muted">Click <strong>Generate</strong> to run the AI extractor.</p>';
        }
        var appr = document.getElementById("vcAiReviewApproveBtn");
        if (appr) appr.disabled = true;

        var modal = document.getElementById("vcAiReportReviewerModal");
        if (modal) {
            modal.style.display = "block";
            modal.setAttribute("aria-hidden", "false");
        }
    }

    function closeModal() {
        var modal = document.getElementById("vcAiReportReviewerModal");
        if (modal) {
            modal.style.display = "none";
            modal.setAttribute("aria-hidden", "true");
        }
        restoreRawHighlight();
    }

    async function generate() {
        if (!state.ticketId) {
            alert("Open the reviewer from a loaded ticket first.");
            return;
        }
        var raw = String(state.rawNotes || "").trim();
        if (!raw || raw === "(No Inter-Office Comms on this ticket yet.)") {
            alert("Add Inter-Office Comms to this ticket first (Field dictation / Pulse / internal notes).");
            return;
        }
        setLoading(true);
        state.quoteRegistry = [];
        try {
            var prompt = isPmJobType(state.jobType)
                ? buildPmPrompt(raw)
                : buildDiagnosticPrompt(raw);
            var parsed = await callGeminiJson(prompt);
            if (!parsed) {
                setLoading(false);
                return;
            }
            state.parsed = parsed;
            state.schemaKind =
                parsed.schemaKind === "pm" || isPmJobType(state.jobType) ? "pm" : "diagnostic";

            var html =
                state.schemaKind === "pm" ? renderPm(parsed) : renderDiagnostic(parsed);
            var parsedEl = document.getElementById("vcAiReviewParsed");
            if (parsedEl) {
                parsedEl.innerHTML = html;
                wireCitationHover(parsedEl);
            }
            var appr = document.getElementById("vcAiReviewApproveBtn");
            if (appr) appr.disabled = false;
            if (typeof global.showSaveCue === "function") {
                global.showSaveCue("✓ AI extraction ready — review citations, then approve.");
            }
        } catch (e) {
            console.error("VcAiReportReviewer.generate", e);
            alert(e && e.message ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    async function approveAndSave() {
        if (!state.ticketId || !state.parsed) {
            alert("Generate a report first.");
            return;
        }
        var memo = formatPlainTextForPortal(state.parsed, state.schemaKind);
        if (!memo) {
            alert("Nothing to save — extraction was empty.");
            return;
        }
        if (typeof VCFirestore === "undefined" || !VCFirestore.setServiceCallMerged) {
            alert("setServiceCallMerged not available.");
            return;
        }
        var db = firebase.firestore();
        var btn = document.getElementById("vcAiReviewApproveBtn");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "⏳ Saving…";
        }
        try {
            await VCFirestore.setServiceCallMerged(
                db,
                state.ticketId,
                { clientPortalMemo: memo },
                true
            );
            var memoEl = document.getElementById("scClientPortalMemo");
            if (memoEl) memoEl.value = memo;

            var dbLocal = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]");
            var ix = dbLocal.findIndex(function (r) {
                return r && r.id === state.ticketId;
            });
            if (ix >= 0) {
                dbLocal[ix].clientPortalMemo = memo;
                localStorage.setItem("twinPillarsServiceDB", JSON.stringify(dbLocal));
            }
            // KI-002 E4: syncSingleServiceCallToCloud removed — it internally calls
            // VCFirestore.setServiceCallMerged, which was already called above (line ~567).
            // Keeping the call doubled the Firestore write cost with no additional benefit.
            if (typeof global.showSaveCue === "function") {
                global.showSaveCue("✓ Client portal memo saved");
            }
            closeModal();
        } catch (e) {
            console.error(e);
            alert(e && e.message ? e.message : String(e));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Approve & Save to Portal";
            }
        }
    }

    function isFeatureEnabled() {
        try {
            if (typeof window.VCUserEntitlements !== "undefined" && VCUserEntitlements.has) {
                var profile =
                    (typeof window.VCAuth !== "undefined" && VCAuth.currentProfile)
                        ? VCAuth.currentProfile()
                        : null;
                return VCUserEntitlements.has("aiReportReviewer", profile);
            }
        } catch (e) {}
        // Fallback: check tenant-level flag when VCUserEntitlements not yet loaded.
        try {
            if (typeof window.vcHasFeature === "function") {
                return vcHasFeature("aiReportReviewer");
            }
        } catch (e) {}
        return false;
    }

    function init() {
        var gen = document.getElementById("vcAiReviewGenerateBtn");
        var appr = document.getElementById("vcAiReviewApproveBtn");
        if (gen) gen.addEventListener("click", function () { void generate(); });
        if (appr) appr.addEventListener("click", function () { void approveAndSave(); });
        var modal = document.getElementById("vcAiReportReviewerModal");
        if (modal) {
            modal.addEventListener("click", function (e) {
                if (e.target === modal) closeModal();
            });
        }
    }

    /* ── Review Package (Slice 49a) ─────────────────────────────── */

    var reviewPkgState = {
        ticketId: "",
        reportDocId: "",
        findings: [],
        photos: [],
        editLog: [],
        approvedReportText: "",
    };

    function loadReviewPackage(ticketId) {
        reviewPkgState.ticketId = ticketId;
        reviewPkgState.findings = [];
        reviewPkgState.photos = [];
        reviewPkgState.editLog = [];
        reviewPkgState.reportDocId = "";
        reviewPkgState.approvedReportText = "";

        var card = document.getElementById("vc-review-package");
        if (!card) return Promise.resolve();

        if (!ticketId || typeof firebase === "undefined" || !firebase.firestore) {
            card.style.display = "none";
            return Promise.resolve();
        }

        var db = firebase.firestore();
        var crCol = (typeof VCFirestore !== "undefined" && VCFirestore.completedReports)
            ? VCFirestore.completedReports(db)
            : db.collection("completed_reports");

        return crCol
            .where("ticketId", "==", ticketId)
            .orderBy("compiledAt", "desc")
            .limit(1)
            .get()
            .then(function (snap) {
                if (snap.empty) {
                    card.style.display = "none";
                    return;
                }
                var doc = snap.docs[0];
                var data = doc.data();
                reviewPkgState.reportDocId = doc.id;

                var cr = data.compiledResult || {};
                reviewPkgState.findings = (Array.isArray(cr.equipmentFindings) ? cr.equipmentFindings : []).map(function (f, i) {
                    return {
                        id: "ef-" + i,
                        equipment: f.equipment || "Unknown Equipment",
                        diagnosis: f.diagnosis || "",
                        measurements: f.measurements || "",
                        actionsTaken: f.actionsTaken || "",
                        visible: true,
                        internalOnly: false,
                    };
                });
                reviewPkgState.photos = Array.isArray(data.photos) ? data.photos : [];

                card.style.display = "block";
                renderReviewPackageCard();
            })
            .catch(function (err) {
                console.warn("[ReviewPackage] load error:", err);
                card.style.display = "none";
            });
    }

    function renderReviewPackageCard() {
        var card = document.getElementById("vc-review-package");
        if (!card) return;

        var findings = reviewPkgState.findings;
        if (!findings.length) {
            card.innerHTML =
                '<div class="vc-rp-empty" style="padding:16px;color:#94a3b8;font-size:13px;">' +
                "No equipment findings in this review package.</div>";
            return;
        }

        var html = '<div class="vc-rp-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
            '<h4 style="margin:0;font-size:15px;color:#e2e8f0;">Review Package <span style="font-size:12px;color:#64748b;">(' + findings.length + ' finding' + (findings.length !== 1 ? "s" : "") + ')</span></h4>' +
            '<span style="font-size:11px;color:#f59e0b;">⚠ Requires human review</span>' +
            "</div>";

        for (var i = 0; i < findings.length; i++) {
            var f = findings[i];
            var opacity = f.visible ? "1" : "0.4";
            var badge = f.internalOnly
                ? ' <span style="font-size:10px;background:#7c3aed;color:#fff;padding:2px 6px;border-radius:3px;">INTERNAL</span>'
                : "";

            html += '<div class="vc-rp-finding" data-finding-id="' + escapeHtml(f.id) + '" style="' +
                "background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px;margin-bottom:10px;opacity:" + opacity + ';">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
                '<strong style="color:#00d4ff;font-size:13px;">' + escapeHtml(f.equipment) + "</strong>" + badge +
                "</div>" +
                '<div style="margin-bottom:6px;">' +
                '<label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:2px;">Diagnosis</label>' +
                '<textarea class="vc-rp-edit" data-field="diagnosis" data-idx="' + i + '" style="' +
                "width:100%;box-sizing:border-box;min-height:36px;resize:vertical;font-family:inherit;font-size:12px;" +
                'background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:4px;padding:6px;">' +
                escapeHtml(f.diagnosis) + "</textarea></div>" +
                '<div style="margin-bottom:6px;">' +
                '<label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:2px;">Measurements</label>' +
                '<textarea class="vc-rp-edit" data-field="measurements" data-idx="' + i + '" style="' +
                "width:100%;box-sizing:border-box;min-height:36px;resize:vertical;font-family:inherit;font-size:12px;" +
                'background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:4px;padding:6px;">' +
                escapeHtml(f.measurements) + "</textarea></div>" +
                '<div style="margin-bottom:6px;">' +
                '<label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:2px;">Actions Taken</label>' +
                '<textarea class="vc-rp-edit" data-field="actionsTaken" data-idx="' + i + '" style="' +
                "width:100%;box-sizing:border-box;min-height:36px;resize:vertical;font-family:inherit;font-size:12px;" +
                'background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:4px;padding:6px;">' +
                escapeHtml(f.actionsTaken) + "</textarea></div>" +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">' +
                '<button type="button" class="vc-rp-toggle-btn" data-idx="' + i + '" style="' +
                "font-size:11px;padding:4px 10px;border:1px solid #475569;background:transparent;color:#94a3b8;" +
                'border-radius:4px;cursor:pointer;">' +
                (f.visible ? "Remove" : "Restore") + "</button>" +
                '<button type="button" class="vc-rp-internal-btn" data-idx="' + i + '" style="' +
                "font-size:11px;padding:4px 10px;border:1px solid #7c3aed;background:transparent;color:#a78bfa;" +
                'border-radius:4px;cursor:pointer;">' +
                (f.internalOnly ? "Make Customer-Visible" : "Mark Internal Only") + "</button>" +
                "</div></div>";
        }

        html += '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">' +
            '<button type="button" id="vcRpApproveBtn" style="' +
            "padding:10px 18px;background:#0f766e;color:#fff;border:none;border-radius:6px;" +
            'font-weight:bold;cursor:pointer;font-size:13px;">Approve for Customer Report</button>' +
            '<button type="button" id="vcRpPreviewBtn" style="' +
            "padding:10px 18px;background:#334155;color:#e2e8f0;border:1px solid #475569;border-radius:6px;" +
            'cursor:pointer;font-size:13px;">Preview Report</button>' +
            "</div>" +
            '<div id="vcRpStatus" style="font-size:12px;color:#64748b;margin-top:8px;" aria-live="polite"></div>' +
            '<div id="vcRpPreviewArea" style="display:none;margin-top:12px;"></div>';

        card.innerHTML = html;
        wireReviewPackageEvents(card);
    }

    function wireReviewPackageEvents(card) {
        if (!card) return;

        card.querySelectorAll(".vc-rp-toggle-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var idx = parseInt(btn.getAttribute("data-idx"), 10);
                if (isNaN(idx) || !reviewPkgState.findings[idx]) return;
                reviewPkgState.findings[idx].visible = !reviewPkgState.findings[idx].visible;
                renderReviewPackageCard();
            });
        });

        card.querySelectorAll(".vc-rp-internal-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var idx = parseInt(btn.getAttribute("data-idx"), 10);
                if (isNaN(idx) || !reviewPkgState.findings[idx]) return;
                reviewPkgState.findings[idx].internalOnly = !reviewPkgState.findings[idx].internalOnly;
                renderReviewPackageCard();
            });
        });

        card.querySelectorAll(".vc-rp-edit").forEach(function (ta) {
            ta.addEventListener("blur", function () {
                var idx = parseInt(ta.getAttribute("data-idx"), 10);
                var field = ta.getAttribute("data-field");
                if (isNaN(idx) || !reviewPkgState.findings[idx] || !field) return;
                var original = reviewPkgState.findings[idx][field] || "";
                var edited = ta.value || "";
                if (original !== edited) {
                    reviewPkgState.findings[idx][field] = edited;
                    reviewPkgState.editLog.push({
                        field: field,
                        findingId: reviewPkgState.findings[idx].id,
                        original: original,
                        edited: edited,
                    });
                }
            });
        });

        var approveBtn = document.getElementById("vcRpApproveBtn");
        if (approveBtn) {
            approveBtn.addEventListener("click", function () {
                void approveReviewPackage();
            });
        }
        var previewBtn = document.getElementById("vcRpPreviewBtn");
        if (previewBtn) {
            previewBtn.addEventListener("click", function () {
                previewCustomerReport();
            });
        }
    }

    function buildCustomerReportText() {
        var lines = [];
        lines.push("SERVICE REPORT");
        lines.push("");
        var visibleFindings = reviewPkgState.findings.filter(function (f) {
            return f.visible && !f.internalOnly;
        });

        if (!visibleFindings.length) {
            lines.push("Service was performed. No reportable findings at this time.");
            return lines.join("\n");
        }

        for (var i = 0; i < visibleFindings.length; i++) {
            var f = visibleFindings[i];
            lines.push(f.equipment);
            if (f.diagnosis) lines.push("  Diagnosis: " + f.diagnosis);
            if (f.measurements) lines.push("  Measurements: " + f.measurements);
            if (f.actionsTaken) lines.push("  Actions taken: " + f.actionsTaken);
            lines.push("");
        }

        return lines.join("\n").trim();
    }

    function previewCustomerReport() {
        var area = document.getElementById("vcRpPreviewArea");
        if (!area) return;
        var text = buildCustomerReportText();
        area.style.display = "block";
        area.innerHTML =
            '<label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px;">Customer Report Preview</label>' +
            '<pre style="background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:6px;' +
            'padding:12px;font-size:12px;white-space:pre-wrap;max-height:260px;overflow-y:auto;">' +
            escapeHtml(text) + "</pre>";
    }

    function getDispatcherName() {
        try {
            if (typeof window.VCAuth !== "undefined" && VCAuth.currentProfile) {
                var p = VCAuth.currentProfile();
                if (p && p.name) return String(p.name);
                if (p && p.email) return String(p.email);
            }
        } catch (e) {}
        return "dispatcher";
    }

    async function saveReviewEdits() {
        if (!reviewPkgState.reportDocId || !reviewPkgState.editLog.length) return;
        if (typeof firebase === "undefined" || !firebase.firestore) return;
        var db = firebase.firestore();

        var crCol = (typeof VCFirestore !== "undefined" && VCFirestore.completedReports)
            ? VCFirestore.completedReports(db)
            : db.collection("completed_reports");

        var editsCol = crCol.doc(reviewPkgState.reportDocId).collection("review_edits");
        var editorName = getDispatcherName();
        var now = new Date().toISOString();

        var batch = db.batch();
        for (var i = 0; i < reviewPkgState.editLog.length; i++) {
            var entry = reviewPkgState.editLog[i];
            var ref = editsCol.doc();
            batch.set(ref, {
                original: entry.original,
                edited: entry.edited,
                field: entry.field,
                editedBy: editorName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                findingId: entry.findingId || "",
                localTimestamp: now,
            });
        }
        await batch.commit();
        reviewPkgState.editLog = [];
    }

    async function approveReviewPackage() {
        var btn = document.getElementById("vcRpApproveBtn");
        var statusEl = document.getElementById("vcRpStatus");
        if (!reviewPkgState.ticketId) {
            if (statusEl) statusEl.textContent = "No ticket loaded.";
            return;
        }

        var reportText = buildCustomerReportText();
        if (!reportText.trim()) {
            if (statusEl) statusEl.textContent = "Nothing to approve — all findings removed.";
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = "Approving…"; }
        if (statusEl) statusEl.textContent = "Saving…";

        try {
            await saveReviewEdits();

            if (typeof VCFirestore !== "undefined" && VCFirestore.setServiceCallMerged) {
                var db = firebase.firestore();
                await VCFirestore.setServiceCallMerged(db, reviewPkgState.ticketId, {
                    clientPortalMemo: reportText,
                    reviewPackageApproved: true,
                    reviewPackageApprovedAt: new Date().toISOString(),
                    reviewPackageApprovedBy: getDispatcherName(),
                }, true);
            }

            var memoEl = document.getElementById("scClientPortalMemo");
            if (memoEl) memoEl.value = reportText;

            var dbLocal = [];
            try { dbLocal = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]"); } catch (e) {}
            var ix = dbLocal.findIndex(function (r) { return r && r.id === reviewPkgState.ticketId; });
            if (ix >= 0) {
                dbLocal[ix].clientPortalMemo = reportText;
                dbLocal[ix].reviewPackageApproved = true;
                try { localStorage.setItem("twinPillarsServiceDB", JSON.stringify(dbLocal)); } catch (e) {}
            }

            reviewPkgState.approvedReportText = reportText;
            if (statusEl) {
                statusEl.style.color = "#16a34a";
                statusEl.textContent = "✓ Customer report approved and saved to portal memo.";
            }
            if (typeof global.showSaveCue === "function") {
                global.showSaveCue("✓ Review package approved — customer report saved.");
            }
        } catch (err) {
            console.error("[ReviewPackage] approve error:", err);
            if (statusEl) {
                statusEl.style.color = "#dc2626";
                statusEl.textContent = "Error: " + (err && err.message ? err.message : String(err));
            }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "Approve for Customer Report"; }
        }
    }

    global.VcAiReportReviewer = {
        openModal: openModal,
        closeModal: closeModal,
        generate: generate,
        approveAndSave: approveAndSave,
        loadReviewPackage: loadReviewPackage,
        approveReviewPackage: approveReviewPackage,
        init: init,
    };

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", init);
    }
})(typeof window !== "undefined" ? window : globalThis);
