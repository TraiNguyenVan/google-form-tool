// FormFill Pro — Background Service Worker

// Initialize default storage and configure side panel on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      profiles: [],
      activeProfileId: null,
      settings: {
        matchMode: 'label',
        fuzzyThreshold: 0.7,
        autoScan: true,
        showNotifications: true
      }
    });
    
    chrome.contextMenus.create({
      id: "formfill-import",
      title: "Import to Knowledge Base",
      contexts: ["selection"]
    });
    
    console.log('FormFill Pro installed — default storage initialized.');
  }

  // Allow the side panel to open via user gesture (clicking the icon)
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('Failed to set sidePanel behavior:', err));
});

// Open side panel when the toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error('Failed to open side panel:', err);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'formfill-import' && info.selectionText) {
    try {
      // Save text to storage so the side panel can pick it up
      await chrome.storage.local.set({ pendingImportText: info.selectionText });
      // Open side panel
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.error('Failed to handle context menu:', err);
    }
  }
});

// Listen for messages from side panel or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getExtensionInfo') {
    sendResponse({
      version: chrome.runtime.getManifest().version,
      name: chrome.runtime.getManifest().name
    });
    return true;
  }
});
