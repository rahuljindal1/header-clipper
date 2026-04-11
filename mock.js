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
            value: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock-token-value",
        },
        GET_ALL_RESPONSE_TRACES: {
            ok: true,
            data: [
                { traceId: "abc123def456ghi789jkl012mno345pqr678stu901vwx", requestId: "1001", updatedAt: Date.now(), operationName: "GetPatientDetails" },
                { traceId: "fed987cba654zyx321wvu098tsr765qpo432nml109kji", requestId: "1002", updatedAt: Date.now() - 30000, operationName: "ListPrescriptions" },
                { traceId: "1a2b3c4d5e6f7g8h9i0j", requestId: "1003", updatedAt: Date.now() - 60000 },
            ],
        },
        CLEAR: { ok: true },
    };

    window.chrome = {
        runtime: {
            sendMessage: function (msg, cb) {
                setTimeout(function () { cb(mockData[msg.type] || { ok: false }); }, 150);
            },
        },
    };
}
