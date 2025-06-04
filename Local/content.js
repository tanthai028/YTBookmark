// ==UserScript==
// @name         YouTube Bookmark Pins with Sidebar (v2.4+share+undo)
// @namespace    http://tampermonkey.net/
// @version      2.4.1
// @description  Draggable sidebar + exact pins on full progress bar; add-pin button centered; export/import highlights with custom filename; undo delete; only on /watch pages.
// @match        *://www.youtube.com/watch*
// @match        *://*.youtube.com/watch*
// @match        *://youtu.be/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  let video, bookmarks = [];
  let sidebar, listContainer, header, pinBtn, undoBtn;
  let lastDeleted = null;

  // inject styles
  const style = document.createElement('style');
  style.textContent = `
    .yt-pin {
      position: absolute;
      width: 2px;
      bottom: 0;
      background-color: #00bcd4;
      pointer-events: none;
      z-index: 9998;
    }
    .yt-pins-sidebar {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 220px;
      max-height: 60vh;
      padding: 8px;
      overflow-y: auto;
      overflow-x: hidden;
      background: #fff;
      color: #1a1a1a;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      border-radius: 12px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
      z-index: 10000;
    }
    .yt-pins-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      margin-bottom: 6px;
      background: #f3f3f3;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: move;
      user-select: none;
    }
    .yt-pins-list {
      padding: 4px 0;
    }
    .bookmark-entry {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 6px;
      margin-bottom: 4px;
      background: #f9f9f9;
      border-radius: 8px;
      transition: background 0.2s;
      min-width: 0;
    }
    .bookmark-entry:hover {
      background: #eee;
    }
    .bookmark-input {
      flex: 1;
      margin-right: 6px;
      padding: 4px 6px;
      border: 1px solid transparent;
      border-radius: 6px;
      font-size: 13px;
      background: #fff;
      min-width: 0;
    }
    .bookmark-input:focus {
      outline: none;
      border-color: #065fd4;
      background: #eef5ff;
    }
    .bookmark-time {
      white-space: nowrap;
      padding: 2px 4px;
      font-size: 12px;
      font-weight: 600;
      color: #065fd4;
      background: #eee;
      border-radius: 6px;
      cursor: pointer;
    }
    .delete-btn {
      background: none;
      border: none;
      color: #ff4d4f;
      font-size: 14px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .delete-btn:hover {
      transform: scale(1.1);
    }
    .ytp-pin-btn {
      position: absolute !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      bottom: 6px !important;
      padding: 4px !important;
      font-size: 20px !important;
      background: rgba(0, 0, 0, 0.6) !important;
      color: #fff !important;
      border: none !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      z-index: 10002 !important;
      pointer-events: auto !important;
    }
    .ytp-pin-label {
      position: absolute;
      top: -18px;
      transform: translateX(-50%);
      padding: 2px 4px;
      font-size: 10px;
      color: #fff;
      background: rgba(0, 0, 0, 0.75);
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10000;
    }
    #yt-pins-share-ui button {
      padding: 4px 6px;
      font-size: 12px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: #065fd4;
      color: #fff;
      transition: background 0.2s;
    }
    #yt-pins-share-ui button:hover {
      background: #054cb2;
    }
    .undo-btn {
      margin-left: 4px;
      padding: 2px 6px;
      font-size: 12px;
      font-weight: 600;
      background: #ffeaea;
      color: #d32f2f;
      border: 1px solid #f77;
      border-radius: 6px;
      cursor: pointer;
    }
    .undo-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `;
  document.head.appendChild(style);

  function formatTime(t) {
    const m = Math.floor(t / 60);
    const s = String(Math.floor(t % 60)).padStart(2, '0');
    return `${m}:${s}`;
  }

  function getVideoId() {
    return new URLSearchParams(location.search).get('v');
  }

  function loadBookmarks() {
    const saved = localStorage.getItem(`yt-pins-${getVideoId()}`);
    bookmarks = saved ? JSON.parse(saved) : [];
  }

  function saveBookmarks() {
    localStorage.setItem(`yt-pins-${getVideoId()}`, JSON.stringify(bookmarks));
  }

  function renderPins() {
    const bar = document.querySelector('.ytp-progress-bar');
    if (!bar || !video) return;
    bar.querySelectorAll('.yt-pin, .ytp-pin-label').forEach(n => n.remove());
    const barWidth = bar.clientWidth;
    const placed = [];

    bookmarks.forEach(bm => {
      const frac = bm.time / video.duration;
      const leftPx = frac * barWidth;
      const pct = frac * 100 + '%';

      const pin = document.createElement('div');
      pin.className = 'yt-pin';
      pin.style.left = pct;
      bar.appendChild(pin);

      const lbl = document.createElement('div');
      lbl.className = 'ytp-pin-label';
      lbl.style.left = pct;
      lbl.textContent = bm.label;
      bar.appendChild(lbl);

      const lblW = lbl.offsetWidth;
      const lblH = lbl.offsetHeight;
      let lvl = 0;
      for (const p of placed) {
        if (Math.abs(leftPx - p.left) < (lblW + p.width) / 2) {
          lvl = Math.max(lvl, p.level + 1);
        }
      }
      const base = -18;
      const gap = lblH + 2;
      lbl.style.top = base - lvl * gap + 'px';
      pin.style.top = lbl.offsetTop + lbl.offsetHeight + 'px';
      pin.style.bottom = '0px';
      placed.push({ left: leftPx, width: lblW, level: lvl });
    });
  }

  function addBookmark() {
    if (!video) return;
    const input = prompt('Enter label:', 'Bookmark');
    if (typeof input !== 'string') return;
    const label = input.trim() || 'Bookmark';
    bookmarks.push({ time: video.currentTime, label });
    saveBookmarks();
    renderPins();
    renderSidebar();
    lastDeleted = null;
    updateUndoButton();
  }

  function deleteBookmark(i) {
    lastDeleted = { bookmark: bookmarks[i], index: i };
    bookmarks.splice(i, 1);
    saveBookmarks();
    renderPins();
    renderSidebar();
    updateUndoButton();
  }

  function undoDelete() {
    if (!lastDeleted) return;
    bookmarks.splice(lastDeleted.index, 0, lastDeleted.bookmark);
    saveBookmarks();
    renderPins();
    renderSidebar();
    lastDeleted = null;
    updateUndoButton();
  }

  function updateUndoButton() {
    if (undoBtn) undoBtn.disabled = !lastDeleted;
  }

  function createSidebar() {
    sidebar = document.createElement('div');
    sidebar.className = 'yt-pins-sidebar';

    header = document.createElement('div');
    header.className = 'yt-pins-header';
    header.textContent = 'YTBookmarks';

    // Undo button
    undoBtn = document.createElement('button');
    undoBtn.textContent = 'Undo';
    undoBtn.className = 'undo-btn';
    undoBtn.disabled = true;
    undoBtn.addEventListener('click', undoDelete);
    header.appendChild(undoBtn);

    sidebar.appendChild(header);
    listContainer = document.createElement('div');
    listContainer.className = 'yt-pins-list';
    sidebar.appendChild(listContainer);
    document.body.appendChild(sidebar);

    // Drag logic
    header.addEventListener('mousedown', e => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = sidebar.getBoundingClientRect();
      const dx = startX - rect.left;
      const dy = startY - rect.top;
      function onMove(ev) {
        sidebar.style.left = (ev.clientX - dx) + 'px';
        sidebar.style.top = (ev.clientY - dy) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Pin button
    pinBtn = document.createElement('button');
    pinBtn.className = 'ytp-pin-btn';
    pinBtn.textContent = '📌';
    pinBtn.title = 'Add Bookmark';
    pinBtn.addEventListener('click', e => {
      e.stopPropagation();
      addBookmark();
    });
    const ctrls = document.querySelector('.ytp-chrome-bottom');
    (ctrls || document.body).appendChild(pinBtn);
  }

  function renderSidebar() {
    listContainer.innerHTML = '';
    if (!bookmarks.length) {
      const ph = document.createElement('div');
      ph.textContent = 'No bookmarks yet';
      ph.style.color = '#888';
      listContainer.appendChild(ph);
      return;
    }
    const sorted = bookmarks
      .map((bm, i) => ({ bm, index: i }))
      .sort((a, b) => a.bm.time - b.bm.time);

    sorted.forEach(({ bm, index }, pos) => {
      const entry = document.createElement('div');
      entry.className = 'bookmark-entry';
      entry.addEventListener('click', () => {
        video.currentTime = bm.time;
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.value = bm.label;
      input.className = 'bookmark-input';
      input.addEventListener('focus', () => input.select());
      input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          input.blur();
        }
      });
      input.addEventListener('blur', () => {
        bm.label = input.value.trim() || String(pos + 1);
        saveBookmarks();
        renderPins();
        renderSidebar();
      });
      input.addEventListener('click', ev => ev.stopPropagation());

      const ts = document.createElement('span');
      ts.className = 'bookmark-time';
      ts.textContent = formatTime(bm.time);
      ts.addEventListener('click', ev => {
        ev.stopPropagation();
        video.currentTime = bm.time;
      });

      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.textContent = '✖';
      del.title = 'Delete';
      del.addEventListener('click', ev => {
        ev.stopPropagation();
        deleteBookmark(index);
      });

      entry.append(input, ts, del);
      listContainer.appendChild(entry);
    });
  }

  function destroySidebar() {
    if (sidebar) sidebar.remove();
    if (pinBtn) pinBtn.remove();
    sidebar = listContainer = header = pinBtn = undoBtn = null;
  }

  function initShareUI() {
    if (document.getElementById('yt-pins-share-ui')) return;
    const share = document.createElement('div');
    share.id = 'yt-pins-share-ui';
    share.style = 'position:fixed;bottom:10px;right:10px;z-index:10000;display:flex;gap:5px;';

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export Bookmarks';
    exportBtn.onclick = () => {
      const vidId = getVideoId();
      const payload = { videoId: vidId, bookmarks };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const defaultName = `yt-bookmarks-${vidId}.json`;
      const fname = prompt('Filename to save as:', defaultName);
      if (!fname) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
    };

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import Bookmarks';
    importBtn.onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'application/json';
      inp.onchange = () => {
        const file = inp.files[0];
        const r = new FileReader();
        r.onload = e => {
          try {
            const data = JSON.parse(e.target.result);
            if (data.videoId !== getVideoId()) {
              return alert('⚠️ This file is for a different video.');
            }
            bookmarks = data.bookmarks;
            saveBookmarks();
            renderPins();
            renderSidebar();
          } catch {
            alert('⚠️ Invalid bookmarks file.');
          }
        };
        r.readAsText(file);
      };
      inp.click();
    };

    share.append(exportBtn, importBtn);
    document.body.appendChild(share);
  }

  function initAll() {
    const onWatch = location.pathname === '/watch' && document.querySelector('video');
    if (!onWatch) return destroySidebar();
    video = document.querySelector('video');
    loadBookmarks();
    renderPins();
    if (!sidebar) createSidebar();
    renderSidebar();
    initShareUI();
  }

  let last = location.href;
  new MutationObserver(() => {
    if (location.href !== last) {
      last = location.href;
      setTimeout(initAll, 500);
    }
  }).observe(document, { childList: true, subtree: true });

  window.addEventListener('yt-navigate-finish', initAll);
  initAll();
})();
