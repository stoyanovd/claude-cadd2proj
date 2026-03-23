// ==UserScript==
// @name         Claude — Add to Project
// @namespace    https://github.com/stoyanovd/claude-cadd2proj
// @version      2.6.1
// @description  Adds "Add to project" and "Add all to project" buttons for file artifacts in Claude chat. One-click file transfer from conversation to project knowledge.
// @description:ru  Кнопки «Add to project» для файлов-артефактов в чате Claude. Быстрый перенос файлов из переписки в проект.
// @author       Dmitry S
// @license      MIT
// @homepageURL  https://github.com/stoyanovd/claude-cadd2proj
// @supportURL   https://github.com/stoyanovd/claude-cadd2proj/issues
// @source       https://github.com/stoyanovd/claude-cadd2proj/tree/v2.6.1
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// @compatible   chrome
// @compatible   firefox Tested with Violentmonkey
// @compatible   edge
// @compatible   opera
// @compatible   safari
// ==/UserScript==
//
// ┌─────────────────────────────────────────────────────────────┐
// │  PRIVACY & SECURITY                                        │
// │                                                             │
// │  • ZERO network requests — no fetch, no XHR, no WebSocket. │
// │  • ZERO permissions — @grant none, no GM_ APIs.            │
// │  • No external scripts — fully self-contained.              │
// │  • No code execution from strings — no eval, no new        │
// │    Function, no setTimeout with strings.                    │
// │  • No data storage — nothing saved between sessions.        │
// │  • No access to file contents or messages — only clicks     │
// │    UI buttons that the user could click manually.           │
// │  • No clipboard, cookie, or sessionStorage access.          │
// │  • No unsafeWindow — runs entirely in userscript sandbox.  │
// │  • No innerHTML — safe DOM manipulation only.               │
// │  • Open source — MIT license, full code on GitHub.         │
// │                                                             │
// │  VERIFY: Search this file for any of the above terms.      │
// │  Each claim is designed to be verifiable in seconds.        │
// │  See VERIFICATION GUIDE below.                              │
// └─────────────────────────────────────────────────────────────┘
//
// VERIFICATION GUIDE — Ctrl+F each term, expect zero results:
//
//   fetch(               — no network requests
//   XMLHttpRequest       — no network requests
//   GM_xmlhttp           — no network requests
//   sendBeacon           — no network requests
//   WebSocket            — no network requests
//   new Image(           — no image-based exfiltration
//   eval(                — no dynamic code execution
//   new Function(        — no dynamic code execution
//   document.cookie      — no cookie access
//   navigator.clipboard  — no clipboard access
//   unsafeWindow         — no page context access
//   @require             — no external scripts (check header)
//   @connect             — no cross-origin permissions (check header)
//   innerHTML            — zero (we use textContent + createElement)
//
// SCOPE: This script interacts ONLY with:
//   1. File artifact cards in chat (role="button" elements)
//   2. Artifact preview panel (Copy button, dropdown menu)
//   3. Our injected buttons (prefixed atp-*)
// It does NOT touch: file contents, chat messages, navigation,
// settings, API endpoints, or authentication elements.
// It only clicks UI buttons that you could click manually.
//

