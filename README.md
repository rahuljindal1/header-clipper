# Header Clipper

A Chrome extension (Manifest V3) for securely capturing and copying HTTP headers and trace IDs from ScriptSense API requests.

Only header **names** are displayed in the popup — values are never shown. Click the copy icon to copy a header's hidden value to your clipboard.

## Features

- **Authorization header capture** — Intercepts outgoing requests to `api.*.scriptsense.co.nz` and stores the `Authorization` header for the active tab.
- **Trace ID capture** — Captures `X-Traceid` response headers along with GraphQL operation names for easy debugging.
- **One-click copy** — Copy header values or trace IDs to clipboard without exposing them in the UI.
- **Bearer prefix toggle** — Option to include or strip the `Bearer ` prefix when copying auth tokens.
- **Active tab scoping** — Only captures data from the currently focused tab; cleans up storage when a tab is closed.

## Architecture

```
popup.html
  └─ popup.js                  ← entry point (creates ChromeApi, wires PopupController)
       └─ ui/PopupController   ← renders headers & traces, handles copy/clear/refresh

background.js                  ← service worker entry (creates ChromeApi, wires workers)
  ├─ workers/HeaderCapture     ← listens to webRequest events, saves to chrome.storage
  └─ services/TraceService     ← handles runtime messages from popup, reads chrome.storage

services/ChromeApi             ← thin wrapper over chrome.* APIs (storage, tabs, webRequest, runtime)
constants.js                   ← shared message types, storage keys, preference keys
```

**Data flow:**

1. Browser makes a request to `*.scriptsense.co.nz`
2. `HeaderCapture` (background) intercepts the request/response via `chrome.webRequest` and writes auth headers, trace IDs, and operation names to `chrome.storage.local`
3. User opens the popup
4. `PopupController` sends messages (via `ChromeApi.sendMessage`) to the background service worker
5. `TraceService` (background) receives the message, reads from `chrome.storage.local`, and responds
6. `PopupController` renders the data in the popup DOM

## Project Structure

```
services/    # Chrome API wrapper and background message handlers
workers/     # WebRequest listeners and storage writers
ui/          # Popup DOM rendering and user interaction
```

## Setup

```bash
npm install
```

## Build

```bash
# Production build → outputs to dist/
npm run build

# Development build with watch mode
npm run dev
```

## Load in Chrome

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder

## Local Preview (without Chrome)

Open `popup.html` directly in a browser. The `mock.js` script detects the absence of `chrome.runtime.sendMessage` and provides mock data so the UI can be previewed standalone.

## Permissions

| Permission       | Reason                                                 |
|------------------|--------------------------------------------------------|
| `webRequest`     | Intercept request/response headers                     |
| `tabs`           | Track the active tab                                   |
| `storage`        | Persist captured headers and preferences               |
| `clipboardWrite` | Copy values to clipboard                               |
| `activeTab`      | Access the currently focused tab                       |
| `host_permissions: *://*/*` | Monitor requests across all origins        |
