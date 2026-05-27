export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = String(Math.floor(t % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

export function getVideoId() {
  return new URLSearchParams(location.search).get('v');
}
