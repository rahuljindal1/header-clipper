import { ChromeApi } from "./ChromeApi";
import { STORE_RESPONSE_HEADERS, STORE_REQUEST_PAYLOADS, PREF_BADGE_MODE } from "../constants";

export class BadgeService {
    private api: ChromeApi;

    constructor(api: ChromeApi) {
        this.api = api;
    }

    public init() {
        this.api.setBadgeBackgroundColor("#0d9488");
        this.api.setBadgeTextColor("#ffffff");
        this.update();
    }

    public async update() {
        const mode = await this.api.getPreference(PREF_BADGE_MODE);
        const responseHeaders = await this.api.getStorage(STORE_RESPONSE_HEADERS);
        const entries = Object.entries(responseHeaders);

        if (entries.length === 0) {
            this.api.setBadgeText("");
            return;
        }

        let count: number;
        if (mode === "max_hits") {
            const payloads = await this.api.getStorage(STORE_REQUEST_PAYLOADS);
            const grouped = new Map<string, number>();
            entries.forEach(([requestId, value]: [string, any]) => {
                const opName = payloads[requestId]?.operationName;
                const key = opName || (value as any).url || requestId;
                grouped.set(key, (grouped.get(key) || 0) + 1);
            });
            count = Math.max(...grouped.values());
        } else {
            count = entries.length;
        }

        this.api.setBadgeText(count > 999 ? "999+" : String(count));
    }

    public clear() {
        this.api.setBadgeText("");
    }
}
