document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("container");
    const responseTraceContainer = document.getElementById("responseTraceContainer")
    const clearBtn = document.getElementById("clearBtn");
    const refreshBtn = document.getElementById("refreshBtn");

    async function render() {
        container.innerHTML = "<div class='small'>Loading…</div>";

        await renderRequestHeader()
        await renderResponseTraces()
    }

    async function renderRequestHeader() {

        chrome.runtime.sendMessage({ type: "GET_ALL_REQUEST_HEADERS" }, (resp) => {
            if (!resp || !resp.ok) {
                container.innerHTML = "<div class='small'>Error reading data.</div>";
                return;
            }
            const data = resp.data;
            if (!data) {
                container.innerHTML = "<div class='small'>No Authorization header captured for the current tab. Trigger a request from the tab.</div>";
                return;
            }

            container.innerHTML = "";

            const urlDiv = document.createElement("div");
            urlDiv.className = "section-heading";
            urlDiv.style.marginTop = "16px";
            urlDiv.title = data.url;
            urlDiv.textContent = data.url || `Tab ${data.tabId}`;
            container.appendChild(urlDiv);

            const meta = document.createElement("div");
            meta.className = "small";
            const t = new Date(data.updatedAt);
            meta.textContent = `Captured: ${t.toLocaleString()}`;
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
                    chrome.runtime.sendMessage({ type: "GET_REQUEST_HEADER_VALUE", headerName: hName }, async (resp2) => {
                        copyBtn.classList.remove("fa-spin");
                        if (!resp2 || !resp2.ok) {
                            alert("Header value not found.");
                            return;
                        }
                        const value = resp2.value;
                        await navigator.clipboard.writeText(value);

                        copyBtn.classList.remove("fa-copy");
                        copyBtn.classList.add("fa-check");
                        setTimeout(() => {
                            copyBtn.classList.remove("fa-check");
                            copyBtn.classList.add("fa-copy");
                        }, 1200);
                    });
                });

                actions.appendChild(copyBtn);
                row.appendChild(name);
                row.appendChild(actions);
                container.appendChild(row);
            });
        });
    }

    async function renderResponseTraces() {
        chrome.runtime.sendMessage({ type: "GET_ALL_RESPONSE_TRACES" }, (resp) => {
            if (!resp || !resp.ok) {
                responseTraceContainer.innerHTML = "<div class='small'>Error reading data.</div>";
                return;
            }
            const data = resp.data;
            if (!data) {
                responseTraceContainer.innerHTML = "<div class='small'>No Authorization header captured for the current tab. Trigger a request from the tab.</div>";
                return;
            }

            const header = document.createElement("div");
            header.className = "section-heading";
            header.textContent = `Captured traces (${data.length})`;
            responseTraceContainer.appendChild(header);

            data.forEach(trace => {
                // trace is expected to be { requestId, traceId, ... }
                const row = document.createElement("div");
                row.className = "trace-row";

                const left = document.createElement("div");
                left.className = "trace-left";

                const req = document.createElement("div");
                req.className = "req-title";

                if (trace.operationName) {
                    req.textContent = trace.operationName

                } else if (trace.requestId) {
                    req.textContent = `Req: ${trace.requestId}`
                } else {
                    req.textContent = "Req: —"
                }
                req.title = trace.updatedAt ? new Date(trace.updatedAt).toLocaleString() : "";
                req.title = `${req.title} - ${req.textContent}`

                const small = document.createElement("div");
                small.className = "trace-small";
                small.textContent = trace.traceId ? `Trace ID: ${trace.traceId.substring(0, 40)}${trace.traceId && trace.traceId.length > 40 ? "…" : ""}` : "Trace ID: —";
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
                        // data already contains traceId — copy directly
                        const value = trace.traceId || "";
                        if (!value) {
                            alert("Trace ID not available.");
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
                        alert("Failed to copy trace id.");
                        console.error("copy trace error:", err);
                    }
                });

                actions.appendChild(copyBtn);
                row.appendChild(left);
                row.appendChild(actions);
                responseTraceContainer.appendChild(row);
            })
        })
    }

    clearBtn.addEventListener("click", () => {
        container.innerHTML = ''
        responseTraceContainer.innerHTML = ''
        chrome.runtime.sendMessage({ type: "CLEAR" }, (resp) => {
            if (resp && resp.ok) {
                render();
            }
        });
    });

    refreshBtn.addEventListener("click", () => {
        container.innerHTML = ''
        responseTraceContainer.innerHTML = ''
        render()
    });

    // initial render
    render();
});
