// BirdyTV Settings Hub: TizenTube Cobalt-style right-side drawer settings menu.
// Single-column drill-down navigation matching TizenTube's TV overlay UI,
// using YouTube TV's dark surface palette, solid white focus cards, TrustedHTML-safe DOM,
// and direct scrollTop scrolling optimized for Android TV Cobalt.
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
        ads: [
            ["circle", { cx: "12", cy: "12", r: "10" }],
            ["path", { d: "m4.9 4.9 14.2 14.2" }]
        ],
        premium: [
            ["polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }]
        ],
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
        ],
        chevron: [
            ["polyline", { points: "9 18 15 12 9 6" }]
        ],
        back: [
            ["polyline", { points: "15 18 9 12 15 6" }]
        ],
        restart: [
            ["path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }],
            ["polyline", { points: "21 3 21 8 16 8" }]
        ],
        check: [
            ["polyline", { points: "20 6 9 17 4 12" }]
        ]
    };

    function createSvgIcon(shapes, strokeWidth) {
        var svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", strokeWidth || "2");
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

    // ---- Styles (Exact TizenTube Right-Side Drawer + YouTube TV Dark Palette) ------------------
    var sheet = new CSSStyleSheet();
    try {
        sheet.replaceSync(
            ".birdy-tt-backdrop {" +
            " position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 2147483647;" +
            " background: rgba(0, 0, 0, 0.52);" +
            " display: none; justify-content: flex-end; align-items: stretch;" +
            " font-family: 'YouTube Sans', Roboto, Arial, sans-serif; }" +
            ".birdy-tt-backdrop.show { display: flex; }" +
            ".birdy-tt-drawer {" +
            " width: 470px; max-width: 92vw; margin: 1.35rem 1.35rem 1.35rem 0;" +
            " background: #1e2024; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 18px;" +
            " display: flex; flex-direction: column; overflow: hidden; color: #f1f1f1; }" +
            ".birdy-tt-header {" +
            " padding: 1.35rem 1.45rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08);" +
            " flex-shrink: 0; display: flex; flex-direction: column; gap: 0.25rem; }" +
            ".birdy-tt-title-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }" +
            ".birdy-tt-title { font-size: 1.42rem; font-weight: 700; margin: 0; color: #ffffff; }" +
            ".birdy-tt-sub { font-size: 0.92rem; color: rgba(255, 255, 255, 0.65); margin: 0; }" +
            ".birdy-tt-restart-banner {" +
            " margin: 0.75rem 1.1rem 0; padding: 0.65rem 0.95rem; border-radius: 10px;" +
            " background: rgba(62, 166, 255, 0.14); border: 1px solid rgba(62, 166, 255, 0.45);" +
            " color: #7cc4ff; font-size: 0.9rem; font-weight: 600; flex-shrink: 0; }" +
            ".birdy-tt-list {" +
            " position: relative; flex: 1; min-height: 0; overflow-y: auto;" +
            " padding: 0.95rem 1.1rem 1.5rem; display: flex; flex-direction: column; gap: 0.55rem; }" +
            ".birdy-tt-item {" +
            " display: flex; align-items: center; justify-content: space-between; gap: 0.85rem;" +
            " padding: 0.92rem 1.05rem; border-radius: 10px; flex-shrink: 0; cursor: pointer;" +
            " background: rgba(255, 255, 255, 0.08); border: 1.5px solid rgba(255, 255, 255, 0.06);" +
            " color: #f1f1f1; }" +
            ".birdy-tt-item.birdy-focus {" +
            " background: #ffffff; border-color: #ffffff; color: #0f0f0f; }" +
            ".birdy-tt-item-left { display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 0; }" +
            ".birdy-tt-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: inherit; }" +
            ".birdy-tt-icon svg { width: 20px; height: 20px; }" +
            ".birdy-tt-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }" +
            ".birdy-tt-text { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }" +
            ".birdy-tt-label { font-size: 1.04rem; font-weight: 600; color: inherit; }" +
            ".birdy-tt-desc { font-size: 0.84rem; color: rgba(255, 255, 255, 0.62); line-height: 1.25; }" +
            ".birdy-tt-item.birdy-focus .birdy-tt-desc { color: rgba(15, 15, 15, 0.72); }" +
            ".birdy-tt-right { display: flex; align-items: center; flex-shrink: 0; }" +
            ".birdy-tt-chevron { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; opacity: 0.85; }" +
            ".birdy-tt-chevron svg { width: 18px; height: 18px; }" +
            ".birdy-tt-check {" +
            " width: 22px; height: 22px; border-radius: 5px; box-sizing: border-box;" +
            " border: 2px solid rgba(255, 255, 255, 0.7); background: transparent;" +
            " display: flex; align-items: center; justify-content: center; color: #0f0f0f; }" +
            ".birdy-tt-check.on { background: #ffffff; border-color: #ffffff; color: #0f0f0f; }" +
            ".birdy-tt-item.birdy-focus .birdy-tt-check { border-color: #0f0f0f; color: #ffffff; }" +
            ".birdy-tt-item.birdy-focus .birdy-tt-check.on { background: #0f0f0f; border-color: #0f0f0f; color: #ffffff; }" +
            ".birdy-tt-check svg { width: 15px; height: 15px; display: none; }" +
            ".birdy-tt-check.on svg { display: block; }" +
            ".birdy-tt-mode {" +
            " padding: 0.28rem 0.68rem; border-radius: 9999px; font-size: 0.84rem; font-weight: 700;" +
            " background: rgba(255, 255, 255, 0.14); color: #ffffff; white-space: nowrap; }" +
            ".birdy-tt-mode.skip { background: #3ea6ff; color: #0f0f0f; }" +
            ".birdy-tt-mode.prompt { background: #ffd600; color: #0f0f0f; }" +
            ".birdy-tt-mode.off { background: rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.6); }" +
            ".birdy-tt-item.birdy-focus .birdy-tt-mode.off { background: rgba(15, 15, 15, 0.14); color: #0f0f0f; }" +
            ".birdy-tt-footer {" +
            " padding: 0.65rem 1.2rem; border-top: 1px solid rgba(255, 255, 255, 0.08);" +
            " font-size: 0.82rem; color: rgba(255, 255, 255, 0.55); flex-shrink: 0; text-align: center; }"
        );
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {}

    // ---- Drawer State & Navigation ------------------------------------------------------------
    var backdropEl = null;
    var titleEl = null;
    var subEl = null;
    var listEl = null;
    var bannerEl = null;

    var currentView = "root";
    var focusIndex = 0;
    var rootFocusIndex = 0;
    var currentItems = [];
    var prevFocusedEl = null;
    var pendingRestart = false;

    function brandName() {
        return window.__youtvBranding || "BirdyTV";
    }

    function createDrawer() {
        if (backdropEl) return;
        backdropEl = document.createElement("div");
        backdropEl.className = "birdy-tt-backdrop";
        backdropEl.onclick = function (e) {
            if (e.target === backdropEl) closeHub();
        };

        var drawer = document.createElement("div");
        drawer.className = "birdy-tt-drawer";

        var header = document.createElement("div");
        header.className = "birdy-tt-header";
        var titleRow = document.createElement("div");
        titleRow.className = "birdy-tt-title-row";
        titleEl = document.createElement("h2");
        titleEl.className = "birdy-tt-title";
        titleRow.appendChild(titleEl);
        subEl = document.createElement("p");
        subEl.className = "birdy-tt-sub";
        header.appendChild(titleRow);
        header.appendChild(subEl);

        bannerEl = document.createElement("div");
        bannerEl.className = "birdy-tt-restart-banner";
        bannerEl.style.display = "none";
        bannerEl.textContent = t("restart.message");

        listEl = document.createElement("div");
        listEl.className = "birdy-tt-list";

        var footer = document.createElement("div");
        footer.className = "birdy-tt-footer";
        footer.textContent = t("hub.nav.hint");

        drawer.appendChild(header);
        drawer.appendChild(bannerEl);
        drawer.appendChild(listEl);
        drawer.appendChild(footer);
        backdropEl.appendChild(drawer);
        document.body.appendChild(backdropEl);
    }

    function updateBanner() {
        if (!bannerEl) return;
        bannerEl.style.display = pendingRestart ? "block" : "none";
    }

    function buildItemBase(opts) {
        var row = document.createElement("div");
        row.className = "birdy-tt-item";

        var left = document.createElement("div");
        left.className = "birdy-tt-item-left";

        if (opts.icon) {
            var iconWrap = document.createElement("span");
            iconWrap.className = "birdy-tt-icon";
            iconWrap.appendChild(createSvgIcon(opts.icon));
            left.appendChild(iconWrap);
        } else if (opts.dotColor) {
            var dot = document.createElement("span");
            dot.className = "birdy-tt-dot";
            dot.style.backgroundColor = opts.dotColor;
            left.appendChild(dot);
        }

        var textWrap = document.createElement("div");
        textWrap.className = "birdy-tt-text";
        var label = document.createElement("span");
        label.className = "birdy-tt-label";
        label.textContent = opts.label;
        textWrap.appendChild(label);

        if (opts.summary) {
            var desc = document.createElement("span");
            desc.className = "birdy-tt-desc";
            desc.textContent = opts.summary;
            textWrap.appendChild(desc);
        }

        left.appendChild(textWrap);
        row.appendChild(left);

        var right = document.createElement("div");
        right.className = "birdy-tt-right";
        row.appendChild(right);

        return { row: row, right: right };
    }

    function createSubmenuItem(label, icon, targetView) {
        var parts = buildItemBase({ label: label, icon: icon });
        var chev = document.createElement("span");
        chev.className = "birdy-tt-chevron";
        chev.appendChild(createSvgIcon(ICONS.chevron, "2.5"));
        parts.right.appendChild(chev);

        parts.row._activate = function () {
            rootFocusIndex = focusIndex;
            openView(targetView, 0);
        };
        return parts.row;
    }

    function createBackItem() {
        var parts = buildItemBase({ label: t("common.close") === "Close" ? "Back" : "←", icon: ICONS.back });
        parts.row._activate = function () {
            openView("root", rootFocusIndex);
        };
        return parts.row;
    }

    function createToggleItem(label, summary, storageKey, defaultVal, needsRestart, icon, dotColor) {
        var enabled = getBool(storageKey, defaultVal);
        var parts = buildItemBase({ label: label, summary: summary, icon: icon, dotColor: dotColor });

        var box = document.createElement("span");
        box.className = "birdy-tt-check" + (enabled ? " on" : "");
        box.appendChild(createSvgIcon(ICONS.check, "3"));
        parts.right.appendChild(box);

        parts.row._activate = function () {
            enabled = !enabled;
            setBool(storageKey, enabled);
            box.classList.toggle("on", enabled);
            if (needsRestart) {
                pendingRestart = true;
                updateBanner();
            }
        };
        return parts.row;
    }

    var MODE_ORDER = ["skip", "prompt", "off"];
    function modeText(mode) {
        if (mode === "skip") return t("hub.action.skip");
        if (mode === "prompt") return t("hub.action.prompt");
        return t("hub.action.off");
    }

    function createThreeWayItem(cat) {
        var mode = getSponsorMode(cat.key);
        var parts = buildItemBase({ label: t(cat.titleKey), dotColor: cat.color });

        var badge = document.createElement("span");
        badge.className = "birdy-tt-mode " + mode;
        badge.textContent = modeText(mode);
        parts.right.appendChild(badge);

        function applyMode(nextMode) {
            mode = nextMode;
            setSponsorMode(cat.key, mode);
            badge.className = "birdy-tt-mode " + mode;
            badge.textContent = modeText(mode);
        }

        parts.row._activate = function () {
            var idx = MODE_ORDER.indexOf(mode);
            applyMode(MODE_ORDER[(idx + 1) % MODE_ORDER.length]);
        };
        parts.row._step = function (delta) {
            var idx = MODE_ORDER.indexOf(mode);
            applyMode(MODE_ORDER[(idx + delta + MODE_ORDER.length) % MODE_ORDER.length]);
        };
        return parts.row;
    }

    function createActionItem(label, summary, icon, onActivate) {
        var parts = buildItemBase({ label: label, summary: summary, icon: icon });
        var chev = document.createElement("span");
        chev.className = "birdy-tt-chevron";
        chev.appendChild(createSvgIcon(ICONS.chevron, "2.5"));
        parts.right.appendChild(chev);
        parts.row._activate = onActivate;
        return parts.row;
    }

    function openView(viewName, nextFocusIdx) {
        currentView = viewName;
        focusIndex = nextFocusIdx || 0;
        renderView();
        updateFocusUI();
    }

    function renderView() {
        if (!listEl) return;
        listEl.textContent = "";
        listEl.scrollTop = 0;
        currentItems = [];
        prevFocusedEl = null;

        var ver = window.__farotvVersion ? "v" + window.__farotvVersion : "";
        var frag = document.createDocumentFragment();

        function push(el) {
            el.onclick = (function (item, idx) {
                return function () {
                    focusIndex = idx;
                    updateFocusUI();
                    if (item._activate) item._activate();
                };
            })(el, currentItems.length);
            frag.appendChild(el);
            currentItems.push(el);
        }

        if (currentView === "root") {
            titleEl.textContent = brandName() + " Settings";
            subEl.textContent = "Made by SEIFELDEEN15" + (ver ? " • " + ver : "");

            push(createToggleItem(t("feature.ads.name"), "", "YOUTV_ADS", true, false, ICONS.ads));
            push(createToggleItem(t("feature.premium-promos.name"), "", "YOUTV_PREMIUM_PROMOS", true, false, ICONS.premium));
            push(createSubmenuItem(t("hub.tab.sponsorblock"), ICONS.sponsorblock, "sponsorblock"));
            push(createSubmenuItem(t("hub.tab.seekbar"), ICONS.seekbar, "seekbar"));
            push(createSubmenuItem(t("hub.tab.player"), ICONS.player, "player"));
            push(createSubmenuItem(t("hub.tab.shorts"), ICONS.shorts, "shorts"));
            push(createToggleItem(t("hub.tab.ryd"), "", "YOUTV_RYD", true, false, ICONS.ryd));
            push(createSubmenuItem(t("hub.tab.about"), ICONS.about, "about"));
            if (pendingRestart) {
                push(createActionItem(t("hub.restart_app"), "", ICONS.restart, function () { location.reload(); }));
            }
        } else if (currentView === "sponsorblock") {
            titleEl.textContent = t("hub.tab.sponsorblock");
            subEl.textContent = t("feature.sponsorblock.summary");
            push(createBackItem());
            push(createToggleItem(t("feature.sponsorblock.name"), "", "YOUTV_SPONSORBLOCK", true, false, ICONS.sponsorblock));
            push(createToggleItem(t("sponsor.prompt_all.title"), t("sponsor.prompt_all.summary"), "YOUTV_SPONSORBLOCK_PROMPT_ALL", false, false));
            for (var i = 0; i < CATEGORIES.length; i++) {
                push(createThreeWayItem(CATEGORIES[i]));
            }
        } else if (currentView === "seekbar") {
            titleEl.textContent = t("hub.tab.seekbar");
            subEl.textContent = t("feature.sponsorblock_colors.summary");
            push(createBackItem());
            push(createToggleItem(t("feature.sponsorblock_colors.name"), "", "YOUTV_SPONSORBLOCK_COLORS", true, false, ICONS.seekbar));
            for (var j = 0; j < CATEGORIES.length; j++) {
                var cat = CATEGORIES[j];
                var key = "YOUTV_SPONSORBLOCK_COLORS_" + cat.key.toUpperCase() + "_SEEKBAR";
                var def = cat.key === "sponsor" || cat.key === "selfpromo" || cat.key === "interaction";
                push(createToggleItem(t(cat.titleKey), "", key, def, false, null, cat.color));
            }
        } else if (currentView === "player") {
            titleEl.textContent = t("hub.tab.player");
            subEl.textContent = t("feature.player.summary");
            push(createBackItem());
            push(createToggleItem(t("feature.player.name"), "", "YOUTV_PLAYER", true, false, ICONS.player));
            for (var k = 0; k < PLAYER_BUTTONS.length; k++) {
                var btn = PLAYER_BUTTONS[k];
                push(createToggleItem(
                    t(btn.titleKey),
                    btn.summaryKey ? t(btn.summaryKey) : "",
                    "YOUTV_PLAYER_" + btn.key.toUpperCase(),
                    false,
                    false
                ));
            }
        } else if (currentView === "shorts") {
            titleEl.textContent = t("hub.tab.shorts");
            subEl.textContent = t("restart.title");
            push(createBackItem());
            push(createToggleItem(t("feature.shorts.name"), t("feature.shorts.summary"), "YOUTV_SHORTS", true, true, ICONS.shorts));
            push(createToggleItem(t("feature.topics.name"), t("feature.topics.summary"), "YOUTV_TOPICS", false, true, ICONS.shorts));
            push(createActionItem(t("hub.restart_app"), "", ICONS.restart, function () { location.reload(); }));
        } else if (currentView === "about") {
            titleEl.textContent = t("hub.tab.about");
            subEl.textContent = "SEIFELDEEN15/Birdy-Patches";
            push(createBackItem());
            var ytVer = window.__youtubeVersion ? "YouTube TV " + window.__youtubeVersion : "Android TV Cobalt";
            push(createActionItem(brandName() + (ver ? " " + ver : ""), ytVer, ICONS.about, function () {}));
            push(createActionItem(t("hub.restart_app"), "", ICONS.restart, function () { location.reload(); }));
        }

        listEl.appendChild(frag);
        updateBanner();
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
        var pad = 16;
        if (eRect.top - pad < cRect.top) {
            container.scrollTop -= (cRect.top - (eRect.top - pad));
        } else if (eRect.bottom + pad > cRect.bottom) {
            container.scrollTop += ((eRect.bottom + pad) - cRect.bottom);
        }
    }

    function updateFocusUI() {
        if (!backdropEl || !currentItems.length) return;
        if (prevFocusedEl) prevFocusedEl.classList.remove("birdy-focus");
        if (focusIndex >= currentItems.length) focusIndex = currentItems.length - 1;
        if (focusIndex < 0) focusIndex = 0;
        var target = currentItems[focusIndex];
        if (!target) return;
        target.classList.add("birdy-focus");
        prevFocusedEl = target;
        ensureVisible(listEl, target, focusIndex === 0);
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
            if (currentView !== "root") {
                openView("root", rootFocusIndex);
            } else {
                closeHub();
            }
            return;
        }

        var cur = currentItems[focusIndex];

        if (code === 38) { // UP
            stopEvent(e);
            if (focusIndex > 0) {
                focusIndex--;
                updateFocusUI();
            }
        } else if (code === 40) { // DOWN
            stopEvent(e);
            if (focusIndex < currentItems.length - 1) {
                focusIndex++;
                updateFocusUI();
            }
        } else if (code === 37) { // LEFT
            stopEvent(e);
            if (cur && cur._step) {
                cur._step(-1);
            } else if (currentView !== "root") {
                openView("root", rootFocusIndex);
            }
        } else if (code === 39) { // RIGHT
            stopEvent(e);
            if (cur && cur._step) {
                cur._step(1);
            } else if (cur && cur._activate && currentView === "root") {
                cur._activate();
            }
        } else if (code === 13 || code === 23) { // OK / ENTER
            stopEvent(e);
            if (cur && cur._activate) cur._activate();
        }
    }

    function isHubOpen() {
        return !!(backdropEl && backdropEl.classList.contains("show"));
    }

    function openHub(initialView) {
        createDrawer();
        backdropEl.classList.add("show");
        rootFocusIndex = 0;
        openView(initialView || "root", 0);
        window.removeEventListener("keydown", onKeyDown, true);
        window.addEventListener("keydown", onKeyDown, true);
        youtv.report("settings-hub: opened");
    }

    function closeHub() {
        if (!backdropEl) return;
        backdropEl.classList.remove("show");
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
