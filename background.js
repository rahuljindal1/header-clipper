import * as api from "./chromeApi.js";
import {
    MSG_GET_ALL_REQUEST_HEADERS,
    MSG_GET_REQUEST_HEADER_VALUE,
    MSG_GET_ALL_RESPONSE_TRACES,
    MSG_CLEAR,
    STORE_REQUEST_HEADERS,
    STORE_REQUEST_PAYLOADS,
    STORE_RESPONSE_HEADERS,
} from "./constants.js";

let currentActiveTabId = null;

// Initialize current active tab on service worker start
(async function init() {
    try {
        const tabs = await api.queryActiveTabs();
        if (tabs && tabs.length) currentActiveTabId = tabs[0].id;
    } catch (e) {
        console.warn("Header Clipper init tabs.query failed:", e);
    }
})();

// Keep currentActiveTabId up to date
api.onTabActivated((activeInfo) => {
    currentActiveTabId = activeInfo.tabId;
});

// Clean up when active tab is removed
api.onTabRemoved((tabId) => {
    if (tabId === currentActiveTabId) {
        currentActiveTabId = null;
        api.removeStorage(STORE_REQUEST_HEADERS, STORE_RESPONSE_HEADERS, STORE_REQUEST_PAYLOADS);
    }
});

// Helper to store headers for the current tab only
async function saveRequestHeaderForCurrentTab(headerName, headerValue, url, tabId) {
    if (!currentActiveTabId || tabId !== currentActiveTabId) return;
    const payload = {
        tabId: String(tabId),
        url: url || "",
        headers: { [headerName]: headerValue },
        updatedAt: Date.now(),
    };
    await api.setStorage(STORE_REQUEST_HEADERS, payload);
}

async function saveResponseHeadersForCurrentTab(headerName, headerValue, url, tabId, requestId) {
    if (!currentActiveTabId || tabId !== currentActiveTabId) return;
    const savedResponses = await api.getStorage(STORE_RESPONSE_HEADERS);
    savedResponses[requestId] = {
        tabId: String(tabId),
        requestId,
        url: url || "",
        headers: { [headerName]: headerValue },
        updatedAt: Date.now(),
    };
    await api.setStorage(STORE_RESPONSE_HEADERS, savedResponses);
}

async function saveOperationNamesForCurrentTab(operationName, tabId, requestId) {
    if (!currentActiveTabId || tabId !== currentActiveTabId) return;
    const savedOperationNames = await api.getStorage(STORE_REQUEST_PAYLOADS);
    savedOperationNames[requestId] = {
        requestId,
        operationName,
        tabId: String(tabId),
        updatedAt: Date.now(),
    };
    await api.setStorage(STORE_REQUEST_PAYLOADS, savedOperationNames);
}

const URL_FILTER = { urls: ["*://*.scriptsense.co.nz/*"] };

// Observe outgoing requests; only capture headers for the active tab
api.onBeforeSendHeaders((details) => {
    try {
        if (!details.requestHeaders) return;
        if (!details.tabId || details.tabId !== currentActiveTabId) return;

        const urlObj = new URL(details.url);
        const host = urlObj.hostname;
        if (!host.startsWith("api.") || !host.endsWith(".scriptsense.co.nz")) return;

        const authHeader = details.requestHeaders.find(
            (h) => h.name.toLowerCase() === "authorization"
        );
        if (authHeader && authHeader.value) {
            saveRequestHeaderForCurrentTab("Authorization", authHeader.value, details.url, details.tabId);
        }
    } catch (e) {
        console.error("Header Clipper (current-tab) error:", e);
    }
}, URL_FILTER);

// Capture response headers for x-trace-id
api.onHeadersReceived((details) => {
    try {
        if (!details.responseHeaders) return;
        if (!details.tabId || details.tabId !== currentActiveTabId) return;

        const urlObj = new URL(details.url);
        const host = urlObj.hostname;
        if (!host.startsWith("api.") || !host.endsWith(".scriptsense.co.nz")) return;

        const traceIdHeader = details.responseHeaders.find(
            (h) => h.name.toLowerCase() === "x-traceid"
        );
        if (traceIdHeader) {
            saveResponseHeadersForCurrentTab("X-Traceid", traceIdHeader.value, details.url, details.tabId, details.requestId);
        }
    } catch (e) {
        console.error("Header Clipper (current-tab) error:", e);
    }
}, URL_FILTER);

