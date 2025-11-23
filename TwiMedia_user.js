// ==UserScript==
// @name         TwiMedia
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Twitterタイムラインをグリッド表示にします
// @author       You
// @match        https://twitter.com/home
// @match        https://x.com/home
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(async function () {
    "use strict";

    const SCRIPT_ID = "twi-media-style";
    const GRID_CONTAINER_ID = "twi-media-grid-container";
    const GRID_ACTIVE_CLASS = "twi-media-grid-active";
    const PROCESSED_CLASS = "twi-media-processed";
    const TOGGLE_BUTTON_ID = "twi-media-toggle-button";
    const STORAGE_KEY = "twi_media_grid_enabled";

    // --- ユーティリティ ---
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- CSSの注入 ---
    function injectStyles() {
        if (document.getElementById(SCRIPT_ID)) return;

        const style = document.createElement("style");
        style.id = SCRIPT_ID;
        style.textContent = `
            body.${GRID_ACTIVE_CLASS} div[aria-label="タイムライン: ホームタイムライン"] {
                display: none !important;
            }
            body.${GRID_ACTIVE_CLASS} #${GRID_CONTAINER_ID} {
                display: grid;
            }
            #${GRID_CONTAINER_ID} {
                display: none;
                grid-template-columns: repeat(3, 1fr);
                grid-gap: 2px;
                padding: 0 4px;
            }
            .twi-media-grid-item {
                text-decoration: none; display: block; position: relative;
                width: 100%; padding-bottom: 100%;
                background-size: cover;
                background-position: center;
                overflow: hidden;
            }
            /* --- ボタンのスタイル --- */
            #${TOGGLE_BUTTON_ID} {
                margin-bottom: 8px; /* 下に余白を追加 */
                padding-top: 12px; /* 上の余白を調整 */
                padding-bottom: 12px; /* 下の余白を調整 */
                transition-property: background-color, box-shadow;
                transition-duration: 0.2s;
                border-color: rgb(29, 155, 240);
            }
            /* オフの時（デフォルト）のホバー */
            #${TOGGLE_BUTTON_ID}:hover {
                background-color: rgb(29, 155, 240);
            }
            /* オン時のスタイル（青色） */
            body.${GRID_ACTIVE_CLASS} #${TOGGLE_BUTTON_ID} {
                background-color: rgb(29, 155, 240); /* Twitterの青色 */
                border-color: rgb(29, 155, 240); /* 枠線も青色に */
            }
            body.${GRID_ACTIVE_CLASS} #${TOGGLE_BUTTON_ID} span {
                color: rgb(255, 255, 255); /* 白文字 */
            }
            /* オン時のホバー */
            body.${GRID_ACTIVE_CLASS} #${TOGGLE_BUTTON_ID}:hover {
                background-color: rgb(244, 33, 46);
                border-color: rgb(244, 33, 46);
            }
        `;
        document.head.appendChild(style);
    }

    // --- DOMの再構築 ---
    function rebuildTimeline() {
        if (!document.body.classList.contains(GRID_ACTIVE_CLASS)) return;
        const originalTimeline = document.querySelector('div[aria-label="タイムライン: ホームタイムライン"]');
        if (!originalTimeline) return;
        let gridContainer = document.getElementById(GRID_CONTAINER_ID);
        if (!gridContainer) {
            gridContainer = document.createElement("div");
            gridContainer.id = GRID_CONTAINER_ID;
            originalTimeline.parentNode.insertBefore(gridContainer, originalTimeline.nextSibling);
        }
        const newTweets = originalTimeline.querySelectorAll(`article[data-testid="tweet"]:not(.${PROCESSED_CLASS})`);
        if (newTweets.length === 0) return;
        newTweets.forEach((tweet) => {
            tweet.classList.add(PROCESSED_CLASS);
            const photoEl = tweet.querySelector('[data-testid="tweetPhoto"]');
            const videoEl = tweet.querySelector('[data-testid="videoPlayer"]');
            let tweetLinkEl = null;
            const timeLink = tweet.querySelector('a[href*="/status/"] time');
            if (timeLink && timeLink.parentNode.tagName === "A") {
                tweetLinkEl = timeLink.parentNode;
            }
            if ((photoEl || videoEl) && tweetLinkEl) {
                const tweetUrl = tweetLinkEl.href;
                const itemId = `twi-media-item-${tweetUrl.split("/status/")[1].replace("/", "-")}`;
                if (document.getElementById(itemId)) return;
                let mediaUrl;
                if (photoEl) {
                    const img = photoEl.querySelector("img");
                    if (img) mediaUrl = img.src;
                } else if (videoEl) {
                    const poster = videoEl.querySelector('div[style*="background-image"]');
                    if (poster) mediaUrl = poster.style.backgroundImage.slice(5, -2);
                }
                if (mediaUrl) {
                    mediaUrl = mediaUrl.replace(/\?format=[^&]+&name=[^&]+/, "?format=jpg&name=orig");
                    const gridItem = document.createElement("a");
                    gridItem.id = itemId;
                    gridItem.href = tweetUrl;
                    gridItem.className = "twi-media-grid-item";
                    gridItem.style.backgroundImage = `url(${mediaUrl})`;
                    gridItem.target = "_blank";
                    gridItem.rel = "noopener noreferrer";
                    gridContainer.appendChild(gridItem);
                }
            }
        });
    }

    // --- UIと状態管理 ---
    function toggleGrid(forceState) {
        const shouldBeEnabled = typeof forceState === "boolean" ? forceState : !document.body.classList.contains(GRID_ACTIVE_CLASS);
        document.body.classList.toggle(GRID_ACTIVE_CLASS, shouldBeEnabled);
        GM_setValue(STORAGE_KEY, shouldBeEnabled);
        if (shouldBeEnabled) {
            rebuildTimeline();
        }
    }

    function createToggleButton() {
        // header[role="banner"] がDOMに追加されるのを待つ
        const observer = new MutationObserver((mutations, obs) => {
            const header = document.querySelector('header[role="banner"]');
            if (header) {
                // headerが見つかったら、ボタンの作成を試みる
                if (document.getElementById(TOGGLE_BUTTON_ID)) return; // 既に存在する場合は何もしない

                // 「フォローする」ボタンのスタイルを模倣
                const button = document.createElement("div");
                button.id = TOGGLE_BUTTON_ID;
                button.role = "button";
                button.tabIndex = 0;
                // 「フォローする」ボタンのクラスをコピー
                button.className = "css-175oi2r r-sdzlij r-1phboty r-rs99b7 r-lrvibr r-2yi16 r-1qi2l1t r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l";
                button.addEventListener("click", (e) => {
                    e.preventDefault();
                    toggleGrid();
                });

                const div = document.createElement("div");
                div.dir = "ltr";
                // 内部divのクラスをコピー
                div.className = "css-901oao r-1awozwy r-6koalj r-18u37iz r-16y2uox r-37j5jr r-a023e6 r-b88u0q r-1777fci r-rjixqe r-bcqeeo r-q4m81j r-qvutc0";

                const span = document.createElement("span");
                // 内部spanのクラスをコピー
                span.className = "css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0";
                span.textContent = "Grid";

                div.appendChild(span);
                button.appendChild(div);

                const postButton = header.querySelector('a[aria-label="ポストする"]');
                if (postButton) {
                    postButton.parentNode.insertBefore(button, postButton);
                    console.log("TwiMedia: Gridボタンをポストボタンの上に追加しました。");
                    obs.disconnect(); // 成功したら監視を停止
                }
            }
        });

        // body全体の変更を監視開始
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    // --- 初期化 ---
    injectStyles();
    createToggleButton();

    const isEnabled = await GM_getValue(STORAGE_KEY, true); // デフォルトはオン
    toggleGrid(isEnabled);

    const debouncedRebuild = debounce(rebuildTimeline, 500);
    const observer = new MutationObserver(debouncedRebuild);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", debouncedRebuild, { passive: true });

    console.log("TwiMedia: Violentmonkeyストレージ対応スクリプトが読み込まれました。");
})();
