// BirdyTV Settings Hub: TizenTube Cobalt-style TV overlay settings modal.
// Hosts all BirdyTV settings: SponsorBlock (3-way modes), Seekbar Colors, AdBlock,
// Player Controls, Shorts, Return Dislike (RYD), Topics, and About.
// Full spatial D-pad remote navigation (Up, Down, Left, Right, OK, Back).
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

    // ---- Styles -------------------------------------------------------------------------------
    var sheet = new CSSStyleSheet();
    try {
        sheet.replaceSync(
            ".birdy-hub-backdrop {" +
            " position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 2147483647;" +
            " background: rgba(0, 0, 0, 0.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);" +
            " display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none;" +
            " transition: opacity 220ms ease; font-family: Roboto, 'YouTube Sans', Arial, sans-serif; }" +
            ".birdy-hub-backdrop.show { opacity: 1; pointer-events: auto; }" +
            ".birdy-hub-modal {" +
            " width: 88vw; height: 86vh; max-width: 1360px; max-height: 820px; background: #141414;" +
            " border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 24px;" +
            " box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85); display: flex; flex-direction: column;" +
            " overflow: hidden; color: #ffffff; }" +
            ".birdy-hub-header {" +
            " display: flex; align-items: center; justify-content: space-between; padding: 1.6rem 2.4rem;" +
            " border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #181818; flex-shrink: 0; }" +
            ".birdy-hub-title-box { display: flex; align-items: center; gap: 1rem; }" +
            ".birdy-hub-badge {" +
            " background: #FF2028; color: #ffffff; font-weight: 800; font-size: 0.85rem;" +
            " padding: 0.35rem 0.8rem; border-radius: 9999px; letter-spacing: 0.05em; text-transform: uppercase; }" +
            ".birdy-hub-title { font-size: 1.65rem; font-weight: 700; margin: 0; color: #ffffff; }" +
            ".birdy-hub-hint { color: rgba(255, 255, 255, 0.55); font-size: 1.15rem; font-weight: 500; }" +
            ".birdy-hub-body { display: flex; flex: 1; overflow: hidden; }" +
            ".birdy-hub-sidebar {" +
            " width: 280px; flex-shrink: 0; background: #121212; border-right: 1px solid rgba(255, 255, 255, 0.08);" +
            " padding: 1.2rem; display: flex; flex-direction: column; gap: 0.4rem; overflow-y: auto; }" +
            ".birdy-hub-tab {" +
            " display: flex; align-items: center; gap: 1rem; padding: 1rem 1.4rem; border-radius: 14px;" +
            " font-size: 1.25rem; font-weight: 600; color: rgba(255, 255, 255, 0.7); cursor: pointer;" +
            " border: 2px solid transparent; transition: all 180ms ease; outline: none; }" +
            ".birdy-hub-tab.active { background: rgba(255, 255, 255, 0.08); color: #ffffff; }" +
            ".birdy-hub-tab.birdy-focus { border-color: #FF2028; background: rgba(255, 32, 40, 0.15); color: #ffffff; }" +
            ".birdy-hub-content {" +
            " flex: 1; padding: 2rem 2.8rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1.4rem; }" +
            ".birdy-hub-row {" +
            " display: flex; align-items: center; justify-content: space-between; padding: 1.2rem 1.6rem;" +
            " background: rgba(255, 255, 255, 0.03); border-radius: 16px; border: 1.5px solid transparent;" +
            " transition: all 180ms ease; }" +
            ".birdy-hub-row.birdy-focus { border-color: #FF2028; background: rgba(255, 255, 255, 0.07); }" +
            ".birdy-hub-row-left { display: flex; flex-direction: column; gap: 0.3rem; max-width: 55%; }" +
            ".birdy-hub-row-title-wrap { display: flex; align-items: center; gap: 0.75rem; }" +
            ".birdy-hub-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }" +
            ".birdy-hub-row-title { font-size: 1.3rem; font-weight: 600; color: #ffffff; }" +
            ".birdy-hub-row-summary { font-size: 1rem; color: rgba(255, 255, 255, 0.5); line-height: 1.3; }" +
            ".birdy-hub-pill-group { display: flex; align-items: center; gap: 0.5rem; }" +
            ".birdy-hub-pill {" +
            " padding: 0.65rem 1.15rem; border-radius: 12px; font-size: 1.1rem; font-weight: 600;" +
            " background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.65);" +
            " border: 2px solid transparent; cursor: pointer; transition: all 180ms ease; outline: none; }" +
            ".birdy-hub-pill.selected { background: #FF2028; color: #ffffff; }" +
            ".birdy-hub-pill.birdy-focus { border-color: #ffffff; box-shadow: 0 0 12px rgba(255, 255, 255, 0.4); transform: scale(1.04); }" +
            ".birdy-hub-toggle {" +
            " padding: 0.65rem 1.6rem; border-radius: 12px; font-size: 1.15rem; font-weight: 700;" +
            " border: 2px solid transparent; cursor: pointer; transition: all 180ms ease; outline: none; }" +
            ".birdy-hub-toggle.on { background: #00D400; color: #121212; }" +
            ".birdy-hub-toggle.off { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.5); }" +
            ".birdy-hub-toggle.birdy-focus { border-color: #ffffff; box-shadow: 0 0 12px rgba(255, 255, 255, 0.4); transform: scale(1.04); }" +
            ".birdy-hub-action-btn {" +
            " padding: 0.85rem 1.8rem; border-radius: 14px; font-size: 1.2rem; font-weight: 700;" +
            " background: #FF2028; color: #ffffff; border: 2px solid transparent; cursor: pointer;" +
            " transition: all 180ms ease; outline: none; align-self: flex-start; margin-top: 1rem; }" +
            ".birdy-hub-action-btn.birdy-focus { border-color: #ffffff; box-shadow: 0 0 16px rgba(255, 32, 40, 0.7); transform: scale(1.03); }"
        );
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {}

    // ---- Modal DOM & Focus Controller ---------------------------------------------------------
    var modalBackdrop = null;
    var activeTabKey = "sponsorblock";
    var focusArea = "sidebar"; // "sidebar" or "content"
    var focusSidebarIndex = 0;
    var focusContentIndex = 0;
    var focusPillIndex = 0; // For rows with 3 pills

    var TABS = [
        { key: "sponsorblock", labelKey: "hub.tab.sponsorblock", icon: "🛡️" },
        { key: "seekbar", labelKey: "hub.tab.seekbar", icon: "🎨" },
        { key: "ads", labelKey: "hub.tab.ads", icon: "🚫" },
        { key: "player", labelKey: "hub.tab.player", icon: "🎬" },
        { key: "shorts", labelKey: "hub.tab.shorts", icon: "⚡" },
        { key: "ryd", labelKey: "hub.tab.ryd", icon: "👎" },
        { key: "about", labelKey: "hub.tab.about", icon: "ℹ️" }
    ];

    function createModal() {
        if (modalBackdrop) return;
        modalBackdrop = document.createElement("div");
        modalBackdrop.className = "birdy-hub-backdrop";

        var modal = document.createElement("div");
        modal.className = "birdy-hub-modal";

        // Header
        var header = document.createElement("div");
        header.className = "birdy-hub-header";

        var titleBox = document.createElement("div");
        titleBox.className = "birdy-hub-title-box";
        var badge = document.createElement("span");
        badge.className = "birdy-hub-badge";
        badge.textContent = "BirdyTV";
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
            el.textContent = tab.icon + "  " + t(tab.labelKey);
            sidebar.appendChild(el);
        });
    }

    function renderContent() {
        var content = modalBackdrop.querySelector(".birdy-hub-content");
        if (!content) return;
        content.textContent = "";

        if (activeTabKey === "sponsorblock") {
            // Master prompt_all toggle
            var promptAllRow = createToggleRow(
                t("sponsor.prompt_all.title"),
                t("sponsor.prompt_all.summary"),
                getBool("YOUTV_SPONSORBLOCK_PROMPT_ALL", false),
                function (val) {
                    setBool("YOUTV_SPONSORBLOCK_PROMPT_ALL", val);
                    renderContent();
                    updateFocusUI();
                }
            );
            content.appendChild(promptAllRow);

            // Per category 3-way mode selectors
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

                modes.forEach(function (m) {
                    var pill = document.createElement("button");
                    pill.className = "birdy-hub-pill" + (currentMode === m.id ? " selected" : "");
                    pill.textContent = m.text;
                    pill.setAttribute("data-mode", m.id);
                    pill.onclick = function () {
                        setSponsorMode(cat.key, m.id);
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
            // Master seekbar colors toggle
            var masterRow = createToggleRow(
                t("feature.sponsorblock_colors.name"),
                t("feature.sponsorblock_colors.summary"),
                getBool("YOUTV_SPONSORBLOCK-COLORS", true),
                function (val) {
                    setBool("YOUTV_SPONSORBLOCK-COLORS", val);
                    renderContent();
                    updateFocusUI();
                }
            );
            content.appendChild(masterRow);

            // Per category seekbar toggles
            CATEGORIES.forEach(function (cat) {
                var key = "YOUTV_SPONSORBLOCK-COLORS_" + cat.key.toUpperCase() + "_SEEKBAR";
                var def = cat.key === "sponsor" || cat.key === "selfpromo" || cat.key === "interaction";
                var isEnabled = getBool(key, def);

                var row = createToggleRow(
                    t(cat.titleKey),
                    t("sponsor." + cat.key + ".seekbar.summary"),
                    isEnabled,
                    function (val) {
                        setBool(key, val);
                        renderContent();
                        updateFocusUI();
                    },
                    cat.color
                );
                content.appendChild(row);
            });
        } else if (activeTabKey === "ads") {
            var adsRow = createToggleRow(
                t("feature.ads.name"),
                t("feature.ads.summary"),
                getBool("YOUTV_ADS", true),
                function (val) {
                    setBool("YOUTV_ADS", val);
                    renderContent();
                    updateFocusUI();
                }
            );
            content.appendChild(adsRow);
        } else if (activeTabKey === "player") {
            var playerMaster = createToggleRow(
                t("feature.player.name"),
                t("feature.player.summary"),
                getBool("YOUTV_PLAYER", true),
                function (val) {
                    setBool("YOUTV_PLAYER", val);
                    renderContent();
                    updateFocusUI();
                }
            );
            content.appendChild(playerMaster);

            PLAYER_BUTTONS.forEach(function (btn) {
                var key = "YOUTV_PLAYER_" + btn.key.toUpperCase();
                var row = createToggleRow(
                    t(btn.titleKey),
                    btn.summaryKey ? t(btn.summaryKey) : "",
                    getBool(key, false),
                    function (val) {
                        setBool(key, val);
                        renderContent();
                        updateFocusUI();
                    }
                );
                content.appendChild(row);
            });
        } else if (activeTabKey === "shorts") {
            var shortsRow = createToggleRow(
                t("feature.shorts.name"),
                t("feature.shorts.summary"),
                getBool("YOUTV_SHORTS", true),
                function (val) {
                    setBool("YOUTV_SHORTS", val);
                    renderContent();
                    updateFocusUI();
                }
            );
            content.appendChild(shortsRow);
        } else if (activeTabKey === "ryd") {
            var rydRow = createToggleRow(
                t("feature.ryd.name"),
                t("feature.ryd.summary"),
                getBool("YOUTV_RYD", true),
                function (val) {
                    setBool("YOUTV_RYD", val);
                    renderContent();
                    updateFocusUI();
                }
            );
            content.appendChild(rydRow);
        } else if (activeTabKey === "about") {
            var repoRow = document.createElement("div");
            repoRow.className = "birdy-hub-row";
            repoRow.innerHTML =
                "<div class='birdy-hub-row-left'>" +
                "<span class='birdy-hub-row-title'>SEIFELDEEN15 / Birdy-Patches</span>" +
                "<span class='birdy-hub-row-summary'>" + (window.__farotvVersion ? "v" + window.__farotvVersion : "v1.3.0") + " • Android TV Cobalt</span>" +
                "</div>";
            content.appendChild(repoRow);

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

        var toggle = document.createElement("button");
        toggle.className = "birdy-hub-toggle " + (isEnabled ? "on" : "off");
        toggle.textContent = isEnabled ? t("hub.enabled") : t("hub.disabled");
        toggle.onclick = function () {
            onToggle(!isEnabled);
        };

        row.appendChild(left);
        row.appendChild(toggle);
        return row;
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
                tabs[focusSidebarIndex].scrollIntoView ? tabs[focusSidebarIndex].scrollIntoView({ block: "nearest" }) : null;
            }
        } else {
            var rows = modalBackdrop.querySelectorAll(".birdy-interactive-row");
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
                var toggleBtn = targetRow.querySelector(".birdy-hub-toggle");
                if (toggleBtn) toggleBtn.classList.add("birdy-focus");
            } else {
                targetRow.classList.add("birdy-focus");
            }
            targetRow.scrollIntoView ? targetRow.scrollIntoView({ block: "nearest" }) : null;
        }
    }

    function onKeyDown(e) {
        if (!isHubOpen()) return;
        var code = e.keyCode || e.which;

        // BACK: 27 (Escape), 4 (Android Back), 10009 (Tizen Back)
        if (code === 27 || code === 4 || code === 10009 || e.key === "Escape" || e.key === "GoBack") {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            closeHub();
            return;
        }

        var tabs = modalBackdrop.querySelectorAll(".birdy-hub-tab");
        var rows = modalBackdrop.querySelectorAll(".birdy-interactive-row");

        if (focusArea === "sidebar") {
            if (code === 38) { // UP
                e.preventDefault();
                focusSidebarIndex = Math.max(0, focusSidebarIndex - 1);
                activeTabKey = TABS[focusSidebarIndex].key;
                renderSidebar();
                renderContent();
                updateFocusUI();
            } else if (code === 40) { // DOWN
                e.preventDefault();
                focusSidebarIndex = Math.min(TABS.length - 1, focusSidebarIndex + 1);
                activeTabKey = TABS[focusSidebarIndex].key;
                renderSidebar();
                renderContent();
                updateFocusUI();
            } else if (code === 39 || code === 13 || code === 23) { // RIGHT or OK
                e.preventDefault();
                if (rows.length > 0) {
                    focusArea = "content";
                    focusContentIndex = 0;
                    focusPillIndex = 0;
                    updateFocusUI();
                }
            }
        } else {
            var curRow = rows[focusContentIndex];
            var type = curRow ? curRow.getAttribute("data-type") : null;

            if (code === 38) { // UP
                e.preventDefault();
                if (focusContentIndex > 0) {
                    focusContentIndex--;
                    focusPillIndex = 0;
                    updateFocusUI();
                }
            } else if (code === 40) { // DOWN
                e.preventDefault();
                if (focusContentIndex < rows.length - 1) {
                    focusContentIndex++;
                    focusPillIndex = 0;
                    updateFocusUI();
                }
            } else if (code === 37) { // LEFT
                e.preventDefault();
                if (type === "3way" && focusPillIndex > 0) {
                    focusPillIndex--;
                    updateFocusUI();
                } else {
                    focusArea = "sidebar";
                    updateFocusUI();
                }
            } else if (code === 39) { // RIGHT
                e.preventDefault();
                if (type === "3way") {
                    var pills = curRow.querySelectorAll(".birdy-hub-pill");
                    if (focusPillIndex < pills.length - 1) {
                        focusPillIndex++;
                        updateFocusUI();
                    }
                }
            } else if (code === 13 || code === 23) { // OK / ENTER
                e.preventDefault();
                if (type === "3way") {
                    var pillsList = curRow.querySelectorAll(".birdy-hub-pill");
                    if (pillsList[focusPillIndex]) pillsList[focusPillIndex].click();
                } else if (type === "toggle") {
                    var togBtn = curRow.querySelector(".birdy-hub-toggle");
                    if (togBtn) togBtn.click();
                } else if (curRow) {
                    curRow.click();
                }
            }
        }
    }

    function isHubOpen() {
        return modalBackdrop && modalBackdrop.className.indexOf("show") !== -1;
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

    // Global shortcut: F2 or 'KeyS' or clicking settings entry opens the hub
    window.addEventListener("keydown", function (e) {
        if (isHubOpen()) return;
        var code = e.keyCode || e.which;
        if (code === 113 /* F2 */) {
            e.preventDefault();
            openHub();
        }
    }, true);

    // Watch for click or Enter on the native settings entry for BirdyTV Settings
    document.addEventListener("click", function (e) {
        var el = e.target;
        while (el && el !== document.body) {
            var text = (el.textContent || "").trim();
            if (el.getAttribute("data-item-id") === "BIRDY_SETTINGS_HUB" ||
                text === t("hub.open") ||
                text.indexOf(t("hub.title")) !== -1) {
                openHub();
                break;
            }
            el = el.parentElement;
        }
    }, true);
})();
