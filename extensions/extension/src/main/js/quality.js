// Quality & Playback Tweaks: forces playback resolution, default caption language,
// expanded auto-translate languages, original titles, and original audio (no auto-dub)
// independently for regular videos and YouTube Shorts.
(function () {
    if (!window.youtv) return;

    var STORAGE_PREFIX = "yt.leanback.default::";
    var VIDEO_QUALITY_KEY = "YOUTV_QUALITY_VIDEO";
    var SHORTS_QUALITY_KEY = "YOUTV_QUALITY_SHORTS";
    var VIDEO_CAPTION_KEY = "YOUTV_VIDEO_CAPTION_LANG";
    var SHORTS_CAPTION_KEY = "YOUTV_SHORTS_CAPTION_LANG";
    var VIDEO_MORE_TRANS_KEY = "YOUTV_VIDEO_MORE_AUTO_TRANSLATE";
    var SHORTS_MORE_TRANS_KEY = "YOUTV_SHORTS_MORE_AUTO_TRANSLATE";
    var VIDEO_ORIG_TITLE_KEY = "YOUTV_VIDEO_ORIGINAL_TITLE";
    var SHORTS_ORIG_TITLE_KEY = "YOUTV_SHORTS_ORIGINAL_TITLE";
    var VIDEO_ORIG_AUDIO_KEY = "YOUTV_VIDEO_ORIGINAL_AUDIO";
    var SHORTS_ORIG_AUDIO_KEY = "YOUTV_SHORTS_ORIGINAL_AUDIO";
    var VIDEO_SPEED_KEY = "YOUTV_VIDEO_SPEED";
    var SHORTS_SPEED_KEY = "YOUTV_SHORTS_SPEED";
    var VIDEO_CUSTOM_SPEED_KEY = "YOUTV_VIDEO_CUSTOM_SPEED";
    var SHORTS_CUSTOM_SPEED_KEY = "YOUTV_SHORTS_CUSTOM_SPEED";
    var VIDEO_PIP_KEY = "YOUTV_VIDEO_PIP";

    var SPEED_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4];

    var QUALITY_ORDER = ["highres", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];

    var TRANSLATION_LANGUAGES = [
        { code: "en", name: "English" },
        { code: "ar", name: "Arabic" },
        { code: "es", name: "Spanish" },
        { code: "fr", name: "French" },
        { code: "de", name: "German" },
        { code: "it", name: "Italian" },
        { code: "pt", name: "Portuguese" },
        { code: "ru", name: "Russian" },
        { code: "ja", name: "Japanese" },
        { code: "ko", name: "Korean" },
        { code: "zh-Hans", name: "Chinese (Simplified)" },
        { code: "zh-Hant", name: "Chinese (Traditional)" },
        { code: "hi", name: "Hindi" },
        { code: "tr", name: "Turkish" },
        { code: "nl", name: "Dutch" },
        { code: "pl", name: "Polish" },
        { code: "sv", name: "Swedish" },
        { code: "id", name: "Indonesian" },
        { code: "vi", name: "Vietnamese" },
        { code: "th", name: "Thai" },
        { code: "uk", name: "Ukrainian" },
        { code: "he", name: "Hebrew" },
        { code: "fa", name: "Persian" },
        { code: "ur", name: "Urdu" },
        { code: "bn", name: "Bengali" }
    ];

    var shortsVideoIds = new Set();
    var MAX_SHORTS_IDS = 200;

    function rememberShortId(id) {
        if (!id || typeof id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
        if (!shortsVideoIds.has(id) && shortsVideoIds.size >= MAX_SHORTS_IDS) {
            shortsVideoIds.delete(shortsVideoIds.values().next().value);
        }
        shortsVideoIds.add(id);
    }

    function collectShortsIds(node, depth) {
        if (!node || typeof node !== "object" || depth > 18) return;
        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) collectShortsIds(node[i], depth + 1);
            return;
        }
        if (node.reelWatchEndpoint && typeof node.reelWatchEndpoint.videoId === "string") {
            rememberShortId(node.reelWatchEndpoint.videoId);
        }
        if (node.videoDetails && node.videoDetails.isShortsEligible && typeof node.videoDetails.videoId === "string") {
            rememberShortId(node.videoDetails.videoId);
        }
        for (var k in node) {
            if (Object.prototype.hasOwnProperty.call(node, k)) {
                var v = node[k];
                if (v && typeof v === "object") collectShortsIds(v, depth + 1);
            }
        }
    }

    function getStringSetting(key, def) {
        try {
            var raw = localStorage.getItem(STORAGE_PREFIX + key);
            if (!raw) return def;
            var parsed = youtv.rawParse(raw);
            if (typeof parsed === "string") return parsed;
            if (parsed && typeof parsed.data === "string") return parsed.data;
        } catch (e) {}
        return def;
    }

    function getBoolSetting(key, def) {
        try {
            var raw = localStorage.getItem(STORAGE_PREFIX + key);
            if (raw !== null) {
                var parsed = youtv.rawParse(raw);
                if (parsed && typeof parsed.data === "boolean") return parsed.data;
            }
        } catch (e) {}
        return !!def;
    }

    // ---- Original Audio (anti auto-dub) in InnerTube /player ----------------------------------
    function isOriginalAudioTrackObj(at) {
        if (!at || typeof at !== "object") return false;
        if (typeof at.id === "string" && /\.4$/.test(at.id)) return true;
        if (typeof at.displayName === "string" && /original|الأصل|orig/i.test(at.displayName)) return true;
        return false;
    }

    function applyOriginalAudioToResponse(response) {
        var sd = response && response.streamingData;
        if (!sd || !Array.isArray(sd.adaptiveFormats)) return;
        var origIds = {};
        var hasOrig = false;
        for (var i = 0; i < sd.adaptiveFormats.length; i++) {
            var fmt = sd.adaptiveFormats[i];
            if (fmt && fmt.audioTrack && isOriginalAudioTrackObj(fmt.audioTrack)) {
                if (fmt.audioTrack.id) origIds[fmt.audioTrack.id] = true;
                hasOrig = true;
            }
        }
        if (!hasOrig) return;

        var filtered = [];
        for (var j = 0; j < sd.adaptiveFormats.length; j++) {
            var f = sd.adaptiveFormats[j];
            if (f && f.audioTrack) {
                if (origIds[f.audioTrack.id] || isOriginalAudioTrackObj(f.audioTrack)) {
                    f.audioTrack.audioIsDefault = true;
                    filtered.push(f);
                }
                // Drop auto-dubbed tracks when original audio track is present
            } else {
                filtered.push(f);
            }
        }
        if (filtered.length > 0) {
            sd.adaptiveFormats = filtered;
            youtv.report("quality: forced original audio track in player response");
        }
    }

    // ---- Captions & Auto-Translate in InnerTube /player ---------------------------------------
    function langMatches(trackLang, targetLang) {
        if (!trackLang || !targetLang) return false;
        var a = trackLang.toLowerCase();
        var b = targetLang.toLowerCase();
        return a === b || a.indexOf(b + "-") === 0 || b.indexOf(a + "-") === 0;
    }

    function findLangName(code) {
        for (var i = 0; i < TRANSLATION_LANGUAGES.length; i++) {
            if (TRANSLATION_LANGUAGES[i].code === code) return TRANSLATION_LANGUAGES[i].name;
        }
        return code;
    }

    function applyCaptionsToResponse(response, captionLang, moreAutoTranslate) {
        var cap = response && response.captions && response.captions.playerCaptionsTracklistRenderer;
        if (!cap || !Array.isArray(cap.captionTracks) || !cap.captionTracks.length) return;

        if (moreAutoTranslate) {
            for (var i = 0; i < cap.captionTracks.length; i++) {
                if (cap.captionTracks[i]) cap.captionTracks[i].isTranslatable = true;
            }
            var existing = Array.isArray(cap.translationLanguages) ? cap.translationLanguages : [];
            var seen = {};
            for (var e = 0; e < existing.length; e++) {
                if (existing[e] && existing[e].languageCode) seen[existing[e].languageCode] = true;
            }
            for (var l = 0; l < TRANSLATION_LANGUAGES.length; l++) {
                var tl = TRANSLATION_LANGUAGES[l];
                if (!seen[tl.code]) {
                    existing.push({
                        languageCode: tl.code,
                        languageName: { runs: [{ text: tl.name }] }
                    });
                    seen[tl.code] = true;
                }
            }
            cap.translationLanguages = existing;
        }

        if (!captionLang || captionLang === "auto") return;

        var chosenIdx = -1;
        if (captionLang === "video") {
            // Prefer non-ASR track, else first track
            for (var v = 0; v < cap.captionTracks.length; v++) {
                if (cap.captionTracks[v] && cap.captionTracks[v].kind !== "asr") {
                    chosenIdx = v;
                    break;
                }
            }
            if (chosenIdx === -1) chosenIdx = 0;
        } else {
            // Exact native track (prefer non-ASR)
            for (var n = 0; n < cap.captionTracks.length; n++) {
                var tr = cap.captionTracks[n];
                if (tr && langMatches(tr.languageCode, captionLang)) {
                    if (chosenIdx === -1 || tr.kind !== "asr") chosenIdx = n;
                    if (tr.kind !== "asr") break;
                }
            }
            // If no native track exists, synthesize an auto-translated track via &tlang=
            if (chosenIdx === -1) {
                var base = cap.captionTracks[0];
                if (base && base.baseUrl) {
                    var sep = base.baseUrl.indexOf("?") !== -1 ? "&" : "?";
                    var transTrack = {
                        baseUrl: base.baseUrl + sep + "tlang=" + encodeURIComponent(captionLang),
                        name: { runs: [{ text: findLangName(captionLang) + " (Auto)" }] },
                        vssId: "." + captionLang + ".tlang",
                        languageCode: captionLang,
                        isTranslatable: false
                    };
                    cap.captionTracks.push(transTrack);
                    chosenIdx = cap.captionTracks.length - 1;
                }
            }
        }

        if (chosenIdx >= 0 && Array.isArray(cap.audioTracks)) {
            for (var a = 0; a < cap.audioTracks.length; a++) {
                var at = cap.audioTracks[a];
                if (at) {
                    if (Array.isArray(at.captionTrackIndices) && at.captionTrackIndices.indexOf(chosenIdx) === -1) {
                        at.captionTrackIndices.push(chosenIdx);
                    }
                    at.defaultCaptionTrackIndex = chosenIdx;
                    at.captionsInitialState = "CAPTIONS_INITIAL_STATE_ON_REQUIRED";
                    at.visibility = "ON";
                }
            }
            youtv.report("captions: response forced lang=" + captionLang + " idx=" + chosenIdx);
        }
    }

    // ---- Original Video Titles (via same-origin /oembed) --------------------------------------
    var oembedCache = new Map();
    var oembedInFlight = new Map();
    var oembedQueue = [];
    var oembedActive = 0;
    var MAX_OEMBED_CACHE = 200;
    var MAX_OEMBED_CONCURRENT = 4;

    function pumpOembed() {
        while (oembedActive < MAX_OEMBED_CONCURRENT && oembedQueue.length > 0) {
            var vid = oembedQueue.shift();
            startOembedFetch(vid);
        }
    }

    function startOembedFetch(vid) {
        oembedActive++;
        var url = "https://www.youtube.com/oembed?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + vid) + "&format=json";
        if (typeof fetch !== "function") {
            oembedActive = Math.max(0, oembedActive - 1);
            oembedInFlight.delete(vid);
            return;
        }
        fetch(url, { credentials: "omit" })
            .then(function (res) { return res && res.ok ? res.json() : null; })
            .then(function (data) {
                var title = data && typeof data.title === "string" ? data.title : null;
                if (title) {
                    if (!oembedCache.has(vid) && oembedCache.size >= MAX_OEMBED_CACHE) {
                        oembedCache.delete(oembedCache.keys().next().value);
                    }
                    oembedCache.set(vid, title);
                }
                finishOembed(vid, title);
            })
            .catch(function () { finishOembed(vid, null); });
    }

    function finishOembed(vid, title) {
        oembedActive = Math.max(0, oembedActive - 1);
        var cbs = oembedInFlight.get(vid) || [];
        oembedInFlight.delete(vid);
        for (var i = 0; i < cbs.length; i++) {
            try { cbs[i](title); } catch (e) {}
        }
        pumpOembed();
    }

    function fetchOriginalTitle(vid, cb) {
        if (oembedCache.has(vid)) {
            cb(oembedCache.get(vid));
            return;
        }
        if (oembedInFlight.has(vid)) {
            oembedInFlight.get(vid).push(cb);
            return;
        }
        oembedInFlight.set(vid, [cb]);
        oembedQueue.push(vid);
        pumpOembed();
    }

    function setTitleObj(titleObj, newText) {
        if (!titleObj || typeof titleObj !== "object" || !newText) return;
        if (typeof titleObj.simpleText === "string") titleObj.simpleText = newText;
        if (Array.isArray(titleObj.runs) && titleObj.runs.length > 0) {
            titleObj.runs[0].text = newText;
            if (titleObj.runs.length > 1) titleObj.runs.length = 1;
        }
    }

    function collectTitleTargets(node, depth, inShortsContext, out) {
        if (!node || typeof node !== "object" || depth > 22) return out;
        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) collectTitleTargets(node[i], depth + 1, inShortsContext, out);
            return out;
        }

        var nextShorts = inShortsContext ||
            !!(node.shelfRenderer && node.shelfRenderer.tvhtml5ShelfRendererType === "TVHTML5_SHELF_RENDERER_TYPE_SHORTS") ||
            !!node.reelWatchEndpoint ||
            !!node.reelPlayerOverlayRenderer ||
            !!node.shortsLockupViewModel;

        if (node.tileRenderer && typeof node.tileRenderer.contentId === "string" && /^[A-Za-z0-9_-]{11}$/.test(node.tileRenderer.contentId)) {
            var meta = node.tileRenderer.metadata && node.tileRenderer.metadata.tileMetadataRenderer;
            var isShortTile = nextShorts || !!(node.tileRenderer.onSelectCommand && node.tileRenderer.onSelectCommand.reelWatchEndpoint);
            if (meta && meta.title) {
                out.push({ videoId: node.tileRenderer.contentId, titleObj: meta.title, isShort: isShortTile });
            }
        }

        var keys = ["gridVideoRenderer", "videoRenderer", "compactVideoRenderer", "playlistVideoRenderer"];
        for (var k = 0; k < keys.length; k++) {
            var vr = node[keys[k]];
            if (vr && typeof vr.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(vr.videoId) && vr.title) {
                out.push({ videoId: vr.videoId, titleObj: vr.title, isShort: nextShorts });
            }
        }

        if (node.videoDetails && typeof node.videoDetails.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(node.videoDetails.videoId)) {
            out.push({
                videoId: node.videoDetails.videoId,
                videoDetails: node.videoDetails,
                isShort: nextShorts || !!node.videoDetails.isShortsEligible
            });
        }

        for (var prop in node) {
            if (Object.prototype.hasOwnProperty.call(node, prop)) {
                var val = node[prop];
                if (val && typeof val === "object") collectTitleTargets(val, depth + 1, nextShorts, out);
            }
        }
        return out;
    }

    var inOnApiResponse = false;

    function onApiResponse(response, settings, text) {
        if (inOnApiResponse) return;
        inOnApiResponse = true;
        try {
            if (youtv.mentions(text, ["reelWatchEndpoint", "isShortsEligible", "reelPlayerOverlayRenderer"])) {
                collectShortsIds(response, 0);
            }

            var isShortResp = !!(
                (response.videoDetails && response.videoDetails.isShortsEligible) ||
                (response.videoDetails && shortsVideoIds.has(response.videoDetails.videoId)) ||
                (response.microformat && response.microformat.playerMicroformatRenderer &&
                    typeof response.microformat.playerMicroformatRenderer.canonicalUrl === "string" &&
                    response.microformat.playerMicroformatRenderer.canonicalUrl.indexOf("/shorts/") !== -1)
            );

            // 1. Original Audio in /player
            var origAudio = getBoolSetting(isShortResp ? SHORTS_ORIG_AUDIO_KEY : VIDEO_ORIG_AUDIO_KEY, false);
            if (origAudio && response.streamingData) {
                applyOriginalAudioToResponse(response);
            }

            // 1b. Unlock playback speed in playerConfig if restricted
            if (response.playerConfig) {
                if (!response.playerConfig.playbackSpeedConfig) {
                    response.playerConfig.playbackSpeedConfig = {};
                }
                response.playerConfig.playbackSpeedConfig.enabled = true;
                response.playerConfig.playbackSpeedConfig.availableRates = SPEED_RATES.slice();
            }

            // 2. Captions & More Auto-Translate in /player
            var captionLang = getStringSetting(isShortResp ? SHORTS_CAPTION_KEY : VIDEO_CAPTION_KEY, "auto");
            var moreTrans = getBoolSetting(isShortResp ? SHORTS_MORE_TRANS_KEY : VIDEO_MORE_TRANS_KEY, false);
            if ((captionLang !== "auto" || moreTrans) && response.captions) {
                applyCaptionsToResponse(response, captionLang, moreTrans);
            }

            // 3. Original Titles
            var wantVideoOrigTitle = getBoolSetting(VIDEO_ORIG_TITLE_KEY, false);
            var wantShortsOrigTitle = getBoolSetting(SHORTS_ORIG_TITLE_KEY, false);
            if ((wantVideoOrigTitle || wantShortsOrigTitle) &&
                youtv.mentions(text, ["tileRenderer", "gridVideoRenderer", "videoRenderer", "compactVideoRenderer", "videoDetails"])) {
                var targets = collectTitleTargets(response, 0, false, []);
                for (var i = 0; i < targets.length; i++) {
                    (function (target) {
                        var shouldRestore = target.isShort ? wantShortsOrigTitle : wantVideoOrigTitle;
                        if (!shouldRestore) return;
                        fetchOriginalTitle(target.videoId, function (origTitle) {
                            if (!origTitle) return;
                            if (target.titleObj) setTitleObj(target.titleObj, origTitle);
                            if (target.videoDetails && typeof target.videoDetails.title === "string") {
                                target.videoDetails.title = origTitle;
                            }
                        });
                    })(targets[i]);
                }
            }
        } finally {
            inOnApiResponse = false;
        }
    }

    var feature = youtv.feature({
        id: "quality",
        nameKey: "hub.tab.video",
        summaryKey: "video.quality.summary",
        defaultEnabled: true,
        onResponse: onApiResponse
    });
    if (!feature) return;

    // ---- Player Runtime Enforcement (Quality, Captions, Audio) --------------------------------
    function findPlayer() {
        var byId = document.getElementById("movie_player");
        if (byId && (typeof byId.setPlaybackQualityRange === "function" || typeof byId.setPlaybackQuality === "function")) {
            return byId;
        }
        var byClass = document.querySelector(".html5-video-player");
        if (byClass && (typeof byClass.setPlaybackQualityRange === "function" || typeof byClass.setPlaybackQuality === "function")) {
            return byClass;
        }
        var video = document.querySelector("video");
        var node = video;
        while (node && node !== document.documentElement) {
            if (typeof node.setPlaybackQualityRange === "function" || typeof node.setPlaybackQuality === "function") {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    function getVideoId(player) {
        try {
            if (player && typeof player.getVideoData === "function") {
                var data = player.getVideoData();
                if (data && data.video_id) return data.video_id;
            }
        } catch (e) {}
        var match = /[?&#]v=([A-Za-z0-9_-]{11})/.exec(location.hash || location.search || "");
        return match ? match[1] : null;
    }

    function isCurrentShort(player) {
        var href = (location.href || "") + " " + (location.hash || "");
        if (/\/shorts\/|reelWatchEndpoint|isShorts/i.test(href)) return true;
        if (document.querySelector("ytlr-shorts-page, ytlr-reel-player-overlay-renderer, ytlr-reel-video-renderer, ytlr-shorts-player")) {
            return true;
        }
        try {
            if (player && typeof player.getPlayerResponse === "function") {
                var pr = player.getPlayerResponse();
                if (pr && pr.videoDetails && pr.videoDetails.isShortsEligible) return true;
            }
        } catch (e) {}
        var vid = getVideoId(player);
        return !!(vid && shortsVideoIds.has(vid));
    }

    function pickBestQuality(desired, available) {
        if (!desired || desired === "auto") return null;
        if (!Array.isArray(available) || !available.length) return desired;
        var levels = available.filter(function (q) { return q && q !== "auto"; });
        if (!levels.length) return desired;
        if (levels.indexOf(desired) !== -1) return desired;

        var desiredIdx = QUALITY_ORDER.indexOf(desired);
        if (desiredIdx === -1) return levels[0];
        for (var i = desiredIdx; i < QUALITY_ORDER.length; i++) {
            if (levels.indexOf(QUALITY_ORDER[i]) !== -1) return QUALITY_ORDER[i];
        }
        for (var j = QUALITY_ORDER.length - 1; j >= 0; j--) {
            if (levels.indexOf(QUALITY_ORDER[j]) !== -1) return QUALITY_ORDER[j];
        }
        return levels[0];
    }

    var lastAppliedVid = null;
    var lastAppliedTarget = null;
    var lastCaptionVid = null;
    var lastCaptionLang = null;
    var lastAudioVid = null;

    function enforceQuality(player, isShort, vid, forceNow) {
        var desired = getStringSetting(isShort ? SHORTS_QUALITY_KEY : VIDEO_QUALITY_KEY, "auto");
        if (!desired || desired === "auto") {
            if (lastAppliedTarget !== null || forceNow) {
                try {
                    if (typeof player.setPlaybackQualityRange === "function") {
                        player.setPlaybackQualityRange("tiny", "highres");
                    }
                    if (typeof player.setPlaybackQuality === "function") {
                        player.setPlaybackQuality("auto");
                    }
                    localStorage.removeItem("yt-player-quality");
                } catch (e) {}
                lastAppliedTarget = null;
                lastAppliedVid = vid;
            }
            return;
        }

        var avail = typeof player.getAvailableQualityLevels === "function"
            ? player.getAvailableQualityLevels()
            : [];
        var target = pickBestQuality(desired, avail);
        if (!target) return;

        var current = typeof player.getPlaybackQuality === "function"
            ? player.getPlaybackQuality()
            : null;

        if (!forceNow && current === target && lastAppliedVid === vid && lastAppliedTarget === target) {
            return;
        }

        try {
            if (typeof player.setPlaybackQualityRange === "function") {
                player.setPlaybackQualityRange(target, target);
            }
            if (typeof player.setPlaybackQuality === "function") {
                player.setPlaybackQuality(target);
            }
            localStorage.setItem("yt-player-quality", JSON.stringify({
                data: JSON.stringify({ quality: target, previousQuality: target }),
                expiration: Date.now() + 30 * 24 * 60 * 60 * 1000,
                creation: Date.now()
            }));
            if (lastAppliedVid !== vid || lastAppliedTarget !== target) {
                youtv.report("quality: locked " + (isShort ? "shorts" : "video") + " to " + target);
            }
            lastAppliedVid = vid;
            lastAppliedTarget = target;
        } catch (e) {}
    }

    function enforceCaptions(player, isShort, vid, forceNow) {
        var desiredLang = getStringSetting(isShort ? SHORTS_CAPTION_KEY : VIDEO_CAPTION_KEY, "auto");
        if (!desiredLang || desiredLang === "auto") {
            lastCaptionLang = "auto";
            return;
        }
        if (!forceNow && lastCaptionVid === vid && lastCaptionLang === desiredLang) return;

        try {
            if (typeof player.loadModule === "function") player.loadModule("captions");
            var tracklist = (typeof player.getOption === "function") ? player.getOption("captions", "tracklist") : null;
            if (!Array.isArray(tracklist) || !tracklist.length) {
                var pr = (typeof player.getPlayerResponse === "function") ? player.getPlayerResponse() : null;
                var cap = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer;
                if (cap && Array.isArray(cap.captionTracks)) tracklist = cap.captionTracks;
            }
            if (!Array.isArray(tracklist) || !tracklist.length) return;

            var chosen = null;
            if (desiredLang === "video") {
                for (var i = 0; i < tracklist.length; i++) {
                    if (tracklist[i] && tracklist[i].kind !== "asr") {
                        chosen = tracklist[i];
                        break;
                    }
                }
                if (!chosen) chosen = tracklist[0];
            } else {
                for (var j = 0; j < tracklist.length; j++) {
                    var tr = tracklist[j];
                    if (tr && langMatches(tr.languageCode, desiredLang)) {
                        if (!chosen || tr.kind !== "asr") chosen = tr;
                        if (tr.kind !== "asr") break;
                    }
                }
                if (!chosen) {
                    var base = tracklist[0];
                    chosen = {
                        languageCode: base.languageCode,
                        vssId: base.vssId,
                        translationLanguage: {
                            languageCode: desiredLang,
                            languageName: findLangName(desiredLang)
                        }
                    };
                }
            }

            if (chosen) {
                if (typeof player.toggleSubtitlesOn === "function") {
                    try { player.toggleSubtitlesOn(); } catch (e) {}
                }
                if (typeof player.setOption === "function") {
                    player.setOption("captions", "track", {
                        languageCode: chosen.languageCode,
                        vssId: chosen.vssId,
                        translationLanguage: chosen.translationLanguage
                    });
                }
                lastCaptionVid = vid;
                lastCaptionLang = desiredLang;
                youtv.report("captions: set " + (isShort ? "shorts" : "video") + " to " + desiredLang);
            }
        } catch (e) {}
    }

    function enforceOriginalAudio(player, isShort, vid, forceNow) {
        var wantOrig = getBoolSetting(isShort ? SHORTS_ORIG_AUDIO_KEY : VIDEO_ORIG_AUDIO_KEY, false);
        if (!wantOrig) return;
        if (!forceNow && lastAudioVid === vid) return;

        try {
            if (typeof player.getAvailableAudioTracks !== "function" || typeof player.setAudioTrack !== "function") return;
            var tracks = player.getAvailableAudioTracks();
            if (!Array.isArray(tracks) || tracks.length <= 1) return;

            var orig = null;
            for (var i = 0; i < tracks.length; i++) {
                var t = tracks[i];
                var id = (t && t.id) || "";
                var name = (t && (t.name || t.displayName)) || "";
                if (/\.4$/.test(id) || /original|الأصل|orig/i.test(name)) {
                    orig = t;
                    break;
                }
            }
            if (orig) {
                var cur = typeof player.getAudioTrack === "function" ? player.getAudioTrack() : null;
                if (!cur || cur.id !== orig.id) {
                    player.setAudioTrack(orig);
                    youtv.report("audio: forced original track");
                }
                lastAudioVid = vid;
            }
        } catch (e) {}
    }

    function unlockSpeedOnEnvironment(player) {
        try {
            if (window.ytcfg && typeof window.ytcfg.get === "function") {
                var flags = window.ytcfg.get("EXPERIMENT_FLAGS");
                if (flags && typeof flags === "object") {
                    flags.html5_disable_playback_rate_on_tv = false;
                    flags.web_player_disable_playback_speed = false;
                    flags.tv_enable_playback_rate = true;
                    flags.enable_playback_rate_on_tv = true;
                    flags.enable_playback_speed_for_tv = true;
                    flags.cobalt_enable_playback_rate = true;
                }
            }
        } catch (e) {}
        if (player && !player._birdySpeedPatched) {
            player._birdySpeedPatched = true;
            try {
                player.getAvailablePlaybackRates = function () {
                    return SPEED_RATES.slice();
                };
            } catch (e) {}
        }
    }
    unlockSpeedOnEnvironment(null);

    if (typeof setInterval === "function") {
        setInterval(function () {
            unlockSpeedOnEnvironment(findPlayer());
        }, 250);
    }

    var lastSpeedVid = null;
    var lastSpeedRate = 1;

    function enforceSpeed(player, isShort, vid, forceNow) {
        unlockSpeedOnEnvironment(player);
        var raw = getStringSetting(isShort ? SHORTS_SPEED_KEY : VIDEO_SPEED_KEY, "1");
        var rate = parseFloat(raw);
        if (!isFinite(rate) || rate <= 0) rate = 1;

        var video = typeof document !== "undefined" ? document.querySelector("video") : null;
        if (rate === 1 && !forceNow && lastSpeedRate === 1) return;

        try {
            if (player && typeof player.setPlaybackRate === "function") {
                var curPlayerRate = typeof player.getPlaybackRate === "function" ? player.getPlaybackRate() : 1;
                if (forceNow || Math.abs(curPlayerRate - rate) > 0.01) {
                    player.setPlaybackRate(rate);
                }
            }
            if (video && (forceNow || Math.abs(video.playbackRate - rate) > 0.01)) {
                video.defaultPlaybackRate = rate;
                video.playbackRate = rate;
            }
            if (lastSpeedVid !== vid || Math.abs(lastSpeedRate - rate) > 0.01) {
                if (rate !== 1) youtv.report("speed: set " + (isShort ? "shorts" : "video") + " to " + rate + "x");
                lastSpeedVid = vid;
                lastSpeedRate = rate;
            }
        } catch (e) {}
    }

    function applyAllTweaks(forceNow) {
        if (typeof document === "undefined") return;
        var player = findPlayer();
        unlockSpeedOnEnvironment(player);
        if (!player) return;
        var isShort = isCurrentShort(player);
        var vid = getVideoId(player);
        enforceQuality(player, isShort, vid, forceNow);
        enforceSpeed(player, isShort, vid, forceNow);
        enforceCaptions(player, isShort, vid, forceNow);
        enforceOriginalAudio(player, isShort, vid, forceNow);
    }

    function bindVideoListeners() {
        if (typeof document === "undefined") return;
        var video = document.querySelector("video");
        if (video && !video._birdyQualityBound) {
            video._birdyQualityBound = true;
            var onEvt = function () { applyAllTweaks(false); };
            video.addEventListener("loadedmetadata", onEvt);
            video.addEventListener("playing", onEvt);
            video.addEventListener("durationchange", onEvt);
            video.addEventListener("ratechange", onEvt);
        }
        var player = findPlayer();
        if (player && !player._birdyQualityBound && typeof player.addEventListener === "function") {
            player._birdyQualityBound = true;
            try {
                player.addEventListener("onStateChange", function (state) {
                    if (state === 1 || state === 3) applyAllTweaks(false);
                });
            } catch (e) {}
        }
    }

    window.birdyApplyQuality = function () {
        applyAllTweaks(true);
    };

    if (typeof setInterval === "function") {
        setInterval(function () {
            bindVideoListeners();
            applyAllTweaks(false);
        }, 1200);
    }

    // ---- Custom Speed Picker inside YouTube's native "Video speed" container ------------------
    try {
        if (typeof CSSStyleSheet !== "undefined" && document && document.adoptedStyleSheets) {
            var speedSheet = new CSSStyleSheet();
            speedSheet.replaceSync(
                ".birdy-speed-list { display: flex; flex-direction: column; gap: 6px; padding: 8px 4px; max-height: 58vh; overflow-y: auto; }" +
                ".birdy-speed-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 20px;" +
                " border-radius: 12px; font-size: 1.25rem; font-weight: 500; background: transparent; color: #f1f1f1;" +
                " border: 1px solid transparent; cursor: pointer; text-align: left; box-sizing: border-box; }" +
                ".birdy-speed-item.selected { color: #3ea6ff; font-weight: 600; }" +
                ".birdy-speed-item.birdy-focus { background: #f1f1f1; color: #0f0f0f; font-weight: 700; }"
            );
            document.adoptedStyleSheets = document.adoptedStyleSheets.concat([speedSheet]);
        }
    } catch (e) {}

    var activeSpeedMenu = null;

    function closeNativeSpeedPopup(container) {
        try {
            var esc = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
            document.dispatchEvent(esc);
            if (container && container.parentElement) {
                var back = new KeyboardEvent("keydown", { key: "GoBack", keyCode: 4, which: 4, bubbles: true });
                container.dispatchEvent(back);
            }
        } catch (e) {}
        activeSpeedMenu = null;
    }

    function updateNativeSpeedFocus() {
        if (!activeSpeedMenu) return;
        var items = activeSpeedMenu.items;
        for (var i = 0; i < items.length; i++) {
            var isFoc = i === activeSpeedMenu.focusIdx;
            items[i].classList.toggle("birdy-focus", isFoc);
            if (isFoc && typeof items[i].scrollIntoView === "function") {
                try { items[i].scrollIntoView({ block: "nearest" }); } catch (e) {}
            }
        }
    }

    function enhanceNativeSpeedContainer() {
        if (typeof document === "undefined" || !document.querySelectorAll) return;
        var player = findPlayer();
        var isShort = isCurrentShort(player);
        if (!getBoolSetting(isShort ? SHORTS_CUSTOM_SPEED_KEY : VIDEO_CUSTOM_SPEED_KEY, true)) return;

        var popups = document.querySelectorAll("ytlr-popup-container, ytlr-menu-renderer, ytlr-multi-page-menu-renderer, [role='dialog']");
        for (var i = 0; i < popups.length; i++) {
            var popup = popups[i];
            if (!popup || popup.offsetParent === null) continue;
            if (popup.getAttribute("data-birdy-speed-menu") === "1") continue;

            var text = (popup.textContent || "").trim();
            if (!/^(Video speed|Playback speed|Velocidad|سرعة التشغيل)/i.test(text)) continue;
            if (text.length > 160) continue; // Only replace the compact speed list, not unrelated full menus

            var normalEl = null;
            var allEls = popup.querySelectorAll("*");
            for (var j = 0; j < allEls.length; j++) {
                var t = (allEls[j].textContent || "").trim();
                if (t === "Normal" && allEls[j].children.length <= 2) {
                    normalEl = allEls[j];
                    break;
                }
            }
            if (!normalEl) continue;

            var listHost = normalEl.parentElement;
            while (listHost && listHost !== popup && listHost.children.length < 1) {
                listHost = listHost.parentElement;
            }
            if (!listHost) continue;

            popup.setAttribute("data-birdy-speed-menu", "1");
            var speedKey = isShort ? SHORTS_SPEED_KEY : VIDEO_SPEED_KEY;
            var currentRate = parseFloat(getStringSetting(speedKey, "1")) || 1;

            listHost.textContent = "";
            var wrap = document.createElement("div");
            wrap.className = "birdy-speed-list";

            var itemEls = [];
            var initIdx = 3; // 1x default
            for (var r = 0; r < SPEED_RATES.length; r++) {
                (function (rate, idx) {
                    var isSel = Math.abs(rate - currentRate) < 0.01;
                    if (isSel) initIdx = idx;
                    var btn = document.createElement("button");
                    btn.className = "birdy-speed-item" + (isSel ? " selected" : "");
                    var lbl = document.createElement("span");
                    lbl.textContent = rate === 1 ? "Normal (1x)" : (rate + "x");
                    var chk = document.createElement("span");
                    chk.textContent = isSel ? "\u2713" : "";
                    btn.appendChild(lbl);
                    btn.appendChild(chk);
                    btn.onclick = function (ev) {
                        ev.stopPropagation();
                        try {
                            localStorage.setItem(STORAGE_PREFIX + speedKey, JSON.stringify(String(rate)));
                        } catch (e) {}
                        applyAllTweaks(true);
                        closeNativeSpeedPopup(popup);
                    };
                    wrap.appendChild(btn);
                    itemEls.push(btn);
                })(SPEED_RATES[r], r);
            }

            listHost.appendChild(wrap);
            activeSpeedMenu = { popup: popup, items: itemEls, focusIdx: initIdx };
            updateNativeSpeedFocus();
            break;
        }

        if (activeSpeedMenu && (!document.body.contains(activeSpeedMenu.popup) || activeSpeedMenu.popup.offsetParent === null)) {
            activeSpeedMenu = null;
        }
    }

    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
        document.addEventListener("keydown", function (e) {
            if (!activeSpeedMenu) return;
            if (!document.body.contains(activeSpeedMenu.popup) || activeSpeedMenu.popup.offsetParent === null) {
                activeSpeedMenu = null;
                return;
            }
            var code = e.keyCode || e.which;
            if (code === 38) { // UP
                e.preventDefault(); e.stopPropagation();
                if (activeSpeedMenu.focusIdx > 0) {
                    activeSpeedMenu.focusIdx--;
                    updateNativeSpeedFocus();
                }
            } else if (code === 40) { // DOWN
                e.preventDefault(); e.stopPropagation();
                if (activeSpeedMenu.focusIdx < activeSpeedMenu.items.length - 1) {
                    activeSpeedMenu.focusIdx++;
                    updateNativeSpeedFocus();
                }
            } else if (code === 13 || code === 23) { // OK
                e.preventDefault(); e.stopPropagation();
                var btn = activeSpeedMenu.items[activeSpeedMenu.focusIdx];
                if (btn) btn.click();
            } else if (code === 27 || code === 4 || code === 10009 || code === 37) {
                activeSpeedMenu = null;
            }
        }, true);
    }

    if (typeof setInterval === "function") {
        setInterval(enhanceNativeSpeedContainer, 250);
    }
})();
