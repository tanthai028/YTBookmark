export function formatTime(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(Math.floor(t % 60)).padStart(2, '0');
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s}`;
  return `${m}:${s}`;
}

export function parseTime(str) {
  const parts = str.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n) || n < 0)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s < 60) return m * 60 + s;
  } else if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m < 60 && s < 60) return h * 3600 + m * 60 + s;
  }
  return null;
}

export function getVideoId() {
  return new URLSearchParams(location.search).get('v');
}
