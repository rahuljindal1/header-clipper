import {
    MSG_GET_ALL_REQUEST_HEADERS,
    MSG_GET_REQUEST_HEADER_VALUE,
    MSG_GET_ALL_RESPONSE_TRACES,
    MSG_CLEAR,
} from "../constants.js";

export class ChromeApi {
    // ── Storage ──

    getStorage(key) {
        return new Promise((resolve) =>
            chrome.storage.local.get([key], (r) => resolve(r[key] || {}))
        );
    }

    setStorage(key, value) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                resolve();
            });
        });
    }

    removeStorage(...keys) {
        return Promise.all(keys.map((k) => chrome.storage.local.remove(k)));
    }

    // ── Tabs ──

    queryActiveTabs() {
        return chrome.tabs.query({ active: true, lastFocusedWindow: true });
    }

    onTabActivated(callback) {
        chrome.tabs.onActivated.addListener(callback);
    }

    onTabRemoved(callback) {
        chrome.tabs.onRemoved.addListener(callback);
    }

    // ── Web Request ──

    onBeforeSendHeaders(callback, filter) {
        chrome.webRequest.onBeforeSendHeaders.addListener(callback, filter, ["requestHeaders"]);
    }

    onHeadersReceived(callback, filter) {
        chrome.webRequest.onHeadersReceived.addListener(callback, filter, ["responseHeaders"]);
    }

    onBeforeRequest(callback, filter) {
        chrome.webRequest.onBeforeRequest.addListener(callback, filter, ["requestBody"]);
    }

    // ── Runtime messaging ──

    onMessage(callback) {
        chrome.runtime.onMessage.addListener(callback);
    }

    sendMessage(msg) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(msg, (resp) => resolve(resp));
        });
    }

    // ── Popup convenience methods ──

    getAllRequestHeaders() {
        return this.sendMessage({ type: MSG_GET_ALL_REQUEST_HEADERS });
    }

    getRequestHeaderValue(headerName) {
        return this.sendMessage({ type: MSG_GET_REQUEST_HEADER_VALUE, headerName });
    }

    getAllResponseTraces() {
        return this.sendMessage({ type: MSG_GET_ALL_RESPONSE_TRACES });
    }

    clearData() {
        return this.sendMessage({ type: MSG_CLEAR });
    }

    getPreference(key) {
        return new Promise((resolve) => {
            chrome.storage?.local?.get([key], (result) => {
                resolve(result?.[key] ?? null);
            });
        });
    }

    setPreference(key, value) {
        chrome.storage?.local?.set({ [key]: value });
    }
}
