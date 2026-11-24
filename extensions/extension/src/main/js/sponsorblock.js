// SponsorBlock: skips sponsored parts, self-promotion, "subscribe" reminders and other segments
// marked by the SponsorBlock community (https://sponsor.ajay.app, data under CC BY-NC-SA 4.0).
// Supports three modes per category: automatically skip, prompt to skip (with OK on TV remote), or off.
// Also supports custom seekbar segment colors for each category.
(function () {
    if (!window.youtv || !youtv.request) return;

    var CATEGORIES = [
        { key: "sponsor", titleKey: "sponsor.sponsor.title", promptTitleKey: "sponsor.sponsor.prompt.title", labelKey: "sponsor.sponsor.label", actionKey: "sponsor.sponsor.action", default: true },
        { key: "selfpromo", titleKey: "sponsor.selfpromo.title", promptTitleKey: "sponsor.selfpromo.prompt.title", labelKey: "sponsor.selfpromo.label", actionKey: "sponsor.selfpromo.action", default: true },
        { key: "interaction", titleKey: "sponsor.interaction.title", promptTitleKey: "sponsor.interaction.prompt.title", labelKey: "sponsor.interaction.label", actionKey: "sponsor.interaction.action", default: true },
        { key: "intro", titleKey: "sponsor.intro.title", promptTitleKey: "sponsor.intro.prompt.title", labelKey: "sponsor.intro.label", actionKey: "sponsor.intro.action", default: false },
        { key: "outro", titleKey: "sponsor.outro.title", promptTitleKey: "sponsor.outro.prompt.title", labelKey: "sponsor.outro.label", actionKey: "sponsor.outro.action", default: false },
        { key: "preview", titleKey: "sponsor.preview.title", promptTitleKey: "sponsor.preview.prompt.title", labelKey: "sponsor.preview.label", actionKey: "sponsor.preview.action", default: false },
        { key: "music_offtopic", titleKey: "sponsor.music_offtopic.title", promptTitleKey: "sponsor.music_offtopic.prompt.title", labelKey: "sponsor.music_offtopic.label", actionKey: "sponsor.music_offtopic.action", default: false },
        { key: "filler", titleKey: "sponsor.filler.title", promptTitleKey: "sponsor.filler.prompt.title", labelKey: "sponsor.filler.label", actionKey: "sponsor.filler.action", default: false }
    ];

    var CATEGORY_COLORS = {
        sponsor: "#00D400",       // Green
        selfpromo: "#FFD600",     // Yellow
        interaction: "#CC00FF",   // Magenta
        intro: "#00E5FF",         // Cyan
        outro: "#304FFE",         // Blue
        preview: "#00B0FF",       // Light Blue
        music_offtopic: "#FF6D00",// Orange
        filler: "#9C27B0"         // Purple
    };

    // 1. Feature: SponsorBlock skipping (1 setting per category in list, 3 options on its page: On, Prompt to skip, Off)
    var featureSettings = [
        { key: "prompt_all", titleKey: "sponsor.prompt_all.title", summaryKey: "sponsor.prompt_all.summary", default: false }
    ];
    CATEGORIES.forEach(function (c) {
        featureSettings.push({ key: c.key, titleKey: c.titleKey, default: c.default });
    });

    var feature = youtv.feature({
        id: "sponsorblock",
        nameKey: "feature.sponsorblock.name",
        summaryKey: "feature.sponsorblock.summary",
        defaultEnabled: true,
        settings: featureSettings
    });
    if (!feature) return;

    // 2. Feature: SponsorBlock seekbar colors (Dedicated setting entry with per-category toggles)
    var seekbarSettings = [];
    CATEGORIES.forEach(function (c) {
        seekbarSettings.push({
            key: c.key + "_seekbar",
            titleKey: "sponsor." + c.key + ".seekbar.title",
            summaryKey: "sponsor." + c.key + ".seekbar.summary",
            default: c.default
        });
    });

    var seekbarFeature = youtv.feature({
        id: "sponsorblock-colors",
        nameKey: "feature.sponsorblock_colors.name",
        summaryKey: "feature.sponsorblock_colors.summary",
        defaultEnabled: true,
        settings: seekbarSettings
    });

    var videoId = null;
    var segments = [];      // { start, end, category, label, actionKey, skipped, prompted }

    function currentVideoId() {
        var match = /[?&]v=([A-Za-z0-9_-]{11})/.exec(location.hash || "");
        return match ? match[1] : null;
    }

    // 3 options per category: "skip" (automatic), "prompt" (manual overlay), "off" (disabled)
    function getCategoryMode(key) {
        if (!feature.enabled()) return "off";
        var rawMode = null;
        try {
            var raw = localStorage.getItem("yt.leanback.default::YOUTV_SPONSORBLOCK_" + key.toUpperCase() + "_MODE");
            if (raw) rawMode = JSON.parse(raw);
        } catch (e) {}
        if (rawMode === "skip" || rawMode === "prompt" || rawMode === "off") {
            return rawMode;
        }
        var isManual = feature.settings.get(key + "_prompt");
        var isAuto = feature.settings.get(key);
        var globalPrompt = feature.settings.get("prompt_all");
        if (isManual || (isAuto && globalPrompt)) return "prompt";
        if (isAuto) return "skip";
        return "off";
    }

    function setCategoryMode(key, mode) {
        var upper = key.toUpperCase();
        try {
            localStorage.setItem("yt.leanback.default::YOUTV_SPONSORBLOCK_" + upper + "_MODE", JSON.stringify(mode));
            if (mode === "skip") {
                localStorage.setItem("yt.leanback.default::YOUTV_SPONSORBLOCK_" + upper, '{"data":true}');
                localStorage.setItem("yt.leanback.default::YOUTV_SPONSORBLOCK_" + upper + "_PROMPT", '{"data":false}');
            } else if (mode === "prompt") {
                localStorage.setItem("yt.leanback.default::YOUTV_SPONSORBLOCK_" + upper, '{"data":false}');
                localStorage.setItem("yt.leanback.default::YOUTV_SPONSORBLOCK_" + upper + "_PROMPT", '{"data":true}');
            } else {
                localStorage.setItem("yt.leanback.default::YOUTV_SPONSORBLOCK_" + upper, '{"data":false}');
                localStorage.setItem("yt.leanback.default::YOUTV_SPONSORBLOCK_" + upper + "_PROMPT", '{"data":false}');
            }
        } catch (e) {}
    }

    function enabledCategories() {
        return CATEGORIES.filter(function (c) {
            var skipMode = getCategoryMode(c.key);
            var seekbarOn = seekbarFeature && seekbarFeature.enabled() && seekbarFeature.settings.get(c.key + "_seekbar");
            return skipMode !== "off" || seekbarOn;
        });
    }

    // Short-lived, bounded cache, including 404s. Never share mutable skipped flags.
    var segmentCache = new Map();
    var CACHE_TTL = 5 * 60 * 1000;
    var MAX_CACHE = 50;
    function requestSegments(url, callback) {
        var cached = segmentCache.get(url);
        if (cached && Date.now() - cached.time < CACHE_TTL) {
            callback(cached.status, cached.body);
            return;
        }
        if (cached) segmentCache.delete(url);
        youtv.request(url, function (status, body) {
            if (status === 200 || status === 404) {
                if (!segmentCache.has(url) && segmentCache.size >= MAX_CACHE) {
                    segmentCache.delete(segmentCache.keys().next().value);
                }
                segmentCache.set(url, { time: Date.now(), status: status, body: body });
            }
            callback(status, body);
        });
    }

    function load(id) {
        segments = [];
        var categories = enabledCategories();
        if (!categories.length) return;
        var url = "https://sponsor.ajay.app/api/skipSegments?videoID=" + id +
            "&categories=" + encodeURIComponent(JSON.stringify(categories.map(function (c) { return c.key; })));
        requestSegments(url, function (status, body) {
            if (id !== videoId) return;
            if (status !== 200) {
                if (status !== 404) youtv.report("sponsorblock: HTTP " + status + " for " + id);
                return;
            }
            var list;
            try { list = youtv.rawParse(body); } catch (e) { return; }
            if (!Array.isArray(list)) return;
            var labels = {};
            var actions = {};
            CATEGORIES.forEach(function (c) {
                labels[c.key] = c.labelKey;
                actions[c.key] = c.actionKey;
            });
            segments = list.filter(function (s) {
                return s && Array.isArray(s.segment) && (s.actionType || "skip") === "skip" && s.segment[1] > s.segment[0];
            }).map(function (s) {
                return {
                    start: s.segment[0],
                    end: s.segment[1],
                    category: s.category,
                    label: labels[s.category] || s.category,
                    actionKey: actions[s.category] || "sponsor.prompt.action",
                    skipped: false,
                    prompted: false
                };
            });
            youtv.report("sponsorblock: " + segments.length + " segment(s) for " + id);
            updateSeekbarMarkers();
        });
    }

    // ---- notices, prompts and seekbar styles --------------------------------------------------
    var sheet = new CSSStyleSheet();
    try {
        sheet.replaceSync(
            ".birdy-skip-notice, .farotv-skip-notice," +
            ".birdy-skip-prompt, .farotv-skip-prompt {" +
            " position: fixed; right: 4.5rem; bottom: 5.5rem; z-index: 2147483647;" +
            " display: inline-flex; align-items: center; justify-content: center;" +
            " padding: 0.7rem 1.6rem; border-radius: 9999px;" +
            " background: rgba(18, 18, 18, 0.88); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);" +
            " border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);" +
            " color: #ffffff; font: 500 1.4rem Roboto, 'YouTube Sans', Arial, sans-serif;" +
            " opacity: 0; transform: translateY(0.8rem); transition: opacity 250ms ease, transform 250ms ease;" +
            " pointer-events: none; cursor: pointer; }" +
            ".birdy-skip-notice.show, .farotv-skip-notice.show," +
            ".birdy-skip-prompt.show, .farotv-skip-prompt.show { opacity: 1; transform: translateY(0); pointer-events: auto; }" +
            "[dir='rtl'] .birdy-skip-notice, [dir='rtl'] .farotv-skip-notice," +
            "[dir='rtl'] .birdy-skip-prompt, [dir='rtl'] .farotv-skip-prompt { right: auto; left: 4.5rem; }" +
            ".birdy-skip-notice b, .farotv-skip-notice b { color: #ffffff; font-weight: 500; margin-left: 0.3rem; }" +
            ".birdy-skip-icon { width: 1.4rem; height: 1.4rem; fill: #ffffff; margin-left: 0.6rem; vertical-align: middle; flex-shrink: 0; }" +
            "[dir='rtl'] .birdy-skip-icon { margin-left: 0; margin-right: 0.6rem; transform: scaleX(-1); }" +
            ".birdy-sb-track-markers { position: absolute; left: 0; width: 100%; top: 50%; transform: translateY(-50%); height: 5px;" +
            " pointer-events: none; z-index: 5; overflow: hidden; border-radius: 2px; }" +
            ".birdy-sb-marker { position: absolute; top: 0; height: 100%; border-radius: 1px; opacity: 0.95; pointer-events: none; }" +
            "ytlr-progress-bar:focus .birdy-sb-track-markers, ytlr-progress-bar:focus-within .birdy-sb-track-markers, .ytp-progress-bar:hover .birdy-sb-track-markers { height: 8px; }" +
            ".birdy-setting-prompt-button { outline: none; cursor: pointer; }");
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {}

    function createSkipIcon() {
        if (!document) return null;
        if (typeof document.createElementNS === "function") {
            try {
                var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                if (svg && svg.setAttribute) {
                    svg.setAttribute("viewBox", "0 0 24 24");
                    svg.setAttribute("class", "birdy-skip-icon");
                }
                var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                if (path && path.setAttribute) {
                    path.setAttribute("d", "M5 4v16l12-8zm13 0v16h2V4z");
                }
                if (svg && svg.appendChild && path) svg.appendChild(path);
                return svg;
            } catch (e) {}
        }
        if (typeof document.createElement === "function") {
            try {
                var span = document.createElement("span");
                span.className = "birdy-skip-icon";
                return span;
            } catch (e) {}
        }
        return null;
    }

    // Feedback notice: identical sleek dark pill design
    var notice = null;
    var noticeTimer = null;
    function showNotice(label) {
        if (!document.body) return;
        if (!notice) {
            notice = document.createElement("div");
            notice.className = "birdy-skip-notice farotv-skip-notice";
        }
        if (!notice.parentNode) document.body.appendChild(notice);
        notice.dir = window.farotvI18n.direction();
        notice.textContent = "";

        var prefixSpan = document.createElement("span");
        prefixSpan.textContent = youtv.t("sponsor.skipped");
        notice.appendChild(prefixSpan);

        var labelSpan = document.createElement("b");
        labelSpan.textContent = youtv.t(label);
        notice.appendChild(labelSpan);

        var icon = createSkipIcon();
        if (icon && notice.appendChild) notice.appendChild(icon);

        notice.className = "birdy-skip-notice farotv-skip-notice show";
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(function () {
            notice.className = "birdy-skip-notice farotv-skip-notice";
        }, 2500);
    }

    // Manual Skip Prompt: sleek dark pill with "Skip sponsor |>" matching Picture 1 & 2
    var prompt = null;
    var promptTimer = null;
    var activePromptSegment = null;

    function isPromptShowing() {
        return prompt && prompt.className.indexOf("show") !== -1;
    }

    function hidePrompt() {
        if (!prompt) return;
        prompt.className = "birdy-skip-prompt farotv-skip-prompt";
        activePromptSegment = null;
        clearTimeout(promptTimer);
        window.removeEventListener("keydown", onPromptKeyDown, true);
    }

    function onPromptKeyDown(e) {
        if (!isPromptShowing() || !activePromptSegment) return;
        var code = e.keyCode || e.which;
        if (code === 13 || code === 23 || e.key === "Enter" || e.key === "Select") {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            var target = activePromptSegment;
            hidePrompt();
            var video = document.querySelector("video");
            if (video && isFinite(video.duration)) {
                target.skipped = true;
                video.currentTime = Math.min(target.end, video.duration - 0.1);
                showNotice(target.label);
                youtv.report("sponsorblock: prompt-skipped " + target.label + " " + target.start.toFixed(1) + "-" + target.end.toFixed(1));
            }
        }
    }

    function updatePromptView() {
        if (!prompt || !activePromptSegment) return;
        prompt.textContent = "";

        var actionText = youtv.t(activePromptSegment.actionKey);
        if (!actionText || actionText === activePromptSegment.actionKey) {
            actionText = youtv.t("sponsor.prompt.action") + youtv.t(activePromptSegment.label);
        }

        var textSpan = document.createElement("span");
        textSpan.textContent = actionText;
        prompt.appendChild(textSpan);

        var icon = createSkipIcon();
        if (icon && prompt.appendChild) prompt.appendChild(icon);
    }

    function showPrompt(s) {
        if (!document.body) return;
        if (!prompt) {
            prompt = document.createElement("div");
            prompt.className = "birdy-skip-prompt farotv-skip-prompt";
            prompt.onclick = function () {
                if (!activePromptSegment) return;
                var target = activePromptSegment;
                hidePrompt();
                var video = document.querySelector("video");
                if (video && isFinite(video.duration)) {
                    target.skipped = true;
                    video.currentTime = Math.min(target.end, video.duration - 0.1);
                    showNotice(target.label);
                }
            };
        }
        if (!prompt.parentNode) document.body.appendChild(prompt);

        activePromptSegment = s;
        prompt.dir = window.farotvI18n.direction();

        var video = document.querySelector("video");
        var timeLeft = video ? Math.floor(s.end - video.currentTime) : 6;
        var displaySeconds = Math.max(3, Math.min(8, timeLeft));

        updatePromptView();
        prompt.className = "birdy-skip-prompt farotv-skip-prompt show";

        window.removeEventListener("keydown", onPromptKeyDown, true);
        window.addEventListener("keydown", onPromptKeyDown, true);

        clearTimeout(promptTimer);
        promptTimer = setTimeout(function () {
            hidePrompt();
        }, displaySeconds * 1000);
    }

    // ---- seekbar colored markers (Picture 3) --------------------------------------------------
    function findProgressBar() {
        if (!document || typeof document.querySelector !== "function") return null;
        var el = document.querySelector("ytlr-progress-bar [idomkey='progress-bar']") ||
                 document.querySelector("ytlr-progress-bar ytlr-multi-markers-player-bar-renderer") ||
                 document.querySelector("ytlr-progress-bar") ||
                 document.querySelector("[idomkey='progress-bar']") ||
                 document.querySelector(".ytlr-progress-bar") ||
                 document.querySelector(".ytp-progress-bar");
        if (!el || el.tagName === "VIDEO" || typeof el.querySelector !== "function") return null;
        return el;
    }

    function clearSeekbarMarkers() {
        if (!document || typeof document.querySelectorAll !== "function") return;
        try {
            var existing = document.querySelectorAll(".birdy-sb-track-markers");
            for (var i = 0; i < existing.length; i++) {
                if (typeof existing[i].remove === "function") {
                    existing[i].remove();
                } else if (existing[i].parentNode) {
                    existing[i].parentNode.removeChild(existing[i]);
                }
            }
        } catch (e) {}
    }

    function updateSeekbarMarkers() {
        if (!seekbarFeature || !seekbarFeature.enabled()) {
            clearSeekbarMarkers();
            return;
        }
        var bar = findProgressBar();
        if (!bar) return;
        var video = document.querySelector ? document.querySelector("video") : null;
        if (!video || !isFinite(video.duration) || video.duration <= 0 || !segments.length) {
            clearSeekbarMarkers();
            return;
        }
        var duration = video.duration;

        var container = typeof bar.querySelector === "function" ? bar.querySelector(".birdy-sb-track-markers") : null;
        if (!container && typeof document.createElement === "function") {
            container = document.createElement("div");
            container.className = "birdy-sb-track-markers";
            if (bar.appendChild) bar.appendChild(container);
        }
        if (!container) return;
        try {
            if (window.getComputedStyle && bar.style) {
                if (window.getComputedStyle(bar).position === "static") {
                    bar.style.position = "relative";
                }
            }
        } catch (e) {}

        container.textContent = "";
        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            var isCategorySeekbar = seekbarFeature.settings.get(s.category + "_seekbar");
            if (isCategorySeekbar === false) continue;
            var color = CATEGORY_COLORS[s.category];
            if (!color) continue;

            var startPct = Math.max(0, Math.min(100, (s.start / duration) * 100));
            var endPct = Math.max(0, Math.min(100, (s.end / duration) * 100));
            var widthPct = endPct - startPct;
            if (widthPct <= 0.05) continue;

            var marker = document.createElement("div");
            marker.className = "birdy-sb-marker";
            marker.style.left = startPct.toFixed(2) + "%";
            marker.style.width = widthPct.toFixed(2) + "%";
            marker.style.backgroundColor = color;
            container.appendChild(marker);
        }
    }

    // ---- 3-choice settings page enhancer (On, Prompt to skip, Off) ----------------------------
    function updateButtonCheckmarks(pane, catKey) {
        if (!pane || typeof pane.querySelectorAll !== "function") return;
        var mode = getCategoryMode(catKey);
        var buttons = pane.querySelectorAll("[role='button'], button");
        if (buttons.length < 3) return;
        var onBtn = buttons[0];
        var promptBtn = buttons[1];
        var offBtn = buttons[2];

        function setCheck(btn, show) {
            var svg = btn.querySelector ? btn.querySelector("svg, [class*='check'], [idomkey*='check']") : null;
            if (svg) {
                svg.style.display = show ? "" : "none";
                svg.style.visibility = show ? "visible" : "hidden";
            }
            if (show) {
                btn.setAttribute("aria-checked", "true");
            } else {
                btn.setAttribute("aria-checked", "false");
            }
        }

        setCheck(onBtn, mode === "skip");
        setCheck(promptBtn, mode === "prompt");
        setCheck(offBtn, mode === "off");
    }

    function enhanceSettingsPane() {
        if (!document || !document.body || typeof document.querySelectorAll !== "function") return;
        var titles = document.querySelectorAll("h1, h2, h3, [class*='title'], [class*='heading']");
        var activeCat = null;
        var activeTitleEl = null;

        for (var i = 0; i < titles.length; i++) {
            var el = titles[i];
            var txt = (el.textContent || "").trim();
            if (!txt) continue;
            for (var c = 0; c < CATEGORIES.length; c++) {
                var cat = CATEGORIES[c];
                var expected = youtv.t(cat.titleKey);
                if (txt === expected || txt.indexOf(expected) !== -1 || expected.indexOf(txt) !== -1) {
                    var p = el.closest ? (el.closest("ytlr-setting-boolean-renderer, [class*='setting'], [class*='pane'], [class*='renderer']") || el.parentElement) : el.parentElement;
                    if (p && p.querySelectorAll) {
                        var btns = p.querySelectorAll("[role='button'], button");
                        if (btns.length >= 2) {
                            activeCat = cat;
                            activeTitleEl = el;
                            break;
                        }
                    }
                }
            }
            if (activeCat) break;
        }
        if (!activeCat || !activeTitleEl) return;

        var pane = activeTitleEl.closest ? (activeTitleEl.closest("ytlr-setting-boolean-renderer, [class*='setting'], [class*='pane'], [class*='renderer']") || activeTitleEl.parentElement) : activeTitleEl.parentElement;
        if (!pane || !pane.querySelectorAll) return;

        var buttons = pane.querySelectorAll("[role='button'], button");
        if (buttons.length < 2) return;

        var onBtn = buttons[0];
        var offBtn = buttons[buttons.length - 1];

        var promptBtn = pane.querySelector ? pane.querySelector(".birdy-setting-prompt-button") : null;
        if (!promptBtn && typeof onBtn.cloneNode === "function") {
            promptBtn = onBtn.cloneNode(true);
            promptBtn.className = (onBtn.className || "") + " birdy-setting-prompt-button";
            promptBtn.setAttribute("data-category", activeCat.key);

            // Replace text inside promptBtn with "Prompt to skip"
            if (typeof document.createTreeWalker === "function") {
                try {
                    var walk = document.createTreeWalker(promptBtn, NodeFilter.SHOW_TEXT, null, false);
                    var n;
                    while ((n = walk.nextNode())) {
                        if (n.nodeValue && n.nodeValue.trim()) {
                            n.nodeValue = youtv.t("sponsor.option.prompt");
                            break;
                        }
                    }
                } catch (e) {}
            } else {
                promptBtn.textContent = youtv.t("sponsor.option.prompt");
            }

            if (offBtn.parentNode && offBtn.parentNode.insertBefore) {
                offBtn.parentNode.insertBefore(promptBtn, offBtn);
            }

            var currentKey = activeCat.key;
            promptBtn.addEventListener("click", function (e) {
                if (e.preventDefault) e.preventDefault();
                if (e.stopPropagation) e.stopPropagation();
                setCategoryMode(currentKey, "prompt");
                updateButtonCheckmarks(pane, currentKey);
            }, true);

            promptBtn.addEventListener("keydown", function (e) {
                var code = e.keyCode || e.which;
                if (code === 13 || code === 23) {
                    if (e.preventDefault) e.preventDefault();
                    if (e.stopPropagation) e.stopPropagation();
                    setCategoryMode(currentKey, "prompt");
                    updateButtonCheckmarks(pane, currentKey);
                } else if (code === 38 && onBtn.focus) {
                    if (e.preventDefault) e.preventDefault();
                    if (e.stopPropagation) e.stopPropagation();
                    onBtn.focus();
                } else if (code === 40 && offBtn.focus) {
                    if (e.preventDefault) e.preventDefault();
                    if (e.stopPropagation) e.stopPropagation();
                    offBtn.focus();
                }
            }, true);

            onBtn.addEventListener("keydown", function (e) {
                var code = e.keyCode || e.which;
                if (code === 40 && promptBtn.focus) {
                    if (e.preventDefault) e.preventDefault();
                    if (e.stopPropagation) e.stopPropagation();
                    promptBtn.focus();
                }
            }, true);

            offBtn.addEventListener("keydown", function (e) {
                var code = e.keyCode || e.which;
                if (code === 38 && promptBtn.focus) {
                    if (e.preventDefault) e.preventDefault();
                    if (e.stopPropagation) e.stopPropagation();
                    promptBtn.focus();
                }
            }, true);

            onBtn.addEventListener("click", function () {
                setCategoryMode(currentKey, "skip");
                setTimeout(function () { updateButtonCheckmarks(pane, currentKey); }, 50);
            }, true);

            offBtn.addEventListener("click", function () {
                setCategoryMode(currentKey, "off");
                setTimeout(function () { updateButtonCheckmarks(pane, currentKey); }, 50);
            }, true);
        }

        updateButtonCheckmarks(pane, activeCat.key);
    }

    try {
        window.addEventListener("focusin", enhanceSettingsPane, true);
        window.addEventListener("keydown", function () { setTimeout(enhanceSettingsPane, 50); }, true);
    } catch (e) {}

    // ---- main playback tick -------------------------------------------------------------------
    setInterval(function () {
        enhanceSettingsPane();
        var id = (feature.enabled() || (seekbarFeature && seekbarFeature.enabled())) ? currentVideoId() : null;
        if (id !== videoId) {
            videoId = id;
            segments = [];
            hidePrompt();
            clearSeekbarMarkers();
            if (id) load(id);
        }

        updateSeekbarMarkers();

        if (!segments.length || !feature.enabled()) return;
        var video = document.querySelector("video");
        if (!video || video.paused || !isFinite(video.duration)) {
            if (isPromptShowing()) hidePrompt();
            return;
        }
        var t = video.currentTime;

        // Dismiss prompt if playback moves outside the active segment range
        if (activePromptSegment && (t < activePromptSegment.start || t >= activePromptSegment.end)) {
            hidePrompt();
        }

        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            if (t >= s.start && t < s.end - 0.5) {
                var mode = getCategoryMode(s.category);
                if (mode === "off") continue;

                if (mode === "skip") {
                    if (s.skipped) continue;
                    s.skipped = true;
                    if (activePromptSegment === s) hidePrompt();
                    video.currentTime = Math.min(s.end, video.duration - 0.1);
                    showNotice(s.label);
                    youtv.report("sponsorblock: skipped " + s.label + " " + s.start.toFixed(1) + "-" + s.end.toFixed(1));
                    return;
                }

                if (mode === "prompt") {
                    if (s.prompted || s.skipped) continue;
                    s.prompted = true;
                    showPrompt(s);
                    youtv.report("sponsorblock: prompt shown for " + s.label + " " + s.start.toFixed(1) + "-" + s.end.toFixed(1));
                    return;
                }
            }
        }
    }, 400);
})();
