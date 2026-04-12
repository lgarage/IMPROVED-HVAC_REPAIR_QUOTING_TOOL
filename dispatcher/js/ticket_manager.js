/**
 * Dispatcher portal — labor math, duration parsing, and tech multi-select UI (shared with service_call.js).
 */
(function (global) {
    "use strict";

    var DURATION_CHOICES = ["0.5", "1.0", "1.5", "2.0", "3.0", "4.0", "6.0", "8.0", "Multi-Day"];

    var docCloseBound = false;

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

    function syncLeadSelectFromCrew(leadSelectId, crewNames) {
        if (!leadSelectId) {
            return;
        }
        var leadSel = document.getElementById(leadSelectId);
        if (!leadSel) {
            return;
        }
        var prev = leadSel.value;
        leadSel.innerHTML = '<option value="">— Lead —</option>';
        (crewNames || []).forEach(function (t) {
            var o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            leadSel.appendChild(o);
        });
        if (prev && crewNames.indexOf(prev) !== -1) {
            leadSel.value = prev;
        } else if (crewNames.length === 1) {
            leadSel.value = crewNames[0];
        }
    }

    /**
     * Renders a div-based multi-select: checkboxes in a dropdown, summary on the trigger.
     * @param {HTMLElement} container
     * @param {string[]} techList
     * @param {{ initialSelected?: string[], leadSelectId?: string|null }} options
     */
    function mountTechMultiSelect(container, techList, options) {
        options = options || {};
        var initial = options.initialSelected || [];
        var leadSelectId = options.leadSelectId != null ? options.leadSelectId : null;

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

        (techList || []).forEach(function (tech) {
            var label = document.createElement("label");
            label.className = "sc-tech-dropdown__option";
            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = "sc-tech-cb";
            cb.value = tech;
            if (initial.indexOf(tech) !== -1) {
                cb.checked = true;
            }
            var span = document.createElement("span");
            span.textContent = tech;
            label.appendChild(cb);
            label.appendChild(span);
            panel.appendChild(label);
        });

        wrap.appendChild(trigger);
        wrap.appendChild(panel);
        container.appendChild(wrap);

        updateTechDropdownSummary(container);
        syncLeadSelectFromCrew(leadSelectId, getSelectedTechsFromContainer(container));

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
            if (e.target && e.target.classList.contains("sc-tech-cb")) {
                updateTechDropdownSummary(container);
                syncLeadSelectFromCrew(leadSelectId, getSelectedTechsFromContainer(container));
            }
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
                syncLeadSelectFromCrew(leadSelectId, getSelectedTechsFromContainer(container));
            },
        };
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
    };
})(typeof window !== "undefined" ? window : this);
