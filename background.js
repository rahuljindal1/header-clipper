const STORE_KEY = "header_clipper_current";
let currentActiveTabId = null;

// Initialize current active tab on service worker start
(async function init() {
    try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tabs && tabs.length) currentActiveTabId = tabs[0].id;
    } catch (e) {
        console.warn("Header Clipper init tabs.query failed:", e);
    }
})();

// Keep currentActiveTabId up to date
chrome.tabs.onActivated.addListener(activeInfo => {
    currentActiveTabId = activeInfo.tabId;
});

// Also update on tab changes (navigation) to keep stored URL accurate
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === currentActiveTabId && tab && tab.url) {
        // update stored url if we already have headers stored
        chrome.storage.local.get(STORE_KEY).then(all => {
            const obj = all[STORE_KEY] || null;
            if (obj && obj.tabId === String(tabId)) {
                obj.url = tab.url;
                obj.updatedAt = Date.now();
                chrome.storage.local.set({ [STORE_KEY]: obj });
            }
        });
    }
});


// Clean up when active tab is removed - clear stored header
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === currentActiveTabId) {
        currentActiveTabId = null;
        chrome.storage.local.remove(STORE_KEY);
    }
});

// Helper to store headers for the current tab only
async function saveHeaderForCurrentTab(headerName, headerValue, url, tabId) {
    if (!currentActiveTabId || tabId !== currentActiveTabId) return;
    const payload = {
        tabId: String(tabId),
        url: url || "",
        headers: { [headerName]: headerValue },
        updatedAt: Date.now()
    };
    await chrome.storage.local.set({ [STORE_KEY]: payload });
}

// Observe outgoing requests; only capture headers for the active tab
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        try {
            if (!details.requestHeaders) { return };
            // Only consider requests that belong to a tab and match active tab id
            if (!details.tabId || details.tabId !== currentActiveTabId) { return };

            // match monolith.<env>.scriptsense.co.nz
            const urlObj = new URL(details.url);
            const host = urlObj.hostname;
            if (!host.startsWith("monolith.") || !host.endsWith(".scriptsense.co.nz")) { return };


            const authHeader = details.requestHeaders.find(h => h.name.toLowerCase() === "authorization");
            if (authHeader) {
                saveHeaderForCurrentTab("Authorization", authHeader.value.split(' ')[1], details.url, details.tabId);
            }
        } catch (e) {
            console.error("Header Clipper (current-tab) error:", e);
        }
    },
    { urls: ["*://*.scriptsense.co.nz/*"] },
    ["requestHeaders"]
);

// Simple message API for popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_CURRENT") {
        chrome.storage.local.get(STORE_KEY).then(all => {
            const obj = all[STORE_KEY] || null;
            // Only return metadata (not the raw header value) to list names
            if (!obj) {
                sendResponse({ ok: true, data: null });
            } else {
                sendResponse({
                    ok: true,
                    data: {
                        tabId: obj.tabId,
                        url: obj.url,
                        headerNames: Object.keys(obj.headers),
                        updatedAt: obj.updatedAt
                    }
                });
            }
        });
        return true; // async
    }

    if (msg && msg.type === "GET_VALUE") {
        // Return the raw header value for the current stored entry (popup will copy)
        chrome.storage.local.get(STORE_KEY).then(all => {
            const obj = all[STORE_KEY] || null;
            if (!obj) {
                sendResponse({ ok: false, error: "No header stored for current tab." });
            } else {
                const val = obj.headers[msg.headerName];
                if (val) sendResponse({ ok: true, value: val });
                else sendResponse({ ok: false, error: "Header not found." });
            }
        });
        return true;
    }

    if (msg && msg.type === "CLEAR") {
        chrome.storage.local.remove(STORE_KEY).then(() => sendResponse({ ok: true }));
        return true;
    }
});
