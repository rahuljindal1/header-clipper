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

                    if (msg.type === "GET_ALL_RESPONSE_TRACES" && resp.data) {
                        var data = resp.data.slice();
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
                    }

                    cb(resp);
                }, 150);
            },
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
