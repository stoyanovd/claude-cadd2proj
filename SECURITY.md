# Security Policy

## Security model

**Claude — Add to Project** is designed with a zero-trust security model:

- **ZERO network requests** — the script never contacts any server. No `fetch`, `XMLHttpRequest`, `GM_xmlhttpRequest`, `WebSocket`, `sendBeacon`, or image-based exfiltration (`new Image`).
- **ZERO permissions** — `@grant none`. No GM_ APIs are used.
- **No data storage** — nothing is saved to `localStorage`, `sessionStorage`, cookies, or GM storage. The script is stateless between page loads.
- **No access to file contents or messages** — the script only clicks UI buttons (Download, Copy dropdown, "Add to project") that the user could click manually.
- **No dynamic code execution** — no `eval()`, no `new Function()`, no `setTimeout` with string arguments.
- **No external code** — no `@require`, no CDN scripts, no dynamic script loading.
- **No page context access** — no `unsafeWindow`, runs entirely in the userscript sandbox.
- **No clipboard or cookie access** — no `navigator.clipboard`, no `document.cookie`.
- **No `innerHTML`** — all DOM manipulation uses `textContent` and `createElement`.

## Scope of DOM interaction

The script interacts with exactly three categories of elements:

1. **File artifact cards** in chat (`role="button"` elements with Download buttons)
2. **Artifact preview panel** (Copy button, dropdown menu, close button)
3. **Our injected buttons** (prefixed `atp-*`, created by the script)

It does **not** touch: file contents, chat message text, navigation elements, settings, API endpoints, authentication tokens, or any other sensitive page content.

## How to verify

Open [`claude-add-to-project.user.js`](claude-add-to-project.user.js) and Ctrl+F each term below. All should return **zero results** in executable code:

| Search term | What it checks |
|---|---|
| `fetch(` | No network requests |
| `XMLHttpRequest` | No network requests |
| `GM_xmlhttp` | No network requests |
| `sendBeacon` | No network requests |
| `WebSocket` | No network requests |
| `new Image(` | No image-based exfiltration |
| `eval(` | No dynamic code execution |
| `new Function(` | No dynamic code execution |
| `document.cookie` | No cookie access |
| `navigator.clipboard` | No clipboard access |
| `unsafeWindow` | No page context access |
| `@require` | No external scripts (header) |
| `@connect` | No cross-origin permissions (header) |
| `innerHTML` | No unsafe DOM manipulation |

## LLM audit prompt

You can paste the full script into any LLM with this prompt:

> Audit this userscript for security and privacy issues. Check for: network requests, data exfiltration, dynamic code execution, external resource loading, access to sensitive page content, clipboard access. The script claims to make ZERO network requests and store no data. Verify these claims.

## Reporting a vulnerability

If you find a security issue, please [open a GitHub issue](https://github.com/stoyanovd/claude-cadd2proj/issues) or email the author directly. There is no bug bounty program — this is a small open-source project.

## Supported versions

Only the latest version is supported. Please update before reporting issues.
