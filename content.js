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

  // Load label visibility state from storage
  const labelVisibility = localStorage.getItem('yt-pins-label-visibility');
  if (labelVisibility !== null) {
    settings.showLabels = labelVisibility === 'true';
  }

  // Load external styles
  function injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles.css');
    document.head.appendChild(link);

    // Add force-hidden style with !important and transition
    const style = document.createElement('style');
    style.textContent = `
        .force-hidden {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: fixed !important;
            z-index: -1 !important;
        }
        .yt-pins-sidebar {
            transition: opacity 0.2s ease-in-out;
        }
    `;
    document.head.appendChild(style);
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
    
    // Always clean up existing pins first
    if (bar) {
        bar.querySelectorAll('.yt-pin, .ytp-pin-label').forEach(n => n.remove());
    }
    
    // Only proceed with rendering if we have all required elements AND have bookmarks to render
    if (!bar || !video || !video.duration || !bookmarks.length) return;
    
    // Wait for next frame to ensure dimensions are correct
    requestAnimationFrame(() => {
        const barWidth = bar.clientWidth;
        if (!barWidth) return;
        
        // Sort bookmarks by time for consistent ordering
        const sortedBookmarks = [...bookmarks].sort((a, b) => a.time - b.time);
        
        // Keep track of occupied spaces at each level
        const occupiedSpaces = [[]]; // Array of arrays, each sub-array represents a level
        
        // Create pins and labels
        sortedBookmarks.forEach((bm, index) => {
            const frac = bm.time / video.duration;
            if (isNaN(frac) || frac < 0) return;
            
            const leftPx = frac * barWidth;
            const pct = frac * 100 + '%';

            const pin = document.createElement('div');
            pin.className = 'yt-pin';
            pin.style.left = pct;
            pin.style.visibility = 'visible';
            pin.style.height = '100%';
            pin.dataset.pinId = `pin-${index}`;
            bar.appendChild(pin);

            // Only create and show label if settings.showLabels is true
            const showLabels = localStorage.getItem('yt-pins-label-visibility') !== 'false';
            if (showLabels) {
                const lbl = document.createElement('div');
                lbl.className = 'ytp-pin-label';
                lbl.textContent = bm.label;
                lbl.style.visibility = 'hidden';
                lbl.dataset.pinId = `pin-${index}`;
                bar.appendChild(lbl);

                requestAnimationFrame(() => {
                    const lblW = lbl.offsetWidth;
                    const lblH = lbl.offsetHeight;
                    
                    // Function to check if a space is available at a given level
                    const isSpaceAvailable = (level, leftPos, width) => {
                        if (!occupiedSpaces[level]) return true;
                        
                        const labelStart = leftPos - width / 2;
                        const labelEnd = leftPos + width / 2;
                        
                        return !occupiedSpaces[level].some(space => {
                            const spaceStart = space.left - space.width / 2;
                            const spaceEnd = space.left + space.width / 2;
                            return !(labelEnd < spaceStart || labelStart > spaceEnd);
                        });
                    };
                    
                    // Find the lowest possible level where this label can fit
                    let lvl = 0;
                    while (!isSpaceAvailable(lvl, leftPx, lblW)) {
                        lvl++;
                        if (!occupiedSpaces[lvl]) {
                            occupiedSpaces[lvl] = [];
                        }
                    }
                    
                    // Mark this space as occupied at the chosen level
                    occupiedSpaces[lvl].push({
                        left: leftPx,
                        width: lblW
                    });

                    const base = -18;
                    const gap = lblH + 2;
                    lbl.style.top = base - lvl * gap + 'px';

                    // Handle edge cases for labels at start and end of video
                    if (leftPx < lblW * 0.3) {
                        lbl.style.left = '0';
                        lbl.style.transform = 'none';
                        lbl.classList.add('edge-left');
                        lbl.style.marginLeft = leftPx < lblW / 4 ? '-2px' : '0px';
                        pin.dataset.isEdgeLabel = 'true';
                    } else if (leftPx > barWidth - lblW / 2) {
                        lbl.style.left = 'auto';
                        lbl.style.right = '0';
                        lbl.style.transform = 'none';
                        lbl.classList.add('edge-right');
                        lbl.style.marginRight = (leftPx > barWidth - lblW / 4) ? '0.5px' : '0px';
                        pin.dataset.isEdgeLabel = 'true';
                    } else {
                        lbl.style.left = pct;
                        lbl.style.transform = 'translateX(-50%)';
                        lbl.style.marginLeft = '0';
                        lbl.style.marginRight = '0';
                    }

                    // Store the label's bottom position for the pin
                    pin.dataset.labelBottom = lbl.offsetTop + lbl.offsetHeight;
                    
                    // Set pin height to reach just to the bottom of the label
                    const labelDistanceFromBar = Math.abs(lbl.offsetTop);
                    pin.style.height = `${labelDistanceFromBar - 12}px`;
                    
                    // Show label after all calculations are done
                    lbl.style.visibility = 'visible';
                });
            }

            // Make pin follow the played portion of the video
            const updatePinVisibility = () => {
                const progress = video.currentTime / video.duration;
                if (progress >= bm.time / video.duration) {
                    pin.classList.add('played');
                } else {
                    pin.classList.remove('played');
                }
            };
            updatePinVisibility();
            video.addEventListener('timeupdate', updatePinVisibility);
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
    if (i < 0 || i >= bookmarks.length) return;
    
    stateManager.set('lastDeleted', { bookmark: bookmarks[i], index: i, type: 'single' });
    const newBookmarks = [...bookmarks];
    newBookmarks.splice(i, 1);
    stateManager.set('bookmarks', newBookmarks);
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

    // Load saved position for this video
    const videoId = getVideoId();
    const savedPosition = localStorage.getItem(`yt-pins-position-${videoId}`);
    if (savedPosition) {
        try {
            const position = JSON.parse(savedPosition);
            sidebar.style.left = position.left;
            sidebar.style.top = position.top;
            // Remove default right position when using custom position
            sidebar.style.right = 'auto';
        } catch (e) {
            console.error('Error loading saved position:', e);
        }
    }

    // Load visibility state from storage
    const isVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
    if (!isVisible) {
        sidebar.classList.add('hidden');
        if (document.getElementById('yt-pins-share-ui')) {
            document.getElementById('yt-pins-share-ui').classList.add('hidden');
        }
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
    clearAllBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        clearAllBookmarks();
    };

    // Undo button
    undoBtn = document.createElement('button');
    stateManager.set('ui.undoBtn', undoBtn);
    undoBtn.textContent = 'Undo';
    undoBtn.className = 'undo-btn';
    undoBtn.disabled = true;
    undoBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        undoDelete();
    };

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

    // Create buttons container for video player
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

    // Create visibility toggle button
    const visibilityBtn = document.createElement('button');
    visibilityBtn.className = 'visibility-btn';
    
    // Load visibility states from storage
    const uiVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
    const showLabels = localStorage.getItem('yt-pins-label-visibility') !== 'false';
    
    const visibilityIcon = document.createElement('span');
    visibilityIcon.textContent = uiVisible ? '👁️' : '👁️‍🗨️';
    visibilityBtn.appendChild(visibilityIcon);
    
    const visibilityTooltip = document.createElement('div');
    visibilityTooltip.className = 'button-tooltip';
    visibilityTooltip.textContent = uiVisible ? 'Hide UI' : 'Show UI';
    visibilityBtn.appendChild(visibilityTooltip);

    // Update settings with the loaded visibility state
    const settings = stateManager.get('settings');
    settings.showLabels = showLabels;
    stateManager.set('settings', settings);
    stateManager.saveSettings();

    visibilityBtn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        
        // Toggle visibility state
        const isCurrentlyVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
        
        // Update storage first
        localStorage.setItem('yt-pins-visibility', isCurrentlyVisible ? 'hidden' : 'visible');
        localStorage.setItem('yt-pins-label-visibility', isCurrentlyVisible ? 'false' : 'true');
        
        // Update icon and tooltip
        visibilityIcon.textContent = isCurrentlyVisible ? '👁️‍🗨️' : '👁️';
        visibilityTooltip.textContent = isCurrentlyVisible ? 'Show UI' : 'Hide UI';

        // Update settings
        const settings = stateManager.get('settings');
        settings.showLabels = !isCurrentlyVisible;
        stateManager.set('settings', settings);
        stateManager.saveSettings();

        // Update visibility immediately
        const sidebar = stateManager.get('ui.sidebar');
        const shareUI = document.getElementById('yt-pins-share-ui');
        const progressBar = document.querySelector('.ytp-progress-bar');
        
        if (sidebar) {
            sidebar.style.setProperty('display', isCurrentlyVisible ? 'none' : 'block', 'important');
        }
        if (shareUI) {
            const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            if (!isFullscreen) {
                shareUI.style.setProperty('display', isCurrentlyVisible ? 'none' : 'flex', 'important');
            }
        }
        if (progressBar) {
            progressBar.querySelectorAll('.ytp-pin-label').forEach(label => {
                label.style.setProperty('visibility', isCurrentlyVisible ? 'hidden' : 'visible', 'important');
            });
            progressBar.querySelectorAll('.yt-pin').forEach(pin => {
                if (isCurrentlyVisible) {
                    pin.style.setProperty('height', '100%', 'important');
                } else {
                    const label = progressBar.querySelector(`.ytp-pin-label[data-pin-id="${pin.dataset.pinId}"]`);
                    if (label) {
                        const labelDistanceFromBar = Math.abs(label.offsetTop);
                        pin.style.setProperty('height', `${labelDistanceFromBar - 12}px`, 'important');
                    }
                }
            });
        }

        // Re-render pins to ensure correct state
        renderPins();
    });

    // Add buttons to video player container
    buttonsContainer.append(pinBtn, visibilityBtn);

    // Add container to video controls
    const ctrls = document.querySelector('.ytp-right-controls');
    if (ctrls) {
        ctrls.prepend(buttonsContainer);
    } else {
        document.body.appendChild(buttonsContainer);
    }

    // Drag logic for sidebar
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
            // Save the position
            const videoId = getVideoId();
            const position = {
                left: sidebar.style.left,
                top: sidebar.style.top
            };
            localStorage.setItem(`yt-pins-position-${videoId}`, JSON.stringify(position));
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
          if (!updatedBookmarks || index >= updatedBookmarks.length) return;
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
          ev.preventDefault();
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
    const scrollHandler = stateManager.get('scrollHandler');
    
    if (sidebar) {
        sidebar.style.setProperty('display', 'none', 'important');
        sidebar.remove();
    }
    if (pinBtn) pinBtn.remove();
    if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
        stateManager.set('scrollHandler', null);
    }
    
    const buttonsContainer = document.querySelector('.yt-pins-buttons-container');
    if (buttonsContainer) buttonsContainer.remove();
    
    const shareUI = document.getElementById('yt-pins-share-ui');
    if (shareUI) {
        shareUI.style.setProperty('display', 'none', 'important');
        shareUI.remove();
    }

    // Clean up pins and labels
    const progressBar = document.querySelector('.ytp-progress-bar');
    if (progressBar) {
        progressBar.querySelectorAll('.yt-pin, .ytp-pin-label').forEach(el => el.remove());
    }

    // Clean up resize observer
    if (window.ytPinsResizeObserver) {
        window.ytPinsResizeObserver.disconnect();
        window.ytPinsResizeObserver = null;
    }

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
        share.style.setProperty('display', 'none', 'important');
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
        const userWantsVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
        if (isFullscreen || !userWantsVisible) {
            share.style.setProperty('display', 'none', 'important');
        } else {
            share.style.setProperty('display', 'flex', 'important');
        }
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
                const player = document.querySelector('#movie_player');
                
                if (!video || !progressBar || !document.body.contains(video) || !player) {
                    setTimeout(waitForVideo, 100);
                    return;
                }
                
                stateManager.set('video', video);
                stateManager.loadBookmarks();
                stateManager.loadSettings();

                // Function to update UI visibility
                const updateVisibility = () => {
                    const sidebar = stateManager.get('ui.sidebar');
                    const shareUI = document.getElementById('yt-pins-share-ui');
                    const progressBar = document.querySelector('.ytp-progress-bar');
                    
                    // Get player position
                    const playerRect = player.getBoundingClientRect();
                    const isPlayerVisible = playerRect.bottom > 0 && playerRect.top < window.innerHeight / 2;
                    
                    // Get user's visibility preferences
                    const userWantsVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
                    const showLabels = localStorage.getItem('yt-pins-label-visibility') !== 'false';
                    
                    // Only show if both conditions are met
                    const shouldShow = isPlayerVisible && userWantsVisible;
                    
                    if (sidebar) {
                        sidebar.style.setProperty('display', shouldShow ? 'block' : 'none', 'important');
                    }
                    if (shareUI) {
                        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
                        if (!isFullscreen && shouldShow) {
                            shareUI.style.setProperty('display', 'flex', 'important');
                        } else {
                            shareUI.style.setProperty('display', 'none', 'important');
                        }
                    }

                    // Update label visibility
                    if (progressBar) {
                        const pins = progressBar.querySelectorAll('.yt-pin');
                        const labels = progressBar.querySelectorAll('.ytp-pin-label');
                        
                        labels.forEach(label => {
                            label.style.setProperty('visibility', showLabels ? 'visible' : 'hidden', 'important');
                        });
                        
                        pins.forEach(pin => {
                            if (!showLabels) {
                                pin.style.setProperty('height', '100%', 'important');
                            } else {
                                const label = progressBar.querySelector(`.ytp-pin-label[data-pin-id="${pin.dataset.pinId}"]`);
                                if (label) {
                                    const labelDistanceFromBar = Math.abs(label.offsetTop);
                                    pin.style.setProperty('height', `${labelDistanceFromBar - 12}px`, 'important');
                                }
                            }
                        });
                    }
                };

                // Add scroll listener
                const scrollHandler = () => {
                    requestAnimationFrame(updateVisibility);
                };

                window.addEventListener('scroll', scrollHandler, { passive: true });
                stateManager.set('scrollHandler', scrollHandler);
                stateManager.set('updateVisibility', updateVisibility);
                
                // Initial visibility check
                updateVisibility();

                // Delay initial render to ensure player is ready
                setTimeout(() => {
                    if (progressBar) {
                        progressBar.querySelectorAll('.yt-pin, .ytp-pin-label').forEach(el => el.remove());
                        renderPins();
                    }
                }, 500);
                
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

  // Update the observer code
  let last = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== last) {
        last = location.href;
        if (location.pathname === '/watch') {
            // Add delay before initialization on navigation
            setTimeout(initAll, 500);
        } else {
            destroySidebar();
            stateManager.set('video', null);
        }
    }
  });

  // Handle YouTube's custom navigation events
  window.addEventListener('yt-navigate-start', () => {
    destroySidebar();
    stateManager.set('video', null);
  });

  window.addEventListener('yt-navigate-finish', () => {
    if (location.pathname === '/watch') {
        // Add delay before initialization on navigation
        setTimeout(initAll, 500);
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
