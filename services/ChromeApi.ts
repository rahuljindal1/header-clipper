import {
    MSG_GET_ALL_REQUEST_HEADERS,
    MSG_GET_REQUEST_HEADER_VALUE,
    MSG_GET_ALL_RESPONSE_TRACES,
    MSG_CLEAR,
} from "../constants";
import { Message } from "../types";

export class ChromeApi {
    // ── Storage ──

    public getStorage(key: string): Promise<any> {
        return new Promise((resolve) => chrome.storage.local.get([key], (r) => resolve(r[key] || {})));
    }

    public setStorage(key: string, value: any): Promise<void> {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                resolve();
            });
        });
    }

    public removeStorage(...keys: string[]) {
        return Promise.all(keys.map((k) => chrome.storage.local.remove(k)));
    }

    // ── Tabs ──

    public queryActiveTabs() {
        return chrome.tabs.query({ active: true, lastFocusedWindow: true });
    }

    public onTabActivated(callback: (activeInfo: chrome.tabs.OnActivatedInfo) => void) {
        chrome.tabs.onActivated.addListener(callback);
    }

    public onTabRemoved(callback: (tabId: number) => void) {
        chrome.tabs.onRemoved.addListener(callback);
    }

    // ── Web Request ──

    public onBeforeSendHeaders(
        callback: (
            details: chrome.webRequest.OnBeforeSendHeadersDetails,
        ) => chrome.webRequest.BlockingResponse | undefined,
        filter: chrome.webRequest.RequestFilter,
    ) {
        chrome.webRequest.onBeforeSendHeaders.addListener(callback, filter, ["requestHeaders"]);
    }

    public onHeadersReceived(
        callback: (
            details: chrome.webRequest.OnHeadersReceivedDetails,
        ) => chrome.webRequest.BlockingResponse | undefined,
        filter: chrome.webRequest.RequestFilter,
    ) {
        chrome.webRequest.onHeadersReceived.addListener(callback, filter, ["responseHeaders"]);
    }

    public onBeforeRequest(
        callback: (details: chrome.webRequest.OnBeforeRequestDetails) => chrome.webRequest.BlockingResponse | undefined,
        filter: chrome.webRequest.RequestFilter,
    ) {
        chrome.webRequest.onBeforeRequest.addListener(callback, filter, ["requestBody"]);
    }

    // ── Runtime messaging ──

    public onMessage(
        callback: (
            msg: Message,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response?: unknown) => void,
        ) => void,
    ) {
        chrome.runtime.onMessage.addListener(callback);
    }

    public sendMessage(msg: Message): Promise<any> {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(msg, (resp) => resolve(resp));
        });
    }

    // ── Badge ──

    public setBadgeText(text: string) {
        chrome.action.setBadgeText({ text });
    }

    public setBadgeBackgroundColor(color: string) {
        chrome.action.setBadgeBackgroundColor({ color });
    }

    public setBadgeTextColor(color: string) {
        chrome.action.setBadgeTextColor({ color });
    }

    // ── Popup convenience methods ──

    public getAllRequestHeaders() {
        return this.sendMessage({ type: MSG_GET_ALL_REQUEST_HEADERS });
    }

    public getRequestHeaderValue(headerName: string) {
        return this.sendMessage({ type: MSG_GET_REQUEST_HEADER_VALUE, headerName });
    }

    public getAllResponseTraces() {
        return this.sendMessage({ type: MSG_GET_ALL_RESPONSE_TRACES });
    }

    public clearData() {
        return this.sendMessage({ type: MSG_CLEAR });
    }

    public getPreference(key: string): Promise<unknown> {
        return new Promise((resolve) => {
            chrome.storage?.local?.get([key], (result) => {
                resolve(result?.[key] ?? null);
            });
        });
    }

    public setPreference(key: string, value: unknown) {
        chrome.storage?.local?.set({ [key]: value });
    }
}
