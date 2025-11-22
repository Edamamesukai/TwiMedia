// ==UserScript==
// @name         TwiMedia
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Twitterタイムラインをグリッド表示にします
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
        // スタイルが既に注入されている場合は何もしない
        if (document.getElementById(SCRIPT_ID)) return;

        const style = document.createElement("style");
        style.id = SCRIPT_ID;
        style.textContent = `
            /* --- グリッド有効時の状態 --- */

            /* グリッドが有効な場合、元のタイムラインを非表示にする */
            body.${GRID_ACTIVE_CLASS} div[aria-label="タイムライン: ホームタイムライン"] {
                display: none !important;
            }

            /* グリッドが有効な場合、新しいグリッドコンテナを表示する */
            body.${GRID_ACTIVE_CLASS} #${GRID_CONTAINER_ID} {
                display: grid;
            }

            /* --- グリッド無効時の状態 (デフォルト) --- */

            /* 新しいグリッドコンテナはデフォルトで非表示 */
            #${GRID_CONTAINER_ID} {
                display: none;
                grid-template-columns: repeat(3, 1fr); /* 固定3列 */
                grid-gap: 2px;
                padding: 0 4px;
            }

            /* --- グリッドアイテム共通スタイル --- */

            .twi-media-grid-item {
                text-decoration: none;
                display: block;
                position: relative;
                width: 100%;
                padding-bottom: 100%; /* 1:1のアスペクト比 */
                background-size: cover;
                background-position: center;
                /* 角を丸くするスタイルや背景色は削除 */
                overflow: hidden;
            }
        `;
        document.head.appendChild(style);
        console.log("TwiMedia: 並列タイムラインのスタイルを注入しました。");
    }

    // --- DOMの再構築 ---
    function rebuildTimeline() {
        // グリッドが有効でない場合は何もしない
        if (!document.body.classList.contains(GRID_ACTIVE_CLASS)) return;

        const originalTimeline = document.querySelector('div[aria-label="タイムライン: ホームタイムライン"]');
        if (!originalTimeline) return;

        // カスタムグリッドコンテナを見つけるか、作成して元のタイムラインの隣に配置する
        let gridContainer = document.getElementById(GRID_CONTAINER_ID);
        if (!gridContainer) {
            gridContainer = document.createElement('div');
            gridContainer.id = GRID_CONTAINER_ID;
            originalTimeline.parentNode.insertBefore(gridContainer, originalTimeline.nextSibling);
        }

        //【変更点】まだ処理されていない新しいツイートのみを収集する
        const newTweets = originalTimeline.querySelectorAll('article[data-testid="tweet"]:not(.twi-media-processed)');
        if (newTweets.length === 0) return; // 新しいツイートがなければ何もしない

        console.log(`TwiMedia: 処理する新しいツイートを${newTweets.length}件見つけました。`);

        // 各ツイートを処理して新しいグリッドアイテムを作成する
        newTweets.forEach((tweet) => {
            //【変更点】処理済みクラスを最初に追加して、重複処理を確実に防ぐ
            tweet.classList.add('twi-media-processed');

            const photoEl = tweet.querySelector('[data-testid="tweetPhoto"]');
            const videoEl = tweet.querySelector('[data-testid="videoPlayer"]');

            // ツイートステータスへの正しいリンクを見つける
            let tweetLinkEl = null;
            const timeLink = tweet.querySelector('a[href*="/status/"] time');
            if (timeLink && timeLink.parentNode.tagName === "A") {
                tweetLinkEl = timeLink.parentNode;
            }

            // 写真または動画があり、ツイートリンクがある場合のみ処理
            if ((photoEl || videoEl) && tweetLinkEl) {
                const tweetUrl = tweetLinkEl.href;

                // 重複を避けるためにツイートURLをユニークなIDとして使用する
                const itemId = `twi-media-item-${tweetUrl.split("/status/")[1].replace("/", "-")}`;
                if (document.getElementById(itemId)) {
                    return; // 既に存在する場合はスキップ
                }

                let mediaUrl;
                if (photoEl) {
                    const img = photoEl.querySelector("img");
                    if (img) mediaUrl = img.src;
                } else if (videoEl) {
                    const poster = videoEl.querySelector('div[style*="background-image"]');
                    if (poster) {
                        mediaUrl = poster.style.backgroundImage.slice(5, -2); // "url(...)"からURLを抽出
                    }
                }

                if (mediaUrl) {
                    // URLを?format=jpg&name=origに変換
                    mediaUrl = mediaUrl.replace(/\?format=[^&]+&name=[^&]+/, "?format=jpg&name=orig");

                    // シンプルな構造に基づいて新しいグリッドアイテムを作成する
                    const gridItem = document.createElement("a");
                    gridItem.id = itemId;
                    gridItem.href = tweetUrl;
                    gridItem.className = "twi-media-grid-item";
                    gridItem.style.backgroundImage = `url(${mediaUrl})`;
                    gridItem.target = "_blank"; // 新しいタブで開く
                    gridItem.rel = "noopener noreferrer";

                    gridContainer.appendChild(gridItem);
                }
            }
        });
    }

    // この関数は現在使用されていませんが、ボタン用に使用されます
    function toggleGrid(enable) {
        document.body.classList.toggle(GRID_ACTIVE_CLASS, enable);
        console.log(`TwiMedia: グリッドを${enable ? "ON" : "OFF"}に切り替えました。`);
        if (enable) {
            rebuildTimeline();
        }
    }

    // --- 初期化 ---
    injectStyles();

    // デフォルトでグリッドを有効にする
    toggleGrid(true);

    // MutationObserverとscrollイベントの両方で、同じデバウンスされた関数を呼び出す
    const debouncedRebuild = debounce(rebuildTimeline, 500);
    const observer = new MutationObserver(debouncedRebuild);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', debouncedRebuild, { passive: true });

    console.log('TwiMedia: 並列タイムラインスクリプトが読み込まれました。');
})();
