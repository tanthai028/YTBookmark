import { stateManager } from './state.js';
import { createSidebar, destroySidebar, renderSidebar } from './sidebar.js';
import { renderPins } from './pins.js';
import { exportBookmarks, importBookmarks } from './import-export.js';

chrome.runtime.onMessage.addListener(request => {
  if (request.action === 'exportBookmarks') exportBookmarks();
  else if (request.action === 'importBookmarks') importBookmarks();
});

function injectStyles() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('styles.css');
  document.head.appendChild(link);

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
    .yt-pins-sidebar { transition: opacity 0.2s ease-in-out; }
  `;
  document.head.appendChild(style);
}

if (document.head) {
  injectStyles();
} else {
  const observer = new MutationObserver(() => {
    if (document.head) { injectStyles(); observer.disconnect(); }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function initAll() {
  try {
    if (location.pathname !== '/watch' || !document.querySelector('video')) {
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

        const updateVisibility = () => {
          const sidebar = stateManager.get('ui.sidebar');
          const bar = document.querySelector('.ytp-progress-bar');

          const playerRect = player.getBoundingClientRect();
          const isPlayerVisible = playerRect.bottom > 0 && playerRect.top < window.innerHeight / 2;
          const userWantsVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
          const showLabels = localStorage.getItem('yt-pins-label-visibility') !== 'false';
          const shouldShow = isPlayerVisible && userWantsVisible;

          if (sidebar) {
            sidebar.style.setProperty('display', shouldShow ? 'block' : 'none', 'important');
          }
          if (bar) {
            bar.querySelectorAll('.ytp-pin-label').forEach(label => {
              label.style.setProperty('visibility', showLabels ? 'visible' : 'hidden', 'important');
            });
            bar.querySelectorAll('.yt-pin').forEach(pin => {
              if (!showLabels) {
                pin.style.setProperty('height', '100%', 'important');
              } else {
                const label = bar.querySelector(`.ytp-pin-label[data-pin-id="${pin.dataset.pinId}"]`);
                if (label) {
                  pin.style.setProperty('height', `${Math.abs(label.offsetTop) - 12}px`, 'important');
                }
              }
            });
          }
        };

        const scrollHandler = () => requestAnimationFrame(updateVisibility);
        window.addEventListener('scroll', scrollHandler, { passive: true });
        stateManager.set('scrollHandler', scrollHandler);
        stateManager.set('updateVisibility', updateVisibility);

        updateVisibility();

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

window.addEventListener('yt-navigate-start', () => {
  destroySidebar();
  stateManager.set('video', null);
});

window.addEventListener('yt-navigate-finish', () => {
  if (location.pathname === '/watch') setTimeout(initAll, 500);
});

window.addEventListener('error', event => {
  if (event.error?.message === 'Extension context invalidated.') {
    console.warn('Extension context invalidated, cleaning up...');
    try {
      destroySidebar();
      window.removeEventListener('yt-navigate-start', destroySidebar);
      window.removeEventListener('yt-navigate-finish', initAll);
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
  }
});
