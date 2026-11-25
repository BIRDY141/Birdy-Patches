// BirdyTV Settings Hub: TizenTube Cobalt-style TV overlay settings menu.
// Replaces the native YouTube settings list with a dedicated, D-pad-navigable TV overlay
// hosting all BirdyTV settings: SponsorBlock (3-way modes), Seekbar Colors, Ads & Promos,
// Player Controls, Shorts & Topics, Return YouTube Dislike (RYD), and About.
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

    // ---- SVG Icons (built via createElementNS so TrustedHTML CSP is respected) ---------------
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

    // ---- Styles -------------------------------------------------------------------------------
    var sheet = new CSSStyleSheet();
    try {
        sheet.replaceSync(
            ".birdy-hub-backdrop {" +
            " position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 2147483647;" +
            " background: rgba(6, 6, 9, 0.84); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);" +
            " display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none;" +
            " transition: opacity 200ms ease; font-family: Roboto, 'YouTube Sans', Arial, sans-serif; }" +
            ".birdy-hub-backdrop.show { opacity: 1; pointer-events: auto; }" +
            ".birdy-hub-modal {" +
            " width: 88vw; height: 86vh; max-width: 1380px; max-height: 820px;" +
            " background: linear-gradient(160deg, rgba(24, 24, 28, 0.98), rgba(14, 14, 17, 0.99));" +
            " border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 22px;" +
            " box-shadow: 0 28px 80px rgba(0, 0, 0, 0.9); display: flex; flex-direction: column;" +
            " overflow: hidden; color: #f1f1f1; }" +
            ".birdy-hub-header {" +
            " display: flex; align-items: center; justify-content: space-between; padding: 1.35rem 2.2rem;" +
            " border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); flex-shrink: 0; }" +
            ".birdy-hub-title-box { display: flex; align-items: center; gap: 0.9rem; }" +
            ".birdy-hub-badge {" +
            " background: linear-gradient(135deg, #FF2028, #D9141C); color: #ffffff; font-weight: 800; font-size: 0.85rem;" +
            " padding: 0.35rem 0.85rem; border-radius: 9999px; letter-spacing: 0.06em; text-transform: uppercase;" +
            " box-shadow: 0 4px 14px rgba(255, 32, 40, 0.35); }" +
            ".birdy-hub-title { font-size: 1.55rem; font-weight: 700; margin: 0; color: #ffffff; letter-spacing: -0.01em; }" +
            ".birdy-hub-hint { color: rgba(255, 255, 255, 0.5); font-size: 1.05rem; font-weight: 500; }" +
            ".birdy-hub-body { display: flex; flex: 1; overflow: hidden; }" +
            ".birdy-hub-sidebar {" +
            " width: 290px; flex-shrink: 0; background: rgba(0, 0, 0, 0.25); border-right: 1px solid rgba(255, 255, 255, 0.07);" +
            " padding: 1.2rem 1rem; display: flex; flex-direction: column; gap: 0.45rem; overflow-y: auto; }" +
            ".birdy-hub-tab {" +
            " position: relative; display: flex; align-items: center; gap: 0.9rem; padding: 0.95rem 1.25rem; border-radius: 14px;" +
            " font-size: 1.18rem; font-weight: 600; color: rgba(255, 255, 255, 0.65); cursor: pointer;" +
            " border: 2px solid transparent; transition: all 160ms ease; outline: none; }" +
            ".birdy-hub-tab-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }" +
            ".birdy-hub-tab-icon svg { width: 20px; height: 20px; }" +
            ".birdy-hub-tab.active { background: rgba(255, 255, 255, 0.08); color: #ffffff; }" +
            ".birdy-hub-tab.active::before {" +
            " content: ''; position: absolute; left: 0; top: 22%; height: 56%; width: 4px;" +
            " border-radius: 0 4px 4px 0; background: #FF2028; }" +
            ".birdy-hub-tab.birdy-focus {" +
            " border-color: #ffffff; background: rgba(255, 32, 40, 0.18); color: #ffffff;" +
            " box-shadow: 0 4px 18px rgba(255, 32, 40, 0.25); transform: scale(1.02); }" +
            ".birdy-hub-content {" +
            " flex: 1; padding: 1.8rem 2.4rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }" +
            ".birdy-hub-section-head {" +
            " display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem; padding-bottom: 0.6rem;" +
            " border-bottom: 1px solid rgba(255, 255, 255, 0.06); }" +
            ".birdy-hub-section-title { font-size: 1.35rem; font-weight: 700; color: #ffffff; }" +
            ".birdy-hub-restart-banner {" +
            " display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.9rem 1.3rem;" +
            " background: rgba(255, 179, 0, 0.14); border: 1px solid rgba(255, 179, 0, 0.45); border-radius: 14px;" +
            " color: #ffd54f; font-size: 1.05rem; font-weight: 600; }" +
            ".birdy-hub-row {" +
            " display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; padding: 1.05rem 1.45rem;" +
            " background: rgba(255, 255, 255, 0.035); border-radius: 16px; border: 2px solid transparent;" +
            " transition: all 160ms ease; }" +
            ".birdy-hub-row.birdy-focus { border-color: rgba(255, 255, 255, 0.85); background: rgba(255, 255, 255, 0.09); }" +
            ".birdy-hub-row-left { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 0; }" +
            ".birdy-hub-row-title-wrap { display: flex; align-items: center; gap: 0.7rem; }" +
            ".birdy-hub-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }" +
            ".birdy-hub-row-title { font-size: 1.2rem; font-weight: 600; color: #ffffff; }" +
            ".birdy-hub-row-summary { font-size: 0.96rem; color: rgba(255, 255, 255, 0.55); line-height: 1.35; }" +
            ".birdy-hub-pill-group { display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0; background: rgba(0, 0, 0, 0.28); padding: 0.3rem; border-radius: 14px; }" +
            ".birdy-hub-pill {" +
            " padding: 0.55rem 1rem; border-radius: 10px; font-size: 1.02rem; font-weight: 600;" +
            " background: transparent; color: rgba(255, 255, 255, 0.6);" +
            " border: 2px solid transparent; cursor: pointer; transition: all 150ms ease; outline: none; }" +
            ".birdy-hub-pill.selected { background: #FF2028; color: #ffffff; box-shadow: 0 2px 10px rgba(255, 32, 40, 0.4); }" +
            ".birdy-hub-pill.birdy-focus { border-color: #ffffff; color: #ffffff; transform: scale(1.04); }" +
            ".birdy-hub-switch {" +
            " position: relative; width: 58px; height: 32px; border-radius: 9999px; flex-shrink: 0;" +
            " background: rgba(255, 255, 255, 0.18); border: 2px solid transparent; cursor: pointer;" +
            " transition: background 180ms ease, transform 150ms ease, border-color 150ms ease; outline: none; }" +
            ".birdy-hub-switch.on { background: #00D400; }" +
            ".birdy-hub-switch::after {" +
            " content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px;" +
            " border-radius: 50%; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4);" +
            " transition: transform 180ms ease; }" +
            ".birdy-hub-switch.on::after { transform: translateX(26px); }" +
            ".birdy-hub-switch.birdy-focus { border-color: #ffffff; box-shadow: 0 0 14px rgba(255, 255, 255, 0.45); transform: scale(1.06); }" +
            ".birdy-hub-action-btn {" +
            " padding: 0.85rem 1.8rem; border-radius: 14px; font-size: 1.15rem; font-weight: 700;" +
            " background: #FF2028; color: #ffffff; border: 2px solid transparent; cursor: pointer;" +
            " transition: all 160ms ease; outline: none; align-self: flex-start; margin-top: 0.5rem; }" +
            ".birdy-hub-action-btn.birdy-focus { border-color: #ffffff; box-shadow: 0 0 18px rgba(255, 32, 40, 0.75); transform: scale(1.03); }"
        );
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {}

    // ---- Modal DOM & Focus Controller ---------------------------------------------------------
    var modalBackdrop = null;
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
        var badge = document.createElement("span");
        badge.className = "birdy-hub-badge";
        badge.textContent = window.__youtvBranding || "BirdyTV";
        var title = document.createElement("h2");
        title.className = "birdy-hub-title";
        title.textContent = t("hub.title");
        titleBox.appendChild(badge);
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

        var sidebar = document.createElement("div");
        sidebar.className = "birdy-hub-sidebar";
        body.appendChild(sidebar);

        var content = document.createElement("div");
        content.className = "birdy-hub-content";
        body.appendChild(content);

        modal.appendChild(body);
        modalBackdrop.appendChild(modal);
        document.body.appendChild(modalBackdrop);
    }

    function renderSidebar() {
        var sidebar = modalBackdrop.querySelector(".birdy-hub-sidebar");
        if (!sidebar) return;
        sidebar.textContent = "";

        TABS.forEach(function (tab, idx) {
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
                activeTabKey = tab.key;
                focusSidebarIndex = idx;
                focusArea = "sidebar";
                renderSidebar();
                renderContent();
                updateFocusUI();
            };
            sidebar.appendChild(el);
        });
    }

    function renderContent() {
        var content = modalBackdrop.querySelector(".birdy-hub-content");
        if (!content) return;
        content.textContent = "";

        var currentTab = null;
        for (var i = 0; i < TABS.length; i++) {
            if (TABS[i].key === activeTabKey) { currentTab = TABS[i]; break; }
        }
        if (currentTab) {
            var secHead = document.createElement("div");
            secHead.className = "birdy-hub-section-head";
            var secTitle = document.createElement("span");
            secTitle.className = "birdy-hub-section-title";
            secTitle.textContent = t(currentTab.labelKey);
            secHead.appendChild(secTitle);
            content.appendChild(secHead);
        }

        if (pendingRestart) {
            var banner = document.createElement("div");
            banner.className = "birdy-hub-restart-banner";
            var bannerText = document.createElement("span");
            bannerText.textContent = t("restart.message");
            banner.appendChild(bannerText);
            content.appendChild(banner);
        }

        if (activeTabKey === "sponsorblock") {
            content.appendChild(createToggleRow(
                t("feature.sponsorblock.name"),
                t("feature.sponsorblock.summary"),
                getBool("YOUTV_SPONSORBLOCK", true),
                function (val) {
                    setBool("YOUTV_SPONSORBLOCK", val);
                    renderContent();
                    updateFocusUI();
                }
            ));

            content.appendChild(createToggleRow(
                t("sponsor.prompt_all.title"),
                t("sponsor.prompt_all.summary"),
                getBool("YOUTV_SPONSORBLOCK_PROMPT_ALL", false),
                function (val) {
                    setBool("YOUTV_SPONSORBLOCK_PROMPT_ALL", val);
                    renderContent();
                    updateFocusUI();
                }
            ));

            CATEGORIES.forEach(function (cat) {
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

                modes.forEach(function (m, idx) {
                    var pill = document.createElement("button");
                    pill.className = "birdy-hub-pill" + (currentMode === m.id ? " selected" : "");
                    pill.textContent = m.text;
                    pill.setAttribute("data-mode", m.id);
                    pill.onclick = function () {
                        setSponsorMode(cat.key, m.id);
                        focusPillIndex = idx;
                        renderContent();
                        updateFocusUI();
                    };
                    pillGroup.appendChild(pill);
                });

                row.appendChild(left);
                row.appendChild(pillGroup);
                content.appendChild(row);
            });
        } else if (activeTabKey === "seekbar") {
            content.appendChild(createToggleRow(
                t("feature.sponsorblock_colors.name"),
                t("feature.sponsorblock_colors.summary"),
                getBool("YOUTV_SPONSORBLOCK_COLORS", true),
                function (val) {
                    setBool("YOUTV_SPONSORBLOCK_COLORS", val);
                    renderContent();
                    updateFocusUI();
                }
            ));

            CATEGORIES.forEach(function (cat) {
                var key = "YOUTV_SPONSORBLOCK_COLORS_" + cat.key.toUpperCase() + "_SEEKBAR";
                var def = cat.key === "sponsor" || cat.key === "selfpromo" || cat.key === "interaction";
                content.appendChild(createToggleRow(
                    t(cat.titleKey),
                    t("sponsor." + cat.key + ".seekbar.summary"),
                    getBool(key, def),
                    function (val) {
                        setBool(key, val);
                        renderContent();
                        updateFocusUI();
                    },
                    cat.color
                ));
            });
        } else if (activeTabKey === "ads") {
            content.appendChild(createToggleRow(
                t("feature.ads.name"),
                t("feature.ads.summary"),
                getBool("YOUTV_ADS", true),
                function (val) {
                    setBool("YOUTV_ADS", val);
                    renderContent();
                    updateFocusUI();
                }
            ));

            content.appendChild(createToggleRow(
                t("feature.premium-promos.name"),
                t("feature.premium-promos.summary"),
                getBool("YOUTV_PREMIUM_PROMOS", true),
                function (val) {
                    setBool("YOUTV_PREMIUM_PROMOS", val);
                    renderContent();
                    updateFocusUI();
                }
            ));
        } else if (activeTabKey === "player") {
            content.appendChild(createToggleRow(
                t("feature.player.name"),
                t("feature.player.summary"),
                getBool("YOUTV_PLAYER", true),
                function (val) {
                    setBool("YOUTV_PLAYER", val);
                    renderContent();
                    updateFocusUI();
                }
            ));

            PLAYER_BUTTONS.forEach(function (btn) {
                var key = "YOUTV_PLAYER_" + btn.key.toUpperCase();
                content.appendChild(createToggleRow(
                    t(btn.titleKey),
                    btn.summaryKey ? t(btn.summaryKey) : "",
                    getBool(key, false),
                    function (val) {
                        setBool(key, val);
                        renderContent();
                        updateFocusUI();
                    }
                ));
            });
        } else if (activeTabKey === "shorts") {
            content.appendChild(createToggleRow(
                t("feature.shorts.name"),
                t("feature.shorts.summary"),
                getBool("YOUTV_SHORTS", true),
                function (val) {
                    setBool("YOUTV_SHORTS", val);
                    pendingRestart = true;
                    renderContent();
                    updateFocusUI();
                }
            ));

            content.appendChild(createToggleRow(
                t("feature.topics.name"),
                t("feature.topics.summary"),
                getBool("YOUTV_TOPICS", false),
                function (val) {
                    setBool("YOUTV_TOPICS", val);
                    pendingRestart = true;
                    renderContent();
                    updateFocusUI();
                }
            ));
        } else if (activeTabKey === "ryd") {
            content.appendChild(createToggleRow(
                t("feature.ryd.name"),
                t("feature.ryd.summary"),
                getBool("YOUTV_RYD", true),
                function (val) {
                    setBool("YOUTV_RYD", val);
                    renderContent();
                    updateFocusUI();
                }
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
            content.appendChild(repoRow);
        }

        if (pendingRestart || activeTabKey === "about") {
            var restartBtn = document.createElement("button");
            restartBtn.className = "birdy-hub-action-btn birdy-interactive-row";
            restartBtn.textContent = t("hub.restart_app");
            restartBtn.onclick = function () {
                location.reload();
            };
            content.appendChild(restartBtn);
        }
    }

    function createToggleRow(titleText, summaryText, isEnabled, onToggle, dotColor) {
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

        var switchBtn = document.createElement("button");
        switchBtn.className = "birdy-hub-switch" + (isEnabled ? " on" : "");
        switchBtn.setAttribute("aria-label", isEnabled ? t("hub.enabled") : t("hub.disabled"));
        switchBtn.onclick = function () {
            onToggle(!isEnabled);
        };

        row.appendChild(left);
        row.appendChild(switchBtn);
        return row;
    }

    function syncPillIndexToSelected(row) {
        if (!row || row.getAttribute("data-type") !== "3way") {
            focusPillIndex = 0;
            return;
        }
        var pills = row.querySelectorAll(".birdy-hub-pill");
        for (var i = 0; i < pills.length; i++) {
            if (pills[i].classList.contains("selected")) {
                focusPillIndex = i;
                return;
            }
        }
        focusPillIndex = 0;
    }

    // ---- Focus & Navigation -------------------------------------------------------------------
    function updateFocusUI() {
        if (!modalBackdrop) return;
        var prevFocused = modalBackdrop.querySelectorAll(".birdy-focus");
        for (var i = 0; i < prevFocused.length; i++) {
            prevFocused[i].classList.remove("birdy-focus");
        }

        if (focusArea === "sidebar") {
            var tabs = modalBackdrop.querySelectorAll(".birdy-hub-tab");
            if (tabs[focusSidebarIndex]) {
                tabs[focusSidebarIndex].classList.add("birdy-focus");
                if (tabs[focusSidebarIndex].scrollIntoView) {
                    tabs[focusSidebarIndex].scrollIntoView({ block: "nearest" });
                }
            }
        } else {
            var rows = modalBackdrop.querySelectorAll(".birdy-interactive-row");
            if (focusContentIndex >= rows.length) focusContentIndex = Math.max(0, rows.length - 1);
            var targetRow = rows[focusContentIndex];
            if (!targetRow) return;

            var type = targetRow.getAttribute("data-type");
            if (type === "3way") {
                targetRow.classList.add("birdy-focus");
                var pills = targetRow.querySelectorAll(".birdy-hub-pill");
                if (pills[focusPillIndex]) {
                    pills[focusPillIndex].classList.add("birdy-focus");
                }
            } else if (type === "toggle") {
                targetRow.classList.add("birdy-focus");
                var switchBtn = targetRow.querySelector(".birdy-hub-switch");
                if (switchBtn) switchBtn.classList.add("birdy-focus");
            } else {
                targetRow.classList.add("birdy-focus");
            }
            if (targetRow.scrollIntoView) {
                targetRow.scrollIntoView({ block: "nearest" });
            }
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

        var rows = modalBackdrop.querySelectorAll(".birdy-interactive-row");

        if (focusArea === "sidebar") {
            if (code === 38) { // UP
                stopEvent(e);
                focusSidebarIndex = Math.max(0, focusSidebarIndex - 1);
                activeTabKey = TABS[focusSidebarIndex].key;
                renderSidebar();
                renderContent();
                updateFocusUI();
            } else if (code === 40) { // DOWN
                stopEvent(e);
                focusSidebarIndex = Math.min(TABS.length - 1, focusSidebarIndex + 1);
                activeTabKey = TABS[focusSidebarIndex].key;
                renderSidebar();
                renderContent();
                updateFocusUI();
            } else if (code === 39 || code === 13 || code === 23) { // RIGHT or OK
                stopEvent(e);
                if (rows.length > 0) {
                    focusArea = "content";
                    focusContentIndex = 0;
                    syncPillIndexToSelected(rows[0]);
                    updateFocusUI();
                }
            }
        } else {
            var curRow = rows[focusContentIndex];
            var type = curRow ? curRow.getAttribute("data-type") : null;

            if (code === 38) { // UP
                stopEvent(e);
                if (focusContentIndex > 0) {
                    focusContentIndex--;
                    syncPillIndexToSelected(rows[focusContentIndex]);
                    updateFocusUI();
                }
            } else if (code === 40) { // DOWN
                stopEvent(e);
                if (focusContentIndex < rows.length - 1) {
                    focusContentIndex++;
                    syncPillIndexToSelected(rows[focusContentIndex]);
                    updateFocusUI();
                }
            } else if (code === 37) { // LEFT
                stopEvent(e);
                if (type === "3way" && focusPillIndex > 0) {
                    focusPillIndex--;
                    updateFocusUI();
                } else {
                    focusArea = "sidebar";
                    updateFocusUI();
                }
            } else if (code === 39) { // RIGHT
                stopEvent(e);
                if (type === "3way") {
                    var pills = curRow.querySelectorAll(".birdy-hub-pill");
                    if (focusPillIndex < pills.length - 1) {
                        focusPillIndex++;
                        updateFocusUI();
                    }
                }
            } else if (code === 13 || code === 23) { // OK / ENTER
                stopEvent(e);
                if (type === "3way") {
                    var pillsList = curRow.querySelectorAll(".birdy-hub-pill");
                    if (pillsList[focusPillIndex]) pillsList[focusPillIndex].click();
                } else if (type === "toggle") {
                    var swBtn = curRow.querySelector(".birdy-hub-switch");
                    if (swBtn) swBtn.click();
                } else if (curRow) {
                    curRow.click();
                }
            }
        }
    }

    function isHubOpen() {
        return !!(modalBackdrop && modalBackdrop.className.indexOf("show") !== -1);
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
        renderSidebar();
        renderContent();
        focusArea = "sidebar";
        updateFocusUI();

        modalBackdrop.className = "birdy-hub-backdrop show";
        window.removeEventListener("keydown", onKeyDown, true);
        window.addEventListener("keydown", onKeyDown, true);
        youtv.report("settings-hub: opened");
    }

    function closeHub() {
        if (!modalBackdrop) return;
        modalBackdrop.className = "birdy-hub-backdrop";
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

    // Global shortcuts: F2 opens hub; OK/Enter on the native "Open BirdyTV Settings" item opens hub
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

    // Pointer / click on the native settings entry for BirdyTV Settings
    document.addEventListener("click", function (e) {
        if (isHubOpen()) return;
        if (matchesHubEntry(e.target)) {
            stopEvent(e);
            openHub();
        }
    }, true);
})();
