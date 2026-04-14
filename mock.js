// Mock Chrome extension APIs for local development preview.
// Only activates when chrome.runtime.sendMessage is unavailable
// (i.e. popup.html opened directly in a browser, not as an extension).
if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
    var mockData = {
        GET_ALL_REQUEST_HEADERS: {
            ok: true,
            data: {
                tabId: "123",
                url: "https://api.staging.scriptsense.co.nz/graphql",
                headerNames: ["Authorization"],
                updatedAt: Date.now(),
            },
        },
        GET_REQUEST_HEADER_VALUE: {
            ok: true,
            value: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock-token-value",
        },
        GET_ALL_RESPONSE_TRACES: {
            ok: true,
            data: [
                {
                    traceId: "abc123def456ghi789jkl012mno345pqr678stu901vwx",
                    requestId: "1001",
                    updatedAt: Date.now(),
                    operationName: "GetPatientDetails",
                    count: 5,
                },
                {
                    traceId: "fed987cba654zyx321wvu098tsr765qpo432nml109kji",
                    requestId: "1002",
                    updatedAt: Date.now() - 30000,
                    operationName: "ListPrescriptions",
                    count: 1,
                },
                { traceId: "1a2b3c4d5e6f7g8h9i0j", requestId: "1003", updatedAt: Date.now() - 60000, count: 12 },
                { traceId: "old9876trace5432value10", requestId: "1004", updatedAt: Date.now() - 600000, operationName: "OldQuery", count: 3 },
            ],
        },
        CLEAR: { ok: true },
    };

    var mockStorage = { session_start: Date.now() };
    window.chrome = {
        runtime: {
            sendMessage: function (msg, cb) {
                setTimeout(function () {
                    var resp = mockData[msg.type] || { ok: false };

                    if (msg.type === "CLEAR") {
                        mockData.GET_ALL_REQUEST_HEADERS = { ok: true, data: null };
                        mockData.GET_ALL_RESPONSE_TRACES = { ok: true, data: [] };
                        resp = { ok: true };
                    }

                    if (msg.type === "UPDATE_BADGE") {
                        var badgeData = mockData.GET_ALL_RESPONSE_TRACES.data;
                        if (badgeData) {
                            var filtered = badgeData.slice();
                            filtered.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
                            var bTtl = Number(mockStorage["tracesTtlMinutes"]) || 0;
                            if (bTtl > 0) {
                                var bCutoff = Date.now() - bTtl * 60 * 1000;
                                filtered = filtered.filter(function (t) { return t.updatedAt >= bCutoff; });
                            }
                            var bMax = Number(mockStorage["tracesMaxCount"]) || 0;
                            if (bMax > 0) filtered = filtered.slice(0, bMax);
                            var bMin = Number(mockStorage["tracesMinHits"]) || 0;
                            if (bMin > 0) filtered = filtered.filter(function (t) { return t.count >= bMin; });
                            var mode = mockStorage["badgeMode"] || "total";
                            var count = 0;
                            if (filtered.length > 0) {
                                if (mode === "max_hits") {
                                    count = Math.max.apply(null, filtered.map(function (t) { return t.count; }));
                                } else {
                                    count = filtered.length;
                                }
                            }
                            chrome.action.setBadgeText({ text: count > 0 ? (count > 999 ? "999+" : String(count)) : "" });
                        } else {
                            chrome.action.setBadgeText({ text: "" });
                        }
                        resp = { ok: true };
                    }

                    if (msg.type === "GET_ALL_RESPONSE_TRACES" && resp.data) {
                        var data = resp.data.slice();
                        data.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
                        var ttl = Number(mockStorage["tracesTtlMinutes"]) || 0;
                        if (ttl > 0) {
                            var cutoff = Date.now() - ttl * 60 * 1000;
                            data = data.filter(function (t) { return t.updatedAt >= cutoff; });
                        }
                        var max = Number(mockStorage["tracesMaxCount"]) || 0;
                        if (max > 0) {
                            data = data.slice(0, max);
                        }
                        var minHits = Number(mockStorage["tracesMinHits"]) || 0;
                        if (minHits > 0) {
                            data = data.filter(function (t) { return t.count >= minHits; });
                        }
                        resp = { ok: true, data: data };
                        var traceMode = mockStorage["badgeMode"] || "total";
                        var badgeCount = 0;
                        if (data.length > 0) {
                            if (traceMode === "max_hits") {
                                badgeCount = Math.max.apply(null, data.map(function (t) { return t.count; }));
                            } else {
                                badgeCount = data.length;
                            }
                        }
                        chrome.action.setBadgeText({ text: badgeCount > 0 ? (badgeCount > 999 ? "999+" : String(badgeCount)) : "" });
                    }

                    cb(resp);
                }, 150);
            },
        },
        action: {
            setBadgeText: function (opts) {
                var el = document.getElementById("mockBadge");
                if (!el) {
                    el = document.createElement("span");
                    el.id = "mockBadge";
                    el.style.cssText =
                        "display:inline-flex;align-items:center;justify-content:center;" +
                        "min-width:20px;height:20px;padding:0 6px;border-radius:10px;" +
                        "background:#0d9488;color:#fff;font-size:11px;font-weight:700;" +
                        "margin-left:8px;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;";
                    var title = document.querySelector(".title");
                    if (title) title.appendChild(el);
                }
                if (opts.text) {
                    el.textContent = opts.text;
                    el.style.display = "inline-flex";
                } else {
                    el.textContent = "";
                    el.style.display = "none";
                }
            },
            setBadgeBackgroundColor: function () {},
            setBadgeTextColor: function () {},
        },
        storage: {
            local: {
                get: function (keys, cb) {
                    var result = {};
                    keys.forEach(function (k) {
                        if (mockStorage[k] !== undefined) result[k] = mockStorage[k];
                    });
                    if (cb) cb(result);
                },
                set: function (obj, cb) {
                    Object.keys(obj).forEach(function (k) {
                        mockStorage[k] = obj[k];
                    });
                    if (cb) cb();
                },
            },
        },
    };
}
