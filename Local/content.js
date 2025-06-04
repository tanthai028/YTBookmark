(function() {
  'use strict';

  let video, bookmarks = [];
  let sidebar, listContainer, header, pinBtn, undoBtn;
  let lastDeleted = null;

  // Load external styles
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('styles.css');
  document.head.appendChild(link);

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
    video.pause(); // Pause the video when adding a bookmark
    const input = prompt('Enter label:', 'Bookmark');
    if (typeof input !== 'string') {
      video.play(); // Resume playback if user cancels the prompt
      return;
    }
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
