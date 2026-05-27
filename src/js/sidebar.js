import { stateManager } from './state.js';
import { formatTime, getVideoId } from './utils.js';
import { renderPins } from './pins.js';
// addBookmark, clearAllBookmarks, deleteBookmark, undoDelete are imported from bookmarks.js.
// This creates a circular dependency with bookmarks.js → sidebar.js, which esbuild
// resolves correctly because neither module uses the other's exports at evaluation time.
import { addBookmark, clearAllBookmarks, deleteBookmark, undoDelete } from './bookmarks.js';

export function renderSidebar() {
  const listContainer = stateManager.get('ui.listContainer');
  const bookmarks = stateManager.get('bookmarks') || [];
  const video = stateManager.get('video');

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
        if (video && document.body.contains(video)) video.currentTime = bm.time;
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.value = bm.label;
      input.className = 'bookmark-input';
      input.addEventListener('focus', () => input.select());
      input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      });
      input.addEventListener('blur', () => {
        const updated = stateManager.get('bookmarks');
        if (!updated || index >= updated.length) return;
        updated[index].label = input.value.trim() || String(pos + 1);
        stateManager.set('bookmarks', updated);
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
        if (video && document.body.contains(video)) video.currentTime = bm.time;
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
    setTimeout(() => { destroySidebar(); createSidebar(); }, 1000);
  }
}

