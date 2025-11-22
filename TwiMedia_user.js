// ==UserScript==
// @name         TwiMedia
// @namespace    http://tampermonkey.net/
// @version      0.2
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
            #${TOGGLE_BUTTON_ID} {
                margin: 10px 0; padding: 10px 15px; font-size: 15px;
                font-weight: bold; color: #fff; background-color: #1DA1F2;
                border: none; border-radius: 9999px; cursor: pointer;
                transition: background-color 0.2s;
            }
            #${TOGGLE_BUTTON_ID}:hover { background-color: #1A91DA; }
            body.${GRID_ACTIVE_CLASS} #${TOGGLE_BUTTON_ID} {
                background-color: #1A91DA;
                box-shadow: 0 0 0 2px #1DA1F2;
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
            gridContainer = document.createElement('div');
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
        const shouldBeEnabled = typeof forceState === 'boolean' ? forceState : !document.body.classList.contains(GRID_ACTIVE_CLASS);
        document.body.classList.toggle(GRID_ACTIVE_CLASS, shouldBeEnabled);
        GM_setValue(STORAGE_KEY, shouldBeEnabled);
        if (shouldBeEnabled) {
            rebuildTimeline();
        }
    }

    function createToggleButton() {
        if (document.getElementById(TOGGLE_BUTTON_ID)) return;
        const nav = document.querySelector('header[role="banner"] nav[role="navigation"]');
        if (!nav) {
            setTimeout(createToggleButton, 500);
            return;
        }
        const button = document.createElement("button");
        button.id = TOGGLE_BUTTON_ID;
        button.textContent = "Grid";
        button.addEventListener("click", () => toggleGrid());
        nav.appendChild(button);
    }

    // --- 初期化 ---
    injectStyles();
    createToggleButton();

    const isEnabled = await GM_getValue(STORAGE_KEY, true); // デフォルトはオン
    toggleGrid(isEnabled);

    const debouncedRebuild = debounce(rebuildTimeline, 500);
    const observer = new MutationObserver(debouncedRebuild);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', debouncedRebuild, { passive: true });

    console.log('TwiMedia: Violentmonkeyストレージ対応スクリプトが読み込まれました。');
})();
