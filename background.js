const REQUEST_HEADER_STORE_KEY = "request_headers";
const REQUEST_BODY_STORE_KEY = "request_payloads";
const RESPONSE_HEADER_STORE_KEY = "response_headers";
let currentActiveTabId = null;

function safeGetStorage(key) {
    return new Promise((res) => chrome.storage.local.get([key], r => res(r[key] || {})));
}
function safeSetStorage(key, value) {
    return new Promise((res, rej) => {
        chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime.lastError) return rej(chrome.runtime.lastError);
            res();
        });
    });
}

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
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//     if (tabId === currentActiveTabId && tab && tab.url) {
//         // update stored url if we already have headers stored
//         chrome.storage.local.get(REQUEST_HEADER_STORE_KEY).then(all => {
//             const obj = all[REQUEST_HEADER_STORE_KEY] || null;
//             if (obj && obj.tabId === String(tabId)) {
//                 obj.url = tab.url;
//                 obj.updatedAt = Date.now();
//                 chrome.storage.local.set({ [REQUEST_HEADER_STORE_KEY]: obj });
//             }
//         });
//     }
// });


// Clean up when active tab is removed - clear stored header
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === currentActiveTabId) {
        currentActiveTabId = null;
        chrome.storage.local.remove(REQUEST_HEADER_STORE_KEY);
        chrome.storage.local.remove(RESPONSE_HEADER_STORE_KEY);
        chrome.storage.local.remove(REQUEST_BODY_STORE_KEY);
    }
});

// Helper to store headers for the current tab only
async function saveRequestHeaderForCurrentTab(headerName, headerValue, url, tabId) {
    if (!currentActiveTabId || tabId !== currentActiveTabId) return;
    const payload = {
        tabId: String(tabId),
        url: url || "",
        headers: { [headerName]: headerValue },
        updatedAt: Date.now()
    };
    await safeSetStorage(REQUEST_HEADER_STORE_KEY, payload)
}

async function saveResponseHeadersForCurrentTab(headerName, headerValue, url, tabId, requestId) {
    if (!currentActiveTabId || tabId !== currentActiveTabId) { return };
    const savedResponses = await safeGetStorage(RESPONSE_HEADER_STORE_KEY)
    savedResponses[requestId] = {
        tabId: String(tabId),
        requestId,
        url: url || "",
        headers: { [headerName]: headerValue },
        updatedAt: Date.now()
    };
    await safeSetStorage(RESPONSE_HEADER_STORE_KEY, savedResponses)
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
                saveRequestHeaderForCurrentTab("Authorization", authHeader.value.split(' ')[1], details.url, details.tabId);
            }
        } catch (e) {
            console.error("Header Clipper (current-tab) error:", e);
        }
    },
    { urls: ["*://*.scriptsense.co.nz/*"] },
    ["requestHeaders"]
);

/**
 * Capture response headers so we can read `x-trace-id` (or any other response header).
 * Uses onHeadersReceived which has access to responseHeaders.
 */
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        try {
            if (!details.responseHeaders) { return };
            // Only consider requests that belong to a tab and match active tab id
            if (!details.tabId || details.tabId !== currentActiveTabId) { return };

            // match monolith.<env>.scriptsense.co.nz
            const urlObj = new URL(details.url);
            const host = urlObj.hostname;
            if (!host.startsWith("monolith.") || !host.endsWith(".scriptsense.co.nz")) { return };

            const traceIdHeader = details.responseHeaders.find(h => h.name.toLowerCase() === "x-traceid");
            if (traceIdHeader) {
                saveResponseHeadersForCurrentTab("X-Traceid", traceIdHeader.value, details.url, details.tabId, details.requestId);
            }
        } catch (e) {
            console.error("Header Clipper (current-tab) error:", e);
        }
    },
    { urls: ["*://*.scriptsense.co.nz/*"] },
    ["responseHeaders"]
);

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        try {
            // console.log(details)
            // if (!details.tabId || details.tabId < 0) return;
            // if (!details.requestBody) return;

            // let bodyString = "";
            // if (details.requestBody.raw && details.requestBody.raw.length) {
            //     const chunks = details.requestBody.raw.map(chunk => {
            //         if (!chunk || !chunk.bytes) return "";
            //         try {
            //             return new TextDecoder("utf-8").decode(chunk.bytes);
            //         } catch (e) {
            //             return "";
            //         }
            //     });
            //     bodyString = chunks.join("");
            // } else if (details.requestBody.formData) {
            //     // Try a likely form-data field
            //     const fd = details.requestBody.formData;
            //     for (const k in fd) {
            //         if (Array.isArray(fd[k]) && fd[k].length) {
            //             bodyString = fd[k][0];
            //             break;
            //         }
            //     }
            // }

            // if (!bodyString) return;

            // let parsed;
            // try {
            //     parsed = JSON.parse(bodyString);
            // } catch (e) {
            //     return;
            // }

            // const operationName = parsed.operationName || null;
            // if (operationName) {
            //     saveRequestHeaderForCurrentTab(details.tabId, null, operationName, null);
            // }
        } catch (err) {
            console.error("onBeforeRequest error:", err);
        }
    },
    { urls: ["*://*.scriptsense.co.nz/*"] },
    ["requestBody"]
);

// Simple message API for popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_ALL_REQUEST_HEADERS") {
        sendAllRequestHeaders(sendResponse)
        return true; // async
    }

    if (msg && msg.type === "GET_REQUEST_HEADER_VALUE") {
        sendRequestHeaderValue(msg, sendResponse)
        return true
    }

    if (msg && msg.type === "GET_ALL_RESPONSE_TRACES") {
        sendAllResponseTraces(sendResponse)
        return true
    }

    if (msg && msg.type === "CLEAR") {
        Promise.all([chrome.storage.local.remove(REQUEST_HEADER_STORE_KEY),
        chrome.storage.local.remove(RESPONSE_HEADER_STORE_KEY),
        chrome.storage.local.remove(REQUEST_BODY_STORE_KEY)]).then(() => sendResponse({ ok: true }))
        return true;
    }
});

function sendAllRequestHeaders(sendResponse) {
    chrome.storage.local.get(REQUEST_HEADER_STORE_KEY).then(all => {
        const obj = all[REQUEST_HEADER_STORE_KEY] || null;
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
}

function sendRequestHeaderValue(msg, sendResponse) {
    // Return the raw header value for the current stored entry (popup will copy)
    chrome.storage.local.get(REQUEST_HEADER_STORE_KEY).then(all => {
        const obj = all[REQUEST_HEADER_STORE_KEY] || null;
        if (!obj) {
            sendResponse({ ok: false, error: "No header stored for current tab." });
        } else {
            const val = obj.headers[msg.headerName];
            if (val) sendResponse({ ok: true, value: val });
            else sendResponse({ ok: false, error: "Header not found." });
        }
    });
}

function sendAllResponseTraces(sendResponse) {
    chrome.storage.local.get(RESPONSE_HEADER_STORE_KEY).then(allResponseHeaders => {
        const responseHeaders = allResponseHeaders[RESPONSE_HEADER_STORE_KEY] || {};
        if (!responseHeaders) {
            sendResponse({
                ok: true,
                data: null
            });
        }

        const traces = []
        Object.entries(responseHeaders).forEach(([key, value]) => {
            const traceId = value.headers['X-Traceid']
            if (traceId) {
                traces.push({ traceId, requestId: key })
            }
        })

        // Reverse races to get the latest first
        traces.reverse()
        sendResponse({
            ok: true,
            data: traces
        });
    })

}