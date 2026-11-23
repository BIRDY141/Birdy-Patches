// SponsorBlock: skips sponsored parts, self-promotion, "subscribe" reminders and other segments
// marked by the SponsorBlock community (https://sponsor.ajay.app, data under CC BY-NC-SA 4.0).
// Supports three modes per category: automatically skip, prompt to skip (with OK on TV remote), or off.
// The video ID comes from the page address (#/watch?v=ID); the segments are fetched through the
// app (youtv.request) and the <video> element is moved past each segment.
(function () {
    if (!window.youtv || !youtv.request) return;

    var CATEGORIES = [
        { key: "sponsor", titleKey: "sponsor.sponsor.title", promptTitleKey: "sponsor.sponsor.prompt.title", labelKey: "sponsor.sponsor.label", default: true },
        { key: "selfpromo", titleKey: "sponsor.selfpromo.title", promptTitleKey: "sponsor.selfpromo.prompt.title", labelKey: "sponsor.selfpromo.label", default: true },
        { key: "interaction", titleKey: "sponsor.interaction.title", promptTitleKey: "sponsor.interaction.prompt.title", labelKey: "sponsor.interaction.label", default: true },
        { key: "intro", titleKey: "sponsor.intro.title", promptTitleKey: "sponsor.intro.prompt.title", labelKey: "sponsor.intro.label", default: false },
        { key: "outro", titleKey: "sponsor.outro.title", promptTitleKey: "sponsor.outro.prompt.title", labelKey: "sponsor.outro.label", default: false },
        { key: "preview", titleKey: "sponsor.preview.title", promptTitleKey: "sponsor.preview.prompt.title", labelKey: "sponsor.preview.label", default: false },
        { key: "music_offtopic", titleKey: "sponsor.music_offtopic.title", promptTitleKey: "sponsor.music_offtopic.prompt.title", labelKey: "sponsor.music_offtopic.label", default: false },
        { key: "filler", titleKey: "sponsor.filler.title", promptTitleKey: "sponsor.filler.prompt.title", labelKey: "sponsor.filler.label", default: false }
    ];

    var featureSettings = [
        { key: "prompt_all", titleKey: "sponsor.prompt_all.title", summaryKey: "sponsor.prompt_all.summary", default: false }
    ];
    CATEGORIES.forEach(function (c) {
        featureSettings.push({ key: c.key, titleKey: c.titleKey, default: c.default });
        featureSettings.push({ key: c.key + "_prompt", titleKey: c.promptTitleKey, default: false });
    });

    var feature = youtv.feature({
        id: "sponsorblock",
        nameKey: "feature.sponsorblock.name",
        summaryKey: "feature.sponsorblock.summary",
        defaultEnabled: true,
        settings: featureSettings
    });
    if (!feature) return;

    var videoId = null;
    var segments = [];      // { start, end, category, label, skipped, prompted }

    function currentVideoId() {
        var match = /[?&]v=([A-Za-z0-9_-]{11})/.exec(location.hash || "");
        return match ? match[1] : null;
    }

    function getCategoryMode(key) {
        if (!feature.enabled()) return "off";
        var isEnabled = feature.settings.get(key);
        var isPrompt = feature.settings.get(key + "_prompt");
        var globalPrompt = feature.settings.get("prompt_all");
        if (isPrompt || (isEnabled && globalPrompt)) return "prompt";
        if (isEnabled) return "skip";
        return "off";
    }

    function enabledCategories() {
        return CATEGORIES.filter(function (c) {
            return getCategoryMode(c.key) !== "off";
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
            CATEGORIES.forEach(function (c) { labels[c.key] = c.labelKey; });
            segments = list.filter(function (s) {
                return s && Array.isArray(s.segment) && (s.actionType || "skip") === "skip" && s.segment[1] > s.segment[0];
            }).map(function (s) {
                return {
                    start: s.segment[0],
                    end: s.segment[1],
                    category: s.category,
                    label: labels[s.category] || s.category,
                    skipped: false,
                    prompted: false
                };
            });
            youtv.report("sponsorblock: " + segments.length + " segment(s) for " + id);
        });
    }

    // ---- notices and prompts ------------------------------------------------------------------
    var sheet = new CSSStyleSheet();
    try {
        sheet.replaceSync(
            ".birdy-skip-notice, .farotv-skip-notice { position: fixed; left: 4.5rem; bottom: 4rem; z-index: 2147483647;" +
            " padding: 0.9rem 1.6rem; border-radius: 1.5rem; background: rgba(18, 7, 10, 0.95);" +
            " color: #f1f1f1; font: 500 1.4rem Roboto, Arial, sans-serif; opacity: 0;" +
            " transition: opacity 250ms; pointer-events: none; border: 1.5px solid rgba(255, 32, 40, 0.4); }" +
            ".birdy-skip-notice.show, .farotv-skip-notice.show { opacity: 1; }" +
            ".birdy-skip-notice b, .farotv-skip-notice b { color: #FF3741; font-weight: 600; }" +
            ".birdy-skip-prompt, .farotv-skip-prompt { position: fixed; right: 4.5rem; bottom: 4rem; z-index: 2147483647;" +
            " display: flex; align-items: center; gap: 1rem; padding: 0.8rem 1.6rem; border-radius: 1.5rem;" +
            " background: rgba(20, 8, 11, 0.96); border: 2px solid #FF2028; box-shadow: 0 4px 20px rgba(0,0,0,0.8);" +
            " color: #f1f1f1; font: 500 1.4rem Roboto, Arial, sans-serif; opacity: 0; transform: translateY(1rem);" +
            " transition: opacity 250ms, transform 250ms; pointer-events: none; }" +
            ".birdy-skip-prompt.show, .farotv-skip-prompt.show { opacity: 1; transform: translateY(0); }" +
            "[dir='rtl'] .birdy-skip-prompt, [dir='rtl'] .farotv-skip-prompt { right: auto; left: 4.5rem; }" +
            ".birdy-skip-prompt b, .farotv-skip-prompt b { color: #FF3741; font-weight: 600; }" +
            ".birdy-skip-prompt .farotv-key-badge, .birdy-skip-prompt .birdy-key-badge { background: #FF2028; color: #FFFFFF; font-weight: 700;" +
            " font-size: 1.2rem; padding: 0.2rem 0.7rem; border-radius: 0.5rem; margin-right: 0.3rem; }" +
            ".birdy-skip-prompt .farotv-countdown, .birdy-skip-prompt .birdy-countdown { color: #aaaaaa; font-size: 1.2rem; margin-left: 0.3rem; }");
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {}

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
        notice.appendChild(document.createTextNode(youtv.t("sponsor.skipped")));
        var b = document.createElement("b");
        b.textContent = youtv.t(label);
        notice.appendChild(b);
        notice.className = "birdy-skip-notice farotv-skip-notice show";
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(function () { notice.className = "birdy-skip-notice farotv-skip-notice"; }, 2500);
    }

    var prompt = null;
    var promptTimer = null;
    var promptInterval = null;
    var activePromptSegment = null;
    var remainingSeconds = 0;

    function isPromptShowing() {
        return prompt && prompt.className.indexOf("show") !== -1;
    }

    function hidePrompt() {
        if (!prompt) return;
        prompt.className = "birdy-skip-prompt farotv-skip-prompt";
        activePromptSegment = null;
        clearInterval(promptInterval);
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

        var badge = document.createElement("span");
        badge.className = "birdy-key-badge farotv-key-badge";
        badge.textContent = "OK";
        prompt.appendChild(badge);

        prompt.appendChild(document.createTextNode(youtv.t("sponsor.prompt.action")));

        var b = document.createElement("b");
        b.textContent = youtv.t(activePromptSegment.label);
        prompt.appendChild(b);

        var countdownSpan = document.createElement("span");
        countdownSpan.className = "birdy-countdown farotv-countdown";
        countdownSpan.textContent = " (" + remainingSeconds + "s)";
        prompt.appendChild(countdownSpan);
    }

    function showPrompt(s) {
        if (!document.body) return;
        if (!prompt) {
            prompt = document.createElement("div");
            prompt.className = "birdy-skip-prompt farotv-skip-prompt";
        }
        if (!prompt.parentNode) document.body.appendChild(prompt);

        activePromptSegment = s;
        prompt.dir = window.farotvI18n.direction();

        var video = document.querySelector("video");
        var timeLeftInSegment = video ? Math.floor(s.end - video.currentTime) : 5;
        remainingSeconds = Math.max(2, Math.min(6, timeLeftInSegment));
        if (remainingSeconds <= 0) remainingSeconds = 5;

        updatePromptView();
        prompt.className = "birdy-skip-prompt farotv-skip-prompt show";

        window.removeEventListener("keydown", onPromptKeyDown, true);
        window.addEventListener("keydown", onPromptKeyDown, true);

        clearInterval(promptInterval);
        clearTimeout(promptTimer);

        promptInterval = setInterval(function () {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                hidePrompt();
            } else {
                updatePromptView();
            }
        }, 1000);

        promptTimer = setTimeout(function () {
            hidePrompt();
        }, remainingSeconds * 1000);
    }

    // ---- skipping -----------------------------------------------------------------------------
    setInterval(function () {
        var id = feature.enabled() ? currentVideoId() : null;
        if (id !== videoId) {
            videoId = id;
            segments = [];
            hidePrompt();
            if (id) load(id);
        }
        if (!segments.length) return;
        var video = document.querySelector("video");
        if (!video || video.paused || !isFinite(video.duration)) {
            if (isPromptShowing()) hidePrompt();
            return;
        }
        var t = video.currentTime;

        // If a prompt is active and playback has moved outside the segment range, dismiss it
        if (activePromptSegment && (t < activePromptSegment.start || t >= activePromptSegment.end)) {
            hidePrompt();
        }

        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            if (t >= s.start && t < s.end - 0.5) {
                var mode = getCategoryMode(s.category);
                if (mode === "off") continue;

                if (mode === "skip") {
                    // Once per segment: if the user goes back into it, let it play.
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
