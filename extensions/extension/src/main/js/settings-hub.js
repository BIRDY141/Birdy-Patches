// BirdyTV Settings Hub: 1:1 copy of YouTube TV's native Settings screen UI.
// Left column: uppercase section headers + scrollable list of settings separated by a thin
// vertical divider. Right pane: centered illustration, bold title, summary, and pill buttons.
// TrustedHTML-safe DOM (zero innerHTML), direct scrollTop scrolling, and low-CPU optimizations.
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

    // ---- SVG Illustrations (YouTube TV Settings style, built via createElementNS) -------------
    var SVG_NS = "http://www.w3.org/2000/svg";
    var ART = {
        sponsorblock: [
            ["path", { d: "M22 76 H122", stroke: "#3FD3FF", "stroke-width": "6", "stroke-linecap": "round" }],
            ["path", { d: "M54 76 H90", stroke: "#FF4E45", "stroke-width": "10", "stroke-linecap": "round" }],
            ["path", { d: "M42 54 C54 20 90 20 102 54", stroke: "#FFE27A", "stroke-width": "5", fill: "none", "stroke-linecap": "round" }],
            ["path", { d: "M94 48 L102 56 L110 46", stroke: "#FFE27A", "stroke-width": "5", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }],
            ["circle", { cx: "42", cy: "76", r: "7", fill: "#19E3B1" }],
            ["circle", { cx: "102", cy: "76", r: "7", fill: "#19E3B1" }]
        ],
        ads: [
            ["rect", { x: "30", y: "24", width: "84", height: "58", rx: "12", fill: "#0598C9" }],
            ["path", { d: "M28 20 L116 88", stroke: "#FF4E45", "stroke-width": "9", "stroke-linecap": "round" }],
            ["path", { d: "M28 20 L44 32", stroke: "#FFE27A", "stroke-width": "9", "stroke-linecap": "round" }],
            ["circle", { cx: "122", cy: "22", r: "4", fill: "#3FD3FF" }]
        ],
        player: [
            ["rect", { x: "24", y: "18", width: "96", height: "60", rx: "10", fill: "#0598C9" }],
            ["polygon", { points: "64 34 84 48 64 62", fill: "#FFE27A" }],
            ["path", { d: "M30 90 H114 M30 100 H114", stroke: "#3FD3FF", "stroke-width": "4", "stroke-linecap": "round" }],
            ["circle", { cx: "56", cy: "90", r: "6", fill: "#19E3B1" }],
            ["circle", { cx: "92", cy: "100", r: "6", fill: "#FF4E45" }]
        ],
        shorts: [
            ["rect", { x: "50", y: "14", width: "44", height: "78", rx: "10", fill: "#0598C9" }],
            ["polygon", { points: "66 41 82 53 66 65", fill: "#FFE27A" }],
            ["path", { d: "M36 22 L108 86", stroke: "#FF4E45", "stroke-width": "9", "stroke-linecap": "round" }]
        ],
        ryd: [
            ["rect", { x: "26", y: "24", width: "16", height: "48", rx: "4", fill: "#3FD3FF" }],
            ["path", { d: "M48 24 H86 C94 24 98 28 99 34 L104 60 C105 66 101 70 95 70 H76 L80 86 C81 92 77 96 72 94 L54 70 H48 Z", fill: "#0598C9" }],
            ["rect", { x: "96", y: "76", width: "32", height: "18", rx: "9", fill: "#FFE27A" }]
        ],
        about: [
            ["rect", { x: "30", y: "20", width: "84", height: "64", rx: "16", fill: "#FF2028" }],
            ["polygon", { points: "62 38 88 52 62 66", fill: "#FFFFFF" }],
            ["circle", { cx: "120", cy: "22", r: "4", fill: "#3FD3FF" }]
        ]
    };

    function createArtSvg(artKey, dotColor) {
        var svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 144 108");
        var shapes = ART[artKey] || ART.about;
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
        if (dotColor) {
            var badge = document.createElementNS(SVG_NS, "circle");
            badge.setAttribute("cx", "118");
            badge.setAttribute("cy", "26");
            badge.setAttribute("r", "10");
            badge.setAttribute("fill", dotColor);
            svg.appendChild(badge);
        }
        return svg;
    }

    // ---- Styles (Exact YouTube TV Settings Screenshot Copy) -----------------------------------
    var sheet = new CSSStyleSheet();
    try {
        sheet.replaceSync(
            ".birdy-yt-screen {" +
            " position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 2147483647;" +
            " background: #0f1014; color: #f1f1f1; display: none; flex-direction: column;" +
            " font-family: 'YouTube Sans', Roboto, Arial, sans-serif; }" +
            ".birdy-yt-screen.show { display: flex; }" +
            ".birdy-yt-topbar {" +
            " display: flex; align-items: center; justify-content: space-between;" +
            " padding: 2.2rem 3.5rem 1.2rem; flex-shrink: 0; }" +
            ".birdy-yt-page-title { font-size: 2.3rem; font-weight: 700; margin: 0; color: #ffffff; letter-spacing: -0.01em; }" +
            ".birdy-yt-hint { font-size: 0.96rem; color: rgba(255, 255, 255, 0.55); font-weight: 500; }" +
            ".birdy-yt-body { display: flex; flex: 1; min-height: 0; padding: 0 3.5rem 2.2rem; overflow: hidden; }" +
            ".birdy-yt-left {" +
            " position: relative; width: 350px; flex-shrink: 0; min-height: 0; overflow-y: auto;" +
            " border-right: 1px solid rgba(255, 255, 255, 0.22); padding: 0.25rem 1.6rem 2.5rem 0;" +
            " display: flex; flex-direction: column; gap: 0.2rem; }" +
            ".birdy-yt-sec {" +
            " font-size: 0.82rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;" +
            " color: rgba(255, 255, 255, 0.52); padding: 1.15rem 1rem 0.35rem; flex-shrink: 0; }" +
            ".birdy-yt-sec:first-child { padding-top: 0.25rem; }" +
            ".birdy-yt-nav-item {" +
            " display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;" +
            " padding: 0.78rem 1rem; border-radius: 10px; font-size: 1.1rem; font-weight: 500;" +
            " color: #e5e5e5; cursor: pointer; flex-shrink: 0; }" +
            ".birdy-yt-nav-item.selected { background: rgba(255, 255, 255, 0.14); color: #ffffff; font-weight: 600; }" +
            ".birdy-yt-nav-item.birdy-focus { background: #f1f1f1; color: #0f0f0f; font-weight: 700; }" +
            ".birdy-yt-nav-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }" +
            ".birdy-yt-nav-val { font-size: 0.84rem; font-weight: 600; color: rgba(255, 255, 255, 0.55); flex-shrink: 0; }" +
            ".birdy-yt-nav-item.birdy-focus .birdy-yt-nav-val { color: rgba(15, 15, 15, 0.7); }" +
            ".birdy-yt-right {" +
            " flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center;" +
            " justify-content: center; text-align: center; padding: 2rem 4rem; gap: 1.15rem; }" +
            ".birdy-yt-art { width: 150px; height: 112px; display: flex; align-items: center; justify-content: center; }" +
            ".birdy-yt-art svg { width: 100%; height: 100%; }" +
            ".birdy-yt-detail-title { font-size: 2rem; font-weight: 700; margin: 0; color: #ffffff; max-width: 680px; }" +
            ".birdy-yt-detail-summary { font-size: 1.08rem; color: rgba(255, 255, 255, 0.72); line-height: 1.45; max-width: 620px; margin: 0; }" +
            ".birdy-yt-restart-note {" +
            " padding: 0.55rem 1.1rem; border-radius: 8px; background: rgba(62, 166, 255, 0.14);" +
            " border: 1px solid rgba(62, 166, 255, 0.4); color: #7cc4ff; font-size: 0.94rem; font-weight: 600; }" +
            ".birdy-yt-btn-group { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.9rem; margin-top: 0.85rem; }" +
            ".birdy-yt-pill-btn {" +
            " min-width: 220px; padding: 1rem 2.2rem; border-radius: 9999px; border: 2px solid transparent;" +
            " font-size: 1.12rem; font-weight: 600; cursor: pointer; outline: none;" +
            " background: rgba(255, 255, 255, 0.14); color: #f1f1f1; }" +
            ".birdy-yt-pill-btn.active { border-color: rgba(255, 255, 255, 0.45); }" +
            ".birdy-yt-pill-btn.birdy-focus { background: #ffffff; color: #0f0f0f; border-color: #ffffff; font-weight: 700; }"
        );
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {}

    // ---- Menu Items Model ---------------------------------------------------------------------
    function buildEntries() {
        var entries = [];

        entries.push({ section: t("hub.tab.ads") });
        entries.push({
            type: "toggle", art: "ads",
            title: t("feature.ads.name"), summary: t("feature.ads.summary"),
            key: "YOUTV_ADS", def: true
        });
        entries.push({
            type: "toggle", art: "ads",
            title: t("feature.premium-promos.name"), summary: t("feature.premium-promos.summary"),
            key: "YOUTV_PREMIUM_PROMOS", def: true
        });

        entries.push({ section: t("hub.tab.shorts") });
        entries.push({
            type: "toggle", art: "shorts", restart: true,
            title: t("feature.shorts.name"), summary: t("feature.shorts.summary"),
            key: "YOUTV_SHORTS", def: true
        });
        entries.push({
            type: "toggle", art: "shorts", restart: true,
            title: t("feature.topics.name"), summary: t("feature.topics.summary"),
            key: "YOUTV_TOPICS", def: false
        });
        entries.push({
            type: "toggle", art: "ryd",
            title: t("feature.ryd.name"), summary: t("feature.ryd.summary"),
            key: "YOUTV_RYD", def: true
        });

        entries.push({ section: t("hub.tab.sponsorblock") });
        entries.push({
            type: "toggle", art: "sponsorblock",
            title: t("feature.sponsorblock.name"), summary: t("feature.sponsorblock.summary"),
            key: "YOUTV_SPONSORBLOCK", def: true
        });
        entries.push({
            type: "toggle", art: "sponsorblock",
            title: t("sponsor.prompt_all.title"), summary: t("sponsor.prompt_all.summary"),
            key: "YOUTV_SPONSORBLOCK_PROMPT_ALL", def: false
        });
        for (var i = 0; i < CATEGORIES.length; i++) {
            entries.push({
                type: "3way", art: "sponsorblock",
                cat: CATEGORIES[i],
                title: t(CATEGORIES[i].titleKey),
                summary: t("feature.sponsorblock.summary")
            });
        }

        entries.push({ section: t("hub.tab.seekbar") });
        entries.push({
            type: "toggle", art: "sponsorblock",
            title: t("feature.sponsorblock_colors.name"), summary: t("feature.sponsorblock_colors.summary"),
            key: "YOUTV_SPONSORBLOCK_COLORS", def: true
        });
        for (var j = 0; j < CATEGORIES.length; j++) {
            var c = CATEGORIES[j];
            entries.push({
                type: "toggle", art: "sponsorblock", dotColor: c.color,
                title: t(c.titleKey),
                summary: t("sponsor." + c.key + ".seekbar.summary"),
                key: "YOUTV_SPONSORBLOCK_COLORS_" + c.key.toUpperCase() + "_SEEKBAR",
                def: c.key === "sponsor" || c.key === "selfpromo" || c.key === "interaction"
            });
        }

        entries.push({ section: t("hub.tab.player") });
        entries.push({
            type: "toggle", art: "player",
            title: t("feature.player.name"), summary: t("feature.player.summary"),
            key: "YOUTV_PLAYER", def: true
        });
        for (var k = 0; k < PLAYER_BUTTONS.length; k++) {
            var b = PLAYER_BUTTONS[k];
            entries.push({
                type: "toggle", art: "player",
                title: t(b.titleKey),
                summary: b.summaryKey ? t(b.summaryKey) : t("feature.player.summary"),
                key: "YOUTV_PLAYER_" + b.key.toUpperCase(),
                def: false
            });
        }

        entries.push({ section: t("hub.tab.about") });
        var ver = window.__farotvVersion ? "v" + window.__farotvVersion : "";
        var ytVer = window.__youtubeVersion ? "YouTube TV " + window.__youtubeVersion : "Android TV Cobalt";
        entries.push({
            type: "action", art: "about",
            title: (window.__youtvBranding || "BirdyTV") + (ver ? " " + ver : ""),
            summary: "BIRDY141/Birdy-Patches • " + ytVer,
            buttonText: t("hub.restart_app"),
            onAction: function () { location.reload(); }
        });

        return entries;
    }

    // ---- DOM & Focus State --------------------------------------------------------------------
    var screenEl = null;
    var leftEl = null;
    var artEl = null;
    var detailTitleEl = null;
    var detailSummaryEl = null;
    var restartNoteEl = null;
    var btnGroupEl = null;

    var navItems = []; // { entry, el, valEl }
    var rightButtons = [];
    var focusArea = "left"; // "left" or "right"
    var focusLeftIndex = 0;
    var focusRightIndex = 0;
    var prevFocusEl = null;
    var prevSelectedEl = null;
    var pendingRestart = false;

    function modeShortText(mode) {
        if (mode === "skip") return t("hub.action.skip");
        if (mode === "prompt") return t("hub.action.prompt");
        return t("hub.action.off");
    }

    function entryStatusText(entry) {
        if (entry.type === "toggle") {
            return getBool(entry.key, entry.def) ? t("hub.enabled") : t("hub.disabled");
        }
        if (entry.type === "3way") {
            return modeShortText(getSponsorMode(entry.cat.key));
        }
        return "";
    }

    function createScreen() {
        if (screenEl) return;
        screenEl = document.createElement("div");
        screenEl.className = "birdy-yt-screen";

        var topbar = document.createElement("div");
        topbar.className = "birdy-yt-topbar";
        var pageTitle = document.createElement("h1");
        pageTitle.className = "birdy-yt-page-title";
        pageTitle.textContent = t("hub.title");
        var hint = document.createElement("span");
        hint.className = "birdy-yt-hint";
        hint.textContent = t("hub.nav.hint");
        topbar.appendChild(pageTitle);
        topbar.appendChild(hint);

        var body = document.createElement("div");
        body.className = "birdy-yt-body";

        leftEl = document.createElement("div");
        leftEl.className = "birdy-yt-left";
        buildLeftList();

        var rightEl = document.createElement("div");
        rightEl.className = "birdy-yt-right";

        artEl = document.createElement("div");
        artEl.className = "birdy-yt-art";
        detailTitleEl = document.createElement("h2");
        detailTitleEl.className = "birdy-yt-detail-title";
        detailSummaryEl = document.createElement("p");
        detailSummaryEl.className = "birdy-yt-detail-summary";
        restartNoteEl = document.createElement("div");
        restartNoteEl.className = "birdy-yt-restart-note";
        restartNoteEl.style.display = "none";
        restartNoteEl.textContent = t("restart.message");
        btnGroupEl = document.createElement("div");
        btnGroupEl.className = "birdy-yt-btn-group";

        rightEl.appendChild(artEl);
        rightEl.appendChild(detailTitleEl);
        rightEl.appendChild(detailSummaryEl);
        rightEl.appendChild(restartNoteEl);
        rightEl.appendChild(btnGroupEl);

        body.appendChild(leftEl);
        body.appendChild(rightEl);
        screenEl.appendChild(topbar);
        screenEl.appendChild(body);
        document.body.appendChild(screenEl);
    }

    function buildLeftList() {
        leftEl.textContent = "";
        navItems = [];
        var entries = buildEntries();
        var frag = document.createDocumentFragment();

        for (var i = 0; i < entries.length; i++) {
            var item = entries[i];
            if (item.section) {
                var sec = document.createElement("div");
                sec.className = "birdy-yt-sec";
                sec.textContent = item.section;
                frag.appendChild(sec);
                continue;
            }

            (function (entry, idx) {
                var row = document.createElement("div");
                row.className = "birdy-yt-nav-item";

                var label = document.createElement("span");
                label.className = "birdy-yt-nav-label";
                label.textContent = entry.title;

                var val = document.createElement("span");
                val.className = "birdy-yt-nav-val";
                val.textContent = entryStatusText(entry);

                row.appendChild(label);
                row.appendChild(val);

                row.onclick = function () {
                    focusLeftIndex = idx;
                    focusArea = "left";
                    renderDetailPane();
                    updateFocusUI();
                };

                frag.appendChild(row);
                navItems.push({ entry: entry, el: row, valEl: val });
            })(item, navItems.length);
        }

        leftEl.appendChild(frag);
    }

    function renderDetailPane() {
        var current = navItems[focusLeftIndex];
        if (!current) return;
        var entry = current.entry;

        artEl.textContent = "";
        artEl.appendChild(createArtSvg(entry.art, entry.dotColor || (entry.cat && entry.cat.color)));
        detailTitleEl.textContent = entry.title;
        detailSummaryEl.textContent = entry.summary || "";
        restartNoteEl.style.display = pendingRestart ? "block" : "none";

        btnGroupEl.textContent = "";
        rightButtons = [];

        if (entry.type === "toggle") {
            var isOn = getBool(entry.key, entry.def);
            var btn = document.createElement("button");
            btn.className = "birdy-yt-pill-btn";
            btn.textContent = isOn ? t("hub.enabled") : t("hub.disabled");
            btn.onclick = function () {
                var next = !getBool(entry.key, entry.def);
                setBool(entry.key, next);
                if (entry.restart) pendingRestart = true;
                current.valEl.textContent = entryStatusText(entry);
                renderDetailPane();
                updateFocusUI();
            };
            btnGroupEl.appendChild(btn);
            rightButtons.push(btn);

            if (pendingRestart) {
                var rBtn = document.createElement("button");
                rBtn.className = "birdy-yt-pill-btn";
                rBtn.textContent = t("hub.restart_app");
                rBtn.onclick = function () { location.reload(); };
                btnGroupEl.appendChild(rBtn);
                rightButtons.push(rBtn);
            }
            focusRightIndex = 0;
        } else if (entry.type === "3way") {
            var curMode = getSponsorMode(entry.cat.key);
            var modes = [
                { id: "skip", text: t("hub.action.skip") },
                { id: "prompt", text: t("hub.action.prompt") },
                { id: "off", text: t("hub.action.off") }
            ];
            focusRightIndex = 0;
            for (var i = 0; i < modes.length; i++) {
                (function (m, idx) {
                    var pBtn = document.createElement("button");
                    pBtn.className = "birdy-yt-pill-btn" + (curMode === m.id ? " active" : "");
                    pBtn.textContent = m.text;
                    if (curMode === m.id) focusRightIndex = idx;
                    pBtn.onclick = function () {
                        setSponsorMode(entry.cat.key, m.id);
                        current.valEl.textContent = entryStatusText(entry);
                        renderDetailPane();
                        focusRightIndex = idx;
                        updateFocusUI();
                    };
                    btnGroupEl.appendChild(pBtn);
                    rightButtons.push(pBtn);
                })(modes[i], i);
            }
        } else if (entry.type === "action") {
            var aBtn = document.createElement("button");
            aBtn.className = "birdy-yt-pill-btn";
            aBtn.textContent = entry.buttonText;
            aBtn.onclick = entry.onAction;
            btnGroupEl.appendChild(aBtn);
            rightButtons.push(aBtn);
            focusRightIndex = 0;
        }
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

    function updateFocusUI() {
        if (!screenEl) return;
        if (prevFocusEl) prevFocusEl.classList.remove("birdy-focus");
        if (prevSelectedEl) prevSelectedEl.classList.remove("selected");
        prevFocusEl = null;
        prevSelectedEl = null;

        var current = navItems[focusLeftIndex];
        if (!current) return;

        ensureVisible(leftEl, current.el, focusLeftIndex === 0);

        if (focusArea === "left") {
            current.el.classList.add("birdy-focus");
            prevFocusEl = current.el;
        } else {
            current.el.classList.add("selected");
            prevSelectedEl = current.el;
            if (rightButtons[focusRightIndex]) {
                rightButtons[focusRightIndex].classList.add("birdy-focus");
                prevFocusEl = rightButtons[focusRightIndex];
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
            if (focusArea === "right") {
                focusArea = "left";
                updateFocusUI();
            } else {
                closeHub();
            }
            return;
        }

        if (focusArea === "left") {
            if (code === 38) { // UP
                stopEvent(e);
                if (focusLeftIndex > 0) {
                    focusLeftIndex--;
                    renderDetailPane();
                    updateFocusUI();
                }
            } else if (code === 40) { // DOWN
                stopEvent(e);
                if (focusLeftIndex < navItems.length - 1) {
                    focusLeftIndex++;
                    renderDetailPane();
                    updateFocusUI();
                }
            } else if (code === 39 || code === 13 || code === 23) { // RIGHT or OK
                stopEvent(e);
                if (rightButtons.length > 0) {
                    focusArea = "right";
                    updateFocusUI();
                }
            }
        } else {
            if (code === 37) { // LEFT
                stopEvent(e);
                if (focusRightIndex > 0) {
                    focusRightIndex--;
                    updateFocusUI();
                } else {
                    focusArea = "left";
                    updateFocusUI();
                }
            } else if (code === 39) { // RIGHT
                stopEvent(e);
                if (focusRightIndex < rightButtons.length - 1) {
                    focusRightIndex++;
                    updateFocusUI();
                }
            } else if (code === 13 || code === 23) { // OK / ENTER
                stopEvent(e);
                if (rightButtons[focusRightIndex]) {
                    rightButtons[focusRightIndex].click();
                }
            }
        }
    }

    function isHubOpen() {
        return !!(screenEl && screenEl.classList.contains("show"));
    }

    function openHub() {
        createScreen();
        screenEl.classList.add("show");
        focusArea = "left";
        focusLeftIndex = 0;
        buildLeftList();
        renderDetailPane();
        updateFocusUI();

        window.removeEventListener("keydown", onKeyDown, true);
        window.addEventListener("keydown", onKeyDown, true);
        youtv.report("settings-hub: opened");
    }

    function closeHub() {
        if (!screenEl) return;
        screenEl.classList.remove("show");
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