// Capture GraphQL operation names from request body
api.onBeforeRequest((details) => {
    try {
        if (!details.tabId || details.tabId < 0) return;
        if (!details.requestBody) return;

        let bodyString = "";
        if (details.requestBody.raw && details.requestBody.raw.length) {
            const chunks = details.requestBody.raw.map((chunk) => {
                if (!chunk || !chunk.bytes) return "";
                try {
                    return new TextDecoder("utf-8").decode(chunk.bytes);
                } catch (e) {
                    return "";
                }
            });
            bodyString = chunks.join("");
        } else if (details.requestBody.formData) {
            const fd = details.requestBody.formData;
            for (const k in fd) {
                if (Array.isArray(fd[k]) && fd[k].length) {
                    bodyString = fd[k][0];
                    break;
                }
            }
        }

        if (!bodyString) return;

        let parsed;
        try {
            parsed = JSON.parse(bodyString);
        } catch (e) {
            return;
        }

        const operationName = parsed.operationName || null;
        if (operationName) {
            saveOperationNamesForCurrentTab(operationName, details.tabId, details.requestId);
        }
    } catch (err) {
        console.error("onBeforeRequest error:", err);
    }
}, URL_FILTER);

// Message API for popup
api.onMessage((msg, sender, sendResponse) => {
    if (msg && msg.type === MSG_GET_ALL_REQUEST_HEADERS) {
        sendAllRequestHeaders(sendResponse);
        return true;
    }
    if (msg && msg.type === MSG_GET_REQUEST_HEADER_VALUE) {
        sendRequestHeaderValue(msg, sendResponse);
        return true;
    }
    if (msg && msg.type === MSG_GET_ALL_RESPONSE_TRACES) {
        sendAllResponseTraces(sendResponse);
        return true;
    }
    if (msg && msg.type === MSG_CLEAR) {
        api.removeStorage(STORE_REQUEST_HEADERS, STORE_RESPONSE_HEADERS, STORE_REQUEST_PAYLOADS)
            .then(() => sendResponse({ ok: true }));
        return true;
    }
});

function sendAllRequestHeaders(sendResponse) {
    api.getStorage(STORE_REQUEST_HEADERS).then((obj) => {
        if (!obj || !obj.headers) {
            sendResponse({ ok: true, data: null });
        } else {
            sendResponse({
                ok: true,
                data: {
                    tabId: obj.tabId,
                    url: obj.url,
                    headerNames: Object.keys(obj.headers),
                    updatedAt: obj.updatedAt,
                },
            });
        }
    }).catch((err) => {
        console.error("sendAllRequestHeaders error:", err);
        sendResponse({ ok: false, error: "Failed to read request headers." });
    });
}

function sendRequestHeaderValue(msg, sendResponse) {
    api.getStorage(STORE_REQUEST_HEADERS).then((obj) => {
        if (!obj || !obj.headers) {
            sendResponse({ ok: false, error: "No header stored for current tab." });
        } else {
            const val = obj.headers[msg.headerName];
            if (val) sendResponse({ ok: true, value: val });
            else sendResponse({ ok: false, error: "Header not found." });
        }
    }).catch((err) => {
        console.error("sendRequestHeaderValue error:", err);
        sendResponse({ ok: false, error: "Failed to read header value." });
    });
}

function sendAllResponseTraces(sendResponse) {
    Promise.all([
        api.getStorage(STORE_RESPONSE_HEADERS),
        api.getStorage(STORE_REQUEST_PAYLOADS),
    ]).then(([responseHeaders, requestPayloads]) => {
        if (Object.keys(responseHeaders).length === 0) {
            sendResponse({ ok: true, data: null });
            return;
        }

        const traces = [];
        Object.entries(responseHeaders).forEach(([requestId, value]) => {
            const traceId = value.headers["X-Traceid"];
            if (traceId) {
                const requestBody = requestPayloads[requestId];
                traces.push({
                    traceId,
                    requestId,
                    updatedAt: value.updatedAt,
                    operationName: requestBody?.operationName,
                });
            }
        });

        traces.reverse();
        sendResponse({ ok: true, data: traces });
    }).catch((err) => {
        console.error("sendAllResponseTraces error:", err);
        sendResponse({ ok: false, error: "Failed to read response traces." });
    });
}
