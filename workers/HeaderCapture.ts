import { ChromeApi } from "../services/ChromeApi";
import { STORE_SESSION_START, STORE_REQUEST_HEADERS, STORE_RESPONSE_HEADERS, STORE_REQUEST_PAYLOADS } from "../constants";

export class HeaderCapture {
    private api: ChromeApi;
    private currentActiveTabId: number | null = null;
    private URL_FILTER: chrome.webRequest.RequestFilter = { urls: ["*://*.scriptsense.co.nz/*"] };

    constructor(api: ChromeApi) {
        this.api = api;
    }

    public async init() {
        try {
            const tabs = await this.api.queryActiveTabs();
            if (tabs && tabs.length) this.currentActiveTabId = tabs[0].id ?? null;
        } catch (e) {
            console.warn("Header Clipper init tabs.query failed:", e);
        }

        await this.api.setStorage(STORE_SESSION_START, Date.now());

        this.bindTabListeners();
        this.bindWebRequestListeners();
    }

    private bindTabListeners() {
        this.api.onTabActivated((activeInfo) => {
            this.currentActiveTabId = activeInfo.tabId;
        });

        this.api.onTabRemoved((tabId) => {
            if (tabId === this.currentActiveTabId) {
                this.currentActiveTabId = null;
                this.api.removeStorage(STORE_REQUEST_HEADERS, STORE_RESPONSE_HEADERS, STORE_REQUEST_PAYLOADS);
            }
        });
    }

    private bindWebRequestListeners() {
        this.api.onBeforeSendHeaders((details) => {
            try {
                if (!details.requestHeaders) return;
                if (!details.tabId || details.tabId !== this.currentActiveTabId) return;

                const urlObj = new URL(details.url);
                const host = urlObj.hostname;
                if (!host.startsWith("api.") || !host.endsWith(".scriptsense.co.nz")) return;

                const authHeader = details.requestHeaders.find((h) => h.name.toLowerCase() === "authorization");
                if (authHeader && authHeader.value) {
                    this.saveAuthHeader("Authorization", authHeader.value, details.url, details.tabId);
                }
            } catch (e) {
                console.error("Header Clipper (current-tab) error:", e);
            }
        }, this.URL_FILTER);

        this.api.onHeadersReceived((details) => {
            try {
                if (!details.responseHeaders) return;
                if (!details.tabId || details.tabId !== this.currentActiveTabId) return;

                const urlObj = new URL(details.url);
                const host = urlObj.hostname;
                if (!host.startsWith("api.") || !host.endsWith(".scriptsense.co.nz")) return;

                const traceIdHeader = details.responseHeaders.find((h) => h.name.toLowerCase() === "x-traceid");
                if (traceIdHeader) {
                    this.saveTraceId("X-Traceid", traceIdHeader.value!, details.url, details.tabId, details.requestId);
                }
            } catch (e) {
                console.error("Header Clipper (current-tab) error:", e);
            }
        }, this.URL_FILTER);

        this.api.onBeforeRequest((details) => {
            try {
                if (!details.tabId || details.tabId < 0) return;
                if (!details.requestBody) return;

                let bodyString = "";
                if (details.requestBody.raw && details.requestBody.raw.length) {
                    const chunks = details.requestBody.raw.map((chunk) => {
                        if (!chunk || !chunk.bytes) return "";
                        try {
                            return new TextDecoder("utf-8").decode(chunk.bytes);
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        } catch (e) {
                            return "";
                        }
                    });
                    bodyString = chunks.join("");
                } else if (details.requestBody.formData) {
                    const fd = details.requestBody.formData;
                    for (const k in fd) {
                        if (Array.isArray(fd[k]) && fd[k].length) {
                            bodyString = fd[k][0] as string;
                            break;
                        }
                    }
                }

                if (!bodyString) return;

                let parsed: { operationName?: string };
                try {
                    parsed = JSON.parse(bodyString);
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (e) {
                    return;
                }

                const operationName = parsed.operationName || null;
                if (operationName) {
                    this.saveOperationName(operationName, details.tabId, details.requestId);
                }
            } catch (err) {
                console.error("onBeforeRequest error:", err);
            }
        }, this.URL_FILTER);
    }

    private async saveAuthHeader(headerName: string, headerValue: string, url: string, tabId: number) {
        if (!this.currentActiveTabId || tabId !== this.currentActiveTabId) return;
        const payload = {
            tabId: String(tabId),
            url: url || "",
            headers: { [headerName]: headerValue },
            updatedAt: Date.now(),
        };
        await this.api.setStorage(STORE_REQUEST_HEADERS, payload);
    }

    private async saveTraceId(headerName: string, headerValue: string, url: string, tabId: number, requestId: string) {
        if (!this.currentActiveTabId || tabId !== this.currentActiveTabId) return;
        const saved = await this.api.getStorage(STORE_RESPONSE_HEADERS);
        saved[requestId] = {
            tabId: String(tabId),
            requestId,
            url: url || "",
            headers: { [headerName]: headerValue },
            updatedAt: Date.now(),
        };
        await this.api.setStorage(STORE_RESPONSE_HEADERS, saved);
    }

    private async saveOperationName(operationName: string, tabId: number, requestId: string) {
        if (!this.currentActiveTabId || tabId !== this.currentActiveTabId) return;
        const saved = await this.api.getStorage(STORE_REQUEST_PAYLOADS);
        saved[requestId] = {
            requestId,
            operationName,
            tabId: String(tabId),
            updatedAt: Date.now(),
        };
        await this.api.setStorage(STORE_REQUEST_PAYLOADS, saved);
    }
}