(function () {
  'use strict';

  console.log('[atp] Add to Project v2.6.1 loaded');

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  ARCHITECTURE — Add to Project v2.6.1                                    ║
  // ║                                                                          ║
  // ║  CSS ........................ Injected styles for atp-* buttons          ║
  // ║  UTILITIES .................. sleep, waitFor, isInArtifactPanel          ║
  // ║  REAL CLICK ................. Pointer event emulation for Radix UI       ║
  // ║  FILE NAME .................. getCardFileName, cleanText                 ║
  // ║  CARD FINDER ................ cardOf, blockOf (Download → card)          ║
  // ║  TOASTS ..................... snapshotToasts, detectNewToast             ║
  // ║  CLOSE PANEL ................ closeArtifactPanel (3 strategies)          ║
  // ║  COPY BUTTON ................ findPanelCopyBtn (right-panel search)      ║
  // ║  FILE VERIFICATION .......... panelShowsFile (panel ↔ card match)        ║
  // ║  MENU SEARCH ................ findAddToProjectItem (Radix roles)         ║
  // ║  MENU OPEN .................. openMenuAndFindAddItem (trial-and-click)   ║
  // ║  CORE: ADD ONE .............. addOne (full card → toast pipeline)        ║
  // ║  BUTTON INJECTION ........... scan (MutationObserver callback)           ║
  // ║  SPA LIFECYCLE .............. cleanup, path observer, initial scan      ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  //
  // LIFECYCLE (v2.6.1)
  //   @match covers all claude.ai/* — script is always loaded in SPA.
  //   document-idle → initial scan (1500ms delay, only if on /chat/ page).
  //   SPA navigation → cleanup old buttons → delayed scan (800ms).
  //   Single MutationObserver handles both path changes and content updates.
  //   `navigating` flag suppresses content scans during SPA transition.
  //   On non-chat pages the script sleeps — no scans, no DOM queries.

  const INJECTED   = 'data-atp-done';
  const BTN_CLS    = 'atp-btn';
  const ALLBTN_CLS = 'atp-all-btn';

  let busy = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // CSS
  // ═══════════════════════════════════════════════════════════════════════════

  const CSS = `
    .${BTN_CLS}, .${ALLBTN_CLS} {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border-radius: 8px;
      border: none; box-shadow: inset 0 0 0 1px rgba(50,160,80,0.35);
      background: rgba(50,160,80,0.06); color: rgba(30,130,55,0.85);
      font-size: 13px; font-weight: 500; font-family: inherit;
      cursor: pointer; transition: background 0.12s, box-shadow 0.12s, color 0.12s;
      white-space: nowrap; user-select: none; line-height: 1.4;
      vertical-align: middle;
    }
    .${ALLBTN_CLS} { margin-left: 6px; }
    .${BTN_CLS}:hover, .${ALLBTN_CLS}:hover {
      background: rgba(50,160,80,0.13); box-shadow: inset 0 0 0 1px rgba(50,160,80,0.55); color: rgba(20,115,45,1);
    }
    .${BTN_CLS}:disabled, .${ALLBTN_CLS}:disabled { opacity: 0.55; cursor: wait; }
    .${BTN_CLS}.atp-ok, .${ALLBTN_CLS}.atp-ok {
      box-shadow: inset 0 0 0 1px rgba(50,160,80,0.5); background: rgba(50,160,80,0.1);
      color: rgba(20,120,50,0.9); cursor: pointer;
    }
    .${BTN_CLS}.atp-ok:hover, .${ALLBTN_CLS}.atp-ok:hover {
      background: rgba(50,160,80,0.18);
    }
    .${BTN_CLS}.atp-err, .${ALLBTN_CLS}.atp-err {
      box-shadow: inset 0 0 0 1px rgba(210,80,80,0.45); background: rgba(210,80,80,0.07); color: rgba(175,45,45,0.9);
      cursor: pointer;
    }
    .${ALLBTN_CLS}.atp-partial {
      box-shadow: inset 0 0 0 1px rgba(200,160,40,0.5); background: rgba(200,160,40,0.08); color: rgba(160,120,10,0.9);
      cursor: pointer;
    }
  `;

  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function waitFor(fn, timeout = 5000, tick = 150) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function poll() {
        const v = fn();
        if (v) return resolve(v);
        if (Date.now() - t0 > timeout) return reject(new Error('timeout'));
        setTimeout(poll, tick);
      })();
    });
  }

  function btnsByText(text, root = document) {
    return [...root.querySelectorAll('button')].filter(b => b.textContent.trim() === text);
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL CLICK EMULATION
  //
  // Radix UI (used by Claude) listens to pointerdown/pointerup,
  // not click. Programmatic el.click() only fires a click event,
  // so dropdowns don't open.
  // Emulate the full chain: pointerdown → mousedown → pointerup →
  // mouseup → click — mimicking a real mouse press.
  // ═══════════════════════════════════════════════════════════════════════════

  function realClick(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };

    el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse' }));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  // Are we on a /chat/ page?
  function isChatPage() {
    return location.pathname.startsWith('/chat/');
  }

  // Is this a project chat? (breadcrumb link to /project/ exists)
  function isProjectChat() {
    return !!document.querySelector('a[href*="/project/"]');
  }

  function isInArtifactPanel(el) {
    if (el.closest('[data-testid*="artifact"], [data-testid*="preview"]'))
      return true;
    // Check ancestors for artifact PANEL classes, but NOT file card classes.
    // File cards in chat have class "artifact-block-cell" — that's NOT the panel.
    // Panel: "artifact-panel", "artifact-viewer", "preview-panel", etc.
    let node = el;
    for (let i = 0; i < 15; i++) {
      node = node.parentElement;
      if (!node || node === document.body) break;
      if (node.className && typeof node.className === 'string'
          && /artifact[-_]?(panel|viewer|sidebar|preview|container)|preview-panel/i.test(node.className))
        return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE NAME FROM CARD
  // ═══════════════════════════════════════════════════════════════════════════

  // Text normalization: trim + replace &nbsp; (\u00a0) with regular space
  function cleanText(s) { return s.replace(/\u00a0/g, ' ').trim(); }

  const SKIP_TEXT = /^(download|download all|add to project|add all to project|copy|publish artifact|table|csv|py|js|ts|md|pdf|txt|json|html|xml)$/i;

  function getCardFileName(card) {
    for (const el of card.querySelectorAll('div, span, p, a')) {
      if (el.closest('button') || el.closest('.' + BTN_CLS) || el.closest('.' + ALLBTN_CLS))
        continue;
      const text = cleanText(el.textContent);
      if (text.length < 3 || text.length > 120) continue;
      if (SKIP_TEXT.test(text)) continue;
      if (el.children.length === 0) return text;
    }
    for (const el of card.querySelectorAll('div, span, p, a')) {
      if (el.closest('button') || el.closest('.' + BTN_CLS) || el.closest('.' + ALLBTN_CLS))
        continue;
      const text = cleanText(el.textContent);
      if (text.length >= 3 && text.length <= 120 && !SKIP_TEXT.test(text))
        return text;
    }
    return '';
  }

  function findFileNameElement(card) {
    let best = null;
    let bestScore = -1;
    for (const el of card.querySelectorAll('div, span, p, a')) {
      if (el.closest('button') || el.closest('.' + BTN_CLS) || el.closest('.' + ALLBTN_CLS))
        continue;
      const text = cleanText(el.textContent);
      if (text.length < 3 || text.length > 150) continue;
      if (SKIP_TEXT.test(text)) continue;
      const childElements = el.children.length;
      let score = 100 - childElements * 20;
      if (/\.\w{1,5}$/.test(text)) score += 30;
      if (text.length < 60) score += 20;
      if (text.length > 100) score -= 30;
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD FINDER
  // ═══════════════════════════════════════════════════════════════════════════

  function cardOf(dlBtn) {
    let el = dlBtn;
    let bestCandidate = null;
    for (let i = 0; i < 6; i++) {
      el = el.parentElement;
      if (!el) break;
      const nativeChildren = [...el.children].filter(
        c => !c.classList.contains(BTN_CLS) && !c.classList.contains(ALLBTN_CLS)
      ).length;
      if (nativeChildren >= 2) {
        const r = el.getBoundingClientRect();
        if (r.height >= 40 && r.height <= 160 && r.width >= 180) return el;
        if (!bestCandidate && r.height > 20 && r.width > 100) bestCandidate = el;
      }
    }
    return bestCandidate || dlBtn.parentElement?.parentElement || dlBtn.parentElement;
  }

  function blockOf(dlAllBtn) {
    let el = dlAllBtn;
    for (let i = 0; i < 8; i++) {
      el = el.parentElement;
      if (!el) return null;
      if (btnsByText('Download', el).length >= 2) return el;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOASTS
  // ═══════════════════════════════════════════════════════════════════════════

  const TOAST_SEL = [
    '[data-sonner-toast]', '[data-sonner-toaster] li', '[role="status"]',
    '[class*="toast"]', '[class*="Toast"]', '[class*="Toastify"]',
    '[data-state="open"][role="region"]',
  ].join(', ');

  function snapshotToasts() {
    const set = new Set();
    for (const el of document.querySelectorAll(TOAST_SEL)) set.add(el);
    return set;
  }

  function detectNewToast(beforeSet) {
    for (const el of document.querySelectorAll(TOAST_SEL)) {
      if (!beforeSet.has(el) && el.textContent.toLowerCase().includes('added to project'))
        return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOSE PANEL
  // ═══════════════════════════════════════════════════════════════════════════

  async function closeDropdowns() {
    document.body.click();
    await sleep(150);
  }

  async function closeArtifactPanel() {
    // Strategy 1: aria-label (Claude uses "Go back", but could be "Close")
    for (const label of ['Go back', 'go back', 'Close', 'close']) {
      for (const btn of document.querySelectorAll(`button[aria-label="${label}"]`)) {
        if (btn.getBoundingClientRect().left > window.innerWidth * 0.4) {
          realClick(btn); await sleep(400);
          if (!findPanelCopyBtn()) return true;
        }
      }
    }
    // Strategy 2: SVG button without text in the right panel header.
    // Take the LAST match (close/go-back is always last in DOM).
    // Skip buttons with aria-haspopup (dropdown chevron).
    let lastCandidate = null;
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent.trim().length !== 0) continue;
      if (btn.hasAttribute('aria-haspopup')) continue;  // chevron
      if (btn.getBoundingClientRect().left < window.innerWidth * 0.5) continue;
      if (btn.getBoundingClientRect().top > 120) continue;
      if (!btn.querySelector('svg')) continue;
      lastCandidate = btn;
    }
    if (lastCandidate) {
      realClick(lastCandidate); await sleep(400);
      if (!findPanelCopyBtn()) return true;
    }
    // Strategy 3: Escape key as last resort
    document.activeElement?.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true
    }));
    await sleep(400);
    if (!findPanelCopyBtn()) return true;
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COPY BUTTON IN ARTIFACT PANEL
  //
  // Find a button with text containing "Copy" in the right part of the screen.
  // Do NOT require a separate chevron — it may not exist
  // (chevron may be part of the button or a non-button element).
  // ═══════════════════════════════════════════════════════════════════════════

  function findPanelCopyBtn() {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.getBoundingClientRect().left < window.innerWidth * 0.35) continue;
      const t = btn.textContent.trim();
      // Copy button: text is exactly "Copy" or starts with "Copy" (Copy▼)
      if (t === 'Copy' || (t.startsWith('Copy') && t.length <= 6)) return btn;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE VERIFICATION: PANEL SHOWS CORRECT FILE
  // ═══════════════════════════════════════════════════════════════════════════

  function panelShowsFile(copyBtn, fileName) {
    if (!copyBtn || !fileName) return false;
    const nameLower = fileName.toLowerCase();
    let container = copyBtn;
    for (let i = 0; i < 5; i++) {
      container = container.parentElement;
      if (!container) break;
      if (container.textContent.toLowerCase().includes(nameLower)) return true;
    }
    const copyY = copyBtn.getBoundingClientRect().top;
    for (const el of document.querySelectorAll('h1, h2, h3, h4')) {
      const r = el.getBoundingClientRect();
      if (r.left < window.innerWidth * 0.35) continue;
      if (Math.abs(r.top - copyY) > 50) continue;
      if (el.textContent.toLowerCase().includes(nameLower)) return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIND "Add to project" IN MENU
  // ═══════════════════════════════════════════════════════════════════════════

  function findAddToProjectItem() {
    // Strategy 1: standard menu roles
    for (const el of document.querySelectorAll(
      '[role="menuitem"], [role="option"], [data-radix-collection-item], ' +
      '[role="menu"] button, [role="menu"] div, ' +
      '[role="listbox"] button, ' +
      '[data-radix-popper-content-wrapper] button, ' +
      '[data-radix-popper-content-wrapper] div[role], ' +
      '[data-radix-menu-content] [data-radix-menu-item]'
    )) {
      const t = el.textContent.trim();
      if (t === 'Add to project' && isVisible(el)) return el;
    }
    // Strategy 2: any visible element with exact text "Add to project"
    // in the right part of the screen (where the artifact panel is)
    for (const el of document.querySelectorAll('div, button, span, a, li')) {
      const t = el.textContent.trim();
      if (t !== 'Add to project') continue;
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < window.innerWidth * 0.3) continue;  // right side
      // Element must be a leaf or near-leaf (<=2 children)
      if (el.children.length > 2) continue;
      return el;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN MENU WITH "Add to project"
  //
  // Key change in v1.7: instead of "find chevron → click" —
  // try multiple candidates sequentially, checking if "Add to project"
  // appeared after each click.
  //
  // Candidates (in priority order):
  //  1) nextElementSibling of Copy button (classic split button)
  //  2) Element with aria-haspopup nearby
  //  3) Nearest button/div with short text AFTER Copy in parent
  //  4) Nearest button to the right by position (grandparent)
  //  5) Copy button itself (may be the entire dropdown trigger)
  // ═══════════════════════════════════════════════════════════════════════════

  async function openMenuAndFindAddItem(copyBtn) {
    let triedTrigger = null;

    // ── Fast path: look for button[aria-haspopup="menu"] — sibling of Copy
    for (const scope of [copyBtn.parentElement, copyBtn.parentElement?.parentElement]) {
      if (!scope) continue;
      const menuTrigger = scope.querySelector('button[aria-haspopup="menu"]');
      if (menuTrigger && menuTrigger !== copyBtn) {
        triedTrigger = menuTrigger;
        try {
          await waitFor(() => menuTrigger.hasAttribute('data-state'), 3000, 200);
        } catch { /* continue */ }

        realClick(menuTrigger);
        try {
          const item = await waitFor(findAddToProjectItem, 3000, 200);
          if (item) return item;
        } catch { /* menu didn't appear */ }
        document.body.click();
        await sleep(200);
        break;
      }
    }

    // ── Slow path: try candidates (skip already-tried trigger)
    const candidates = collectDropdownCandidates(copyBtn);

    for (const el of candidates) {
      if (el === triedTrigger) continue;
      realClick(el);
      try {
        const item = await waitFor(findAddToProjectItem, 2000, 200);
        if (item) return item;
      } catch { /* didn't appear */ }

      document.body.click();
      await sleep(200);
    }

    return null;
  }

  function collectDropdownCandidates(copyBtn) {
    const seen = new Set();
    const result = [];
    const add = (el) => {
      if (el && !seen.has(el)) { seen.add(el); result.push(el); }
    };

    const parent = copyBtn.parentElement;
    const gp = parent?.parentElement;

    // 1. nextElementSibling — UNCONDITIONALLY as first candidate.
    // Chevron may be <button>, <div>, <span>, SVG wrapper — doesn't matter.
    // Click and check the result.
    const next = copyBtn.nextElementSibling;
    if (next) {
      add(next);
      // Also try nested button/clickable element inside
      const inner = next.querySelector?.('button, [role="button"], [aria-haspopup]');
      if (inner) add(inner);
    }

    // 2. aria-haspopup in parent and grandparent
    if (parent) {
      for (const el of parent.querySelectorAll('[aria-haspopup]')) {
        if (el !== copyBtn) add(el);
      }
    }
    if (gp) {
      for (const el of gp.querySelectorAll('[aria-haspopup]')) {
        if (el !== copyBtn) add(el);
      }
    }

    // 3. ALL sibling elements AFTER Copy in parent (not just buttons)
    if (parent) {
      const siblings = [...parent.children];
      const idx = siblings.indexOf(copyBtn);
      for (let i = idx + 1; i < siblings.length; i++) {
        const sib = siblings[i];
        // Any element with short or empty text (chevron, icon)
        if (sib.textContent.trim().length <= 3) add(sib);
        // Nested clickable
        const inner = sib.querySelector?.('button, [role="button"], [aria-haspopup]');
        if (inner) add(inner);
      }
    }

    // 4. ANY small element to the RIGHT of Copy by position
    // Not limited to buttons — chevron may be div/span/svg
    if (gp) {
      const copyRect = copyBtn.getBoundingClientRect();
      const nearby = [];
      for (const el of gp.querySelectorAll('*')) {
        if (el === copyBtn || el.contains(copyBtn) || copyBtn.contains(el)) continue;
        const r = el.getBoundingClientRect();
        // Small element (< 50x50px), to the right of Copy, at the same height
        if (r.width > 50 || r.height > 50) continue;
        if (r.width < 5 || r.height < 5) continue;  // too small (invisible)
        if (Math.abs(r.top - copyRect.top) > 15) continue;
        if (r.left < copyRect.right - 5) continue;
        const dist = r.left - copyRect.right;
        if (dist < 50) nearby.push({ el, dist });
      }
      nearby.sort((a, b) => a.dist - b.dist);
      // Take first 3 — don't iterate the entire DOM
      nearby.slice(0, 3).forEach(({ el }) => add(el));
    }

    // 5. Copy button itself — may be a single dropdown trigger
    add(copyBtn);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE: ADD ONE FILE TO PROJECT
  // ═══════════════════════════════════════════════════════════════════════════

  async function addOne(card, closePanelAfter = false) {
    let menuOpened = false;

    try {
      const cardName = getCardFileName(card);

      // ── Step 1: click card → artifact panel ────────────────────────────
      const clickTarget = findFileNameElement(card);
      realClick(clickTarget || card);
      await sleep(1000);

      // ── Step 2: wait for Copy button + verify file ─────────────────────
      let copyBtn;
      try {
        copyBtn = await waitFor(() => {
          const btn = findPanelCopyBtn();
          if (!btn) return null;
          if (cardName && panelShowsFile(btn, cardName)) return btn;
          if (!cardName) return btn;
          return null;
        }, 10000);
      } catch {
        copyBtn = findPanelCopyBtn();
        if (!copyBtn) throw new Error('Panel did not open');
      }

      // ── Step 3: open menu and find "Add to project" ────────────────────
      // Retry: for heavy files the first attempt may fail
      // (Radix hasn't initialized handlers yet). Wait and try again.
      // Re-find copyBtn before each retry — React may have re-rendered the panel.
      let addItem = await openMenuAndFindAddItem(copyBtn);

      if (!addItem) {
        await sleep(2000);
        copyBtn = findPanelCopyBtn() || copyBtn;
        addItem = await openMenuAndFindAddItem(copyBtn);
      }

      if (!addItem) {
        await sleep(3000);
        copyBtn = findPanelCopyBtn() || copyBtn;
        addItem = await openMenuAndFindAddItem(copyBtn);
      }

      if (!addItem) throw new Error('Add to project not found');
      menuOpened = true;

      // ── Step 4: click "Add to project" ─────────────────────────────────
      const toastsBefore = snapshotToasts();
      realClick(addItem);
      menuOpened = false;

      // ── Step 5: wait for toast ─────────────────────────────────────────
      try {
        await waitFor(() => detectNewToast(toastsBefore), 7000, 300);
        return 'ok';
      } catch {
        return 'maybe';
      }

    } finally {
      if (menuOpened) await closeDropdowns();
      if (closePanelAfter) {
        const closed = await closeArtifactPanel();
        if (!closed) await sleep(500);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUTTON INJECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function scan() {
    // Guard: only run on project chat pages, not during SPA transition
    if (navigating) return;
    if (!isChatPage() || !isProjectChat()) return;

    for (const dl of btnsByText('Download')) {
      if (dl.hasAttribute(INJECTED)) continue;
      if (dl.closest('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]')) continue;
      if (isInArtifactPanel(dl)) continue;

      dl.setAttribute(INJECTED, '1');
      const card = cardOf(dl);
      const btn = mkBtn('📁 Add to project', BTN_CLS);

      btn.addEventListener('click', async e => {
        e.stopPropagation(); e.preventDefault();
        // Click on status → reset for retry
        if (btn.classList.contains('atp-ok') || btn.classList.contains('atp-err')) {
          btn.textContent = '📁 Add to project';
          btn.className = BTN_CLS;
          btn.disabled = false;
          return;
        }
        if (busy) return;
        busy = true; btn.disabled = true;
        btn.textContent = '⏳ Adding…'; btn.className = BTN_CLS;
        try {
          const r = await addOne(card, false);
          btn.textContent = r === 'ok' ? '✓ Added to project' : '✓ Likely added';
          btn.classList.add('atp-ok');
          btn.disabled = false;
        } catch (err) {
          btn.textContent = '✗ ' + (err.message || 'Error');
          btn.classList.add('atp-err');
          btn.disabled = false;
        } finally { busy = false; }
      });

      dl.before(btn);
    }

    for (const dlAll of btnsByText('Download all')) {
      if (dlAll.hasAttribute(INJECTED)) continue;
      if (dlAll.closest('[role="menu"]')) continue;
      if (isInArtifactPanel(dlAll)) continue;

      dlAll.setAttribute(INJECTED, '1');
      const dlAllRef = dlAll;
      const btn = mkBtn('📁 Add all to project', ALLBTN_CLS);

      btn.addEventListener('click', async e => {
        e.stopPropagation(); e.preventDefault();
        // Click on status → reset for retry
        if (btn.classList.contains('atp-ok') || btn.classList.contains('atp-err') || btn.classList.contains('atp-partial')) {
          btn.textContent = '📁 Add all to project';
          btn.className = ALLBTN_CLS;
          btn.disabled = false;
          return;
        }
        if (busy) return;
        busy = true; btn.disabled = true; btn.className = ALLBTN_CLS;

        try {
          const block = blockOf(dlAllRef);
          if (!block) {
            btn.textContent = '✗ File block not found'; btn.classList.add('atp-err');
            btn.disabled = false; return;
          }
          const dlBtns = btnsByText('Download', block);
          if (dlBtns.length === 0) {
            btn.textContent = '✗ No files found'; btn.classList.add('atp-err');
            btn.disabled = false; return;
          }

          const cards = dlBtns.map(d => cardOf(d));
          let ok = 0, fail = 0;

          for (let i = 0; i < cards.length; i++) {
            btn.textContent = `⏳ Adding ${i + 1} of ${cards.length}…`;
            try {
              const r = await addOne(cards[i], true);
              if (r === 'ok' || r === 'maybe') ok++; else fail++;
            } catch { fail++; }
            if (i < cards.length - 1) await sleep(1000);
          }

          if (fail === 0) {
            btn.textContent = `✓ All ${ok} added to project`; btn.classList.add('atp-ok');
          } else if (ok > 0) {
            btn.textContent = `⚠ ${ok} added, ${fail} failed`; btn.classList.add('atp-partial');
          } else {
            btn.textContent = `✗ Failed to add ${fail} file${fail > 1 ? 's' : ''}`; btn.classList.add('atp-err');
          }
          btn.disabled = false;
        } finally { busy = false; }
      });

      dlAll.after(btn);
    }
  }

  function mkBtn(text, cls) {
    const b = document.createElement('button');
    b.className = cls; b.textContent = text; return b;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP — remove all injected buttons and reset state
  //
  // Called on SPA navigation away from a chat page (or between chats).
  // Removes our buttons, clears INJECTED markers so a fresh scan
  // on the new page works correctly.
  // ═══════════════════════════════════════════════════════════════════════════

  function cleanup() {
    // Remove all injected buttons
    for (const btn of document.querySelectorAll('.' + BTN_CLS + ', .' + ALLBTN_CLS)) {
      btn.remove();
    }
    // Clear INJECTED markers so Download buttons can be re-processed
    for (const el of document.querySelectorAll('[' + INJECTED + ']')) {
      el.removeAttribute(INJECTED);
    }
    // Don't reset busy here — if addOne() is mid-flight, let its finally
    // block clear the flag. This prevents a second addOne from starting
    // on the new page while the old one is still manipulating panels.
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPA LIFECYCLE
  //
  // @match covers all claude.ai/* so the script survives SPA navigation.
  // Single MutationObserver handles two concerns:
  //   1. Path change detection (SPA nav): cleanup → delayed scan
  //   2. Content changes (new messages): debounced scan for new Download buttons
  // A `navigating` flag suppresses content-triggered scans during SPA
  // transition (~850ms window), preventing premature injection into
  // half-rendered DOM.
  // ═══════════════════════════════════════════════════════════════════════════

  let lastPath = location.pathname;
  let _spaDebounce = null;
  let _spaScanTimer = null;  // delayed scan after SPA nav — clearable on re-navigation
  let scanPending = false;
  let navigating = false;  // true during SPA transition — suppresses premature scans

  // Single observer handles both SPA navigation and content changes.
  // Two observers on body with same config = double callback invocations for
  // every React mutation. One observer, two concerns.
  new MutationObserver(() => {

    // ── SPA navigation detection ──────────────────────────────────────────
    if (location.pathname !== lastPath) {
      navigating = true;
      clearTimeout(_spaDebounce);
      clearTimeout(_spaScanTimer);  // Cancel orphan scan from previous navigation
      _spaDebounce = setTimeout(() => {
        if (location.pathname === lastPath) { navigating = false; return; }
        const prevPath = lastPath;
        lastPath = location.pathname;

        // Leaving a chat page (or switching chats) → cleanup
        if (prevPath.startsWith('/chat/')) {
          cleanup();
        }

        // Arriving at a chat page → scan after delay (React needs time)
        if (isChatPage()) {
          _spaScanTimer = setTimeout(() => { navigating = false; scan(); }, 800);
        } else {
          navigating = false;
        }
      }, 50);
    }

    // ── Content change → debounced scan (new messages, streamed artifacts) ─
    if (navigating) return;        // Suppress during SPA transition
    if (!isChatPage()) return;     // Sleep on non-chat pages
    if (scanPending) return;
    scanPending = true;
    setTimeout(() => { scanPending = false; if (!busy) scan(); }, 600);

  }).observe(document.body, { childList: true, subtree: true });

  // Initial scan — only if we started on a chat page
  if (isChatPage()) {
    setTimeout(scan, 1500);
  }

})();
