import { stateManager } from './state.js';
import { renderPins } from './pins.js';
// renderSidebar is imported from sidebar.js — circular at module level but safe
// because both are only called at runtime after all modules are initialized.
import { renderSidebar } from './sidebar.js';

export function updateUndoButton() {
  const undoBtn = stateManager.get('ui.undoBtn');
  if (undoBtn) undoBtn.disabled = !stateManager.get('lastDeleted');
}

export function addBookmark() {
  const video = stateManager.get('video');
  if (!video) return;

  const bookmarks = stateManager.get('bookmarks') || [];
  bookmarks.push({ time: video.currentTime, label: 'Bookmark' });
  stateManager.set('bookmarks', bookmarks);
  stateManager.saveBookmarks();
  stateManager.set('lastDeleted', null);

  renderPins();
  renderSidebar();
  updateUndoButton();
}

export function clearAllBookmarks() {
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

export function deleteBookmark(i) {
  const bookmarks = stateManager.get('bookmarks') || [];
  if (i < 0 || i >= bookmarks.length) return;

  stateManager.set('lastDeleted', { bookmark: bookmarks[i], index: i, type: 'single' });
  const updated = [...bookmarks];
  updated.splice(i, 1);
  stateManager.set('bookmarks', updated);
  stateManager.saveBookmarks();
  renderPins();
  renderSidebar();
  updateUndoButton();
}

export function undoDelete() {
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
