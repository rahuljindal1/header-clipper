import { ChromeApi } from "../services/ChromeApi";
import {
    PREF_INCLUDE_BEARER,
    PREF_TRACE_TTL_MINUTES,
    PREF_TRACE_MAX_COUNT,
    PREF_TRACE_MIN_HITS,
    PREF_BADGE_MODE,
    MSG_UPDATE_BADGE,
    STORE_SESSION_START,
} from "../constants";
import { HeadersResponse, HeaderValueResponse, TracesResponse, Trace, ClearResponse, DeleteTraceResponse } from "../types";

export class PopupController {
    private api: ChromeApi;
    private PREF_INCLUDE_BEARER = PREF_INCLUDE_BEARER;
    private els: Record<string, HTMLElement | null> = {};

    constructor(api: ChromeApi) {
        this.api = api;
    }

    public async init() {
        this.els = {
            container: document.getElementById("container"),
            traceContainer: document.getElementById("responseTraceContainer"),
            clearBtn: document.getElementById("clearBtn"),
            refreshBtn: document.getElementById("refreshBtn"),
            toast: document.getElementById("toast"),
            bearerToggle: document.getElementById("bearerToggle"),
            settingsToggle: document.getElementById("settingsToggle"),
            settingsBody: document.getElementById("settingsBody"),
            settingsChevron: document.getElementById("settingsChevron"),
            ttlInput: document.getElementById("ttlInput"),
            maxCountInput: document.getElementById("maxCountInput"),
            minHitsInput: document.getElementById("minHitsInput"),
            sessionTime: document.getElementById("sessionTime"),
            sessionTimer: document.getElementById("sessionTimer"),
            badgeModeSelect: document.getElementById("badgeModeSelect"),
            settingsSummary: document.getElementById("settingsSummary"),
        };

        const savedPref = await this.api.getPreference(this.PREF_INCLUDE_BEARER);
        if (savedPref) (this.els.bearerToggle as HTMLInputElement).checked = true;

        this.els.bearerToggle!.addEventListener("change", () => {
            this.api.setPreference(this.PREF_INCLUDE_BEARER, (this.els.bearerToggle as HTMLInputElement).checked);
        });

        this.els.clearBtn!.addEventListener("click", async () => {
            const resp: ClearResponse = await this.api.clearData();
            if (resp && resp.ok) this.render();
        });

        this.els.refreshBtn!.addEventListener("click", () => this.render());

        this.els.settingsToggle!.addEventListener("click", () => {
            const body = this.els.settingsBody!;
            const isOpen = body.style.display !== "none";
            body.style.display = isOpen ? "none" : "block";
            this.els.settingsChevron!.classList.toggle("open", !isOpen);
        });

        const savedTtl = await this.api.getPreference(PREF_TRACE_TTL_MINUTES);
        if (savedTtl) (this.els.ttlInput as HTMLInputElement).value = String(savedTtl);

        const savedMax = await this.api.getPreference(PREF_TRACE_MAX_COUNT);
        if (savedMax) (this.els.maxCountInput as HTMLInputElement).value = String(savedMax);

        const savedMinHits = await this.api.getPreference(PREF_TRACE_MIN_HITS);
        if (savedMinHits) (this.els.minHitsInput as HTMLInputElement).value = String(savedMinHits);

        this.els.ttlInput!.addEventListener("change", () => {
            const val = Number((this.els.ttlInput as HTMLInputElement).value) || 0;
            this.api.setPreference(PREF_TRACE_TTL_MINUTES, val);
            this.updateSettingsSummary();
            this.api.sendMessage({ type: MSG_UPDATE_BADGE });
            this.render();
        });

        this.els.maxCountInput!.addEventListener("change", () => {
            const val = Number((this.els.maxCountInput as HTMLInputElement).value) || 0;
            this.api.setPreference(PREF_TRACE_MAX_COUNT, val);
            this.updateSettingsSummary();
            this.api.sendMessage({ type: MSG_UPDATE_BADGE });
            this.render();
        });

        this.els.minHitsInput!.addEventListener("change", () => {
            const val = Number((this.els.minHitsInput as HTMLInputElement).value) || 0;
            this.api.setPreference(PREF_TRACE_MIN_HITS, val);
            this.updateSettingsSummary();
            this.api.sendMessage({ type: MSG_UPDATE_BADGE });
            this.render();
        });

        const savedBadgeMode = await this.api.getPreference(PREF_BADGE_MODE);
        if (savedBadgeMode) (this.els.badgeModeSelect as HTMLSelectElement).value = String(savedBadgeMode);

        this.els.badgeModeSelect!.addEventListener("change", () => {
            this.api.setPreference(PREF_BADGE_MODE, (this.els.badgeModeSelect as HTMLSelectElement).value);
            this.api.sendMessage({ type: MSG_UPDATE_BADGE });
            this.updateSettingsSummary();
        });

        this.updateSettingsSummary();
        this.startSessionTimer();
        this.render();
    }

