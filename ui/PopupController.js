import { PREF_INCLUDE_BEARER } from "../constants.js";

export class PopupController {
    constructor(api) {
        this.api = api;
        this.PREF_INCLUDE_BEARER = PREF_INCLUDE_BEARER;
        this.els = {};
    }

    async init() {
        this.els = {
            container: document.getElementById("container"),
            traceContainer: document.getElementById("responseTraceContainer"),
            clearBtn: document.getElementById("clearBtn"),
            refreshBtn: document.getElementById("refreshBtn"),
            toast: document.getElementById("toast"),
            bearerToggle: document.getElementById("bearerToggle"),
        };

        const savedPref = await this.api.getPreference(this.PREF_INCLUDE_BEARER);
        if (savedPref) this.els.bearerToggle.checked = true;

        this.els.bearerToggle.addEventListener("change", () => {
            this.api.setPreference(this.PREF_INCLUDE_BEARER, this.els.bearerToggle.checked);
        });

        this.els.clearBtn.addEventListener("click", async () => {
            const resp = await this.api.clearData();
            if (resp && resp.ok) this.render();
        });

        this.els.refreshBtn.addEventListener("click", () => this.render());

        this.render();
    }

    async render() {
        this.els.container.innerHTML = "<div class='small'><i class='fas fa-spinner fa-spin'></i> Loading…</div>";
        this.els.traceContainer.innerHTML = "";

        await this._renderHeaders();
        await this._renderTraces();
    }

    async _renderHeaders() {
        const resp = await this.api.getAllRequestHeaders();

        if (!resp || !resp.ok) {
            this.els.container.innerHTML = "<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><p>Error reading header data.</p></div>";
            return;
        }

        const data = resp.data;
        if (!data) {
            this.els.container.innerHTML = "<div class='empty-state'><i class='fas fa-satellite-dish'></i><p>No headers captured yet.<br>Trigger a request from the active tab.</p></div>";
            return;
        }

        this.els.container.innerHTML = "";

        const heading = document.createElement("div");
        heading.className = "section-heading";
        heading.textContent = "Request Headers";
        this.els.container.appendChild(heading);

        const urlDiv = document.createElement("div");
        urlDiv.className = "url-display";
        urlDiv.title = data.url;
        urlDiv.textContent = data.url || `Tab ${data.tabId}`;
        this.els.container.appendChild(urlDiv);

        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = `Captured ${new Date(data.updatedAt).toLocaleString()}`;
        this.els.container.appendChild(meta);

        data.headerNames.forEach(hName => {
            const row = document.createElement("div");
            row.className = "header-row";

            const name = document.createElement("div");
            name.className = "hname";
            name.textContent = hName;

            const actions = document.createElement("div");
            const copyBtn = document.createElement("i");
            copyBtn.className = "fas fa-copy icon";
            copyBtn.title = "Copy hidden value";

            copyBtn.addEventListener("click", () => this._copyHeaderValue(hName, copyBtn));

            actions.appendChild(copyBtn);
            row.appendChild(name);
            row.appendChild(actions);
            this.els.container.appendChild(row);
        });
    }

    async _renderTraces() {
        const resp = await this.api.getAllResponseTraces();

        if (!resp || !resp.ok) {
            this.els.traceContainer.innerHTML = "<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><p>Error reading trace data.</p></div>";
            return;
        }

        const data = resp.data;
        if (!data || data.length === 0) {
            this.els.traceContainer.innerHTML = "<div class='empty-state'><i class='fas fa-route'></i><p>No traces captured yet.<br>Trigger a request from the active tab.</p></div>";
            return;
        }

        const header = document.createElement("div");
        header.className = "section-heading";
        header.textContent = `Captured traces (${data.length})`;
        this.els.traceContainer.appendChild(header);

        data.forEach(trace => {
            const row = document.createElement("div");
            row.className = "trace-row";

            const left = document.createElement("div");
            left.className = "trace-left";

            const req = document.createElement("div");
            req.className = "req-title";

            if (trace.operationName) {
                req.textContent = trace.operationName;
            } else if (trace.requestId) {
                req.textContent = `Req: ${trace.requestId}`;
            } else {
                req.textContent = "Req: —";
            }
            req.title = trace.updatedAt ? new Date(trace.updatedAt).toLocaleString() : "";
            req.title = `${req.title} - ${req.textContent}`;

            const small = document.createElement("div");
            small.className = "trace-small";
            small.textContent = trace.traceId ? `Trace ID: ${trace.traceId.substring(0, 40)}${trace.traceId.length > 40 ? "…" : ""}` : "Trace ID: —";
            small.title = trace.traceId || "";

            left.appendChild(req);
            left.appendChild(small);

            const actions = document.createElement("div");
            actions.className = "trace-actions";

            const copyBtn = document.createElement("i");
            copyBtn.className = "fas fa-copy icon";
            copyBtn.title = "Copy traceId";

            copyBtn.addEventListener("click", () => this._copyTraceId(trace.traceId, copyBtn));

            actions.appendChild(copyBtn);
            row.appendChild(left);
            row.appendChild(actions);
            this.els.traceContainer.appendChild(row);
        });
    }

    async _copyHeaderValue(headerName, iconEl) {
        iconEl.classList.add("fa-spin");
        const resp = await this.api.getRequestHeaderValue(headerName);
        iconEl.classList.remove("fa-spin");

        if (!resp || !resp.ok) {
            this._showToast("Header value not found.", true);
            return;
        }

        const value = this._stripBearerPrefix(resp.value);
        await navigator.clipboard.writeText(value);

        iconEl.classList.remove("fa-copy");
        iconEl.classList.add("fa-check");
        setTimeout(() => {
            iconEl.classList.remove("fa-check");
            iconEl.classList.add("fa-copy");
        }, 1200);
    }

    async _copyTraceId(traceId, iconEl) {
        try {
            iconEl.classList.add("fa-spin");
            const value = traceId || "";
            if (!value) {
                this._showToast("Trace ID not available.", true);
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
            this._showToast("Failed to copy trace id.", true);
            console.error("copy trace error:", err);
        }
    }

    _stripBearerPrefix(value) {
        if (!this.els.bearerToggle.checked && value.toLowerCase().startsWith("bearer ")) {
            return value.substring(7);
        }
        return value;
    }

    _showToast(msg, isError) {
        this.els.toast.textContent = msg;
        this.els.toast.classList.toggle("toast-error", !!isError);
        this.els.toast.classList.add("show");
        setTimeout(() => this.els.toast.classList.remove("show"), 2000);
    }
}
