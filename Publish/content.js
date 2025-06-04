// ==UserScript==
// @name         YouTube Bookmark Pins (Stable)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Add clickable timestamp pins to YouTube progress bar
// @match        *://www.youtube.com/watch*
// @match        *://*.youtube.com/watch*
// @match        *://youtu.be/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

debugger;
console.log("[YT Pins] init");


(function () {
    'use strict';

    let video;
    let bookmarks = [];

    const style = document.createElement('style');
    style.textContent = `
        .yt-pin {
            position: absolute;
            width: 5px;
            height: 14px;
            top: -20px;
            background-color: #00bcd4;
            border-radius: 2px;
            cursor: pointer;
            z-index: 9999;
        }
    `;
    document.head.appendChild(style);

    function formatTime(t) {
        return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    }

    function getVideoId() {
        return new URLSearchParams(window.location.search).get('v');
    }

    function loadBookmarks() {
        const saved = localStorage.getItem(`yt-pins-${getVideoId()}`);
        bookmarks = saved ? JSON.parse(saved) : [];
    }

    function saveBookmarks() {
        localStorage.setItem(`yt-pins-${getVideoId()}`, JSON.stringify(bookmarks));
    }

    function addPin(time, bar) {
        const pin = document.createElement('div');
        pin.className = 'yt-pin';
        pin.title = `Go to ${formatTime(time)}`;
        pin.style.left = `${(time / video.duration) * 100}%`;
        pin.onclick = () => (video.currentTime = time);
        bar.appendChild(pin);
    }

    function renderPins() {
        const bar = document.querySelector('.ytp-progress-bar');
        if (!bar) return;
        bar.querySelectorAll('.yt-pin').forEach(p => p.remove());
        bookmarks.forEach(t => addPin(t, bar));
    }

    function addBookmark() {
        const time = Math.floor(video.currentTime);
        if (!bookmarks.includes(time)) {
            bookmarks.push(time);
            saveBookmarks();
            renderPins();
        }
    }

    function addButton() {
        if (document.getElementById('yt-pin-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'yt-pin-btn';
        btn.textContent = '📌';
        btn.style.position = 'absolute';
        btn.style.top = '60px';
        btn.style.right = '10px';
        btn.style.zIndex = '10000';
        btn.style.fontSize = '20px';
        btn.title = 'Add Bookmark Pin';
        btn.onclick = addBookmark;
        document.body.appendChild(btn);
    }

    function clearAllBookmarks() {
        bookmarks = [];
        localStorage.removeItem(`yt-pins-${getVideoId()}`);
        renderPins();
    }

    // add next to your “📌” button
    function addClearButton() {
        if (document.getElementById('yt-clear-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'yt-clear-btn';
        btn.textContent = '🗑️';
        btn.style.position = 'absolute';
        btn.style.top = '60px';
        btn.style.right = '50px'; // shift it right of the pin button
        btn.style.zIndex = '10000';
        btn.style.fontSize = '20px';
        btn.title = 'Clear All Pins';
        btn.onclick = clearAllBookmarks;
        document.body.appendChild(btn);
    }


    function waitUntilReady() {
        const bar = document.querySelector('.ytp-progress-bar');
        const vid = document.querySelector('video');

        if (bar && vid && vid.duration > 0) {
            video = vid;
            loadBookmarks();
            renderPins();
            addButton();
            addClearButton();
            console.log("[YT Pins] ✅ Ready and loaded.");
        } else {
            console.log("[YT Pins] Waiting for player...");
            setTimeout(waitUntilReady, 1000);
        }
    }

    waitUntilReady();

    // Handle YouTube's internal page changes
    const observer = new MutationObserver(() => {
        if (window.location.href.includes('/watch')) {
            setTimeout(waitUntilReady, 1500);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
