import { stateManager } from './state.js';

export function renderPins() {
  const bar = document.querySelector('.ytp-progress-bar');
  const video = stateManager.get('video');
  const settings = stateManager.get('settings');
  const bookmarks = stateManager.get('bookmarks') || [];

  if (bar) {
    bar.querySelectorAll('.yt-pin, .ytp-pin-label').forEach(n => n.remove());
  }

  if (!bar || !video || !video.duration || !bookmarks.length) return;

  requestAnimationFrame(() => {
    const barWidth = bar.clientWidth;
    if (!barWidth) return;

    const sortedBookmarks = [...bookmarks].sort((a, b) => a.time - b.time);
    const occupiedSpaces = [[]];

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

      if (settings.showLabels) {
        const lbl = document.createElement('div');
        lbl.className = 'ytp-pin-label';
        lbl.textContent = bm.label;
        lbl.style.visibility = 'hidden';
        lbl.dataset.pinId = `pin-${index}`;
        bar.appendChild(lbl);

        requestAnimationFrame(() => {
          const lblW = lbl.offsetWidth;
          const lblH = lbl.offsetHeight;

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

          let lvl = 0;
          while (!isSpaceAvailable(lvl, leftPx, lblW)) {
            lvl++;
            if (!occupiedSpaces[lvl]) occupiedSpaces[lvl] = [];
          }
          occupiedSpaces[lvl].push({ left: leftPx, width: lblW });

          const base = -18;
          const gap = lblH + 2;
          lbl.style.top = base - lvl * gap + 'px';

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
            lbl.style.marginRight = leftPx > barWidth - lblW / 4 ? '0.5px' : '0px';
            pin.dataset.isEdgeLabel = 'true';
          } else {
            lbl.style.left = pct;
            lbl.style.transform = 'translateX(-50%)';
            lbl.style.marginLeft = '0';
            lbl.style.marginRight = '0';
          }

          pin.dataset.labelBottom = lbl.offsetTop + lbl.offsetHeight;
          const labelDistanceFromBar = Math.abs(lbl.offsetTop);
          pin.style.height = `${labelDistanceFromBar - 12}px`;
          lbl.style.visibility = 'visible';
        });
      }

      const updatePinPlayedState = () => {
        const progress = video.currentTime / video.duration;
        pin.classList.toggle('played', progress >= bm.time / video.duration);
      };
      updatePinPlayedState();
      video.addEventListener('timeupdate', updatePinPlayedState);
    });
  });
}
