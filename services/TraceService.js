import {
    MSG_GET_ALL_REQUEST_HEADERS,
    MSG_GET_REQUEST_HEADER_VALUE,
    MSG_GET_ALL_RESPONSE_TRACES,
    MSG_CLEAR,
    STORE_REQUEST_HEADERS,
    STORE_RESPONSE_HEADERS,
    STORE_REQUEST_PAYLOADS,
} from "../constants.js";

export class TraceService {
    constructor(api) {
        this.api = api;
    }

    listen() {
        this.api.onMessage((msg, sender, sendResponse) => this._dispatch(msg, sender, sendResponse));
    }

    _dispatch(msg, _sender, sendResponse) {
        if (!msg || !msg.type) return;

        if (msg.type === MSG_GET_ALL_REQUEST_HEADERS) {
            this._getAllHeaders(sendResponse);
            return true;
        }
        if (msg.type === MSG_GET_REQUEST_HEADER_VALUE) {
            this._getHeaderValue(msg, sendResponse);
            return true;
        }
        if (msg.type === MSG_GET_ALL_RESPONSE_TRACES) {
            this._getAllTraces(sendResponse);
            return true;
        }
        if (msg.type === MSG_CLEAR) {
            this._clear(sendResponse);
            return true;
        }
    }

    _getAllHeaders(sendResponse) {
        this.api.getStorage(STORE_REQUEST_HEADERS).then((obj) => {
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
            console.error("getAllHeaders error:", err);
            sendResponse({ ok: false, error: "Failed to read request headers." });
        });
    }

    _getHeaderValue(msg, sendResponse) {
        this.api.getStorage(STORE_REQUEST_HEADERS).then((obj) => {
            if (!obj || !obj.headers) {
                sendResponse({ ok: false, error: "No header stored for current tab." });
            } else {
                const val = obj.headers[msg.headerName];
                if (val) sendResponse({ ok: true, value: val });
                else sendResponse({ ok: false, error: "Header not found." });
            }
        }).catch((err) => {
            console.error("getHeaderValue error:", err);
            sendResponse({ ok: false, error: "Failed to read header value." });
        });
    }

    _getAllTraces(sendResponse) {
        Promise.all([
            this.api.getStorage(STORE_RESPONSE_HEADERS),
            this.api.getStorage(STORE_REQUEST_PAYLOADS),
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
            console.error("getAllTraces error:", err);
            sendResponse({ ok: false, error: "Failed to read response traces." });
        });
    }

    _clear(sendResponse) {
        this.api.removeStorage(
            STORE_REQUEST_HEADERS,
            STORE_RESPONSE_HEADERS,
            STORE_REQUEST_PAYLOADS
        ).then(() => sendResponse({ ok: true }));
    }
}
