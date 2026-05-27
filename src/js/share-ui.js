export function initShareUI() {
  if (document.getElementById('yt-pins-share-ui')) return;

  const share = document.createElement('div');
  share.id = 'yt-pins-share-ui';

  const isVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
  if (!isVisible) share.style.setProperty('display', 'none', 'important');

  const kofiBtn = document.createElement('button');
  kofiBtn.textContent = '☕';
  kofiBtn.style.position = 'relative';
  kofiBtn.className = 'kofi-circle-btn';

  const kofiPopup = document.createElement('div');
  kofiPopup.className = 'kofi-popup';

  const kofiFrame = document.createElement('iframe');
  kofiFrame.src = 'https://ko-fi.com/tht028/?hidefeed=true&widget=true&embed=true&preview=true';
  kofiFrame.title = 'Ko-fi';
  kofiPopup.appendChild(kofiFrame);
  kofiBtn.appendChild(kofiPopup);

  let hideTimeout;
  const showPopup = () => {
    clearTimeout(hideTimeout);
    requestAnimationFrame(() => kofiPopup.classList.add('visible'));
  };
  const hidePopup = () => {
    hideTimeout = setTimeout(() => {
      if (!kofiPopup.matches(':hover')) kofiPopup.classList.remove('visible');
    }, 250);
  };

  kofiBtn.addEventListener('mouseenter', showPopup);
  kofiBtn.addEventListener('mouseleave', hidePopup);
  kofiPopup.addEventListener('mouseenter', showPopup);
  kofiPopup.addEventListener('mouseleave', hidePopup);

  share.append(kofiBtn);
  document.body.appendChild(share);

  const updateShareUIVisibility = () => {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const userWantsVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
    share.style.setProperty('display', isFullscreen || !userWantsVisible ? 'none' : 'flex', 'important');
  };

  document.addEventListener('fullscreenchange', updateShareUIVisibility);
  document.addEventListener('webkitfullscreenchange', updateShareUIVisibility);
  updateShareUIVisibility();
}
