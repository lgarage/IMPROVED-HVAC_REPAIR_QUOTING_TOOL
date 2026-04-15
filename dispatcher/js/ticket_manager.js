/**
 * Dispatcher portal — labor math, duration parsing, and tech multi-select UI (shared with service_call.js).
 */
(function (global) {
    "use strict";

    var DURATION_CHOICES = ["0.5", "1.0", "1.5", "2.0", "3.0", "4.0", "6.0", "8.0", "Multi-Day"];

    /** Minimum characters in reported issue before "Release to Field app" is allowed. */
    var MIN_ISSUE_CHARS_FOR_RELEASE = 10;

    var docCloseBound = false;
    var releaseGuardWired = false;

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

    /**
     * @param {{ days?: number, includeWeekends?: boolean }} multiDayOpts
     *        For duration "Multi-Day": total = techCount × 8 × days (includeWeekends stored on ticket; scheduling use later).
     */
    function computeTotalBillableHours(techCount, durationStr, multiDayOpts) {
        var t = Math.max(0, parseInt(techCount, 10) || 0);
        var s = String(durationStr == null ? "" : durationStr).trim();
        if (s === "Multi-Day" || /^multi[\s-]?day$/i.test(s)) {
            var days = 2;
            if (multiDayOpts && multiDayOpts.days != null) {
                var d = parseInt(multiDayOpts.days, 10);
                if (isFinite(d) && d >= 1) {
                    days = d;
                }
            }
            return Math.round(t * 8.0 * days * 100) / 100;
        }
        var h = parseScheduledDurationHours(durationStr);
        return Math.round(t * h * 100) / 100;
    }

    function isStandardDurationValue(v) {
        return DURATION_CHOICES.indexOf(String(v == null ? "" : v).trim()) !== -1;
    }

    function formatTechSummary(names) {
        if (!names || !names.length) {
            return "Select technicians";
        }
        if (names.length === 1) {
            return names[0];
        }
        return names[0] + " + " + (names.length - 1) + " more";
    }

    function orderedSelectedNames(container) {
        var out = [];
        if (!container) {
            return out;
        }
        container.querySelectorAll(".sc-tech-cb").forEach(function (cb) {
            if (cb.checked) {
                out.push(cb.value);
            }
        });
        return out;
    }

    function getSelectedTechsFromContainer(container) {
        return orderedSelectedNames(container);
    }

    function setSelectedTechsInContainer(container, names) {
        if (!container) {
            return;
        }
        var set = {};
        (names || []).forEach(function (n) {
            set[n] = true;
        });
        container.querySelectorAll(".sc-tech-cb").forEach(function (cb) {
            cb.checked = !!set[cb.value];
        });
        updateTechDropdownSummary(container);
    }

    function updateTechDropdownSummary(container) {
        var trigger = container.querySelector(".sc-tech-dropdown__trigger");
        if (!trigger) {
            return;
        }
        var names = getSelectedTechsFromContainer(container);
        trigger.textContent = formatTechSummary(names);
        trigger.setAttribute(
            "aria-label",
            names.length ? "Technicians: " + names.join(", ") : "Select technicians"
        );
    }

    function closeAllTechDropdownsExcept(exceptWrap) {
        if (typeof document === "undefined") {
            return;
        }
        document.querySelectorAll(".sc-tech-dropdown.sc-tech-dropdown--open").forEach(function (dd) {
            if (dd !== exceptWrap) {
                dd.classList.remove("sc-tech-dropdown--open");
                var p = dd.querySelector(".sc-tech-dropdown__panel");
                var t = dd.querySelector(".sc-tech-dropdown__trigger");
                if (p) {
                    p.hidden = true;
                }
                if (t) {
                    t.setAttribute("aria-expanded", "false");
                }
            }
        });
    }

    function syncLeadSelectFromCrew(leadSelectId, crewNames, leadLabelOpts) {
        leadLabelOpts = leadLabelOpts || {};
        if (!leadSelectId) {
            return;
        }
        var leadSel = document.getElementById(leadSelectId);
        if (!leadSel) {
            return;
        }
        var prev = leadSel.value;
        var jobYmd = leadLabelOpts.jobDateYmd ? String(leadLabelOpts.jobDateYmd).trim() : "";
        var isAvailFn = leadLabelOpts.isTechAvailableForJobDate;
        leadSel.innerHTML = '<option value="">— Lead —</option>';
        (crewNames || []).forEach(function (t) {
            var o = document.createElement("option");
            o.value = t;
            var off =
                jobYmd &&
                typeof isAvailFn === "function" &&
                !isAvailFn(t);
            o.textContent = off ? t + " (Off)" : t;
            leadSel.appendChild(o);
        });
        if (prev && crewNames.indexOf(prev) !== -1) {
            leadSel.value = prev;
        } else if (crewNames.length === 1) {
            leadSel.value = crewNames[0];
        }
    }

    function appendTechOptionRow(panel, tech, initial, showOffBadge) {
        var label = document.createElement("label");
        label.className = "sc-tech-dropdown__option";
        if (showOffBadge) {
            label.classList.add("sc-tech-dropdown__option--off");
        }
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "sc-tech-cb";
        cb.value = tech;
        if (initial.indexOf(tech) !== -1) {
            cb.checked = true;
        }
        var span = document.createElement("span");
        span.textContent = showOffBadge ? tech + " (Off)" : tech;
        label.appendChild(cb);
        label.appendChild(span);
        panel.appendChild(label);
    }

    /**
     * Renders a div-based multi-select: checkboxes in a dropdown, summary on the trigger.
     * Optional: partition by job-day availability (see Settings → service days).
     * @param {HTMLElement} container
     * @param {string[]} techList
     * @param {{ initialSelected?: string[], leadSelectId?: string|null, jobDateYmd?: string, isTechAvailableForJobDate?: function(string): boolean }} options
     */
    function mountTechMultiSelect(container, techList, options) {
        options = options || {};
        var initial = options.initialSelected || [];
        var leadSelectId = options.leadSelectId != null ? options.leadSelectId : null;
        var jobDateYmd = options.jobDateYmd ? String(options.jobDateYmd).trim() : "";
        var isAvailFn = options.isTechAvailableForJobDate;
        var leadLabelOpts =
            jobDateYmd && typeof isAvailFn === "function"
                ? { jobDateYmd: jobDateYmd, isTechAvailableForJobDate: isAvailFn }
                : {};

        container.innerHTML = "";
        var wrap = document.createElement("div");
        wrap.className = "sc-tech-dropdown";

        var trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "sc-tech-dropdown__trigger sc-twin-pillar-select";
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-haspopup", "listbox");

        var panel = document.createElement("div");
        panel.className = "sc-tech-dropdown__panel";
        panel.hidden = true;
        panel.setAttribute("role", "listbox");

        var usePartition = typeof isAvailFn === "function" && jobDateYmd.length > 0;
        var avail = [];
        var unavail = [];
        if (usePartition) {
            (techList || []).forEach(function (tech) {
                if (isAvailFn(tech)) {
                    avail.push(tech);
                } else {
                    unavail.push(tech);
                }
            });
        } else {
            avail = (techList || []).slice();
        }

        avail.forEach(function (tech) {
            appendTechOptionRow(panel, tech, initial, false);
        });
        if (unavail.length) {
            var hdr = document.createElement("div");
            hdr.className = "sc-tech-dropdown__section-label";
            hdr.textContent = "Unavailable Today";
            panel.appendChild(hdr);
            unavail.forEach(function (tech) {
                appendTechOptionRow(panel, tech, initial, true);
            });
        }

        wrap.appendChild(trigger);
        wrap.appendChild(panel);
        container.appendChild(wrap);

        updateTechDropdownSummary(container);
        syncLeadSelectFromCrew(leadSelectId, getSelectedTechsFromContainer(container), leadLabelOpts);

        trigger.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var open = !wrap.classList.contains("sc-tech-dropdown--open");
            if (open) {
                wrap.classList.add("sc-tech-dropdown--open");
                panel.hidden = false;
                trigger.setAttribute("aria-expanded", "true");
                closeAllTechDropdownsExcept(wrap);
            } else {
                wrap.classList.remove("sc-tech-dropdown--open");
                panel.hidden = true;
                trigger.setAttribute("aria-expanded", "false");
            }
        });

        panel.addEventListener("click", function (e) {
            e.stopPropagation();
        });

        panel.addEventListener("change", function (e) {
            if (!e.target || !e.target.classList || !e.target.classList.contains("sc-tech-cb")) {
                return;
            }
            var cb = e.target;
            if (
                cb.checked &&
                usePartition &&
                typeof isAvailFn === "function" &&
                !isAvailFn(cb.value)
            ) {
                var dayWord = "that day";
                if (global && typeof global.formatWeekdayNameFromYmd === "function") {
                    dayWord = global.formatWeekdayNameFromYmd(jobDateYmd);
                }
                var msg =
                    "Note: This tech is not scheduled for service on " +
                    dayWord +
                    ". Proceed?";
                if (!global.confirm(msg)) {
                    cb.checked = false;
                    return;
                }
                if (global && typeof global.showSaveCue === "function") {
                    global.showSaveCue("Assigned outside usual weekly availability.");
                }
            }
            updateTechDropdownSummary(container);
            syncLeadSelectFromCrew(leadSelectId, getSelectedTechsFromContainer(container), leadLabelOpts);
        });

        if (typeof document !== "undefined" && !docCloseBound) {
            docCloseBound = true;
            document.addEventListener("click", function () {
                closeAllTechDropdownsExcept(null);
            });
            document.addEventListener("keydown", function (ev) {
                if (ev.key === "Escape") {
                    closeAllTechDropdownsExcept(null);
                }
            });
        }

        return {
            getSelected: function () {
                return getSelectedTechsFromContainer(container);
            },
            setSelected: function (names) {
                setSelectedTechsInContainer(container, names);
                syncLeadSelectFromCrew(leadSelectId, getSelectedTechsFromContainer(container), leadLabelOpts);
            },
        };
    }

    /**
     * Release to Field app: requires ≥1 technician and a reported issue of at least MIN_ISSUE_CHARS_FOR_RELEASE.
     * @returns {{ ok: true } | { ok: false, code: 'no_tech' | 'no_issue' | 'issue_too_short' }}
     */
    function checkDispatchReadiness() {
        var techBox = document.getElementById("scAssignedTechsContainer");
        var techs = techBox ? getSelectedTechsFromContainer(techBox) : [];
        if (!techs.length) {
            return { ok: false, code: "no_tech" };
        }
        var issueEl = document.getElementById("scIssueInput");
        var issue = issueEl ? String(issueEl.value || "").trim() : "";
        if (!issue.length) {
            return { ok: false, code: "no_issue" };
        }
        if (issue.length < MIN_ISSUE_CHARS_FOR_RELEASE) {
            return { ok: false, code: "issue_too_short" };
        }
        return { ok: true };
    }

    function pulseElementGuardClass(el, className, ms) {
        if (!el) return;
        el.classList.add(className);
        setTimeout(function () {
            el.classList.remove(className);
        }, ms || 2000);
    }

    function pulseAiSuggestButton() {
        var btn = document.getElementById("scIssueImproveAiBtn");
        pulseElementGuardClass(btn, "sc-ai-suggest-pulse", 2600);
    }

    function showReleaseGuardCue(message) {
        if (global && typeof global.showSaveCue === "function") {
            global.showSaveCue(message);
        }
    }

    /**
     * Soft guardrail: uncheck Release if dispatch is incomplete; highlight gaps + optional AI nudge.
     */
    function wireReleaseToFieldGuardOnce() {
        if (typeof document === "undefined" || releaseGuardWired) return;
        var cb = document.getElementById("scReleasedToTech");
        if (!cb) return;
        releaseGuardWired = true;
        cb.addEventListener("change", function (e) {
            if (!e.target || e.target.id !== "scReleasedToTech") return;
            if (!e.target.checked) return;
            var result = checkDispatchReadiness();
            if (result.ok) return;
            e.target.checked = false;
            if (result.code === "no_tech") {
                var techBox = document.getElementById("scAssignedTechsContainer");
                pulseElementGuardClass(techBox, "sc-field-guard-pulse", 2000);
                showReleaseGuardCue(
                    "Select at least one technician before releasing to the Field app."
                );
            } else if (result.code === "no_issue") {
                var issueTa = document.getElementById("scIssueInput");
                pulseElementGuardClass(issueTa, "sc-field-guard-pulse", 2000);
                showReleaseGuardCue("Add a reported issue / scope of work before releasing.");
            } else if (result.code === "issue_too_short") {
                var shortTa = document.getElementById("scIssueInput");
                pulseElementGuardClass(shortTa, "sc-field-guard-pulse", 2000);
                pulseAiSuggestButton();
                showReleaseGuardCue(
                    "Add a bit more detail to the issue (or use ✨ Clean up & structure with AI) before releasing."
                );
            }
        });
    }

    global.DispatcherTicketManager = {
        DURATION_CHOICES: DURATION_CHOICES,
        parseScheduledDurationHours: parseScheduledDurationHours,
        computeTotalBillableHours: computeTotalBillableHours,
        isStandardDurationValue: isStandardDurationValue,
        formatTechSummary: formatTechSummary,
        getSelectedTechsFromContainer: getSelectedTechsFromContainer,
        setSelectedTechsInContainer: setSelectedTechsInContainer,
        updateTechDropdownSummary: updateTechDropdownSummary,
        mountTechMultiSelect: mountTechMultiSelect,
        syncLeadSelectFromCrew: syncLeadSelectFromCrew,
        MIN_ISSUE_CHARS_FOR_RELEASE: MIN_ISSUE_CHARS_FOR_RELEASE,
        checkDispatchReadiness: checkDispatchReadiness,
        wireReleaseToFieldGuardOnce: wireReleaseToFieldGuardOnce,
    };
})(typeof window !== "undefined" ? window : this);
