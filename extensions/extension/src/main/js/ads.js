// Block ads:
// - video ads: remove the ad schedule from player responses before the player reads it;
// - sponsored tiles in feeds ("Patrocinado"): remove ad slot items from every list.
// Based on utv-runtime's "adblock" patch (MIT License, Copyright (c) 2026 Dylan Duff) and
// ysamjo/morphe-patches (GPLv3).
(function () {
    if (!window.youtv) return;

    var AD_KEYS = ["adPlacements", "adSlots", "playerAds", "adBreakHeartbeatParams"];

    // Feed items that are ads. Seen on Home (7.32.300): adSlotRenderer wrapping an
    // inFeedAdLayoutRenderer, as the first tile of the first shelf.
    var AD_ITEM_KEYS = ["adSlotRenderer", "inFeedAdLayoutRenderer", "promotedVideoRenderer",
        "compactPromotedVideoRenderer", "promotedSparklesWebRenderer", "reelAdRenderer", "shortsAdRenderer",
        "adParams", "adBreakParams", "adPlaybackContext", "adBreakServiceRenderer", "adRenderer",
        "adPlacementRenderer", "reelPlayerAdOverlayRenderer"];

    function stripAds(value) {
        var hit = false;
        for (var i = 0; i < AD_KEYS.length; i++) {
            if (Object.prototype.hasOwnProperty.call(value, AD_KEYS[i])) {
                delete value[AD_KEYS[i]];
                hit = true;
            }
        }
        var nested = value.playerResponse;
        if (nested && typeof nested === "object") hit = stripAds(nested) || hit;
        return hit;
    }

    function isAdItem(item) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        for (var i = 0; i < AD_ITEM_KEYS.length; i++) {
            if (Object.prototype.hasOwnProperty.call(item, AD_ITEM_KEYS[i])) return true;
        }
        var ep = item.command && item.command.reelWatchEndpoint;
        if (ep && (ep.adParams || ep.adBreakParams || ep.adPlaybackContext)) return true;
        var overlay = item.reelPlayerOverlayRenderer;
        if (overlay && (overlay.style === "REEL_PLAYER_OVERLAY_STYLE_AD" || overlay.adRenderer || overlay.adInfo)) return true;
        return false;
    }

    var adsFeature = youtv.feature({
        id: "ads",
        nameKey: "feature.ads.name",
        summaryKey: "feature.ads.summary",
        defaultEnabled: true,
        beforeTree: function (response) {
            if (stripAds(response)) youtv.report("ads: removed ad schedule");
        },
        treeFilter: {
            markers: AD_ITEM_KEYS,
            eligible: function (response) {
                return !!(response.contents || response.onResponseReceivedActions || response.onResponseReceivedEndpoints ||
                    response.continuationContents || response.entries || response.replacementEntries || response.sequenceEntries);
            },
            item: isAdItem,
            report: function (removed) { youtv.report("ads: removed " + removed + " sponsored item(s)"); }
        }
    });

    // Fallback DOM skip for any Shorts ad that bypasses JSON filtering
    if (typeof document !== "undefined" && typeof setInterval === "function") {
        var lastSkippedAdSrc = "";
        setInterval(function () {
            if (!adsFeature || !adsFeature.enabled()) return;
            var overlay = document.querySelector ? document.querySelector("ytlr-reel-player-overlay-renderer") : null;
            if (!overlay) return;
            var adBadge = overlay.querySelector("ytlr-ad-badge-renderer, ytlr-ad-info-renderer, [idomkey*='ad-badge'], [idomkey*='ad_badge'], [class*='ad-badge']");
            if (!adBadge) return;
            var video = document.querySelector("video");
            var src = video ? (video.currentSrc || video.src || String(video.duration || "")) : "ad";
            if (src && src === lastSkippedAdSrc) return;
            lastSkippedAdSrc = src;
            youtv.report("ads: skipping active Shorts ad");
            try {
                window.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 40, which: 40, key: "ArrowDown", bubbles: true }));
            } catch (e) {}
            if (video && isFinite(video.duration) && video.duration > 0) {
                try { video.currentTime = video.duration; } catch (e2) {}
            }
        }, 600);
    }
})();
