import { stateManager } from './state.js';
import { formatTime, parseTime, getVideoId } from './utils.js';
import { renderPins } from './pins.js';
// addBookmark, clearAllBookmarks, deleteBookmark, undoDelete are imported from bookmarks.js.
// This creates a circular dependency with bookmarks.js → sidebar.js, which esbuild
// resolves correctly because neither module uses the other's exports at evaluation time.
import { addBookmark, clearAllBookmarks, deleteBookmark, undoDelete } from './bookmarks.js';

const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_CLEAR_ALL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12"/><path d="M3 12h9"/><path d="M3 18h6"/><line x1="16" y1="14" x2="22" y2="20"/><line x1="22" y1="14" x2="16" y2="20"/></svg>`;
const ICON_BOOKMARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const ICON_BOOKMARK_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const ICON_EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function flashSidebar(sidebar) {
  clearTimeout(sidebar._flashTimeout);
  sidebar.classList.add('just-shown');
  sidebar._flashTimeout = setTimeout(() => sidebar.classList.remove('just-shown'), 2500);
}

export function renderSidebar() {
  const listContainer = stateManager.get('ui.listContainer');
  const bookmarks = stateManager.get('bookmarks') || [];
  const video = stateManager.get('video');

  if (!listContainer || !document.body.contains(listContainer)) {
    console.warn('List container not found or not in document, recreating sidebar...');
    createSidebar();
    return;
  }

  // Update count badge
  const countBadge = stateManager.get('ui.countBadge');
  if (countBadge) {
    countBadge.textContent = bookmarks.length;
    countBadge.style.display = bookmarks.length ? '' : 'none';
  }

  try {
    listContainer.innerHTML = '';

    if (!bookmarks.length) {
      const ph = document.createElement('div');
      ph.className = 'empty-message';
      const icon = document.createElement('span');
      icon.className = 'empty-icon';
      icon.innerHTML = ICON_BOOKMARK_EMPTY;
      const msg = document.createElement('span');
      msg.textContent = 'No bookmarks yet';
      ph.append(icon, msg);
      listContainer.appendChild(ph);
      return;
    }

    const searchInput = stateManager.get('ui.searchInput');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const sorted = bookmarks
      .map((bm, i) => ({ bm, index: i }))
      .sort((a, b) => a.bm.time - b.bm.time)
      .filter(({ bm }) => !query || bm.label.toLowerCase().includes(query));

    if (!sorted.length) {
      const ph = document.createElement('div');
      ph.className = 'empty-message';
      const msg = document.createElement('span');
      msg.textContent = 'No matches';
      ph.appendChild(msg);
      listContainer.appendChild(ph);
      return;
    }

    sorted.forEach(({ bm, index }, pos) => {
      const entry = document.createElement('div');
      entry.className = 'bookmark-entry';
      entry.addEventListener('click', () => {
        if (video && document.body.contains(video)) video.currentTime = bm.time;
      });

      const positionBadge = document.createElement('span');
      positionBadge.className = 'bookmark-position';
      positionBadge.textContent = pos + 1;

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
      ts.title = 'Click to seek · Right-click to edit time';
      ts.addEventListener('click', ev => {
        ev.stopPropagation();
        if (video && document.body.contains(video)) video.currentTime = bm.time;
      });
      ts.addEventListener('contextmenu', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.value = formatTime(bm.time);
        timeInput.className = 'bookmark-time-edit';
        ts.replaceWith(timeInput);
        timeInput.select();
        const commit = () => {
          const secs = parseTime(timeInput.value);
          if (secs !== null) {
            const updated = stateManager.get('bookmarks');
            if (!updated || index >= updated.length) { timeInput.replaceWith(ts); return; }
            updated[index].time = secs;
            stateManager.set('bookmarks', updated);
            stateManager.saveBookmarks();
            renderPins();
            renderSidebar();
          } else {
            timeInput.replaceWith(ts);
          }
        };
        timeInput.addEventListener('blur', commit);
        timeInput.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') { ev.preventDefault(); timeInput.blur(); }
          if (ev.key === 'Escape') { ev.preventDefault(); timeInput.replaceWith(ts); }
        });
        timeInput.addEventListener('click', ev => ev.stopPropagation());
        timeInput.focus();
      });

      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.innerHTML = ICON_X;
      del.title = 'Delete';
      del.addEventListener('click', ev => {
        ev.stopPropagation();
        ev.preventDefault();
        deleteBookmark(index);
      });

      entry.append(positionBadge, input, ts, del);
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

  const titleText = document.createElement('span');
  titleText.className = 'title-text';
  titleText.textContent = 'YTBookmarks';

  const countBadge = document.createElement('span');
  stateManager.set('ui.countBadge', countBadge);
  countBadge.className = 'bookmark-count-badge';
  const bookmarks = stateManager.get('bookmarks') || [];
  countBadge.textContent = bookmarks.length;
  countBadge.style.display = bookmarks.length ? '' : 'none';

  titleSection.append(icon, titleText, countBadge);

  const buttonsGroup = document.createElement('div');
  buttonsGroup.className = 'header-buttons-group';

  const clearAllBtn = document.createElement('button');
  clearAllBtn.innerHTML = ICON_CLEAR_ALL;
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

  const searchContainer = document.createElement('div');
  searchContainer.className = 'yt-pins-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search bookmarks…';
  searchInput.className = 'search-input';
  stateManager.set('ui.searchInput', searchInput);
  searchInput.addEventListener('input', () => renderSidebar());
  searchInput.addEventListener('click', ev => ev.stopPropagation());
  searchContainer.appendChild(searchInput);
  sidebar.appendChild(searchContainer);

  const listContainer = document.createElement('div');
  stateManager.set('ui.listContainer', listContainer);
  listContainer.className = 'yt-pins-list';
  sidebar.appendChild(listContainer);
  document.body.appendChild(sidebar);
  flashSidebar(sidebar);

  // Shared fixed tooltip — appended to body so it escapes YouTube's stacking context
  const sharedTooltip = document.createElement('div');
  sharedTooltip.className = 'button-tooltip';
  document.body.appendChild(sharedTooltip);
  stateManager.set('ui.sharedTooltip', sharedTooltip);

  function showTooltip(btn, text) {
    const rect = btn.getBoundingClientRect();
    sharedTooltip.textContent = text;
    sharedTooltip.style.left = Math.round(rect.left + rect.width / 2) + 'px';
    sharedTooltip.style.top = Math.round(rect.top - sharedTooltip.offsetHeight - 8) + 'px';
    sharedTooltip.classList.add('visible');
  }

  function hideTooltip() {
    sharedTooltip.classList.remove('visible');
  }

  // Player controls
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'yt-pins-buttons-container';

  const pinBtn = document.createElement('button');
  stateManager.set('ui.pinBtn', pinBtn);
  pinBtn.className = 'ytp-pin-btn';
  pinBtn.innerHTML = ICON_BOOKMARK;
  pinBtn.addEventListener('click', e => { e.stopPropagation(); addBookmark(); });
  pinBtn.addEventListener('mouseenter', () => showTooltip(pinBtn, 'Bookmark'));
  pinBtn.addEventListener('mouseleave', hideTooltip);

  const visibilityBtn = document.createElement('button');
  visibilityBtn.className = 'visibility-btn';

  const uiVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
  const showLabels = localStorage.getItem('yt-pins-label-visibility') !== 'false';

  const visibilityIcon = document.createElement('span');
  visibilityIcon.innerHTML = uiVisible ? ICON_EYE : ICON_EYE_OFF;
  visibilityBtn.appendChild(visibilityIcon);
  visibilityBtn.addEventListener('mouseenter', () => {
    const currentlyVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
    showTooltip(visibilityBtn, currentlyVisible ? 'Hide UI' : 'Show UI');
  });
  visibilityBtn.addEventListener('mouseleave', hideTooltip);

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

    visibilityIcon.innerHTML = isCurrentlyVisible ? ICON_EYE_OFF : ICON_EYE;
    hideTooltip();

    const s = stateManager.get('settings');
    s.showLabels = !isCurrentlyVisible;
    stateManager.set('settings', s);
    stateManager.saveSettings();

    const currentSidebar = stateManager.get('ui.sidebar');
    const shareUI = document.getElementById('yt-pins-share-ui');
    const progressBar = document.querySelector('.ytp-progress-bar');

    if (currentSidebar) {
      currentSidebar.style.setProperty('display', isCurrentlyVisible ? 'none' : 'block', 'important');
      if (!isCurrentlyVisible) flashSidebar(currentSidebar);
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

  const sharedTooltip = stateManager.get('ui.sharedTooltip');
  if (sharedTooltip) sharedTooltip.remove();

  stateManager.set('ui', {
    sidebar: null, listContainer: null, header: null, pinBtn: null, undoBtn: null, countBadge: null, sharedTooltip: null, searchInput: null,
  });
}
