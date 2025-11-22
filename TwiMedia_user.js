// ==UserScript==
// @name         TwiMedia
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Twitter timeline in grid view
// @author       You
// @match        https://twitter.com/home
// @match        https://x.com/home
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const SCRIPT_ID = "twi-media-style";
    const GRID_CONTAINER_ID = "twi-media-grid-container";
    const GRID_ACTIVE_CLASS = "twi-media-grid-active";

    // --- Utilities ---
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

    // --- CSS Injection ---
    function injectStyles() {
        if (document.getElementById(SCRIPT_ID)) return;

        const style = document.createElement("style");
        style.id = SCRIPT_ID;
        style.textContent = `
            /* Hide the original timeline when grid is active */
            body.${GRID_ACTIVE_CLASS} div[aria-label="タイムライン: ホームタイムライン"] {
                display: none !important;
            }

            /* Style for our new grid container */
            #${GRID_CONTAINER_ID} {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                grid-gap: 2px;
                padding: 0 4px;
            }

            /* Style for each grid item */
            .twi-media-grid-item {
                text-decoration: none;
                display: block;
                position: relative;
                width: 100%;
                padding-bottom: 100%; /* 1:1 Aspect Ratio */
                background-size: cover;
                background-position: center;
                background-color: #222;
                border-radius: 4px;
                overflow: hidden;
            }
        `;
        document.head.appendChild(style);
        console.log("TwiMedia: DOM Reconstruction styles injected.");
    }

    // --- DOM Reconstruction ---
    function rebuildTimeline() {
        if (!document.body.classList.contains(GRID_ACTIVE_CLASS)) return;

        const originalTimeline = document.querySelector('div[aria-label="タイムライン: ホームタイムライン"]');
        if (!originalTimeline) return;

        // Find or create our custom grid container
        let gridContainer = document.getElementById(GRID_CONTAINER_ID);
        if (!gridContainer) {
            gridContainer = document.createElement("div");
            gridContainer.id = GRID_CONTAINER_ID;
            originalTimeline.parentNode.insertBefore(gridContainer, originalTimeline);
        }

        // Collect all tweets from the original timeline
        const tweets = originalTimeline.querySelectorAll('article[data-testid="tweet"]');
        console.log(`TwiMedia: Found ${tweets.length} tweets to process.`);

        // Process each tweet to create a new grid item
        tweets.forEach((tweet) => {
            const photoEl = tweet.querySelector('[data-testid="tweetPhoto"]');
            const videoEl = tweet.querySelector('[data-testid="videoPlayer"]');
            const tweetLinkEl = tweet.querySelector('a[href*="/status/"]');

            if ((photoEl || videoEl) && tweetLinkEl) {
                const tweetUrl = tweetLinkEl.href;

                // Use tweet URL as a unique ID to avoid duplicates
                const itemId = `twi-media-item-${tweetUrl.split("/status/")[1]}`;
                if (document.getElementById(itemId)) {
                    return; // Already exists, skip
                }

                let mediaUrl;
                if (photoEl) {
                    const img = photoEl.querySelector("img");
                    if (img) mediaUrl = img.src;
                } else if (videoEl) {
                    const poster = videoEl.querySelector('div[style*="background-image"]');
                    if (poster) {
                        mediaUrl = poster.style.backgroundImage.slice(5, -2); // Extract URL from "url(...)"
                    }
                }

                if (mediaUrl) {
                    // Create the new grid item based on the simple structure
                    const gridItem = document.createElement("a");
                    gridItem.id = itemId;
                    gridItem.href = tweetUrl;
                    gridItem.className = "twi-media-grid-item";
                    gridItem.style.backgroundImage = `url(${mediaUrl})`;
                    gridItem.target = "_blank"; // Open in new tab
                    gridItem.rel = "noopener noreferrer";

                    gridContainer.appendChild(gridItem);
                }
            }
        });
    }

    function toggleGrid(enable) {
        document.body.classList.toggle(GRID_ACTIVE_CLASS, enable);
        console.log(`TwiMedia: Grid toggled ${enable ? "ON" : "OFF"}.`);
        if (enable) {
            rebuildTimeline();
        } else {
            const gridContainer = document.getElementById(GRID_CONTAINER_ID);
            if (gridContainer) gridContainer.innerHTML = ""; // Clear grid on disable
        }
    }

    // --- Initialization ---
    injectStyles();
    toggleGrid(true); // Enable grid by default

    const debouncedRebuild = debounce(rebuildTimeline, 500);
    const observer = new MutationObserver(debouncedRebuild);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", debouncedRebuild, { passive: true });

    console.log("TwiMedia: DOM Reconstruction script loaded.");
})();
