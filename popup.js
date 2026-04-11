import * as api from "./chromeApi.js";
import { PREF_INCLUDE_BEARER } from "./constants.js";

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("container");
    const responseTraceContainer = document.getElementById("responseTraceContainer");
    const clearBtn = document.getElementById("clearBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const toast = document.getElementById("toast");
    const bearerToggle = document.getElementById("bearerToggle");

    // Restore saved preference
    const savedPref = await api.getPreference(PREF_INCLUDE_BEARER);
    if (savedPref) bearerToggle.checked = true;

    bearerToggle.addEventListener("change", () => {
        api.setPreference(PREF_INCLUDE_BEARER, bearerToggle.checked);
    });

    function stripBearerPrefix(value) {
        if (!bearerToggle.checked && value.toLowerCase().startsWith("bearer ")) {
            return value.substring(7);
        }
        return value;
    }

    function showToast(msg, isError) {
        toast.textContent = msg;
        toast.classList.toggle("toast-error", !!isError);
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
    }

    async function render() {
        container.innerHTML = "<div class='small'><i class='fas fa-spinner fa-spin'></i> Loading…</div>";
        responseTraceContainer.innerHTML = "";

        await renderRequestHeader();
        await renderResponseTraces();
    }

    async function renderRequestHeader() {
        const resp = await api.getAllRequestHeaders();

        if (!resp || !resp.ok) {
            container.innerHTML = "<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><p>Error reading header data.</p></div>";
            return;
        }

        const data = resp.data;
        if (!data) {
            container.innerHTML = "<div class='empty-state'><i class='fas fa-satellite-dish'></i><p>No headers captured yet.<br>Trigger a request from the active tab.</p></div>";
            return;
        }

        container.innerHTML = "";

        const heading = document.createElement("div");
        heading.className = "section-heading";
        heading.textContent = "Request Headers";
        container.appendChild(heading);

        const urlDiv = document.createElement("div");
        urlDiv.className = "url-display";
        urlDiv.title = data.url;
        urlDiv.textContent = data.url || `Tab ${data.tabId}`;
        container.appendChild(urlDiv);

        const meta = document.createElement("div");
        meta.className = "meta";
        const t = new Date(data.updatedAt);
        meta.textContent = `Captured ${t.toLocaleString()}`;
        container.appendChild(meta);

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

            copyBtn.addEventListener("click", async () => {
                copyBtn.classList.add("fa-spin");
                const resp2 = await api.getRequestHeaderValue(hName);
                copyBtn.classList.remove("fa-spin");

                if (!resp2 || !resp2.ok) {
                    showToast("Header value not found.", true);
                    return;
                }

                const value = stripBearerPrefix(resp2.value);
                await navigator.clipboard.writeText(value);

                copyBtn.classList.remove("fa-copy");
                copyBtn.classList.add("fa-check");
                setTimeout(() => {
                    copyBtn.classList.remove("fa-check");
                    copyBtn.classList.add("fa-copy");
                }, 1200);
            });

            actions.appendChild(copyBtn);
            row.appendChild(name);
            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    async function renderResponseTraces() {
        const resp = await api.getAllResponseTraces();

        if (!resp || !resp.ok) {
            responseTraceContainer.innerHTML = "<div class='empty-state'><i class='fas fa-exclamation-triangle'></i><p>Error reading trace data.</p></div>";
            return;
        }

        const data = resp.data;
        if (!data || data.length === 0) {
            responseTraceContainer.innerHTML = "<div class='empty-state'><i class='fas fa-route'></i><p>No traces captured yet.<br>Trigger a request from the active tab.</p></div>";
            return;
        }

        const header = document.createElement("div");
        header.className = "section-heading";
        header.textContent = `Captured traces (${data.length})`;
        responseTraceContainer.appendChild(header);

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

            copyBtn.addEventListener("click", async () => {
                try {
                    copyBtn.classList.add("fa-spin");
                    const value = trace.traceId || "";
                    if (!value) {
                        showToast("Trace ID not available.", true);
                        return;
                    }
                    await navigator.clipboard.writeText(value);

                    copyBtn.classList.remove("fa-spin");
                    copyBtn.classList.remove("fa-copy");
                    copyBtn.classList.add("fa-check");

                    setTimeout(() => {
                        copyBtn.classList.remove("fa-check");
                        copyBtn.classList.add("fa-copy");
                    }, 1200);
                } catch (err) {
                    copyBtn.classList.remove("fa-spin");
                    showToast("Failed to copy trace id.", true);
                    console.error("copy trace error:", err);
                }
            });

            actions.appendChild(copyBtn);
            row.appendChild(left);
            row.appendChild(actions);
            responseTraceContainer.appendChild(row);
        });
    }

    clearBtn.addEventListener("click", async () => {
        const resp = await api.clearData();
        if (resp && resp.ok) {
            render();
        }
    });

    refreshBtn.addEventListener("click", () => {
        render();
    });

    // initial render
    render();
});
