import { ChromeApi } from "./ChromeApi";
import { BadgeService } from "./BadgeService";
import {
    MSG_GET_ALL_REQUEST_HEADERS,
    MSG_GET_REQUEST_HEADER_VALUE,
    MSG_GET_ALL_RESPONSE_TRACES,
    MSG_CLEAR,
    MSG_UPDATE_BADGE,
    MSG_DELETE_TRACE,
    STORE_REQUEST_HEADERS,
    STORE_RESPONSE_HEADERS,
    STORE_REQUEST_PAYLOADS,
    PREF_TRACE_TTL_MINUTES,
    PREF_TRACE_MAX_COUNT,
    PREF_TRACE_MIN_HITS,
} from "../constants";
import { Message, Trace } from "../types";

type SendResponse = (response: unknown) => void;

export class TraceService {
    private api: ChromeApi;
    private badge: BadgeService;

    constructor(api: ChromeApi, badge: BadgeService) {
        this.api = api;
        this.badge = badge;
    }

    public listen() {
        this.api.onMessage((msg: Message, _sender: chrome.runtime.MessageSender, sendResponse: SendResponse) =>
            this.dispatch(msg, _sender, sendResponse),
        );
    }

    private dispatch(msg: Message, _sender: chrome.runtime.MessageSender, sendResponse: SendResponse) {
        if (!msg || !msg.type) return;

        if (msg.type === MSG_GET_ALL_REQUEST_HEADERS) {
            this.getAllHeaders(sendResponse);
            return true;
        }
        if (msg.type === MSG_GET_REQUEST_HEADER_VALUE) {
            this.getHeaderValue(msg, sendResponse);
            return true;
        }
        if (msg.type === MSG_GET_ALL_RESPONSE_TRACES) {
            this.getAllTraces(sendResponse);
            return true;
        }
        if (msg.type === MSG_CLEAR) {
            this.clear(sendResponse);
            return true;
        }
        if (msg.type === MSG_DELETE_TRACE) {
            this.deleteTrace(msg.payload!, sendResponse);
            return true;
        }
        if (msg.type === MSG_UPDATE_BADGE) {
            this.refreshBadge().then(() => sendResponse({ ok: true }))
            return true;
        }
    }

    private getAllHeaders(sendResponse: SendResponse) {
        this.api
            .getStorage(STORE_REQUEST_HEADERS)
            .then((obj: any) => {
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
            })
            .catch((err: unknown) => {
                console.error("getAllHeaders error:", err);
                sendResponse({ ok: false, error: "Failed to read request headers." });
            });
    }

    private getHeaderValue(msg: Message, sendResponse: SendResponse) {
        this.api
            .getStorage(STORE_REQUEST_HEADERS)
            .then((obj: any) => {
                if (!obj || !obj.headers) {
                    sendResponse({ ok: false, error: "No header stored for current tab." });
                } else {
                    const val = obj.headers[msg.headerName!];
                    if (val) sendResponse({ ok: true, value: val });
                    else sendResponse({ ok: false, error: "Header not found." });
                }
            })
            .catch((err: unknown) => {
                console.error("getHeaderValue error:", err);
                sendResponse({ ok: false, error: "Failed to read header value." });
            });
    }

    public async refreshBadge() {
        const traces = await this.buildFilteredTraces();
        await this.badge.update(traces);
    }

    private async buildFilteredTraces(): Promise<Trace[]> {
        const [responseHeaders, requestPayloads, ttlPref, maxPref, minHitsPref] = await Promise.all([
            this.api.getStorage(STORE_RESPONSE_HEADERS),
            this.api.getStorage(STORE_REQUEST_PAYLOADS),
            this.api.getPreference(PREF_TRACE_TTL_MINUTES),
            this.api.getPreference(PREF_TRACE_MAX_COUNT),
            this.api.getPreference(PREF_TRACE_MIN_HITS),
        ]);

        if (Object.keys(responseHeaders).length === 0) {
            return [];
        }

        const grouped = new Map<string, Trace>();
        Object.entries(responseHeaders).forEach(([requestId, value]: [string, any]) => {
            const traceId = value.headers["X-Traceid"];
            if (traceId) {
                const requestBody = requestPayloads[requestId];
                const operationName = requestBody?.operationName;
                const key = this.resolveGroupKey(operationName, value.url, requestId);
                const existing = grouped.get(key);

                if (existing) {
                    existing.count++;
                    if (value.updatedAt > existing.updatedAt) {
                        existing.traceId = traceId;
                        existing.requestId = requestId;
                        existing.updatedAt = value.updatedAt;
                    }
                } else {
                    grouped.set(key, {
                        traceId,
                        requestId,
                        updatedAt: value.updatedAt,
                        operationName,
                        count: 1,
                        groupKey: key,
                    });
                }
            }
        });

        let traces = Array.from(grouped.values()).sort((a, b) => b.updatedAt - a.updatedAt);

        const ttl = Number(ttlPref) || 0;
        if (ttl > 0) {
            const cutoff = Date.now() - ttl * 60 * 1000;
            traces = traces.filter((t) => t.updatedAt >= cutoff);
        }

        const max = Number(maxPref) || 0;
        if (max > 0) {
            traces = traces.slice(0, max);
        }

        const minHits = Number(minHitsPref) || 0;
        if (minHits > 0) {
            traces = traces.filter((t) => t.count >= minHits);
        }

        return traces;
    }

    private getAllTraces(sendResponse: SendResponse) {
        this.buildFilteredTraces()
            .then((traces) => {
                this.badge.update(traces);
                sendResponse({ ok: true, data: traces.length > 0 ? traces : null });
            })
            .catch((err: unknown) => {
                console.error("getAllTraces error:", err);
                sendResponse({ ok: false, error: "Failed to read response traces." });
            });
    }

    private clear(sendResponse: SendResponse) {
        this.api
            .removeStorage(STORE_REQUEST_HEADERS, STORE_RESPONSE_HEADERS, STORE_REQUEST_PAYLOADS)
            .then(() => {
                this.badge.clear();
                sendResponse({ ok: true });
            });
    }

    private resolveGroupKey(operationName?: string, url?: string, requestId?: string): string {
        return operationName || url || requestId || "";
    }

    private deleteTrace(traceKey: string, sendResponse: SendResponse) {
        Promise.all([
            this.api.getStorage(STORE_RESPONSE_HEADERS),
            this.api.getStorage(STORE_REQUEST_PAYLOADS),
        ])
            .then(async ([responseHeaders, requestPayloads]) => {
                Object.keys(responseHeaders).forEach((requestId) => {
                    const payload = requestPayloads[requestId];
                    const entry = responseHeaders[requestId];
                    const key = this.resolveGroupKey(payload?.operationName, entry.url, requestId);
                    if (key === traceKey) {
                        delete responseHeaders[requestId];
                        delete requestPayloads[requestId];
                    }
                });

                await this.api.setStorage(STORE_RESPONSE_HEADERS, responseHeaders);
                await this.api.setStorage(STORE_REQUEST_PAYLOADS, requestPayloads);
                await this.refreshBadge();
                sendResponse({ ok: true });
            })
            .catch((err: unknown) => {
                console.error("deleteTrace error:", err);
                sendResponse({ ok: false });
            });
    }
}
