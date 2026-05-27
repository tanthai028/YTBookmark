let _card = null;

export function initShareUI() {
  if (document.getElementById('yt-pins-share-ui')) return;

  const container = document.createElement('div');
  container.id = 'yt-pins-share-ui';

  const card = document.createElement('div');
  card.className = 'kofi-card';
  _card = card;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'kofi-card-close';
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.addEventListener('click', () => card.classList.remove('visible'));

  const cardTitle = document.createElement('p');
  cardTitle.className = 'kofi-card-title';
  cardTitle.textContent = 'Enjoying YTBookmarks?';

  const cardSub = document.createElement('p');
  cardSub.className = 'kofi-card-sub';
  cardSub.textContent = 'Help keep it free and updated';

  const donateBtn = document.createElement('a');
  donateBtn.className = 'kofi-donate-btn';
  donateBtn.href = 'https://ko-fi.com/tht028?amount=1';
  donateBtn.target = '_blank';
  donateBtn.rel = 'noopener';
  donateBtn.textContent = 'Buy a coffee — $1';

  card.append(closeBtn, cardTitle, cardSub, donateBtn);
  container.append(card);
  document.body.appendChild(container);

  const updateVisibility = () => {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const userWantsVisible = localStorage.getItem('yt-pins-visibility') !== 'hidden';
    container.style.setProperty('display', isFullscreen || !userWantsVisible ? 'none' : 'block', 'important');
  };

  document.addEventListener('fullscreenchange', updateVisibility);
  document.addEventListener('webkitfullscreenchange', updateVisibility);
  updateVisibility();
}

export function toggleSupportCard() {
  if (!_card) return;
  _card.classList.toggle('visible');
}
