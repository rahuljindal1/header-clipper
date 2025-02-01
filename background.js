import { NEW_REQUEST_ACTION_DATA } from './constants'

let latestRequest

chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        const requestData = {
            type: "Request",
            url: details.url,
            method: details.method,
            requestBody: details.requestBody ? JSON.stringify(details.requestBody, null, 2) : null,
            headers: null, // Will be filled later
            statusCode: null // Will be filled later
        };

        if (details.url.includes('monolith')) {
            latestRequest = requestData
            sendRequestMessage()
        }
    },
    { urls: ["<all_urls>"] }
);

chrome.webRequest.onBeforeSendHeaders.addListener(
    function (details) {
        const requestHeaders = details.requestHeaders.reduce((headers, header) => {
            headers[header.name] = header.value;
            return headers;
        }, {});


        if (details.url === latestRequest?.url) {
            latestRequest.headers = requestHeaders
            sendRequestMessage()
        }
    },
    { urls: ["<all_urls>"] },
    ["requestHeaders"]
);

function sendRequestMessage() {
    chrome.storage.local.set({ [NEW_REQUEST_ACTION_DATA]: latestRequest });
}