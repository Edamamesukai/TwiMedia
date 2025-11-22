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

(function() {
    'use strict';

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

    function applyGridStyles() {
        const timeline = document.querySelector('div[aria-label="タイムライン: ホームタイムライン"] > div');
        if (!timeline) {
            return;
        }

        // Trick the virtualization into rendering more items by making the container huge.
        timeline.style.height = '30000px';

        // Apply grid styles to the container
        timeline.style.display = 'grid';
        timeline.style.gridTemplateColumns = 'repeat(3, 1fr)';
        timeline.style.gridGap = '2px';
        timeline.style.alignItems = 'start'; // Allow items to have different heights

        const virtualizedItems = timeline.children;
        for (const item of virtualizedItems) {
            item.style.position = 'static'; // Force into grid flow
            item.style.transform = 'none';
            item.style.width = 'auto';
            item.style.height = 'auto';
            item.style.minHeight = '50px'; // Give it some minimum height
        }

        // After a short delay, reset the container height to fit the content.
        setTimeout(() => {
            timeline.style.height = 'auto';
        }, 1000); // 1 second delay to allow content to load
    }

    // Debounce the function to avoid excessive calls during rapid DOM changes
    const debouncedApplyStyles = debounce(applyGridStyles, 300);

    // Observe the DOM for changes and apply styles when needed
    const observer = new MutationObserver(() => {
        debouncedApplyStyles();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
