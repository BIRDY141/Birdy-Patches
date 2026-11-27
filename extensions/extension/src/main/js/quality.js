// Quality: forces playback resolution for regular videos and YouTube Shorts separately.
// Uses YouTube's HTML5 player API (setPlaybackQualityRange / setPlaybackQuality) with
// best-available fallback when a video does not offer the chosen resolution.
(function () {
    if (!window.youtv) return;

    var STORAGE_PREFIX = "yt.leanback.default::";
    var VIDEO_KEY = "YOUTV_QUALITY_VIDEO";
    var SHORTS_KEY = "YOUTV_QUALITY_SHORTS";
    var QUALITY_ORDER = ["highres", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];

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

    var feature = youtv.feature({
        id: "quality",
        nameKey: "hub.tab.video",
        summaryKey: "video.quality.summary",
        defaultEnabled: true,
        onResponse: function (response, settings, text) {
            if (!youtv.mentions(text, ["reelWatchEndpoint", "isShortsEligible", "reelPlayerOverlayRenderer"])) return;
            collectShortsIds(response, 0);
        }
    });
    if (!feature) return;

    function getQualitySetting(key) {
        try {
            var raw = localStorage.getItem(STORAGE_PREFIX + key);
            if (!raw) return "auto";
            var parsed = JSON.parse(raw);
            if (typeof parsed === "string") return parsed;
            if (parsed && typeof parsed.data === "string") return parsed.data;
        } catch (e) {}
        return "auto";
    }

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

    function applyQuality(forceNow) {
        if (typeof document === "undefined") return;
        var player = findPlayer();
        if (!player) return;

        var isShort = isCurrentShort(player);
        var desired = getQualitySetting(isShort ? SHORTS_KEY : VIDEO_KEY);
        var vid = getVideoId(player);

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

    function bindVideoListeners() {
        if (typeof document === "undefined") return;
        var video = document.querySelector("video");
        if (video && !video._birdyQualityBound) {
            video._birdyQualityBound = true;
            var onEvt = function () { applyQuality(false); };
            video.addEventListener("loadedmetadata", onEvt);
            video.addEventListener("playing", onEvt);
            video.addEventListener("durationchange", onEvt);
        }
        var player = findPlayer();
        if (player && !player._birdyQualityBound && typeof player.addEventListener === "function") {
            player._birdyQualityBound = true;
            try {
                player.addEventListener("onStateChange", function (state) {
                    if (state === 1 || state === 3) applyQuality(false);
                });
            } catch (e) {}
        }
    }

    window.birdyApplyQuality = function () {
        applyQuality(true);
    };

    if (typeof setInterval === "function") {
        setInterval(function () {
            bindVideoListeners();
            applyQuality(false);
        }, 1200);
    }
})();
