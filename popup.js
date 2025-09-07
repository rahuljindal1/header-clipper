document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("container");
    const clearBtn = document.getElementById("clearBtn");
    const refreshBtn = document.getElementById("refreshBtn");

    async function render() {
        container.innerHTML = "<div class='small'>Loading…</div>";
        chrome.runtime.sendMessage({ type: "GET_CURRENT" }, (resp) => {
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
            urlDiv.className = "tab-url";
            urlDiv.title = data.url;
            urlDiv.textContent = data.url || `Tab ${data.tabId}`;
            container.appendChild(urlDiv);

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
                    chrome.runtime.sendMessage({ type: "GET_VALUE", headerName: hName }, async (resp2) => {
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

            const meta = document.createElement("div");
            meta.className = "small";
            meta.style.marginTop = "8px";
            const t = new Date(data.updatedAt);
            meta.textContent = `Captured: ${t.toLocaleString()}`;
            container.appendChild(meta);
        });
    }

    clearBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "CLEAR" }, (resp) => {
            if (resp && resp.ok) {
                render();
            }
        });
    });

    refreshBtn.addEventListener("click", () => render());

    // initial render
    render();
});
