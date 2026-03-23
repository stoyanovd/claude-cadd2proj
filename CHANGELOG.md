# Changelog

All notable changes to **Claude — Add to Project** are documented here.

## [2.6.1] — 2025-06-XX

SPA lifecycle hardening.

### Fixed
- `navigating` guard in `scan()` — prevents race condition with pre-navigation `scanPending` timeout
- `_spaScanTimer` is now cleared on re-navigation — no orphan scans when quickly switching `/chat/A → /chat/B → /chat/C`

## [2.6.0] — 2025-06-XX

Full SPA navigation support. The script now survives all in-app navigation without page reload.

### Added
- `@match claude.ai/*` — script loads once and handles all SPA transitions
- `isChatPage()` path guard — script sleeps on non-chat pages (zero DOM queries)
- `cleanup()` — removes all injected buttons and markers when leaving a chat page
- Single `MutationObserver` for both SPA navigation detection and content change scanning
- `navigating` flag — suppresses premature scans during SPA transition (~850ms window)

### Changed
- Removed `@icon` — claude.ai blocks direct favicon requests (403)
- `busy` flag is no longer reset in `cleanup()` — prevents parallel `addOne()` calls during navigation

## [2.5.1] — 2025-06-XX

Preparation for Greasy Fork publication.

### Added
- Privacy & Security block with 10 verifiable claims
- Verification Guide — 14 Ctrl+F checks for security audit
- SCOPE declaration — documents exactly which DOM elements the script touches
- Architecture header with 14 sections for code navigation
- `console.log` on load: `[atp] Add to Project v2.5.1 loaded`
- `@compatible safari` in header

### Changed
- Header: `@namespace` → GitHub, `@description` expanded + `:ru`, `@author`, `@license MIT`, `@homepageURL`, `@supportURL`, `@source`
- All comments translated to English (~50 inline + 14 section headers)
- CSS: `border` → `box-shadow: inset 0 0 0 1px` (Tailwind preflight protection)

## [2.5] — 2025-05-XX

Trial-and-click menu opening + file verification.

### Added
- `openMenuAndFindAddItem` with fast path (`aria-haspopup`) + slow path (5 candidate strategies)
- `collectDropdownCandidates` — tag-agnostic chevron search (button, div, span, SVG)
- `panelShowsFile` — verifies the artifact panel shows the correct file before proceeding
- `findFileNameElement` — scored element selection for click targeting
- `closeArtifactPanel` — 3 strategies: aria-label → last SVG button → Escape key
- Retry with increasing delays for heavy files (2s, 3s between attempts)
- `isInArtifactPanel` — prevents injection into the artifact preview panel
- `isVisible` check for menu items

### Changed
- Menu search: Radix roles + text fallback (two strategies)
- Card finder (`cardOf`) uses bounding rect heuristics instead of fixed depth
- Toast detection: broad selector covering Sonner, Toastify, and generic patterns

## [2.0] — 2025-05-XX

Batch mode: "Add all to project".

### Added
- `📁 Add all to project` button next to "Download all"
- Batch progress: `⏳ Adding 2 of 5…`
- Partial success state: `⚠ 3 added, 1 failed`
- Click on status → reset for retry

## [1.0] — 2025-04-XX

Initial release.

### Added
- `📁 Add to project` button on individual file artifact cards
- Radix-compatible click emulation (`realClick`)
- Toast-based success detection
