(function() {
  'use strict';

  let video, bookmarks = [];
  let sidebar, listContainer, header, pinBtn, undoBtn, settingsBtn;
  let lastDeleted = null;
  let settings = {
    showLabels: true,
    autoPause: true,
    showPrompt: true
  };

  // Load settings from storage
  const savedSettings = localStorage.getItem('yt-pins-settings');
  if (savedSettings) {
    settings = { ...settings, ...JSON.parse(savedSettings) };
  }

  // Load external styles
  function injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles.css');
    document.head.appendChild(link);
  }

  // Ensure styles are injected when the document is ready
  if (document.head) {
    injectStyles();
  } else {
    const observer = new MutationObserver(() => {
      if (document.head) {
        injectStyles();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

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

  function saveSettings() {
    localStorage.setItem('yt-pins-settings', JSON.stringify(settings));
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

      // Make pin follow the played portion of the video
      const updatePinVisibility = () => {
        const progress = video.currentTime / video.duration;
        if (progress >= bm.time / video.duration) {
          pin.classList.add('played');
          if (settings.showLabels) {
            // When labels are shown, pin extends from progress bar to label
            pin.style.bottom = '0';
            pin.style.height = 'auto';
            pin.style.top = pin.dataset.labelBottom + 'px';
          } else {
            // When labels are hidden, pin only shows in progress bar
            pin.style.top = 'unset';
            pin.style.bottom = '0';
            pin.style.height = '100%';
          }
        } else {
          pin.classList.remove('played');
          if (settings.showLabels) {
            // When labels are shown, pin extends from progress bar to label
            pin.style.bottom = '0';
            pin.style.height = 'auto';
            pin.style.top = pin.dataset.labelBottom + 'px';
          } else {
            // When labels are hidden, pin only shows in progress bar
            pin.style.top = 'unset';
            pin.style.bottom = '0';
            pin.style.height = '100%';
          }
        }
      };

      video.addEventListener('timeupdate', updatePinVisibility);
      bar.appendChild(pin);

      if (settings.showLabels) {
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
        // Store the label's bottom position for the pin
        pin.dataset.labelBottom = lbl.offsetTop + lbl.offsetHeight;
        placed.push({ left: leftPx, width: lblW, level: lvl });
      }

      updatePinVisibility();
    });
  }

  function addBookmark() {
    if (!video) return;
    
    if (settings.autoPause) {
      video.pause();
    }

    let label = 'Bookmark';
    if (settings.showPrompt) {
      const input = prompt('Enter label:', 'Bookmark');
      if (typeof input !== 'string') {
        if (settings.autoPause) video.play();
        return;
      }
      label = input.trim() || 'Bookmark';
      // Auto-resume if both auto-pause and prompt are enabled
      if (settings.autoPause && settings.showPrompt) {
        video.play();
      }
    }

    bookmarks.push({ time: video.currentTime, label });
    saveBookmarks();
    renderPins();
    renderSidebar();
    lastDeleted = null;
    updateUndoButton();
  }

  function clearAllBookmarks() {
    if (!bookmarks.length) return;
    if (confirm('Are you sure you want to delete all bookmarks?')) {
      lastDeleted = { bookmarks: [...bookmarks], type: 'clear-all' };
      bookmarks = [];
      saveBookmarks();
      renderPins();
      renderSidebar();
      updateUndoButton();
    }
  }

  function deleteBookmark(i) {
    lastDeleted = { bookmark: bookmarks[i], index: i, type: 'single' };
    bookmarks.splice(i, 1);
    saveBookmarks();
    renderPins();
    renderSidebar();
    updateUndoButton();
  }

  function undoDelete() {
    if (!lastDeleted) return;
    if (lastDeleted.type === 'clear-all') {
      bookmarks = [...lastDeleted.bookmarks];
    } else {
      bookmarks.splice(lastDeleted.index, 0, lastDeleted.bookmark);
    }
    saveBookmarks();
    renderPins();
    renderSidebar();
    lastDeleted = null;
    updateUndoButton();
  }

  function updateUndoButton() {
    if (undoBtn) undoBtn.disabled = !lastDeleted;
  }

  function createSettingsMenu() {
    const menu = document.createElement('div');
    menu.className = 'settings-menu';

    const createToggle = (text, key) => {
      const item = document.createElement('div');
      item.className = 'settings-menu-item';
      
      const label = document.createElement('span');
      label.textContent = text;
      
      const toggle = document.createElement('label');
      toggle.className = 'toggle-switch';
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = settings[key];
      input.addEventListener('change', () => {
        settings[key] = input.checked;
        saveSettings();
        renderPins();
      });
      
      const slider = document.createElement('span');
      slider.className = 'toggle-slider';
      
      toggle.append(input, slider);
      item.append(label, toggle);
      return item;
    };

    menu.append(
      createToggle('Show Labels', 'showLabels'),
      createToggle('Auto-Pause on Bookmark', 'autoPause'),
      createToggle('Show Bookmark Prompt', 'showPrompt')
    );

    return menu;
  }

  function createSidebar() {
    sidebar = document.createElement('div');
    sidebar.className = 'yt-pins-sidebar';

    header = document.createElement('div');
    header.className = 'yt-pins-header';

    // Clear all button
    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = '🗑️';
    clearAllBtn.className = 'clear-all-btn';
    clearAllBtn.title = 'Clear All Bookmarks';
    clearAllBtn.addEventListener('click', clearAllBookmarks);

    // Undo button
    undoBtn = document.createElement('button');
    undoBtn.textContent = 'Undo';
    undoBtn.className = 'undo-btn';
    undoBtn.disabled = true;
    undoBtn.addEventListener('click', undoDelete);

    header.append('YTBookmarks', clearAllBtn, undoBtn);
    sidebar.appendChild(header);
    listContainer = document.createElement('div');
    listContainer.className = 'yt-pins-list';
    sidebar.appendChild(listContainer);
    document.body.appendChild(sidebar);

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'yt-pins-buttons-container';

    // Settings button
    settingsBtn = document.createElement('button');
    settingsBtn.className = 'settings-btn';
    settingsBtn.textContent = '⚙️';
    settingsBtn.title = 'Settings';
    
    // Create settings menu
    const settingsMenu = createSettingsMenu();
    document.body.appendChild(settingsMenu);
    
    let hideMenuTimeout;
    
    const showMenu = () => {
      clearTimeout(hideMenuTimeout);
      const btnRect = settingsBtn.getBoundingClientRect();
      const menuWidth = 220; // Match the min-width from CSS
      settingsMenu.style.top = 'auto';
      settingsMenu.style.bottom = (window.innerHeight - btnRect.top + 8) + 'px';
      settingsMenu.style.left = (btnRect.left + (btnRect.width / 2) - (menuWidth / 2)) + 'px';
      settingsMenu.classList.add('visible');
    };

    const hideMenu = () => {
      hideMenuTimeout = setTimeout(() => {
        settingsMenu.classList.remove('visible');
      }, 100);
    };

    settingsBtn.addEventListener('mouseenter', showMenu);
    settingsBtn.addEventListener('mouseleave', hideMenu);
    settingsMenu.addEventListener('mouseenter', () => clearTimeout(hideMenuTimeout));
    settingsMenu.addEventListener('mouseleave', hideMenu);

    // Pin button
    pinBtn = document.createElement('button');
    pinBtn.className = 'ytp-pin-btn';
    pinBtn.textContent = '📌';
    pinBtn.title = 'Add Bookmark';
    pinBtn.addEventListener('click', e => {
      e.stopPropagation();
      addBookmark();
    });

    // Add both buttons to container
    buttonsContainer.append(pinBtn, settingsBtn);

    // Add container to video controls
    const ctrls = document.querySelector('.ytp-chrome-bottom');
    (ctrls || document.body).appendChild(buttonsContainer);

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
    if (document.querySelector('.yt-pins-buttons-container')) {
      document.querySelector('.yt-pins-buttons-container').remove();
    }
    sidebar = listContainer = header = pinBtn = settingsBtn = null;
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
    if (!onWatch) {
      destroySidebar();
      return;
    }

    // Wait for video player to be ready
    const waitForVideo = () => {
      video = document.querySelector('video');
      if (!video || !document.querySelector('.ytp-progress-bar')) {
        setTimeout(waitForVideo, 100);
        return;
      }
      
      loadBookmarks();
      renderPins();
      if (!sidebar) createSidebar();
      renderSidebar();
      initShareUI();
    };
    
    waitForVideo();
  }

  // Handle YouTube's navigation
  let last = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== last) {
      last = location.href;
      if (location.pathname === '/watch') {
        setTimeout(initAll, 100);
      } else {
        destroySidebar();
      }
    }
  });

  // Start observing as early as possible
  if (document.body) {
    observer.observe(document, { childList: true, subtree: true });
    initAll();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document, { childList: true, subtree: true });
      initAll();
    });
  }

  // Handle YouTube's custom navigation events
  window.addEventListener('yt-navigate-start', () => {
    destroySidebar();
  });

  window.addEventListener('yt-navigate-finish', () => {
    if (location.pathname === '/watch') {
      setTimeout(initAll, 100);
    }
  });
})();
