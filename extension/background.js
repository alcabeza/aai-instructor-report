// Service worker: receives the data read on the portal, stores it locally
// and opens the report page. Nothing is sent outside the browser.

const PORTAL = 'https://portal.aai.aws.training/';
const DASHBOARD = chrome.runtime.getURL('dashboard.html');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'aai-open') {
    chrome.storage.local.set({ aaiData: msg.data }).then(() => {
      chrome.tabs.create({ url: DASHBOARD, index: sender.tab ? sender.tab.index + 1 : undefined });
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});

// Toolbar icon click:
// - on the AAI portal: starts the collection (same as the on-page button);
// - elsewhere: reopens the last report, or opens the portal if there is none.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.startsWith(PORTAL)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'aai-run' });
    } catch (e) {
      // Content script not loaded yet (page opened before install): reload it.
      await chrome.tabs.reload(tab.id);
    }
    return;
  }
  const { aaiData } = await chrome.storage.local.get('aaiData');
  chrome.tabs.create({ url: aaiData ? DASHBOARD : PORTAL });
});
