/**
 * Thin Promise wrapper over Chrome extension APIs.
 * Used by both popup.js and background.js — knows nothing about UI or business logic.
 */

import {
    MSG_GET_ALL_REQUEST_HEADERS,
    MSG_GET_REQUEST_HEADER_VALUE,
    MSG_GET_ALL_RESPONSE_TRACES,
    MSG_CLEAR,
} from "./constants.js";

// ── Storage ──

export function getStorage(key) {
    return new Promise((resolve) =>
        chrome.storage.local.get([key], (r) => resolve(r[key] || {}))
    );
}

export function setStorage(key, value) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve();
        });
    });
}

export function removeStorage(...keys) {
    return Promise.all(keys.map((k) => chrome.storage.local.remove(k)));
}

// ── Tabs ──

export function queryActiveTabs() {
    return chrome.tabs.query({ active: true, lastFocusedWindow: true });
}

export function onTabActivated(callback) {
    chrome.tabs.onActivated.addListener(callback);
}

export function onTabRemoved(callback) {
    chrome.tabs.onRemoved.addListener(callback);
}

// ── Web Request ──

export function onBeforeSendHeaders(callback, filter) {
    chrome.webRequest.onBeforeSendHeaders.addListener(callback, filter, ["requestHeaders"]);
}

export function onHeadersReceived(callback, filter) {
    chrome.webRequest.onHeadersReceived.addListener(callback, filter, ["responseHeaders"]);
}

export function onBeforeRequest(callback, filter) {
    chrome.webRequest.onBeforeRequest.addListener(callback, filter, ["requestBody"]);
}

// ── Runtime messaging ──

export function onMessage(callback) {
    chrome.runtime.onMessage.addListener(callback);
}

export function sendMessage(msg) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, (resp) => resolve(resp));
    });
}

// ── Popup convenience methods ──

export function getAllRequestHeaders() {
    return sendMessage({ type: MSG_GET_ALL_REQUEST_HEADERS });
}

export function getRequestHeaderValue(headerName) {
    return sendMessage({ type: MSG_GET_REQUEST_HEADER_VALUE, headerName });
}

export function getAllResponseTraces() {
    return sendMessage({ type: MSG_GET_ALL_RESPONSE_TRACES });
}

export function clearData() {
    return sendMessage({ type: MSG_CLEAR });
}

export function getPreference(key) {
    return new Promise((resolve) => {
        chrome.storage?.local?.get([key], (result) => {
            resolve(result?.[key] ?? null);
        });
    });
}

export function setPreference(key, value) {
    chrome.storage?.local?.set({ [key]: value });
}
