import { ChromeApi } from "./ChromeApi";
import { PREF_BADGE_MODE } from "../constants";
import { Trace } from "../types";

export class BadgeService {
    private api: ChromeApi;

    constructor(api: ChromeApi) {
        this.api = api;
    }

    public init() {
        this.api.setBadgeBackgroundColor("#0d9488");
        this.api.setBadgeTextColor("#ffffff");
    }

    public async update(traces: Trace[]) {
        if (traces.length === 0) {
            this.api.setBadgeText("");
            return;
        }

        const mode = await this.api.getPreference(PREF_BADGE_MODE);

        let count: number;
        if (mode === "max_hits") {
            count = Math.max(...traces.map((t) => t.count));
        } else {
            count = traces.length;
        }

        this.api.setBadgeText(count > 999 ? "999+" : String(count));
    }

    public clear() {
        this.api.setBadgeText("");
    }
}
