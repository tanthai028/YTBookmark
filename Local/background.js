// Background script for YTBookmarks extension
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for extension icon
  chrome.contextMenus.create({
    id: 'ytbookmarks-export',
    title: 'Export Bookmarks',
    contexts: ['action']
  });

  chrome.contextMenus.create({
    id: 'ytbookmarks-import',
    title: 'Import Bookmarks',
    contexts: ['action']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ytbookmarks-export') {
    // Send message to content script to export bookmarks
    chrome.tabs.sendMessage(tab.id, { action: 'exportBookmarks' });
  } else if (info.menuItemId === 'ytbookmarks-import') {
    // Send message to content script to import bookmarks
    chrome.tabs.sendMessage(tab.id, { action: 'importBookmarks' });
  }
});
