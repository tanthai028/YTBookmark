import { getVideoId } from './utils.js';

export class StateManager {
  constructor() {
    this.state = {
      video: null,
      bookmarks: [],
      settings: { showLabels: true },
      lastDeleted: null,
      ui: {
        sidebar: null,
        listContainer: null,
        header: null,
        pinBtn: null,
        undoBtn: null,
      },
    };
    this.listeners = new Map();
  }

  get(key) {
    return key.split('.').reduce((obj, k) => obj?.[k], this.state);
  }

  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => (obj[k] = obj[k] || {}), this.state);
    target[lastKey] = value;
    this.notify(key);
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(callback);
  }

  unsubscribe(key, callback) {
    if (this.listeners.has(key)) this.listeners.get(key).delete(callback);
  }

  notify(key) {
    if (this.listeners.has(key)) {
      const value = this.get(key);
      this.listeners.get(key).forEach(cb => cb(value));
    }
  }

  loadSettings() {
    const saved = localStorage.getItem('yt-pins-settings');
    if (saved) this.set('settings', { ...this.get('settings'), ...JSON.parse(saved) });
    // yt-pins-label-visibility is authoritative for the label toggle state
    const labelVis = localStorage.getItem('yt-pins-label-visibility');
    if (labelVis !== null) {
      const s = this.get('settings');
      s.showLabels = labelVis === 'true';
      this.set('settings', s);
    }
  }

  saveSettings() {
    localStorage.setItem('yt-pins-settings', JSON.stringify(this.get('settings')));
  }

  loadBookmarks() {
    const saved = localStorage.getItem(`yt-pins-${getVideoId()}`);
    this.set('bookmarks', saved ? JSON.parse(saved) : []);
  }

  saveBookmarks() {
    localStorage.setItem(`yt-pins-${getVideoId()}`, JSON.stringify(this.get('bookmarks')));
  }
}

export const stateManager = new StateManager();
