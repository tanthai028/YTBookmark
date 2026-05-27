(() => {
  // src/js/utils.js
  function formatTime(t) {
    const m = Math.floor(t / 60);
    const s = String(Math.floor(t % 60)).padStart(2, "0");
    return `${m}:${s}`;
  }
  function parseTime(str) {
    const parts = str.trim().split(":");
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) return m * 60 + s;
    }
    return null;
  }
  function getVideoId() {
    return new URLSearchParams(location.search).get("v");
  }

  // src/js/state.js
  var StateManager = class {
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
          undoBtn: null
        }
      };
      this.listeners = /* @__PURE__ */ new Map();
    }
    get(key) {
      return key.split(".").reduce((obj, k) => obj?.[k], this.state);
    }
    set(key, value) {
      const keys = key.split(".");
      const lastKey = keys.pop();
      const target = keys.reduce((obj, k) => obj[k] = obj[k] || {}, this.state);
      target[lastKey] = value;
      this.notify(key);
    }
    subscribe(key, callback) {
      if (!this.listeners.has(key)) this.listeners.set(key, /* @__PURE__ */ new Set());
      this.listeners.get(key).add(callback);
    }
    unsubscribe(key, callback) {
      if (this.listeners.has(key)) this.listeners.get(key).delete(callback);
    }
    notify(key) {
      if (this.listeners.has(key)) {
        const value = this.get(key);
        this.listeners.get(key).forEach((cb) => cb(value));
      }
    }
    loadSettings() {
      const saved = localStorage.getItem("yt-pins-settings");
      if (saved) this.set("settings", { ...this.get("settings"), ...JSON.parse(saved) });
      const labelVis = localStorage.getItem("yt-pins-label-visibility");
      if (labelVis !== null) {
        const s = this.get("settings");
        s.showLabels = labelVis === "true";
        this.set("settings", s);
      }
    }
    saveSettings() {
      localStorage.setItem("yt-pins-settings", JSON.stringify(this.get("settings")));
    }
    loadBookmarks() {
      const saved = localStorage.getItem(`yt-pins-${getVideoId()}`);
      this.set("bookmarks", saved ? JSON.parse(saved) : []);
    }
    saveBookmarks() {
      localStorage.setItem(`yt-pins-${getVideoId()}`, JSON.stringify(this.get("bookmarks")));
    }
  };
  var stateManager = new StateManager();

  // src/js/pins.js
  function renderPins() {
    const bar = document.querySelector(".ytp-progress-bar");
    const video = stateManager.get("video");
    const settings = stateManager.get("settings");
    const bookmarks = stateManager.get("bookmarks") || [];
    if (bar) {
      bar.querySelectorAll(".yt-pin, .ytp-pin-label").forEach((n) => n.remove());
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
        const pct = frac * 100 + "%";
        const pin = document.createElement("div");
        pin.className = "yt-pin";
        pin.style.left = pct;
        pin.style.visibility = "visible";
        pin.style.height = "100%";
        pin.dataset.pinId = `pin-${index}`;
        bar.appendChild(pin);
        if (settings.showLabels) {
          const lbl = document.createElement("div");
          lbl.className = "ytp-pin-label";
          lbl.textContent = bm.label;
          lbl.style.visibility = "hidden";
          lbl.dataset.pinId = `pin-${index}`;
          bar.appendChild(lbl);
          requestAnimationFrame(() => {
            const lblW = lbl.offsetWidth;
            const lblH = lbl.offsetHeight;
            const isSpaceAvailable = (level, leftPos, width) => {
              if (!occupiedSpaces[level]) return true;
              const labelStart = leftPos - width / 2;
              const labelEnd = leftPos + width / 2;
              return !occupiedSpaces[level].some((space) => {
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
            lbl.style.top = base - lvl * gap + "px";
            if (leftPx < lblW * 0.3) {
              lbl.style.left = "0";
              lbl.style.transform = "none";
              lbl.classList.add("edge-left");
              lbl.style.marginLeft = leftPx < lblW / 4 ? "-2px" : "0px";
              pin.dataset.isEdgeLabel = "true";
            } else if (leftPx > barWidth - lblW / 2) {
              lbl.style.left = "auto";
              lbl.style.right = "0";
              lbl.style.transform = "none";
              lbl.classList.add("edge-right");
              lbl.style.marginRight = leftPx > barWidth - lblW / 4 ? "0.5px" : "0px";
              pin.dataset.isEdgeLabel = "true";
            } else {
              lbl.style.left = pct;
              lbl.style.transform = "translateX(-50%)";
              lbl.style.marginLeft = "0";
              lbl.style.marginRight = "0";
            }
            pin.dataset.labelBottom = lbl.offsetTop + lbl.offsetHeight;
            const labelDistanceFromBar = Math.abs(lbl.offsetTop);
            pin.style.height = `${labelDistanceFromBar - 12}px`;
            lbl.style.visibility = "visible";
          });
        }
        const updatePinPlayedState = () => {
          const progress = video.currentTime / video.duration;
          pin.classList.toggle("played", progress >= bm.time / video.duration);
        };
        updatePinPlayedState();
        video.addEventListener("timeupdate", updatePinPlayedState);
      });
    });
  }

  // src/js/bookmarks.js
  function updateUndoButton() {
    const undoBtn = stateManager.get("ui.undoBtn");
    if (undoBtn) undoBtn.disabled = !stateManager.get("lastDeleted");
  }
  function addBookmark() {
    const video = stateManager.get("video");
    if (!video) return;
    const bookmarks = stateManager.get("bookmarks") || [];
    bookmarks.push({ time: video.currentTime, label: "Bookmark" });
    stateManager.set("bookmarks", bookmarks);
    stateManager.saveBookmarks();
    stateManager.set("lastDeleted", null);
    renderPins();
    renderSidebar();
    updateUndoButton();
  }
  function clearAllBookmarks() {
    const bookmarks = stateManager.get("bookmarks") || [];
    if (!bookmarks.length) return;
    if (confirm("Are you sure you want to delete all bookmarks?")) {
      stateManager.set("lastDeleted", { bookmarks: [...bookmarks], type: "clear-all" });
      stateManager.set("bookmarks", []);
      stateManager.saveBookmarks();
      renderPins();
      renderSidebar();
      updateUndoButton();
    }
  }
  function deleteBookmark(i) {
    const bookmarks = stateManager.get("bookmarks") || [];
    if (i < 0 || i >= bookmarks.length) return;
    stateManager.set("lastDeleted", { bookmark: bookmarks[i], index: i, type: "single" });
    const updated = [...bookmarks];
    updated.splice(i, 1);
    stateManager.set("bookmarks", updated);
    stateManager.saveBookmarks();
    renderPins();
    renderSidebar();
    updateUndoButton();
  }
  function undoDelete() {
    const lastDeleted = stateManager.get("lastDeleted");
    if (!lastDeleted) return;
    if (lastDeleted.type === "clear-all") {
      stateManager.set("bookmarks", [...lastDeleted.bookmarks]);
    } else {
      const bookmarks = stateManager.get("bookmarks") || [];
      bookmarks.splice(lastDeleted.index, 0, lastDeleted.bookmark);
      stateManager.set("bookmarks", bookmarks);
    }
    stateManager.saveBookmarks();
    stateManager.set("lastDeleted", null);
    renderPins();
    renderSidebar();
    updateUndoButton();
  }

  // src/js/sidebar.js
  var ICON_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  var ICON_CLEAR_ALL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12"/><path d="M3 12h9"/><path d="M3 18h6"/><line x1="16" y1="14" x2="22" y2="20"/><line x1="22" y1="14" x2="16" y2="20"/></svg>`;
  var ICON_BOOKMARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
  var ICON_BOOKMARK_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
  var ICON_EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  var ICON_EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  function flashSidebar(sidebar) {
    clearTimeout(sidebar._flashTimeout);
    sidebar.classList.add("just-shown");
    sidebar._flashTimeout = setTimeout(
      () => sidebar.classList.remove("just-shown"),
      2500
    );
  }
  function renderSidebar() {
    const listContainer = stateManager.get("ui.listContainer");
    const bookmarks = stateManager.get("bookmarks") || [];
    const video = stateManager.get("video");
    if (!listContainer || !document.body.contains(listContainer)) {
      console.warn(
        "List container not found or not in document, recreating sidebar..."
      );
      createSidebar();
      return;
    }
    const countBadge = stateManager.get("ui.countBadge");
    if (countBadge) {
      countBadge.textContent = bookmarks.length;
      countBadge.style.display = bookmarks.length ? "" : "none";
    }
    const searchInput = stateManager.get("ui.searchInput");
    if (searchInput && searchInput.parentElement) {
      searchInput.parentElement.style.display = bookmarks.length > 5 ? "" : "none";
    }
    try {
      listContainer.innerHTML = "";
      if (!bookmarks.length) {
        const ph = document.createElement("div");
        ph.className = "empty-message";
        const icon = document.createElement("span");
        icon.className = "empty-icon";
        icon.innerHTML = ICON_BOOKMARK_EMPTY;
        const msg = document.createElement("span");
        msg.textContent = "No bookmarks yet";
        ph.append(icon, msg);
        listContainer.appendChild(ph);
        return;
      }
      const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const sorted = bookmarks.map((bm, i) => ({ bm, index: i })).sort((a, b) => a.bm.time - b.bm.time).filter(({ bm }) => !query || bm.label.toLowerCase().includes(query));
      if (!sorted.length) {
        const ph = document.createElement("div");
        ph.className = "empty-message";
        const msg = document.createElement("span");
        msg.textContent = "No matches";
        ph.appendChild(msg);
        listContainer.appendChild(ph);
        return;
      }
      sorted.forEach(({ bm, index }, pos) => {
        const entry = document.createElement("div");
        entry.className = "bookmark-entry";
        entry.addEventListener("click", () => {
          if (video && document.body.contains(video)) video.currentTime = bm.time;
        });
        const positionBadge = document.createElement("span");
        positionBadge.className = "bookmark-position";
        positionBadge.textContent = pos + 1;
        const input = document.createElement("input");
        input.type = "text";
        input.value = bm.label;
        input.className = "bookmark-input";
        input.addEventListener("focus", () => input.select());
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            input.blur();
          }
        });
        input.addEventListener("blur", () => {
          const updated = stateManager.get("bookmarks");
          if (!updated || index >= updated.length) return;
          updated[index].label = input.value.trim() || String(pos + 1);
          stateManager.set("bookmarks", updated);
          stateManager.saveBookmarks();
          renderPins();
          renderSidebar();
        });
        input.addEventListener("click", (ev) => ev.stopPropagation());
        const ts = document.createElement("span");
        ts.className = "bookmark-time";
        ts.textContent = formatTime(bm.time);
        ts.title = "Click to seek \xB7 Right-click to edit time";
        ts.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (video && document.body.contains(video)) video.currentTime = bm.time;
        });
        ts.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const timeInput = document.createElement("input");
          timeInput.type = "text";
          timeInput.value = formatTime(bm.time);
          timeInput.className = "bookmark-time-edit";
          ts.replaceWith(timeInput);
          timeInput.select();
          const commit = () => {
            const secs = parseTime(timeInput.value);
            if (secs !== null) {
              const updated = stateManager.get("bookmarks");
              if (!updated || index >= updated.length) {
                timeInput.replaceWith(ts);
                return;
              }
              updated[index].time = secs;
              stateManager.set("bookmarks", updated);
              stateManager.saveBookmarks();
              renderPins();
              renderSidebar();
            } else {
              timeInput.replaceWith(ts);
            }
          };
          timeInput.addEventListener("blur", commit);
          timeInput.addEventListener("keydown", (ev2) => {
            if (ev2.key === "Enter") {
              ev2.preventDefault();
              timeInput.blur();
            }
            if (ev2.key === "Escape") {
              ev2.preventDefault();
              timeInput.replaceWith(ts);
            }
          });
          timeInput.addEventListener("click", (ev2) => ev2.stopPropagation());
          timeInput.focus();
        });
        const del = document.createElement("button");
        del.className = "delete-btn";
        del.innerHTML = ICON_X;
        del.title = "Delete";
        del.addEventListener("click", (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          deleteBookmark(index);
        });
        entry.append(positionBadge, input, ts, del);
        listContainer.appendChild(entry);
      });
    } catch (error) {
      console.error("Error rendering sidebar:", error);
      setTimeout(() => {
        destroySidebar();
        createSidebar();
      }, 1e3);
    }
  }
  function createSidebar() {
    const sidebar = document.createElement("div");
    stateManager.set("ui.sidebar", sidebar);
    sidebar.className = "yt-pins-sidebar";
    const savedPosition = localStorage.getItem(
      `yt-pins-position-${getVideoId()}`
    );
    if (savedPosition) {
      try {
        const pos = JSON.parse(savedPosition);
        sidebar.style.left = pos.left;
        sidebar.style.top = pos.top;
        sidebar.style.right = "auto";
      } catch (e) {
        console.error("Error loading saved position:", e);
      }
    }
    const isVisible = localStorage.getItem("yt-pins-visibility") !== "hidden";
    if (!isVisible) {
      sidebar.classList.add("hidden");
      const shareUI = document.getElementById("yt-pins-share-ui");
      if (shareUI) shareUI.classList.add("hidden");
    }
    const header = document.createElement("div");
    stateManager.set("ui.header", header);
    header.className = "yt-pins-header";
    const titleSection = document.createElement("div");
    titleSection.className = "title-section";
    const icon = document.createElement("img");
    icon.src = chrome.runtime.getURL("icon48.png");
    icon.alt = "YTBookmarks";
    const titleText = document.createElement("span");
    titleText.className = "title-text";
    titleText.textContent = "YTBookmarks";
    const countBadge = document.createElement("span");
    stateManager.set("ui.countBadge", countBadge);
    countBadge.className = "bookmark-count-badge";
    const bookmarks = stateManager.get("bookmarks") || [];
    countBadge.textContent = bookmarks.length;
    countBadge.style.display = bookmarks.length ? "" : "none";
    titleSection.append(icon, titleText, countBadge);
    const buttonsGroup = document.createElement("div");
    buttonsGroup.className = "header-buttons-group";
    const clearAllBtn = document.createElement("button");
    clearAllBtn.innerHTML = ICON_CLEAR_ALL;
    clearAllBtn.className = "clear-all-btn";
    clearAllBtn.title = "Clear All Bookmarks";
    clearAllBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      clearAllBookmarks();
    };
    const undoBtn = document.createElement("button");
    stateManager.set("ui.undoBtn", undoBtn);
    undoBtn.textContent = "Undo";
    undoBtn.className = "undo-btn";
    undoBtn.disabled = true;
    undoBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      undoDelete();
    };
    buttonsGroup.append(clearAllBtn, undoBtn);
    header.append(titleSection, buttonsGroup);
    sidebar.appendChild(header);
    const searchContainer = document.createElement("div");
    searchContainer.className = "yt-pins-search";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search bookmarks\u2026";
    searchInput.className = "search-input";
    stateManager.set("ui.searchInput", searchInput);
    searchInput.addEventListener("input", () => renderSidebar());
    searchInput.addEventListener("click", (ev) => ev.stopPropagation());
    searchContainer.appendChild(searchInput);
    sidebar.appendChild(searchContainer);
    const listContainer = document.createElement("div");
    stateManager.set("ui.listContainer", listContainer);
    listContainer.className = "yt-pins-list";
    sidebar.appendChild(listContainer);
    document.body.appendChild(sidebar);
    flashSidebar(sidebar);
    const sharedTooltip = document.createElement("div");
    sharedTooltip.className = "button-tooltip";
    document.body.appendChild(sharedTooltip);
    stateManager.set("ui.sharedTooltip", sharedTooltip);
    function showTooltip(btn, text) {
      const rect = btn.getBoundingClientRect();
      sharedTooltip.textContent = text;
      sharedTooltip.style.left = Math.round(rect.left + rect.width / 2) + "px";
      sharedTooltip.style.top = Math.round(rect.top - sharedTooltip.offsetHeight - 8) + "px";
      sharedTooltip.classList.add("visible");
    }
    function hideTooltip() {
      sharedTooltip.classList.remove("visible");
    }
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "yt-pins-buttons-container";
    const pinBtn = document.createElement("button");
    stateManager.set("ui.pinBtn", pinBtn);
    pinBtn.className = "ytp-pin-btn";
    pinBtn.innerHTML = ICON_BOOKMARK;
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      addBookmark();
    });
    pinBtn.addEventListener("mouseenter", () => showTooltip(pinBtn, "Bookmark"));
    pinBtn.addEventListener("mouseleave", hideTooltip);
    const visibilityBtn = document.createElement("button");
    visibilityBtn.className = "visibility-btn";
    const uiVisible = localStorage.getItem("yt-pins-visibility") !== "hidden";
    const showLabels = localStorage.getItem("yt-pins-label-visibility") !== "false";
    const visibilityIcon = document.createElement("span");
    visibilityIcon.innerHTML = uiVisible ? ICON_EYE : ICON_EYE_OFF;
    visibilityBtn.appendChild(visibilityIcon);
    visibilityBtn.addEventListener("mouseenter", () => {
      const currentlyVisible = localStorage.getItem("yt-pins-visibility") !== "hidden";
      showTooltip(visibilityBtn, currentlyVisible ? "Hide UI" : "Show UI");
    });
    visibilityBtn.addEventListener("mouseleave", hideTooltip);
    const settings = stateManager.get("settings");
    settings.showLabels = showLabels;
    stateManager.set("settings", settings);
    stateManager.saveSettings();
    visibilityBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isCurrentlyVisible = localStorage.getItem("yt-pins-visibility") !== "hidden";
      localStorage.setItem(
        "yt-pins-visibility",
        isCurrentlyVisible ? "hidden" : "visible"
      );
      localStorage.setItem(
        "yt-pins-label-visibility",
        isCurrentlyVisible ? "false" : "true"
      );
      visibilityIcon.innerHTML = isCurrentlyVisible ? ICON_EYE_OFF : ICON_EYE;
      hideTooltip();
      const s = stateManager.get("settings");
      s.showLabels = !isCurrentlyVisible;
      stateManager.set("settings", s);
      stateManager.saveSettings();
      const currentSidebar = stateManager.get("ui.sidebar");
      const shareUI = document.getElementById("yt-pins-share-ui");
      const progressBar = document.querySelector(".ytp-progress-bar");
      if (currentSidebar) {
        currentSidebar.style.setProperty(
          "display",
          isCurrentlyVisible ? "none" : "block",
          "important"
        );
        if (!isCurrentlyVisible) flashSidebar(currentSidebar);
      }
      if (shareUI) {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        if (!isFullscreen) {
          shareUI.style.setProperty(
            "display",
            isCurrentlyVisible ? "none" : "flex",
            "important"
          );
        }
      }
      if (progressBar) {
        progressBar.querySelectorAll(".ytp-pin-label").forEach((label) => {
          label.style.setProperty(
            "visibility",
            isCurrentlyVisible ? "hidden" : "visible",
            "important"
          );
        });
        progressBar.querySelectorAll(".yt-pin").forEach((pin) => {
          if (isCurrentlyVisible) {
            pin.style.setProperty("height", "100%", "important");
          } else {
            const label = progressBar.querySelector(
              `.ytp-pin-label[data-pin-id="${pin.dataset.pinId}"]`
            );
            if (label) {
              pin.style.setProperty(
                "height",
                `${Math.abs(label.offsetTop) - 12}px`,
                "important"
              );
            }
          }
        });
      }
      renderPins();
    });
    buttonsContainer.append(pinBtn, visibilityBtn);
    const ctrls = document.querySelector(".ytp-right-controls");
    if (ctrls) ctrls.prepend(buttonsContainer);
    else document.body.appendChild(buttonsContainer);
    header.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const rect = sidebar.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      const onMove = (ev) => {
        sidebar.style.left = ev.clientX - dx + "px";
        sidebar.style.top = ev.clientY - dy + "px";
      };
      const onUp = () => {
        localStorage.setItem(
          `yt-pins-position-${getVideoId()}`,
          JSON.stringify({
            left: sidebar.style.left,
            top: sidebar.style.top
          })
        );
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }
  function destroySidebar() {
    const sidebar = stateManager.get("ui.sidebar");
    const pinBtn = stateManager.get("ui.pinBtn");
    const scrollHandler = stateManager.get("scrollHandler");
    if (sidebar) {
      sidebar.style.setProperty("display", "none", "important");
      sidebar.remove();
    }
    if (pinBtn) pinBtn.remove();
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler);
      stateManager.set("scrollHandler", null);
    }
    document.querySelector(".yt-pins-buttons-container")?.remove();
    const shareUI = document.getElementById("yt-pins-share-ui");
    if (shareUI) {
      shareUI.style.setProperty("display", "none", "important");
      shareUI.remove();
    }
    document.querySelector(".ytp-progress-bar")?.querySelectorAll(".yt-pin, .ytp-pin-label").forEach((el) => el.remove());
    if (window.ytPinsResizeObserver) {
      window.ytPinsResizeObserver.disconnect();
      window.ytPinsResizeObserver = null;
    }
    const sharedTooltip = stateManager.get("ui.sharedTooltip");
    if (sharedTooltip) sharedTooltip.remove();
    stateManager.set("ui", {
      sidebar: null,
      listContainer: null,
      header: null,
      pinBtn: null,
      undoBtn: null,
      countBadge: null,
      sharedTooltip: null,
      searchInput: null
    });
  }

  // src/js/import-export.js
  function exportBookmarks() {
    const vidId = getVideoId();
    const currentBookmarks = stateManager.get("bookmarks") || [];
    const payload = { videoId: vidId, bookmarks: currentBookmarks };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const fname = prompt("Filename to save as:", `yt-bookmarks-${vidId}.json`);
    if (!fname) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importBookmarks() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.onchange = () => {
      const file = inp.files[0];
      const r = new FileReader();
      r.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.videoId !== getVideoId()) {
            return alert("\u26A0\uFE0F This file is for a different video.");
          }
          stateManager.set("bookmarks", data.bookmarks);
          stateManager.saveBookmarks();
          renderPins();
          renderSidebar();
        } catch {
          alert("\u26A0\uFE0F Invalid bookmarks file.");
        }
      };
      r.readAsText(file);
    };
    inp.click();
  }

  // src/js/content.js
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "exportBookmarks") exportBookmarks();
    else if (request.action === "importBookmarks") importBookmarks();
  });
  function injectStyles() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("styles.css");
    document.head.appendChild(link);
    const style = document.createElement("style");
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
      if (document.head) {
        injectStyles();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  function initAll() {
    try {
      if (location.pathname !== "/watch" || !document.querySelector("video")) {
        destroySidebar();
        return;
      }
      const waitForVideo = () => {
        try {
          const video = document.querySelector("video");
          const progressBar = document.querySelector(".ytp-progress-bar");
          const player = document.querySelector("#movie_player");
          if (!video || !progressBar || !document.body.contains(video) || !player) {
            setTimeout(waitForVideo, 100);
            return;
          }
          stateManager.set("video", video);
          stateManager.loadBookmarks();
          stateManager.loadSettings();
          const updateVisibility = () => {
            const sidebar = stateManager.get("ui.sidebar");
            const bar = document.querySelector(".ytp-progress-bar");
            const playerRect = player.getBoundingClientRect();
            const isPlayerVisible = playerRect.bottom > 0 && playerRect.top < window.innerHeight / 2;
            const userWantsVisible = localStorage.getItem("yt-pins-visibility") !== "hidden";
            const showLabels = localStorage.getItem("yt-pins-label-visibility") !== "false";
            const shouldShow = isPlayerVisible && userWantsVisible;
            if (sidebar) {
              sidebar.style.setProperty("display", shouldShow ? "block" : "none", "important");
            }
            if (bar) {
              bar.querySelectorAll(".ytp-pin-label").forEach((label) => {
                label.style.setProperty("visibility", showLabels ? "visible" : "hidden", "important");
              });
              bar.querySelectorAll(".yt-pin").forEach((pin) => {
                if (!showLabels) {
                  pin.style.setProperty("height", "100%", "important");
                } else {
                  const label = bar.querySelector(`.ytp-pin-label[data-pin-id="${pin.dataset.pinId}"]`);
                  if (label) {
                    pin.style.setProperty("height", `${Math.abs(label.offsetTop) - 12}px`, "important");
                  }
                }
              });
            }
          };
          const scrollHandler = () => requestAnimationFrame(updateVisibility);
          window.addEventListener("scroll", scrollHandler, { passive: true });
          stateManager.set("scrollHandler", scrollHandler);
          stateManager.set("updateVisibility", updateVisibility);
          updateVisibility();
          setTimeout(() => {
            if (progressBar) {
              progressBar.querySelectorAll(".yt-pin, .ytp-pin-label").forEach((el) => el.remove());
              renderPins();
            }
          }, 500);
          if (!stateManager.get("ui.sidebar") || !document.body.contains(stateManager.get("ui.sidebar"))) {
            createSidebar();
          }
          renderSidebar();
        } catch (error) {
          console.error("Error in waitForVideo:", error);
          setTimeout(waitForVideo, 100);
        }
      };
      waitForVideo();
    } catch (error) {
      console.error("Error in initAll:", error);
    }
  }
  window.addEventListener("yt-navigate-start", () => {
    destroySidebar();
    stateManager.set("video", null);
  });
  window.addEventListener("yt-navigate-finish", () => {
    if (location.pathname === "/watch") setTimeout(initAll, 500);
  });
  window.addEventListener("error", (event) => {
    if (event.error?.message === "Extension context invalidated.") {
      console.warn("Extension context invalidated, cleaning up...");
      try {
        destroySidebar();
        window.removeEventListener("yt-navigate-start", destroySidebar);
        window.removeEventListener("yt-navigate-finish", initAll);
      } catch (e) {
        console.error("Error during cleanup:", e);
      }
    }
  });
})();
