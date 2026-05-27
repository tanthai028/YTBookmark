import { stateManager } from './state.js';
import { getVideoId } from './utils.js';
import { renderPins } from './pins.js';
import { renderSidebar } from './sidebar.js';

export function exportBookmarks() {
  const vidId = getVideoId();
  const currentBookmarks = stateManager.get('bookmarks') || [];
  const payload = { videoId: vidId, bookmarks: currentBookmarks };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const fname = prompt('Filename to save as:', `yt-bookmarks-${vidId}.json`);
  if (!fname) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBookmarks() {
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
}
