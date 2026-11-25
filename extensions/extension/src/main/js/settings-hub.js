// BirdyTV Settings Hub: Native YouTube TV (Cobalt Leanback) style overlay menu.
// Optimized for low-power TV GPUs (no backdrop blur, O(1) focus updates, in-place toggles,
// DocumentFragment tab rendering) with reliable scrollTop scrolling and full D-pad support.
(function () {
    if (!window.youtv) return;

    var t = window.youtv.t;
    var STORAGE_PREFIX = "yt.leanback.default::";

    var CATEGORIES = [
        { key: "sponsor", titleKey: "sponsor.sponsor.title", color: "#00D400" },
        { key: "selfpromo", titleKey: "sponsor.selfpromo.title", color: "#FFD600" },
        { key: "interaction", titleKey: "sponsor.interaction.title", color: "#CC00FF" },
        { key: "intro", titleKey: "sponsor.intro.title", color: "#00E5FF" },
        { key: "outro", titleKey: "sponsor.outro.title", color: "#304FFE" },
        { key: "preview", titleKey: "sponsor.preview.title", color: "#00B0FF" },
        { key: "music_offtopic", titleKey: "sponsor.music_offtopic.title", color: "#FF6D00" },
        { key: "filler", titleKey: "sponsor.filler.title", color: "#9C27B0" }
    ];

    var PLAYER_BUTTONS = [
        { key: "channel", titleKey: "player.channel.title" },
        { key: "description", titleKey: "player.description.title" },
        { key: "subscribe", titleKey: "player.subscribe.title" },
        { key: "like", titleKey: "player.like.title" },
        { key: "comments", titleKey: "player.comments.title" },
        { key: "ask", titleKey: "player.ask.title" },
        { key: "save", titleKey: "player.save.title" },
        { key: "thanks", titleKey: "player.thanks.title" },
        { key: "report", titleKey: "player.report.title" },
        { key: "stats", titleKey: "player.stats.title" },
        { key: "related", titleKey: "player.related.title", summaryKey: "player.related.summary" }
    ];

    // ---- Storage helpers ----------------------------------------------------------------------
    function getBool(key, def) {
        try {
            var raw = localStorage.getItem(STORAGE_PREFIX + key);
            if (raw !== null) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed.data === "boolean") return parsed.data;
            }
        } catch (e) {}
        return def !== undefined ? def : true;
    }

    function setBool(key, val) {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ data: !!val }));
        } catch (e) {}
    }

    function getSponsorMode(key) {
        var upper = key.toUpperCase();
        try {
            var raw = localStorage.getItem(STORAGE_PREFIX + "YOUTV_SPONSORBLOCK_" + upper + "_MODE");
            if (raw) {
                var m = JSON.parse(raw);
                if (m === "skip" || m === "prompt" || m === "off") return m;
            }
        } catch (e) {}
        var isManual = getBool("YOUTV_SPONSORBLOCK_" + upper + "_PROMPT", false);
        var isAuto = getBool("YOUTV_SPONSORBLOCK_" + upper, key === "sponsor" || key === "selfpromo" || key === "interaction");
        var globalPrompt = getBool("YOUTV_SPONSORBLOCK_PROMPT_ALL", false);
        if (isManual || (isAuto && globalPrompt)) return "prompt";
        if (isAuto) return "skip";
        return "off";
    }

    function setSponsorMode(key, mode) {
        var upper = key.toUpperCase();
        try {
            localStorage.setItem(STORAGE_PREFIX + "YOUTV_SPONSORBLOCK_" + upper + "_MODE", JSON.stringify(mode));
            if (mode === "skip") {
                setBool("YOUTV_SPONSORBLOCK_" + upper, true);
                setBool("YOUTV_SPONSORBLOCK_" + upper + "_PROMPT", false);
            } else if (mode === "prompt") {
                setBool("YOUTV_SPONSORBLOCK_" + upper, true);
                setBool("YOUTV_SPONSORBLOCK_" + upper + "_PROMPT", true);
            } else {
                setBool("YOUTV_SPONSORBLOCK_" + upper, false);
                setBool("YOUTV_SPONSORBLOCK_" + upper + "_PROMPT", false);
            }
        } catch (e) {}
    }

    // ---- SVG Icons (created via createElementNS for TrustedHTML compatibility) ----------------
    var SVG_NS = "http://www.w3.org/2000/svg";
    var ICONS = {
        sponsorblock: [
            ["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }],
            ["path", { d: "m9 12 2 2 4-4" }]
        ],
        seekbar: [
            ["circle", { cx: "13.5", cy: "6.5", r: "0.7", fill: "currentColor" }],
            ["circle", { cx: "17.5", cy: "10.5", r: "0.7", fill: "currentColor" }],
            ["circle", { cx: "8.5", cy: "7.5", r: "0.7", fill: "currentColor" }],
            ["circle", { cx: "6.5", cy: "12.5", r: "0.7", fill: "currentColor" }],
            ["path", { d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" }]
        ],
        ads: [
            ["circle", { cx: "12", cy: "12", r: "10" }],
            ["path", { d: "m4.9 4.9 14.2 14.2" }]
        ],
        player: [
            ["rect", { x: "2", y: "4", width: "20", height: "16", rx: "3" }],
            ["polygon", { points: "10 9 16 12 10 15 10 9", fill: "currentColor", stroke: "none" }]
        ],
        shorts: [
            ["polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }]
        ],
        ryd: [
            ["path", { d: "M17 14V2" }],
            ["path", { d: "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" }]
        ],
        about: [
            ["circle", { cx: "12", cy: "12", r: "10" }],
            ["line", { x1: "12", y1: "16", x2: "12", y2: "12" }],
            ["line", { x1: "12", y1: "8", x2: "12.01", y2: "8" }]
        ]
    };

    function createSvgIcon(shapes) {
        var svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        for (var i = 0; i < shapes.length; i++) {
            var node = document.createElementNS(SVG_NS, shapes[i][0]);
            var attrs = shapes[i][1];
            for (var k in attrs) {
                if (Object.prototype.hasOwnProperty.call(attrs, k)) {
                    node.setAttribute(k, attrs[k]);
                }
            }
            svg.appendChild(node);
        }
        return svg;
    }

    // ---- Styles (YouTube TV Leanback Material Dark) -------------------------------------------
    var sheet = new CSSStyleSheet();
    try {
        sheet.replaceSync(
            ".birdy-hub-backdrop {" +
            " position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 2147483647;" +
            " background: rgba(15, 15, 15, 0.94);" +
            " display: none; align-items: center; justify-content: center;" +
            " font-family: 'YouTube Sans', Roboto, Arial, sans-serif; }" +
            ".birdy-hub-backdrop.show { display: flex; }" +
            ".birdy-hub-modal {" +
            " width: 90vw; height: 88vh; max-width: 1400px; max-height: 840px;" +
            " background: #0f0f0f; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;" +
            " display: flex; flex-direction: column; overflow: hidden; color: #f1f1f1; }" +
            ".birdy-hub-header {" +
            " display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 2rem;" +
            " border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: #0f0f0f; flex-shrink: 0; }" +
            ".birdy-hub-title-box { display: flex; align-items: center; gap: 0.85rem; }" +
            ".birdy-hub-yt-mark {" +
            " width: 30px; height: 22px; border-radius: 6px; background: #ff0000; color: #ffffff;" +
            " display: flex; align-items: center; justify-content: center; flex-shrink: 0; }" +
            ".birdy-hub-yt-tri {" +
            " width: 0; height: 0; margin-left: 2px;" +
            " border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 9px solid #ffffff; }" +
            ".birdy-hub-title { font-size: 1.5rem; font-weight: 700; margin: 0; color: #f1f1f1; letter-spacing: -0.01em; }" +
            ".birdy-hub-hint { color: #aaaaaa; font-size: 1rem; font-weight: 500; }" +
            ".birdy-hub-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }" +
            ".birdy-hub-sidebar {" +
            " position: relative; width: 290px; flex-shrink: 0; background: #0f0f0f;" +
            " border-right: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem 0.9rem;" +
            " display: flex; flex-direction: column; gap: 0.3rem; min-height: 0; overflow-y: auto; }" +
            ".birdy-hub-tab {" +
            " display: flex; align-items: center; gap: 0.95rem; padding: 0.9rem 1.1rem; border-radius: 8px;" +
            " font-size: 1.15rem; font-weight: 500; color: #aaaaaa; cursor: pointer;" +
            " border: 2px solid transparent; outline: none; flex-shrink: 0; }" +
            ".birdy-hub-tab-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }" +
            ".birdy-hub-tab-icon svg { width: 20px; height: 20px; }" +
            ".birdy-hub-tab.active { background: rgba(255, 255, 255, 0.1); color: #f1f1f1; font-weight: 600; }" +
            ".birdy-hub-tab.birdy-focus { background: #f1f1f1; color: #0f0f0f; font-weight: 700; }" +
            ".birdy-hub-content {" +
            " position: relative; flex: 1; min-height: 0; padding: 1.6rem 2.2rem 2.4rem;" +
            " overflow-y: auto; display: flex; flex-direction: column; gap: 0.65rem; background: #141414; }" +
            ".birdy-hub-section-head {" +
            " padding-bottom: 0.65rem; margin-bottom: 0.25rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0; }" +
            ".birdy-hub-section-title { font-size: 1.35rem; font-weight: 700; color: #f1f1f1; }" +
            ".birdy-hub-restart-banner {" +
            " display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 1.2rem;" +
            " background: rgba(62, 166, 255, 0.12); border: 1px solid rgba(62, 166, 255, 0.45); border-radius: 8px;" +
            " color: #3ea6ff; font-size: 1rem; font-weight: 600; flex-shrink: 0; }" +
            ".birdy-hub-row {" +
            " display: flex; align-items: center; justify-content: space-between; gap: 1.4rem; padding: 1rem 1.3rem;" +
            " background: #212121; border-radius: 8px; border: 2px solid transparent; flex-shrink: 0; }" +
            ".birdy-hub-row.birdy-focus { background: #2c2c2c; border-color: #f1f1f1; }" +
            ".birdy-hub-row-left { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0; }" +
            ".birdy-hub-row-title-wrap { display: flex; align-items: center; gap: 0.65rem; }" +
            ".birdy-hub-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }" +
            ".birdy-hub-row-title { font-size: 1.15rem; font-weight: 500; color: #f1f1f1; }" +
            ".birdy-hub-row.birdy-focus .birdy-hub-row-title { font-weight: 600; color: #ffffff; }" +
            ".birdy-hub-row-summary { font-size: 0.94rem; color: #aaaaaa; line-height: 1.35; }" +
            ".birdy-hub-pill-group { display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; background: #141414; padding: 0.25rem; border-radius: 8px; }" +
            ".birdy-hub-pill {" +
            " padding: 0.5rem 0.95rem; border-radius: 6px; font-size: 0.98rem; font-weight: 500;" +
            " background: transparent; color: #aaaaaa; border: 2px solid transparent; cursor: pointer; outline: none; }" +
            ".birdy-hub-pill.selected { background: #3ea6ff; color: #0f0f0f; font-weight: 700; }" +
            ".birdy-hub-pill.birdy-focus { border-color: #ffffff; background: #f1f1f1; color: #0f0f0f; font-weight: 700; }" +
            ".birdy-hub-switch-wrap { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }" +
            ".birdy-hub-switch-label { font-size: 0.95rem; font-weight: 500; color: #aaaaaa; min-width: 64px; text-align: right; }" +
            ".birdy-hub-switch-label.on { color: #3ea6ff; }" +
            ".birdy-hub-switch {" +
            " position: relative; width: 52px; height: 28px; border-radius: 9999px; flex-shrink: 0;" +
            " background: #525252; border: 2px solid transparent; cursor: pointer; outline: none; }" +
            ".birdy-hub-switch.on { background: #3ea6ff; }" +
            ".birdy-hub-switch::after {" +
            " content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px;" +
            " border-radius: 50%; background: #f1f1f1; }" +
            ".birdy-hub-switch.on::after { transform: translateX(24px); background: #0f0f0f; }" +
            ".birdy-hub-switch.birdy-focus { border-color: #ffffff; }" +
            ".birdy-hub-action-btn {" +
            " padding: 0.85rem 1.6rem; border-radius: 8px; font-size: 1.1rem; font-weight: 600;" +
            " background: #272727; color: #f1f1f1; border: 2px solid rgba(255,255,255,0.2); cursor: pointer;" +
            " outline: none; align-self: flex-start; margin-top: 0.4rem; flex-shrink: 0; }" +
            ".birdy-hub-action-btn.birdy-focus { background: #f1f1f1; color: #0f0f0f; border-color: #f1f1f1; font-weight: 700; }"
        );
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {}

    // ---- Modal DOM & Focus Controller ---------------------------------------------------------
    var modalBackdrop = null;
    var sidebarEl = null;
    var contentEl = null;
    var sidebarTabs = [];
    var currentRows = [];
    var focusedNodes = [];
    var restartBannerInserted = false;

    var activeTabKey = "sponsorblock";
    var focusArea = "sidebar"; // "sidebar" or "content"
    var focusSidebarIndex = 0;
    var focusContentIndex = 0;
    var focusPillIndex = 0;
    var pendingRestart = false;

    var TABS = [
        { key: "sponsorblock", labelKey: "hub.tab.sponsorblock", icon: ICONS.sponsorblock },
        { key: "seekbar", labelKey: "hub.tab.seekbar", icon: ICONS.seekbar },
        { key: "ads", labelKey: "hub.tab.ads", icon: ICONS.ads },
        { key: "player", labelKey: "hub.tab.player", icon: ICONS.player },
        { key: "shorts", labelKey: "hub.tab.shorts", icon: ICONS.shorts },
        { key: "ryd", labelKey: "hub.tab.ryd", icon: ICONS.ryd },
        { key: "about", labelKey: "hub.tab.about", icon: ICONS.about }
    ];

    function createModal() {
        if (modalBackdrop) return;
        modalBackdrop = document.createElement("div");
        modalBackdrop.className = "birdy-hub-backdrop";
        modalBackdrop.onclick = function (e) {
            if (e.target === modalBackdrop) closeHub();
        };

        var modal = document.createElement("div");
        modal.className = "birdy-hub-modal";

        // Header
        var header = document.createElement("div");
        header.className = "birdy-hub-header";

        var titleBox = document.createElement("div");
        titleBox.className = "birdy-hub-title-box";
        var ytMark = document.createElement("span");
        ytMark.className = "birdy-hub-yt-mark";
        var ytTri = document.createElement("span");
        ytTri.className = "birdy-hub-yt-tri";
        ytMark.appendChild(ytTri);
        var title = document.createElement("h2");
        title.className = "birdy-hub-title";
        title.textContent = (window.__youtvBranding || "BirdyTV") + " · " + t("hub.title");
        titleBox.appendChild(ytMark);
        titleBox.appendChild(title);

        var hint = document.createElement("span");
        hint.className = "birdy-hub-hint";
        hint.textContent = t("hub.nav.hint");

        header.appendChild(titleBox);
        header.appendChild(hint);
        modal.appendChild(header);

        // Body
        var body = document.createElement("div");
        body.className = "birdy-hub-body";

        sidebarEl = document.createElement("div");
        sidebarEl.className = "birdy-hub-sidebar";
        buildSidebarOnce();
        body.appendChild(sidebarEl);

        contentEl = document.createElement("div");
        contentEl.className = "birdy-hub-content";
        body.appendChild(contentEl);

        modal.appendChild(body);
        modalBackdrop.appendChild(modal);
        document.body.appendChild(modalBackdrop);
    }

    function buildSidebarOnce() {
        sidebarEl.textContent = "";
        sidebarTabs = [];
        for (var i = 0; i < TABS.length; i++) {
            (function (tab, idx) {
                var el = document.createElement("div");
                el.className = "birdy-hub-tab" + (tab.key === activeTabKey ? " active" : "");
                el.setAttribute("data-key", tab.key);

                var iconWrap = document.createElement("span");
                iconWrap.className = "birdy-hub-tab-icon";
                iconWrap.appendChild(createSvgIcon(tab.icon));

                var label = document.createElement("span");
                label.textContent = t(tab.labelKey);

                el.appendChild(iconWrap);
                el.appendChild(label);
                el.onclick = function () {
                    selectTab(idx);
                    focusArea = "sidebar";
                    updateFocusUI();
                };
                sidebarEl.appendChild(el);
                sidebarTabs.push(el);
            })(TABS[i], i);
        }
    }

    function updateSidebarActive() {
        for (var i = 0; i < sidebarTabs.length; i++) {
            sidebarTabs[i].classList.toggle("active", TABS[i].key === activeTabKey);
        }
    }

    function selectTab(idx) {
        if (idx < 0 || idx >= TABS.length) return;
        focusSidebarIndex = idx;
        var nextKey = TABS[idx].key;
        if (activeTabKey !== nextKey) {
            activeTabKey = nextKey;
            updateSidebarActive();
            renderContent();
        }
    }

    function addRestartBannerIfNeeded() {
        if (!pendingRestart || restartBannerInserted || !contentEl) return;
        restartBannerInserted = true;
        var banner = document.createElement("div");
        banner.className = "birdy-hub-restart-banner";
        var bannerText = document.createElement("span");
        bannerText.textContent = t("restart.message");
        banner.appendChild(bannerText);

        var head = contentEl.querySelector(".birdy-hub-section-head");
        if (head && head.nextSibling) {
            contentEl.insertBefore(banner, head.nextSibling);
        } else {
            contentEl.appendChild(banner);
        }

        if (activeTabKey !== "about") {
            var restartBtn = createRestartButton();
            contentEl.appendChild(restartBtn);
            currentRows.push(restartBtn);
        }
    }

    function createRestartButton() {
        var restartBtn = document.createElement("button");
        restartBtn.className = "birdy-hub-action-btn birdy-interactive-row";
        restartBtn.textContent = t("hub.restart_app");
        restartBtn.onclick = function () {
            location.reload();
        };
        return restartBtn;
    }

    function renderContent() {
        if (!contentEl) return;
        contentEl.textContent = "";
        contentEl.scrollTop = 0;
        currentRows = [];
        restartBannerInserted = false;

        var frag = document.createDocumentFragment();
        var currentTab = TABS[focusSidebarIndex];
        if (currentTab) {
            var secHead = document.createElement("div");
            secHead.className = "birdy-hub-section-head";
            var secTitle = document.createElement("span");
            secTitle.className = "birdy-hub-section-title";
            secTitle.textContent = t(currentTab.labelKey);
            secHead.appendChild(secTitle);
            frag.appendChild(secHead);
        }

        if (pendingRestart) {
            restartBannerInserted = true;
            var banner = document.createElement("div");
            banner.className = "birdy-hub-restart-banner";
            var bannerText = document.createElement("span");
            bannerText.textContent = t("restart.message");
            banner.appendChild(bannerText);
            frag.appendChild(banner);
        }

        if (activeTabKey === "sponsorblock") {
            appendRow(frag, createToggleRow(
                t("feature.sponsorblock.name"),
                t("feature.sponsorblock.summary"),
                "YOUTV_SPONSORBLOCK",
                true
            ));
            appendRow(frag, createToggleRow(
                t("sponsor.prompt_all.title"),
                t("sponsor.prompt_all.summary"),
                "YOUTV_SPONSORBLOCK_PROMPT_ALL",
                false
            ));

            for (var i = 0; i < CATEGORIES.length; i++) {
                appendRow(frag, createThreeWayRow(CATEGORIES[i]));
            }
        } else if (activeTabKey === "seekbar") {
            appendRow(frag, createToggleRow(
                t("feature.sponsorblock_colors.name"),
                t("feature.sponsorblock_colors.summary"),
                "YOUTV_SPONSORBLOCK_COLORS",
                true
            ));

            for (var j = 0; j < CATEGORIES.length; j++) {
                var cat = CATEGORIES[j];
                var key = "YOUTV_SPONSORBLOCK_COLORS_" + cat.key.toUpperCase() + "_SEEKBAR";
                var def = cat.key === "sponsor" || cat.key === "selfpromo" || cat.key === "interaction";
                appendRow(frag, createToggleRow(
                    t(cat.titleKey),
                    t("sponsor." + cat.key + ".seekbar.summary"),
                    key,
                    def,
                    false,
                    cat.color
                ));
            }
        } else if (activeTabKey === "ads") {
            appendRow(frag, createToggleRow(
                t("feature.ads.name"),
                t("feature.ads.summary"),
                "YOUTV_ADS",
                true
            ));
            appendRow(frag, createToggleRow(
                t("feature.premium-promos.name"),
                t("feature.premium-promos.summary"),
                "YOUTV_PREMIUM_PROMOS",
                true
            ));
        } else if (activeTabKey === "player") {
            appendRow(frag, createToggleRow(
                t("feature.player.name"),
                t("feature.player.summary"),
                "YOUTV_PLAYER",
                true
            ));

            for (var k = 0; k < PLAYER_BUTTONS.length; k++) {
                var btn = PLAYER_BUTTONS[k];
                appendRow(frag, createToggleRow(
                    t(btn.titleKey),
                    btn.summaryKey ? t(btn.summaryKey) : "",
                    "YOUTV_PLAYER_" + btn.key.toUpperCase(),
                    false
                ));
            }
        } else if (activeTabKey === "shorts") {
            appendRow(frag, createToggleRow(
                t("feature.shorts.name"),
                t("feature.shorts.summary"),
                "YOUTV_SHORTS",
                true,
                true
            ));
            appendRow(frag, createToggleRow(
                t("feature.topics.name"),
                t("feature.topics.summary"),
                "YOUTV_TOPICS",
                false,
                true
            ));
        } else if (activeTabKey === "ryd") {
            appendRow(frag, createToggleRow(
                t("feature.ryd.name"),
                t("feature.ryd.summary"),
                "YOUTV_RYD",
                true
            ));
        } else if (activeTabKey === "about") {
            var repoRow = document.createElement("div");
            repoRow.className = "birdy-hub-row";
            var ver = window.__farotvVersion ? "v" + window.__farotvVersion : "";
            var ytVer = window.__youtubeVersion ? "YouTube TV " + window.__youtubeVersion : "Android TV Cobalt";
            var repoLeft = document.createElement("div");
            repoLeft.className = "birdy-hub-row-left";
            var repoTitle = document.createElement("span");
            repoTitle.className = "birdy-hub-row-title";
            repoTitle.textContent = (window.__youtvBranding || "BirdyTV") + (ver ? " " + ver : "");
            var repoSummary = document.createElement("span");
            repoSummary.className = "birdy-hub-row-summary";
            repoSummary.textContent = "SEIFELDEEN15/Birdy-Patches • " + ytVer;
            repoLeft.appendChild(repoTitle);
            repoLeft.appendChild(repoSummary);
            repoRow.appendChild(repoLeft);
            frag.appendChild(repoRow);
        }

        if (pendingRestart || activeTabKey === "about") {
            appendRow(frag, createRestartButton());
        }

        contentEl.appendChild(frag);
    }

    function appendRow(frag, row) {
        frag.appendChild(row);
        currentRows.push(row);
    }

    function createThreeWayRow(cat) {
        var currentMode = getSponsorMode(cat.key);
        var row = document.createElement("div");
        row.className = "birdy-hub-row birdy-interactive-row";
        row.setAttribute("data-type", "3way");
        row.setAttribute("data-cat", cat.key);

        var left = document.createElement("div");
        left.className = "birdy-hub-row-left";
        var titleWrap = document.createElement("div");
        titleWrap.className = "birdy-hub-row-title-wrap";
        var dot = document.createElement("span");
        dot.className = "birdy-hub-dot";
        dot.style.backgroundColor = cat.color;
        var rowTitle = document.createElement("span");
        rowTitle.className = "birdy-hub-row-title";
        rowTitle.textContent = t(cat.titleKey);
        titleWrap.appendChild(dot);
        titleWrap.appendChild(rowTitle);
        left.appendChild(titleWrap);

        var pillGroup = document.createElement("div");
        pillGroup.className = "birdy-hub-pill-group";

        var modes = [
            { id: "skip", text: t("hub.action.skip") },
            { id: "prompt", text: t("hub.action.prompt") },
            { id: "off", text: t("hub.action.off") }
        ];

        var pills = [];
        for (var i = 0; i < modes.length; i++) {
            (function (m, idx) {
                var pill = document.createElement("button");
                pill.className = "birdy-hub-pill" + (currentMode === m.id ? " selected" : "");
                pill.textContent = m.text;
                pill.setAttribute("data-mode", m.id);
                pill.onclick = function () {
                    setSponsorMode(cat.key, m.id);
                    for (var p = 0; p < pills.length; p++) {
                        pills[p].classList.toggle("selected", p === idx);
                    }
                    focusPillIndex = idx;
                    updateFocusUI();
                };
                pillGroup.appendChild(pill);
                pills.push(pill);
            })(modes[i], i);
        }

        row._pills = pills;
        row.appendChild(left);
        row.appendChild(pillGroup);
        return row;
    }

    function createToggleRow(titleText, summaryText, storageKey, defaultVal, needsRestart, dotColor) {
        var isEnabled = getBool(storageKey, defaultVal);
        var row = document.createElement("div");
        row.className = "birdy-hub-row birdy-interactive-row";
        row.setAttribute("data-type", "toggle");

        var left = document.createElement("div");
        left.className = "birdy-hub-row-left";

        var titleWrap = document.createElement("div");
        titleWrap.className = "birdy-hub-row-title-wrap";
        if (dotColor) {
            var dot = document.createElement("span");
            dot.className = "birdy-hub-dot";
            dot.style.backgroundColor = dotColor;
            titleWrap.appendChild(dot);
        }
        var rowTitle = document.createElement("span");
        rowTitle.className = "birdy-hub-row-title";
        rowTitle.textContent = titleText;
        titleWrap.appendChild(rowTitle);
        left.appendChild(titleWrap);

        if (summaryText) {
            var rowSummary = document.createElement("span");
            rowSummary.className = "birdy-hub-row-summary";
            rowSummary.textContent = summaryText;
            left.appendChild(rowSummary);
        }

        var wrap = document.createElement("div");
        wrap.className = "birdy-hub-switch-wrap";

        var stateLabel = document.createElement("span");
        stateLabel.className = "birdy-hub-switch-label" + (isEnabled ? " on" : "");
        stateLabel.textContent = isEnabled ? t("hub.enabled") : t("hub.disabled");

        var switchBtn = document.createElement("button");
        switchBtn.className = "birdy-hub-switch" + (isEnabled ? " on" : "");
        switchBtn.setAttribute("aria-label", stateLabel.textContent);

        function applyToggle() {
            isEnabled = !isEnabled;
            setBool(storageKey, isEnabled);
            switchBtn.classList.toggle("on", isEnabled);
            stateLabel.classList.toggle("on", isEnabled);
            var txt = isEnabled ? t("hub.enabled") : t("hub.disabled");
            stateLabel.textContent = txt;
            switchBtn.setAttribute("aria-label", txt);
            if (needsRestart) {
                pendingRestart = true;
                addRestartBannerIfNeeded();
            }
        }

        switchBtn.onclick = applyToggle;
        row._switchBtn = switchBtn;
        row._toggle = applyToggle;

        wrap.appendChild(stateLabel);
        wrap.appendChild(switchBtn);
        row.appendChild(left);
        row.appendChild(wrap);
        return row;
    }

    function syncPillIndexToSelected(row) {
        if (!row || !row._pills) {
            focusPillIndex = 0;
            return;
        }
        for (var i = 0; i < row._pills.length; i++) {
            if (row._pills[i].classList.contains("selected")) {
                focusPillIndex = i;
                return;
            }
        }
        focusPillIndex = 0;
    }

    // ---- Scroll & Focus Controller ------------------------------------------------------------
    function ensureVisible(container, el, isFirst) {
        if (!container || !el) return;
        if (isFirst) {
            container.scrollTop = 0;
            return;
        }
        var cRect = container.getBoundingClientRect();
        var eRect = el.getBoundingClientRect();
        var pad = 20;
        if (eRect.top - pad < cRect.top) {
            container.scrollTop -= (cRect.top - (eRect.top - pad));
        } else if (eRect.bottom + pad > cRect.bottom) {
            container.scrollTop += ((eRect.bottom + pad) - cRect.bottom);
        }
    }

    function clearFocusedNodes() {
        for (var i = 0; i < focusedNodes.length; i++) {
            focusedNodes[i].classList.remove("birdy-focus");
        }
        focusedNodes.length = 0;
    }

    function addFocusedNode(el) {
        if (!el) return;
        el.classList.add("birdy-focus");
        focusedNodes.push(el);
    }

    function updateFocusUI() {
        if (!modalBackdrop) return;
        clearFocusedNodes();

        if (focusArea === "sidebar") {
            var tab = sidebarTabs[focusSidebarIndex];
            if (tab) {
                addFocusedNode(tab);
                ensureVisible(sidebarEl, tab, focusSidebarIndex === 0);
            }
        } else {
            if (!currentRows.length) return;
            if (focusContentIndex >= currentRows.length) focusContentIndex = currentRows.length - 1;
            var targetRow = currentRows[focusContentIndex];
            if (!targetRow) return;

            addFocusedNode(targetRow);
            if (targetRow._pills && targetRow._pills[focusPillIndex]) {
                addFocusedNode(targetRow._pills[focusPillIndex]);
            } else if (targetRow._switchBtn) {
                addFocusedNode(targetRow._switchBtn);
            }
            ensureVisible(contentEl, targetRow, focusContentIndex === 0);
        }
    }

    function stopEvent(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    function onKeyDown(e) {
        if (!isHubOpen()) return;
        var code = e.keyCode || e.which;

        // BACK: 27 (Escape), 4 (Android Back), 10009 (Tizen Back)
        if (code === 27 || code === 4 || code === 10009 || e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack") {
            stopEvent(e);
            closeHub();
            return;
        }

        if (focusArea === "sidebar") {
            if (code === 38) { // UP
                stopEvent(e);
                if (focusSidebarIndex > 0) {
                    selectTab(focusSidebarIndex - 1);
                    updateFocusUI();
                }
            } else if (code === 40) { // DOWN
                stopEvent(e);
                if (focusSidebarIndex < TABS.length - 1) {
                    selectTab(focusSidebarIndex + 1);
                    updateFocusUI();
                }
            } else if (code === 39 || code === 13 || code === 23) { // RIGHT or OK
                stopEvent(e);
                if (currentRows.length > 0) {
                    focusArea = "content";
                    focusContentIndex = 0;
                    syncPillIndexToSelected(currentRows[0]);
                    updateFocusUI();
                }
            }
        } else {
            var curRow = currentRows[focusContentIndex];

            if (code === 38) { // UP
                stopEvent(e);
                if (focusContentIndex > 0) {
                    focusContentIndex--;
                    syncPillIndexToSelected(currentRows[focusContentIndex]);
                    updateFocusUI();
                }
            } else if (code === 40) { // DOWN
                stopEvent(e);
                if (focusContentIndex < currentRows.length - 1) {
                    focusContentIndex++;
                    syncPillIndexToSelected(currentRows[focusContentIndex]);
                    updateFocusUI();
                }
            } else if (code === 37) { // LEFT
                stopEvent(e);
                if (curRow && curRow._pills && focusPillIndex > 0) {
                    focusPillIndex--;
                    updateFocusUI();
                } else {
                    focusArea = "sidebar";
                    updateFocusUI();
                }
            } else if (code === 39) { // RIGHT
                stopEvent(e);
                if (curRow && curRow._pills && focusPillIndex < curRow._pills.length - 1) {
                    focusPillIndex++;
                    updateFocusUI();
                }
            } else if (code === 13 || code === 23) { // OK / ENTER
                stopEvent(e);
                if (curRow && curRow._pills && curRow._pills[focusPillIndex]) {
                    curRow._pills[focusPillIndex].click();
                } else if (curRow && curRow._toggle) {
                    curRow._toggle();
                } else if (curRow) {
                    curRow.click();
                }
            }
        }
    }

    function isHubOpen() {
        return !!(modalBackdrop && modalBackdrop.classList.contains("show"));
    }

    function openHub(initialTab) {
        createModal();
        if (initialTab) {
            for (var i = 0; i < TABS.length; i++) {
                if (TABS[i].key === initialTab) {
                    activeTabKey = initialTab;
                    focusSidebarIndex = i;
                    break;
                }
            }
        }
        modalBackdrop.classList.add("show");
        updateSidebarActive();
        renderContent();
        focusArea = "sidebar";
        updateFocusUI();
        window.removeEventListener("keydown", onKeyDown, true);
        window.addEventListener("keydown", onKeyDown, true);
        youtv.report("settings-hub: opened");
    }

    function closeHub() {
        if (!modalBackdrop) return;
        modalBackdrop.classList.remove("show");
        window.removeEventListener("keydown", onKeyDown, true);
        youtv.report("settings-hub: closed");
    }

    window.birdyTvSettingsHub = {
        open: openHub,
        close: closeHub,
        isOpen: isHubOpen
    };

    function matchesHubEntry(el) {
        while (el && el !== document.body) {
            var itemId = el.getAttribute && el.getAttribute("data-item-id");
            if (itemId === "BIRDY_SETTINGS_HUB") return true;
            var text = (el.textContent || "").trim();
            if (text === t("hub.open") || text === t("hub.title")) return true;
            el = el.parentElement;
        }
        return false;
    }

    window.addEventListener("keydown", function (e) {
        if (isHubOpen()) return;
        var code = e.keyCode || e.which;
        if (code === 113 /* F2 */) {
            stopEvent(e);
            openHub();
            return;
        }
        if (code === 13 || code === 23) {
            var candidate = document.activeElement;
            if (!matchesHubEntry(candidate)) {
                candidate = null;
                var focusedList = document.querySelectorAll("[class*='focused'], [focused='true'], [aria-selected='true']");
                for (var i = 0; i < focusedList.length; i++) {
                    if (matchesHubEntry(focusedList[i])) {
                        candidate = focusedList[i];
                        break;
                    }
                }
            }
            if (candidate && matchesHubEntry(candidate)) {
                stopEvent(e);
                openHub();
            }
        }
    }, true);

    document.addEventListener("click", function (e) {
        if (isHubOpen()) return;
        if (matchesHubEntry(e.target)) {
            stopEvent(e);
            openHub();
        }
    }, true);
})();
