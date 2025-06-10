(function() {
  'use strict';

  let video, bookmarks = [];
  let sidebar, listContainer, header, pinBtn, undoBtn, settingsBtn;
  let lastDeleted = null;
  let settings = {
    showLabels: true  // Only keeping the labels visibility setting
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
    const video = stateManager.get('video');
    const settings = stateManager.get('settings');
    const bookmarks = stateManager.get('bookmarks') || [];
    
    if (!bar || !video) return;
    bar.querySelectorAll('.yt-pin, .ytp-pin-label').forEach(n => n.remove());
    
    // Wait for next frame to ensure dimensions are correct
    requestAnimationFrame(() => {
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
            if (settings.showLabels && !pin.dataset.isEdgeLabel) {
              pin.style.bottom = '0';
              pin.style.height = 'auto';
              pin.style.top = pin.dataset.labelBottom + 'px';
            } else {
              pin.style.top = 'unset';
              pin.style.bottom = '0';
              pin.style.height = '100%';
            }
          } else {
            pin.classList.remove('played');
            if (settings.showLabels && !pin.dataset.isEdgeLabel) {
              pin.style.bottom = '0';
              pin.style.height = 'auto';
              pin.style.top = pin.dataset.labelBottom + 'px';
            } else {
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
          lbl.textContent = bm.label;
          bar.appendChild(lbl);

          // Get dimensions after adding to DOM and next frame
          requestAnimationFrame(() => {
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

            // Handle edge cases for labels at start and end of video
            if (leftPx < lblW * 0.3) {
              // Near start of video
              lbl.style.left = '0';
              lbl.style.transform = 'none';
              lbl.classList.add('edge-left');
              lbl.style.marginLeft = leftPx < lblW / 4 ? '-2px' : '0px';
              pin.dataset.isEdgeLabel = 'true';
            } else if (leftPx > barWidth - lblW / 2) {
              // Near end of video
              lbl.style.left = 'auto';
              lbl.style.right = '0';
              lbl.style.transform = 'none';
              lbl.classList.add('edge-right');
              lbl.style.marginRight = (leftPx > barWidth - lblW / 4) ? '0.5px' : '0px';
              pin.dataset.isEdgeLabel = 'true';
            } else {
              // Normal case - center the label
              lbl.style.left = pct;
              lbl.style.transform = 'translateX(-50%)';
              lbl.style.marginLeft = '0';
              lbl.style.marginRight = '0';
            }

            // Store the label's bottom position for the pin
            pin.dataset.labelBottom = lbl.offsetTop + lbl.offsetHeight;
            placed.push({ left: leftPx, width: lblW, level: lvl });

            // Force initial pin visibility update
            updatePinVisibility();
          });
        }
      });
    });
  }

  function addBookmark() {
    const video = stateManager.get('video');
    if (!video) return;
    
    const bookmarks = stateManager.get('bookmarks') || [];
    const newBookmark = { time: video.currentTime, label: 'Bookmark' };
    bookmarks.push(newBookmark);
    stateManager.set('bookmarks', bookmarks);
    stateManager.saveBookmarks();
    stateManager.set('lastDeleted', null);
    
    renderPins();
    renderSidebar();
    updateUndoButton();
  }

  function clearAllBookmarks() {
    const bookmarks = stateManager.get('bookmarks') || [];
    if (!bookmarks.length) return;
    
    if (confirm('Are you sure you want to delete all bookmarks?')) {
        stateManager.set('lastDeleted', { bookmarks: [...bookmarks], type: 'clear-all' });
        stateManager.set('bookmarks', []);
        stateManager.saveBookmarks();
        renderPins();
        renderSidebar();
        updateUndoButton();
    }
  }

  function deleteBookmark(i) {
    const bookmarks = stateManager.get('bookmarks') || [];
    stateManager.set('lastDeleted', { bookmark: bookmarks[i], index: i, type: 'single' });
    bookmarks.splice(i, 1);
    stateManager.set('bookmarks', bookmarks);
    stateManager.saveBookmarks();
    renderPins();
    renderSidebar();
    updateUndoButton();
  }

  function undoDelete() {
    const lastDeleted = stateManager.get('lastDeleted');
    if (!lastDeleted) return;

    if (lastDeleted.type === 'clear-all') {
        stateManager.set('bookmarks', [...lastDeleted.bookmarks]);
    } else {
        const bookmarks = stateManager.get('bookmarks') || [];
        bookmarks.splice(lastDeleted.index, 0, lastDeleted.bookmark);
        stateManager.set('bookmarks', bookmarks);
    }
    
    stateManager.saveBookmarks();
    stateManager.set('lastDeleted', null);
    renderPins();
    renderSidebar();
    updateUndoButton();
  }

  function updateUndoButton() {
    const undoBtn = stateManager.get('ui.undoBtn');
    const lastDeleted = stateManager.get('lastDeleted');
    if (undoBtn) undoBtn.disabled = !lastDeleted;
  }

  function createSidebar() {
    sidebar = document.createElement('div');
    stateManager.set('ui.sidebar', sidebar);
    sidebar.className = 'yt-pins-sidebar';

    // Load visibility state from storage
    const isVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
    if (!isVisible) {
        sidebar.classList.add('hidden');
        if (document.getElementById('yt-pins-share-ui')) {
            document.getElementById('yt-pins-share-ui').classList.add('hidden');
        }
        // Also update showLabels setting when UI is hidden
        const settings = stateManager.get('settings');
        settings.showLabels = false;
        stateManager.set('settings', settings);
        stateManager.saveSettings();
    }

    header = document.createElement('div');
    stateManager.set('ui.header', header);
    header.className = 'yt-pins-header';

    // Create title section with icon
    const titleSection = document.createElement('div');
    titleSection.className = 'title-section';
    
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icon48.png');
    icon.alt = 'YTBookmarks';
    
    titleSection.append(icon, 'YTBookmarks');

    // Create buttons group
    const buttonsGroup = document.createElement('div');
    buttonsGroup.className = 'header-buttons-group';

    // Clear all button
    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = '🗑️';
    clearAllBtn.className = 'clear-all-btn';
    clearAllBtn.title = 'Clear All Bookmarks';
    clearAllBtn.addEventListener('click', clearAllBookmarks);

    // Undo button
    undoBtn = document.createElement('button');
    stateManager.set('ui.undoBtn', undoBtn);
    undoBtn.textContent = 'Undo';
    undoBtn.className = 'undo-btn';
    undoBtn.disabled = true;
    undoBtn.addEventListener('click', undoDelete);

    // Add buttons to group
    buttonsGroup.append(clearAllBtn, undoBtn);

    // Add sections to header
    header.append(titleSection, buttonsGroup);

    // Add header to sidebar
    sidebar.appendChild(header);

    listContainer = document.createElement('div');
    stateManager.set('ui.listContainer', listContainer);
    listContainer.className = 'yt-pins-list';
    sidebar.appendChild(listContainer);
    document.body.appendChild(sidebar);

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'yt-pins-buttons-container';

    // Pin button
    pinBtn = document.createElement('button');
    stateManager.set('ui.pinBtn', pinBtn);
    pinBtn.className = 'ytp-pin-btn';
    pinBtn.textContent = '📌';
    pinBtn.title = '';
    pinBtn.addEventListener('click', e => {
        e.stopPropagation();
        addBookmark();
    });

    const pinTooltip = document.createElement('div');
    pinTooltip.className = 'button-tooltip';
    pinTooltip.textContent = 'Bookmark';
    pinBtn.appendChild(pinTooltip);

    // Visibility toggle button
    const visibilityBtn = document.createElement('button');
    visibilityBtn.className = 'visibility-btn';
    
    const visibilityIcon = document.createElement('span');
    visibilityIcon.textContent = isVisible ? '👁️' : '👁️‍🗨️';
    visibilityBtn.appendChild(visibilityIcon);
    
    const visibilityTooltip = document.createElement('div');
    visibilityTooltip.className = 'button-tooltip';
    visibilityTooltip.textContent = isVisible ? 'Hide UI' : 'Show UI';
    visibilityBtn.appendChild(visibilityTooltip);

    visibilityBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isCurrentlyVisible = !sidebar.classList.contains('hidden');
        const shareUI = document.getElementById('yt-pins-share-ui');
        
        if (isCurrentlyVisible) {
            sidebar.classList.add('hidden');
            if (shareUI) {
                shareUI.classList.add('hidden');
            }
            visibilityIcon.textContent = '👁️‍🗨️';
            visibilityTooltip.textContent = 'Show UI';
            // Hide labels when UI is hidden
            const settings = stateManager.get('settings');
            settings.showLabels = false;
            stateManager.set('settings', settings);
            stateManager.saveSettings();
        } else {
            sidebar.classList.remove('hidden');
            if (shareUI) {
                shareUI.classList.remove('hidden');
            }
            visibilityIcon.textContent = '👁️';
            visibilityTooltip.textContent = 'Hide UI';
            // Show labels when UI is shown
            const settings = stateManager.get('settings');
            settings.showLabels = true;
            stateManager.set('settings', settings);
            stateManager.saveSettings();
        }
        localStorage.setItem('yt-pins-visibility', isCurrentlyVisible ? 'hidden' : 'visible');
        renderPins();  // Re-render pins to update labels visibility
    });

    // Add buttons to container
    buttonsContainer.append(pinBtn, visibilityBtn);

    // Add container to video controls
    const ctrls = document.querySelector('.ytp-right-controls');
    if (ctrls) {
        ctrls.prepend(buttonsContainer);
    } else {
        document.body.appendChild(buttonsContainer);
    }

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
    const listContainer = stateManager.get('ui.listContainer');
    const bookmarks = stateManager.get('bookmarks') || [];
    const video = stateManager.get('video');

    // Safety check for listContainer
    if (!listContainer || !document.body.contains(listContainer)) {
      console.warn('List container not found or not in document, recreating sidebar...');
      createSidebar();
      return;
    }

    try {
      listContainer.innerHTML = '';
      if (!bookmarks.length) {
        const ph = document.createElement('div');
        ph.className = 'empty-message';
        ph.textContent = 'No bookmarks yet';
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
          if (video && document.body.contains(video)) {
            video.currentTime = bm.time;
          }
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
          const updatedBookmarks = stateManager.get('bookmarks');
          updatedBookmarks[index].label = input.value.trim() || String(pos + 1);
          stateManager.set('bookmarks', updatedBookmarks);
          stateManager.saveBookmarks();
          renderPins();
          renderSidebar();
        });
        input.addEventListener('click', ev => ev.stopPropagation());

        const ts = document.createElement('span');
        ts.className = 'bookmark-time';
        ts.textContent = formatTime(bm.time);
        ts.addEventListener('click', ev => {
          ev.stopPropagation();
          if (video && document.body.contains(video)) {
            video.currentTime = bm.time;
          }
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
    } catch (error) {
      console.error('Error rendering sidebar:', error);
      setTimeout(() => {
        destroySidebar();
        createSidebar();
      }, 1000);
    }
  }

  function destroySidebar() {
    const sidebar = stateManager.get('ui.sidebar');
    const pinBtn = stateManager.get('ui.pinBtn');
    
    if (sidebar) sidebar.remove();
    if (pinBtn) pinBtn.remove();
    
    const buttonsContainer = document.querySelector('.yt-pins-buttons-container');
    if (buttonsContainer) buttonsContainer.remove();
    
    const shareUI = document.getElementById('yt-pins-share-ui');
    if (shareUI) shareUI.remove();

    // Clear UI references in state
    stateManager.set('ui', {
        sidebar: null,
        listContainer: null,
        header: null,
        pinBtn: null,
        undoBtn: null,
        settingsBtn: null
    });
  }

  function initShareUI() {
    if (document.getElementById('yt-pins-share-ui')) return;
    const share = document.createElement('div');
    share.id = 'yt-pins-share-ui';

    // Load visibility state from storage and apply it
    const isVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
    if (!isVisible) {
        share.classList.add('hidden');
    }

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export Bookmarks';
    exportBtn.onclick = () => {
        const vidId = getVideoId();
        const bookmarks = stateManager.get('bookmarks') || [];
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
                    stateManager.set('bookmarks', data.bookmarks);
                    stateManager.saveBookmarks();
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

    const kofiBtn = document.createElement('button');
    kofiBtn.textContent = '☕ Support';
    kofiBtn.style.position = 'relative';
    
    const kofiPopup = document.createElement('div');
    kofiPopup.className = 'kofi-popup';
    const kofiFrame = document.createElement('iframe');
    kofiFrame.src = 'https://ko-fi.com/tht028/?hidefeed=true&widget=true&embed=true&preview=true';
    kofiFrame.title = 'Ko-fi';
    kofiPopup.appendChild(kofiFrame);
    kofiBtn.appendChild(kofiPopup);

    // Add hover handling with delay and animations
    let hideTimeout;
    const showPopup = () => {
        clearTimeout(hideTimeout);
        // Add visible class to trigger animation
        requestAnimationFrame(() => {
            kofiPopup.classList.add('visible');
        });
    };
    const hidePopup = () => {
        hideTimeout = setTimeout(() => {
            if (!kofiPopup.matches(':hover')) {
                // Remove visible class to trigger animation
                kofiPopup.classList.remove('visible');
            }
        }, 250); // Change this number to adjust how long the panel stays visible (in milliseconds)
    };

    kofiBtn.addEventListener('mouseenter', showPopup);
    kofiBtn.addEventListener('mouseleave', hidePopup);
    kofiPopup.addEventListener('mouseenter', showPopup);
    kofiPopup.addEventListener('mouseleave', hidePopup);

    share.append(exportBtn, importBtn, kofiBtn);
    document.body.appendChild(share);

    // Handle fullscreen changes
    const updateVisibility = () => {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        share.style.display = isFullscreen ? 'none' : 'flex';
    };

    document.addEventListener('fullscreenchange', updateVisibility);
    document.addEventListener('webkitfullscreenchange', updateVisibility);
    updateVisibility();
  }

  function initAll() {
    try {
        const onWatch = location.pathname === '/watch' && document.querySelector('video');
        if (!onWatch) {
            destroySidebar();
            return;
        }

        const waitForVideo = () => {
            try {
                const video = document.querySelector('video');
                const progressBar = document.querySelector('.ytp-progress-bar');
                
                if (!video || !progressBar || !document.body.contains(video)) {
                    setTimeout(waitForVideo, 100);
                    return;
                }
                
                stateManager.set('video', video);
                stateManager.loadBookmarks();
                stateManager.loadSettings();
                
                renderPins();
                if (!stateManager.get('ui.sidebar') || !document.body.contains(stateManager.get('ui.sidebar'))) {
                    createSidebar();
                }
                renderSidebar();
                initShareUI();
            } catch (error) {
                console.error('Error in waitForVideo:', error);
                setTimeout(waitForVideo, 100);
            }
        };
        
        waitForVideo();
    } catch (error) {
        console.error('Error in initAll:', error);
    }
  }

  // Update the observer code to use state manager
  let last = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== last) {
      last = location.href;
      if (location.pathname === '/watch') {
        setTimeout(initAll, 100);
      } else {
        destroySidebar();
        // Clear video reference when leaving watch page
        stateManager.set('video', null);
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
    stateManager.set('video', null);
  });

  window.addEventListener('yt-navigate-finish', () => {
    if (location.pathname === '/watch') {
      setTimeout(initAll, 100);
    }
  });

  // Add error handling for extension context
  window.addEventListener('error', (event) => {
    if (event.error && event.error.message === 'Extension context invalidated.') {
      console.warn('Extension context invalidated, cleaning up...');
      try {
        // Clean up any existing elements
        destroySidebar();
        // Remove all event listeners
        window.removeEventListener('yt-navigate-start', destroySidebar);
        window.removeEventListener('yt-navigate-finish', initAll);
        // Disconnect any observers
        if (observer) {
          observer.disconnect();
        }
      } catch (e) {
        console.error('Error during cleanup:', e);
      }
    }
  });

  class StateManager {
    constructor() {
      this.state = {
        video: null,
        bookmarks: [],
        settings: {
          showLabels: true,
          showPrompt: true  // This will now handle both prompt and auto-pause
        },
        lastDeleted: null,
        ui: {
          sidebar: null,
          listContainer: null,
          header: null,
          pinBtn: null,
          undoBtn: null,
          settingsBtn: null
        }
      };
      
      this.listeners = new Map();
    }

    // Get state
    get(key) {
      return key.split('.').reduce((obj, k) => obj?.[k], this.state);
    }

    // Update state
    set(key, value) {
      const keys = key.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((obj, k) => obj[k] = obj[k] || {}, this.state);
      target[lastKey] = value;
      this.notify(key);
    }

    // Subscribe to state changes
    subscribe(key, callback) {
      if (!this.listeners.has(key)) {
        this.listeners.set(key, new Set());
      }
      this.listeners.get(key).add(callback);
    }

    // Unsubscribe from state changes
    unsubscribe(key, callback) {
      if (this.listeners.has(key)) {
        this.listeners.get(key).delete(callback);
      }
    }

    // Notify listeners of state changes
    notify(key) {
      if (this.listeners.has(key)) {
        const value = this.get(key);
        this.listeners.get(key).forEach(callback => callback(value));
      }
    }

    // Load settings from storage
    loadSettings() {
      const savedSettings = localStorage.getItem('yt-pins-settings');
      if (savedSettings) {
        this.set('settings', { ...this.get('settings'), ...JSON.parse(savedSettings) });
      }
    }

    // Save settings to storage
    saveSettings() {
      localStorage.setItem('yt-pins-settings', JSON.stringify(this.get('settings')));
    }

    // Load bookmarks for current video
    loadBookmarks() {
      const videoId = getVideoId();
      const saved = localStorage.getItem(`yt-pins-${videoId}`);
      this.set('bookmarks', saved ? JSON.parse(saved) : []);
    }

    // Save bookmarks for current video
    saveBookmarks() {
      const videoId = getVideoId();
      localStorage.setItem(`yt-pins-${videoId}`, JSON.stringify(this.get('bookmarks')));
    }
  }

  // Create global state manager instance
  const stateManager = new StateManager();
})();