export function createSidebar() {
  const sidebar = document.createElement('div');
  stateManager.set('ui.sidebar', sidebar);
  sidebar.className = 'yt-pins-sidebar';

  const savedPosition = localStorage.getItem(`yt-pins-position-${getVideoId()}`);
  if (savedPosition) {
    try {
      const pos = JSON.parse(savedPosition);
      sidebar.style.left = pos.left;
      sidebar.style.top = pos.top;
      sidebar.style.right = 'auto';
    } catch (e) {
      console.error('Error loading saved position:', e);
    }
  }

  const isVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
  if (!isVisible) {
    sidebar.classList.add('hidden');
    const shareUI = document.getElementById('yt-pins-share-ui');
    if (shareUI) shareUI.classList.add('hidden');
  }

  const header = document.createElement('div');
  stateManager.set('ui.header', header);
  header.className = 'yt-pins-header';

  const titleSection = document.createElement('div');
  titleSection.className = 'title-section';
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('icon48.png');
  icon.alt = 'YTBookmarks';
  titleSection.append(icon, 'YTBookmarks');

  const buttonsGroup = document.createElement('div');
  buttonsGroup.className = 'header-buttons-group';

  const clearAllBtn = document.createElement('button');
  clearAllBtn.textContent = '🗑️';
  clearAllBtn.className = 'clear-all-btn';
  clearAllBtn.title = 'Clear All Bookmarks';
  clearAllBtn.onclick = e => { e.stopPropagation(); e.preventDefault(); clearAllBookmarks(); };

  const undoBtn = document.createElement('button');
  stateManager.set('ui.undoBtn', undoBtn);
  undoBtn.textContent = 'Undo';
  undoBtn.className = 'undo-btn';
  undoBtn.disabled = true;
  undoBtn.onclick = e => { e.stopPropagation(); e.preventDefault(); undoDelete(); };

  buttonsGroup.append(clearAllBtn, undoBtn);
  header.append(titleSection, buttonsGroup);
  sidebar.appendChild(header);

  const listContainer = document.createElement('div');
  stateManager.set('ui.listContainer', listContainer);
  listContainer.className = 'yt-pins-list';
  sidebar.appendChild(listContainer);
  document.body.appendChild(sidebar);

  // Player controls
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'yt-pins-buttons-container';

  const pinBtn = document.createElement('button');
  stateManager.set('ui.pinBtn', pinBtn);
  pinBtn.className = 'ytp-pin-btn';
  pinBtn.textContent = '📌';
  pinBtn.title = '';
  pinBtn.addEventListener('click', e => { e.stopPropagation(); addBookmark(); });

  const pinTooltip = document.createElement('div');
  pinTooltip.className = 'button-tooltip';
  pinTooltip.textContent = 'Bookmark';
  pinBtn.appendChild(pinTooltip);

  const visibilityBtn = document.createElement('button');
  visibilityBtn.className = 'visibility-btn';

  const uiVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
  const showLabels = localStorage.getItem('yt-pins-label-visibility') !== 'false';

  const visibilityIcon = document.createElement('span');
  visibilityIcon.textContent = uiVisible ? '👁️' : '👁️‍🗨️';
  visibilityBtn.appendChild(visibilityIcon);

  const visibilityTooltip = document.createElement('div');
  visibilityTooltip.className = 'button-tooltip';
  visibilityTooltip.textContent = uiVisible ? 'Hide UI' : 'Show UI';
  visibilityBtn.appendChild(visibilityTooltip);

  const settings = stateManager.get('settings');
  settings.showLabels = showLabels;
  stateManager.set('settings', settings);
  stateManager.saveSettings();

  visibilityBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();

    const isCurrentlyVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';

    localStorage.setItem('yt-pins-visibility', isCurrentlyVisible ? 'hidden' : 'visible');
    localStorage.setItem('yt-pins-label-visibility', isCurrentlyVisible ? 'false' : 'true');

    visibilityIcon.textContent = isCurrentlyVisible ? '👁️‍🗨️' : '👁️';
    visibilityTooltip.textContent = isCurrentlyVisible ? 'Show UI' : 'Hide UI';

    const s = stateManager.get('settings');
    s.showLabels = !isCurrentlyVisible;
    stateManager.set('settings', s);
    stateManager.saveSettings();

    const currentSidebar = stateManager.get('ui.sidebar');
    const shareUI = document.getElementById('yt-pins-share-ui');
    const progressBar = document.querySelector('.ytp-progress-bar');

    if (currentSidebar) {
      currentSidebar.style.setProperty('display', isCurrentlyVisible ? 'none' : 'block', 'important');
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
            pin.style.setProperty('height', `${Math.abs(label.offsetTop) - 12}px`, 'important');
          }
        }
      });
    }

    renderPins();
  });

  buttonsContainer.append(pinBtn, visibilityBtn);
  const ctrls = document.querySelector('.ytp-right-controls');
  if (ctrls) ctrls.prepend(buttonsContainer);
  else document.body.appendChild(buttonsContainer);

  // Drag logic
  header.addEventListener('mousedown', e => {
    e.preventDefault();
    const rect = sidebar.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;

    const onMove = ev => {
      sidebar.style.left = (ev.clientX - dx) + 'px';
      sidebar.style.top = (ev.clientY - dy) + 'px';
    };
    const onUp = () => {
      localStorage.setItem(`yt-pins-position-${getVideoId()}`, JSON.stringify({
        left: sidebar.style.left,
        top: sidebar.style.top,
      }));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export function destroySidebar() {
  const sidebar = stateManager.get('ui.sidebar');
  const pinBtn = stateManager.get('ui.pinBtn');
  const scrollHandler = stateManager.get('scrollHandler');

  if (sidebar) { sidebar.style.setProperty('display', 'none', 'important'); sidebar.remove(); }
  if (pinBtn) pinBtn.remove();
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
    stateManager.set('scrollHandler', null);
  }

  document.querySelector('.yt-pins-buttons-container')?.remove();

  const shareUI = document.getElementById('yt-pins-share-ui');
  if (shareUI) { shareUI.style.setProperty('display', 'none', 'important'); shareUI.remove(); }

  document.querySelector('.ytp-progress-bar')
    ?.querySelectorAll('.yt-pin, .ytp-pin-label')
    .forEach(el => el.remove());

  if (window.ytPinsResizeObserver) {
    window.ytPinsResizeObserver.disconnect();
    window.ytPinsResizeObserver = null;
  }

  stateManager.set('ui', {
    sidebar: null, listContainer: null, header: null, pinBtn: null, undoBtn: null,
  });
}
