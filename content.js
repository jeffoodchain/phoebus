(() => {
  const TOOLTIP_ID = "ctx-translator-tooltip";
  const TOOLBAR_ID = "ctx-translator-toolbar";
  const HL_CONTROLS_ID = "ctx-translator-hl-controls";
  const HL_CLASS = "ctx-highlight";
  const WORD_REGEX = /^[\p{L}\p{M}'\-]+$/u;
  const MIN_PHRASE_LENGTH = 2;

  let activeTooltip = null;
  let activeToolbar = null;
  let activeHlControls = null;
  let activeRequestId = 0;
  let lastRange = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function removeTooltip() {
    if (activeTooltip && activeTooltip.parentNode) {
      activeTooltip.parentNode.removeChild(activeTooltip);
    }
    activeTooltip = null;
  }

  function removeToolbar() {
    if (activeToolbar && activeToolbar.parentNode) {
      activeToolbar.parentNode.removeChild(activeToolbar);
    }
    activeToolbar = null;
  }

  function removeHlControls() {
    if (activeHlControls && activeHlControls.parentNode) {
      activeHlControls.parentNode.removeChild(activeHlControls);
    }
    activeHlControls = null;
  }

  function getSentenceContext(selection) {
    try {
      const range = selection.getRangeAt(0);
      const node = range.startContainer;
      const container = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      if (!container) return "";
      const text = container.innerText || container.textContent || "";
      if (!text) return "";

      const selText = selection.toString();
      const idx = text.indexOf(selText);
      if (idx === -1) return text.slice(0, 400);

      const sentenceEnders = /[.!?。！？\n]/;
      let start = idx;
      while (start > 0 && !sentenceEnders.test(text[start - 1])) start--;
      let end = idx + selText.length;
      while (end < text.length && !sentenceEnders.test(text[end])) end++;
      if (end < text.length) end++;

      let sentence = text.slice(start, end).trim();
      if (sentence.length > 800) {
        const selStart = Math.max(0, idx - 300);
        const selEnd = Math.min(text.length, idx + selText.length + 300);
        sentence = text.slice(selStart, selEnd).trim();
      }
      return sentence || text.slice(0, 400);
    } catch (_) {
      return "";
    }
  }

  function makeDraggable(el) {
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("button, input, textarea, a, select, [contenteditable]")) return;

      const rect = el.getBoundingClientRect();
      const origX = e.clientX;
      const origY = e.clientY;
      const startLeft = rect.left + window.scrollX;
      const startTop = rect.top + window.scrollY;
      let dragging = false;

      function onMove(me) {
        if (!dragging) {
          if (Math.abs(me.clientX - origX) + Math.abs(me.clientY - origY) < 4) return;
          dragging = true;
          el.classList.add("ctx-dragging");
          const sel = window.getSelection();
          if (sel && !el.contains(sel.anchorNode)) sel.removeAllRanges();
        }
        el.style.left = `${startLeft + (me.clientX - origX)}px`;
        el.style.top = `${startTop + (me.clientY - origY)}px`;
        me.preventDefault();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        el.classList.remove("ctx-dragging");
      }
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    });
  }

  function positionFloating(el, x, y, { placement = "below" } = {}) {
    const margin = 10;
    const { innerWidth, innerHeight } = window;
    el.style.visibility = "hidden";
    el.style.left = "0px";
    el.style.top = "0px";
    if (!el.isConnected) document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    let left = x - rect.width / 2;
    let top = placement === "above" ? y - rect.height - margin : y + margin;

    if (left + rect.width > innerWidth - 8) left = innerWidth - rect.width - 8;
    if (left < 8) left = 8;
    if (top + rect.height > innerHeight - 8) top = y - rect.height - margin;
    if (top < 8) top = y + margin;

    el.style.left = `${left + window.scrollX}px`;
    el.style.top = `${top + window.scrollY}px`;
    el.style.visibility = "visible";
  }

  const CLOSE_BTN_HTML = `<button type="button" class="ctx-close-btn" aria-label="Close" title="Close">
    <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
  </button>`;

  function renderTooltipBody(state) {
    const label = state.label || state.word || "";
    if (state.status === "loading") {
      return `
        ${CLOSE_BTN_HTML}
        <div class="ctx-head">
          <span class="ctx-word">${escapeHtml(label)}</span>
          <span class="ctx-spinner" aria-hidden="true"></span>
        </div>
        <div class="ctx-body ctx-muted">Translating…</div>
      `;
    }
    if (state.status === "error") {
      return `
        ${CLOSE_BTN_HTML}
        <div class="ctx-head">
          <span class="ctx-word">${escapeHtml(label)}</span>
        </div>
        <div class="ctx-body ctx-error">${escapeHtml(state.message)}</div>
      `;
    }
    const r = state.result || {};
    if (state.mode === "phrase") {
      return `
        ${CLOSE_BTN_HTML}
        <div class="ctx-head">
          <span class="ctx-word ctx-source">${escapeHtml(label)}</span>
        </div>
        <div class="ctx-translation ctx-translation-phrase">${escapeHtml(r.translation || "")}</div>
        ${r.notes ? `<div class="ctx-example">${escapeHtml(r.notes)}</div>` : ""}
      `;
    }
    return `
      ${CLOSE_BTN_HTML}
      <div class="ctx-head">
        <span class="ctx-word">${escapeHtml(label)}</span>
        <span class="ctx-pos">${escapeHtml(r.part_of_speech || "")}</span>
      </div>
      <div class="ctx-translation">${escapeHtml(r.translation || "")}</div>
      <div class="ctx-meaning">${escapeHtml(r.meaning || "")}</div>
      ${r.example ? `<div class="ctx-example">${escapeHtml(r.example)}</div>` : ""}
    `;
  }

  function createTooltip(state) {
    removeTooltip();
    const tooltip = document.createElement("div");
    tooltip.id = TOOLTIP_ID;
    tooltip.className = "ctx-translator-tooltip";
    if (state.mode === "phrase") tooltip.classList.add("ctx-phrase-tooltip");
    tooltip.setAttribute("role", "tooltip");
    tooltip.innerHTML = renderTooltipBody(state);
    tooltip.addEventListener("mousedown", (e) => e.stopPropagation());
    tooltip.addEventListener("click", (e) => {
      if (e.target.closest(".ctx-close-btn")) {
        e.preventDefault();
        e.stopPropagation();
        removeTooltip();
      }
    });
    makeDraggable(tooltip);
    return tooltip;
  }

  function updateTooltip(tooltip, state) {
    if (!tooltip || !tooltip.isConnected) return;
    tooltip.classList.toggle("ctx-phrase-tooltip", state.mode === "phrase");
    tooltip.innerHTML = renderTooltipBody(state);
  }

  async function runTranslation({ mode, payload, anchorX, anchorY, label }) {
    const requestId = ++activeRequestId;
    removeToolbar();
    const tooltip = createTooltip({ status: "loading", label, mode });
    activeTooltip = tooltip;
    positionFloating(tooltip, anchorX, anchorY, { placement: "below" });
    requestAnimationFrame(() => tooltip.classList.add("ctx-visible"));

    let response;
    try {
      response = await browser.runtime.sendMessage({
        type: "translate",
        payload: { mode, ...payload }
      });
    } catch (err) {
      response = { error: err?.message || "Extension messaging failed." };
    }

    if (requestId !== activeRequestId || !tooltip.isConnected) return;

    if (response?.error) {
      updateTooltip(tooltip, { status: "error", label, mode, message: response.error });
    } else if (response?.result) {
      updateTooltip(tooltip, { status: "ok", label, mode, result: response.result });
      positionFloating(tooltip, anchorX, anchorY, { placement: "below" });
    } else {
      updateTooltip(tooltip, { status: "error", label, mode, message: "Unknown response." });
    }
  }

  // ---- word trigger (double-click) ----
  async function handleDoubleClick(event) {
    if (event.target?.closest?.(`#${TOOLTIP_ID}`)) return;
    if (event.target?.closest?.(`#${TOOLBAR_ID}`)) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const word = selection.toString().trim();
    if (!word) return;
    if (!WORD_REGEX.test(word)) return;
    if (word.length > 60) return;

    removeToolbar();
    const context = getSentenceContext(selection);
    await runTranslation({
      mode: "word",
      payload: { word, context },
      anchorX: event.clientX,
      anchorY: event.clientY,
      label: word
    });
  }

  // ---- phrase trigger (selection toolbar) ----
  function showSelectionToolbar() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      removeToolbar();
      return;
    }
    const text = selection.toString().trim();
    if (text.length < MIN_PHRASE_LENGTH) {
      removeToolbar();
      return;
    }
    if (!/\s/.test(text) && text.length < 12) {
      // short single tokens are the double-click-word path; skip toolbar
      removeToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    lastRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;

    removeToolbar();
    const toolbar = document.createElement("div");
    toolbar.id = TOOLBAR_ID;
    toolbar.className = "ctx-selection-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.innerHTML = `
      <button type="button" class="ctx-tb-btn ctx-icon-only" data-action="translate" title="Translate selection" aria-label="Translate selection">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14"/><path d="M7 4v1"/><path d="M12 4v16"/><path d="m3 19 5-10 5 10"/><path d="M5 16h6"/><path d="M16 12c1 3 3 6 6 8"/><path d="M22 12c-1 3-3 6-6 8"/></svg>
      </button>
      <span class="ctx-tb-sep" aria-hidden="true"></span>
      <button type="button" class="ctx-tb-btn ctx-icon-only" data-action="highlight" title="Highlight selection" aria-label="Highlight selection">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h3l6-6"/><path d="m14 7 6 6"/><path d="M22 9 15 2l-6 6 7 7z"/></svg>
      </button>
      <span class="ctx-tb-sep" aria-hidden="true"></span>
      <button type="button" class="ctx-tb-btn ctx-icon-only ctx-tb-close" data-action="close" title="Close" aria-label="Close">
        <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
      </button>
    `;
    toolbar.addEventListener("mousedown", (e) => e.preventDefault());
    toolbar.addEventListener("click", async (e) => {
      const btn = e.target.closest("button.ctx-tb-btn");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "close") {
        removeToolbar();
        return;
      }
      if (action === "translate") {
        const phrase = text;
        const context = getSentenceContext(selection);
        const anchorX = rect.left + rect.width / 2;
        const anchorY = rect.bottom;
        await runTranslation({
          mode: "phrase",
          payload: { phrase, context },
          anchorX,
          anchorY,
          label: phrase
        });
      } else if (action === "highlight") {
        highlightSelection(lastRange);
        removeToolbar();
        window.getSelection()?.removeAllRanges();
      }
    });

    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.top;
    activeToolbar = toolbar;
    positionFloating(toolbar, anchorX, anchorY, { placement: "above" });
    makeDraggable(toolbar);
    requestAnimationFrame(() => toolbar.classList.add("ctx-visible"));
  }

  // ---- hand-drawn highlight wrapping ----
  function makeHighlightId() {
    return `h${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  }

  // ---- local persistence ----
  // Highlights are keyed by URL (minus fragment) in browser.storage.local.
  // Each record: { id, text, prefix, suffix } — a W3C-style TextQuoteSelector.
  const STORAGE_KEY = (() => {
    const u = new URL(location.href);
    u.hash = "";
    return `highlights:${u.toString()}`;
  })();
  const CTX_LEN = 40;

  async function loadStored() {
    try {
      const res = await browser.storage.local.get(STORAGE_KEY);
      return Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
    } catch (_) { return []; }
  }
  async function writeStored(list) {
    try {
      if (list.length === 0) await browser.storage.local.remove(STORAGE_KEY);
      else await browser.storage.local.set({ [STORAGE_KEY]: list });
    } catch (err) { console.warn("[ctx-translator] storage write failed:", err); }
  }
  async function persistHighlight(record) {
    const list = await loadStored();
    list.push(record);
    await writeStored(list);
  }
  async function forgetHighlight(id) {
    const list = await loadStored();
    const next = list.filter((h) => h.id !== id);
    if (next.length !== list.length) await writeStored(next);
  }

  // Build a flat text index of visible text in the page so we can map string
  // positions back to (textNode, offset) for Range construction.
  function buildTextIndex() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest(`#${TOOLTIP_ID}, #${TOOLBAR_ID}, #${HL_CONTROLS_ID}`)) {
            return NodeFilter.FILTER_REJECT;
          }
          const tag = p.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let text = "";
    const entries = [];
    let n = walker.nextNode();
    while (n) {
      entries.push({ start: text.length, end: text.length + n.nodeValue.length, node: n });
      text += n.nodeValue;
      n = walker.nextNode();
    }
    return { text, entries };
  }

  function positionToNodeOffset(entries, pos) {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (pos < e.end) return { node: e.node, offset: Math.max(0, pos - e.start) };
      if (pos === e.end && i === entries.length - 1) return { node: e.node, offset: e.end - e.start };
    }
    const last = entries[entries.length - 1];
    return last ? { node: last.node, offset: last.end - last.start } : null;
  }

  function nodeOffsetToPosition(entries, node, offset) {
    for (const e of entries) {
      if (e.node === node) return e.start + offset;
    }
    return -1;
  }

  function serializeRange(range) {
    const text = range.toString();
    if (!text) return null;
    if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
    if (range.endContainer.nodeType !== Node.TEXT_NODE) return null;
    const { text: allText, entries } = buildTextIndex();
    const startPos = nodeOffsetToPosition(entries, range.startContainer, range.startOffset);
    const endPos = nodeOffsetToPosition(entries, range.endContainer, range.endOffset);
    if (startPos < 0 || endPos < 0) return null;
    const prefix = allText.slice(Math.max(0, startPos - CTX_LEN), startPos);
    const suffix = allText.slice(endPos, Math.min(allText.length, endPos + CTX_LEN));
    return { text, prefix, suffix };
  }

  function entriesToRange(entries, startPos, endPos) {
    const s = positionToNodeOffset(entries, startPos);
    const e = positionToNodeOffset(entries, endPos);
    if (!s || !e) return null;
    try {
      const range = document.createRange();
      range.setStart(s.node, s.offset);
      range.setEnd(e.node, e.offset);
      return range;
    } catch (_) { return null; }
  }

  function locateRange(record, idx) {
    const { text, prefix, suffix } = record;
    const { text: allText, entries } = idx;
    const full = prefix + text + suffix;
    let pos = allText.indexOf(full);
    if (pos !== -1) return entriesToRange(entries, pos + prefix.length, pos + prefix.length + text.length);

    const shortPrefix = prefix.slice(-16);
    const shortSuffix = suffix.slice(0, 16);
    const shortNeedle = shortPrefix + text + shortSuffix;
    pos = allText.indexOf(shortNeedle);
    if (pos !== -1) return entriesToRange(entries, pos + shortPrefix.length, pos + shortPrefix.length + text.length);

    pos = allText.indexOf(text);
    if (pos === -1) return null;
    return entriesToRange(entries, pos, pos + text.length);
  }

  async function restoreHighlights() {
    const list = await loadStored();
    if (list.length === 0) return;
    for (const record of list) {
      if (document.querySelector(`.${HL_CLASS}[data-highlight-id="${CSS.escape(record.id)}"]`)) continue;
      const idx = buildTextIndex();
      const range = locateRange(record, idx);
      if (!range) continue;
      try { wrapRange(range, record.id); } catch (err) {
        console.warn("[ctx-translator] restore failed:", err);
      }
    }
  }

  function highlightSelection(range) {
    if (!range) return;
    try {
      const id = makeHighlightId();
      const record = serializeRange(range);
      wrapRange(range.cloneRange(), id);
      if (record) persistHighlight({ id, ...record }).catch(() => {});
    } catch (err) {
      console.warn("[ctx-translator] highlight failed:", err);
    }
  }

  function wrapRange(range, highlightId) {
    // Collect text nodes that intersect the range, split boundaries, wrap each slice.
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(
      root.nodeType === Node.TEXT_NODE ? root.parentNode : root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          // skip nodes inside our own UI
          const p = node.parentElement;
          if (p && (p.closest(`#${TOOLTIP_ID}`) || p.closest(`#${TOOLBAR_ID}`) || p.closest(".ctx-highlight"))) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let n = walker.nextNode();
    while (n) { nodes.push(n); n = walker.nextNode(); }
    if (nodes.length === 0) return;

    // Split end boundary first (so start offsets stay valid).
    const endNode = range.endContainer;
    if (endNode.nodeType === Node.TEXT_NODE && range.endOffset > 0 && range.endOffset < endNode.nodeValue.length) {
      endNode.splitText(range.endOffset);
    }
    const startNode = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE && range.startOffset > 0 && range.startOffset < startNode.nodeValue.length) {
      const after = startNode.splitText(range.startOffset);
      // replace first occurrence of startNode in list with its "after" half
      const i = nodes.indexOf(startNode);
      if (i !== -1) nodes[i] = after;
    }

    nodes.forEach((textNode) => {
      if (!textNode.nodeValue || !textNode.nodeValue.trim()) return;
      const wrap = document.createElement("span");
      wrap.className = HL_CLASS;
      wrap.dataset.highlightId = highlightId;
      textNode.parentNode.insertBefore(wrap, textNode);
      wrap.appendChild(textNode);
    });
  }

  function getHighlightGroup(span) {
    const id = span?.dataset?.highlightId;
    if (!id) return [span];
    return Array.from(document.querySelectorAll(`.${HL_CLASS}[data-highlight-id="${CSS.escape(id)}"]`));
  }

  function unwrapSpans(spans) {
    spans.forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
  }

  function showHighlightControls(span) {
    const group = getHighlightGroup(span);
    if (group.length === 0) return;
    removeHlControls();
    removeToolbar();

    const controls = document.createElement("div");
    controls.id = HL_CONTROLS_ID;
    controls.className = "ctx-highlight-controls";
    controls.setAttribute("role", "toolbar");
    controls.innerHTML = `
      <button type="button" class="ctx-hl-btn ctx-icon-only" data-action="adjust" title="Adjust highlight range" aria-label="Adjust highlight range">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M4 7v10"/><path d="M20 7v10"/><path d="M8 11h8"/></svg>
      </button>
      <span class="ctx-hl-sep" aria-hidden="true"></span>
      <button type="button" class="ctx-hl-btn ctx-icon-only ctx-danger" data-action="remove" title="Remove highlight" aria-label="Remove highlight">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
      <span class="ctx-hl-sep" aria-hidden="true"></span>
      <button type="button" class="ctx-hl-btn ctx-icon-only ctx-hl-close" data-action="close" title="Close" aria-label="Close">
        <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
      </button>
    `;
    controls.addEventListener("mousedown", (e) => e.preventDefault());
    controls.addEventListener("click", (e) => {
      const btn = e.target.closest("button.ctx-hl-btn");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "remove") {
        const id = group[0]?.dataset?.highlightId;
        unwrapSpans(group);
        if (id) forgetHighlight(id).catch(() => {});
        removeHlControls();
      } else if (action === "adjust") {
        adjustHighlightGroup(group);
      } else if (action === "close") {
        removeHlControls();
      }
    });

    // position above the first span, centered
    const first = group[0];
    const rect = first.getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.top;
    activeHlControls = controls;
    positionFloating(controls, anchorX, anchorY, { placement: "above" });
    makeDraggable(controls);
    requestAnimationFrame(() => controls.classList.add("ctx-visible"));
  }

  function adjustHighlightGroup(group) {
    if (!group || group.length === 0) return;

    const textNodes = [];
    group.forEach((span) => {
      span.childNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) textNodes.push(n);
      });
    });
    if (textNodes.length === 0) {
      unwrapSpans(group);
      removeHlControls();
      return;
    }

    const firstText = textNodes[0];
    const lastText = textNodes[textNodes.length - 1];
    const endOffset = lastText.nodeValue.length;
    const id = group[0]?.dataset?.highlightId;

    unwrapSpans(group);
    removeHlControls();
    if (id) forgetHighlight(id).catch(() => {});

    try {
      const range = document.createRange();
      range.setStart(firstText, 0);
      range.setEnd(lastText, endOffset);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      setTimeout(showSelectionToolbar, 10);
    } catch (err) {
      console.warn("[ctx-translator] adjust failed:", err);
    }
  }

  // ---- listeners ----
  document.addEventListener("dblclick", handleDoubleClick, true);

  document.addEventListener("click", (e) => {
    const hlSpan = e.target?.closest?.(`.${HL_CLASS}`);
    if (hlSpan) {
      e.preventDefault();
      e.stopPropagation();
      showHighlightControls(hlSpan);
    }
  }, true);

  document.addEventListener("mouseup", (e) => {
    if (e.target?.closest?.(`#${TOOLBAR_ID}`)) return;
    if (e.target?.closest?.(`#${TOOLTIP_ID}`)) return;
    if (e.target?.closest?.(`#${HL_CONTROLS_ID}`)) return;
    if (e.target?.closest?.(`.${HL_CLASS}`)) return;
    setTimeout(showSelectionToolbar, 10);
  });

  document.addEventListener("mousedown", (e) => {
    const inToolbar = e.target?.closest?.(`#${TOOLBAR_ID}`);
    const inTooltip = e.target?.closest?.(`#${TOOLTIP_ID}`);
    const inHlControls = e.target?.closest?.(`#${HL_CONTROLS_ID}`);
    const onHighlight = e.target?.closest?.(`.${HL_CLASS}`);
    if (!inToolbar && !onHighlight) removeToolbar();
    if (activeTooltip && !inTooltip) removeTooltip();
    if (!inHlControls && !onHighlight) removeHlControls();
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      removeTooltip();
      removeToolbar();
      removeHlControls();
    }
  });

  // Scroll/resize no longer auto-dismiss: the floating boxes now have an X button
  // and can be moved, so the user owns when they go away.

  // Restore saved highlights. Retry once for lazy/dynamic content.
  restoreHighlights();
  setTimeout(restoreHighlights, 1500);
})();