    private async startSessionTimer() {
        const stored = await this.api.getStorage(STORE_SESSION_START);
        const startTime = typeof stored === "number" ? stored : Date.now();
        const tick = () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
            const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
            const s = String(elapsed % 60).padStart(2, "0");
            this.els.sessionTime!.textContent = `${h}:${m}:${s}`;
            const totalMin = Math.floor(elapsed / 60);
            this.els.sessionTimer!.setAttribute("data-tooltip", `Session running for ${totalMin} minute${totalMin !== 1 ? "s" : ""}`);
        };
        tick();
        setInterval(tick, 1000);
    }

    private async render() {
        await this.renderHeaders();
        await this.renderTraces();
    }

    private async renderHeaders() {
        const resp: HeadersResponse = await this.api.getAllRequestHeaders();

        if (!resp || !resp.ok) {
            this.els.container!.innerHTML =
                "<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><p>Error reading header data.</p></div>";
            return;
        }

        const data = resp.data;
        if (!data) {
            this.els.container!.innerHTML =
                "<div class='empty-state'><i class='fas fa-satellite-dish'></i><p>No headers captured yet.<br>Trigger a request from the active tab.</p></div>";
            return;
        }

        this.els.container!.innerHTML = "";

        const heading = document.createElement("div");
        heading.className = "section-heading";
        heading.textContent = "Request Headers";
        this.els.container!.appendChild(heading);

        const urlDiv = document.createElement("div");
        urlDiv.className = "url-display";
        urlDiv.title = data.url;
        urlDiv.textContent = data.url || `Tab ${data.tabId}`;
        this.els.container!.appendChild(urlDiv);

        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = `Captured ${new Date(data.updatedAt).toLocaleString()}`;
        this.els.container!.appendChild(meta);

        data.headerNames.forEach((hName: string) => {
            const row = document.createElement("div");
            row.className = "header-row";

            const name = document.createElement("div");
            name.className = "hname";
            name.textContent = hName;

            const actions = document.createElement("div");
            const copyBtn = document.createElement("i");
            copyBtn.className = "fas fa-copy icon";
            copyBtn.title = "Copy hidden value";

            copyBtn.addEventListener("click", () => this.copyHeaderValue(hName, copyBtn));

            actions.appendChild(copyBtn);
            row.appendChild(name);
            row.appendChild(actions);
            this.els.container!.appendChild(row);
        });
    }

    private async renderTraces() {
        const resp: TracesResponse = await this.api.getAllResponseTraces();

        if (!resp || !resp.ok) {
            this.els.traceContainer!.innerHTML =
                "<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><p>Error reading trace data.</p></div>";
            return;
        }

        const data = resp.data;
        if (!data || data.length === 0) {
            this.els.traceContainer!.innerHTML =
                "<div class='empty-state'><i class='fas fa-route'></i><p>No traces captured yet.<br>Trigger a request from the active tab.</p></div>";
            return;
        }

        this.els.traceContainer!.innerHTML = "";

        const header = document.createElement("div");
        header.className = "section-heading";
        header.textContent = `Captured traces (${data.length})`;
        this.els.traceContainer!.appendChild(header);

        data.forEach((trace: Trace) => {
            const row = document.createElement("div");
            row.className = "trace-row";

            const left = document.createElement("div");
            left.className = "trace-left";

            const req = document.createElement("div");
            req.className = "req-title";

            const label = trace.operationName || (trace.requestId ? `Req: ${trace.requestId}` : "Req: —");
            req.textContent = label;
            if (trace.count > 1) {
                const badge = document.createElement("span");
                badge.className = "trace-count";
                badge.textContent = `${trace.count}`;
                badge.title = `${trace.count} requests`;
                req.appendChild(badge);
            }
            req.title = trace.updatedAt ? new Date(trace.updatedAt).toLocaleString() : "";
            req.title = `${req.title} - ${label}`;

            const small = document.createElement("div");
            small.className = "trace-small";
            small.textContent = trace.traceId
                ? `Trace ID: ${trace.traceId.substring(0, 40)}${trace.traceId.length > 40 ? "…" : ""}`
                : "Trace ID: —";
            small.title = trace.traceId || "";

            left.appendChild(req);
            left.appendChild(small);

            const actions = document.createElement("div");
            actions.className = "trace-actions";

            const copyBtn = document.createElement("i");
            copyBtn.className = "fas fa-copy icon";
            copyBtn.title = "Copy traceId";
            copyBtn.addEventListener("click", () => this.copyTraceId(trace.traceId, copyBtn));

            const deleteBtn = document.createElement("i");
            deleteBtn.className = "fas fa-trash-alt icon icon-danger";
            deleteBtn.title = "Remove trace";
            deleteBtn.addEventListener("click", () => this.deleteTrace(trace));

            actions.appendChild(copyBtn);
            actions.appendChild(deleteBtn);
            row.appendChild(left);
            row.appendChild(actions);
            this.els.traceContainer!.appendChild(row);
        });
    }

    private async copyHeaderValue(headerName: string, iconEl: HTMLElement) {
        iconEl.classList.add("fa-spin");
        const resp: HeaderValueResponse = await this.api.getRequestHeaderValue(headerName);
        iconEl.classList.remove("fa-spin");

        if (!resp || !resp.ok) {
            this.showToast("Header value not found.", true);
            return;
        }

        const value = this.stripBearerPrefix(resp.value!);
        await navigator.clipboard.writeText(value);

        iconEl.classList.remove("fa-copy");
        iconEl.classList.add("fa-check");
        setTimeout(() => {
            iconEl.classList.remove("fa-check");
            iconEl.classList.add("fa-copy");
        }, 1200);
    }

    private async copyTraceId(traceId: string, iconEl: HTMLElement) {
        try {
            iconEl.classList.add("fa-spin");
            const value = traceId || "";
            if (!value) {
                this.showToast("Trace ID not available.", true);
                return;
            }
            await navigator.clipboard.writeText(value);

            iconEl.classList.remove("fa-spin");
            iconEl.classList.remove("fa-copy");
            iconEl.classList.add("fa-check");

            setTimeout(() => {
                iconEl.classList.remove("fa-check");
                iconEl.classList.add("fa-copy");
            }, 1200);
        } catch (err) {
            iconEl.classList.remove("fa-spin");
            this.showToast("Failed to copy trace id.", true);
            console.error("copy trace error:", err);
        }
    }

    private async deleteTrace(trace: Trace) {
        const resp: DeleteTraceResponse = await this.api.deleteTrace(trace.groupKey);
        if (resp && resp.ok) this.render();
    }

    private stripBearerPrefix(value: string) {
        if (!(this.els.bearerToggle as HTMLInputElement).checked && value.toLowerCase().startsWith("bearer ")) {
            return value.substring(7);
        }
        return value;
    }

    private updateSettingsSummary() {
        const ttl = Number((this.els.ttlInput as HTMLInputElement).value) || 0;
        const max = Number((this.els.maxCountInput as HTMLInputElement).value) || 0;
        const minHits = Number((this.els.minHitsInput as HTMLInputElement).value) || 0;
        const badgeMode = (this.els.badgeModeSelect as HTMLSelectElement).value;

        const chips: { label: string; active: boolean }[] = [];
        chips.push({ label: ttl > 0 ? `TTL ${ttl}m` : "TTL off", active: ttl > 0 });
        chips.push({ label: max > 0 ? `Max ${max}` : "Max off", active: max > 0 });
        chips.push({ label: minHits > 0 ? `Min ${minHits}` : "Min off", active: minHits > 0 });
        chips.push({ label: badgeMode === "max_hits" ? "Top hits" : "Total", active: true });

        const container = this.els.settingsSummary!;
        container.innerHTML = "";
        chips.forEach((chip) => {
            const el = document.createElement("span");
            el.className = `settings-chip${chip.active ? " active" : ""}`;
            el.textContent = chip.label;
            container.appendChild(el);
        });
    }

    private showToast(msg: string, isError: boolean) {
        this.els.toast!.textContent = msg;
        this.els.toast!.classList.toggle("toast-error", !!isError);
        this.els.toast!.classList.add("show");
        setTimeout(() => this.els.toast!.classList.remove("show"), 2000);
    }
}
