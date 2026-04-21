# Decisions Log

Recorded so you can review and redirect anything. None of these are precious; each has a one-line rationale.

## v0.0.2 — additions (rev 3)

### Highlight visual — rounded marker with tail overshoots (rev 3)

Rev 2 torn-edge look (feTurbulence rect) was still too rough and not quite right. Switched to the reference-image style:

- Main thick horizontal stroke with **rounded linecaps** (stroke-linecap='round') — 26-unit thick, from x=18 to x=282 in a 300x40 viewBox.
- **Four thin tail strokes** sticking out past each end of the main body, at different y-offsets (above and below center). These simulate a highlighter being swiped back-and-forth and slightly overshooting each end of the pass — the detail that makes it read as "hand-drawn" rather than "CSS rectangle".
- All strokes share the same warm-yellow fill with 78% opacity.
- Dark mode: amber variant.
- Because each wrapped text node renders its own SVG (box-decoration-break: clone), multi-line highlights get their own "overshoot tails" per line — visually consistent with how a real highlighter would behave.

### Close buttons on all floating UI

All three floating elements — tooltip, selection toolbar, highlight controls — now have an X close button:

- **Tooltip**: top-right absolute-positioned X, subtle (55% opacity → 100% on hover).
- **Selection toolbar**: X appended as an extra button after Translate / Highlight, separated by a divider.
- **Highlight controls**: X appended after Adjust / Remove.
- Escape key and click-outside still work as before. X is the deliberate, visible affordance.

### Draggable floating boxes

All three floating elements are now draggable:

- Mousedown anywhere in the box (except on buttons / inputs / links) and move > 4px to engage drag mode. Under the 4px threshold, mouse acts as a normal click / text selection attempt — so users can still copy translation text without accidentally dragging.
- During drag, cursor switches to `grabbing` and box shadow deepens slightly for a lifted feel.
- Position is updated via absolute `left`/`top` on the element — respects page scroll offset.
- Dragged position persists until the box is closed or a new box is spawned.

### Auto-dismiss behavior changed

Previously scroll and resize auto-dismissed all floating boxes. With X buttons + draggability now giving explicit user control, scroll/resize no longer dismiss — the user owns closure. Dismissal routes remaining: X button, Escape key, click outside. This means if you drag a translation tooltip to a corner of the page and scroll, it stays visible.

### Known tradeoffs for rev 3

1. **4px drag threshold** is a heuristic. Very small hand movements during a click may tip into drag mode. Feels OK in testing but may need tuning.
2. **Tails on every wrapped segment** of a multi-line highlight — realistic but some users might expect only the first/last line's outermost edges to have overshoots. Compromise for simplicity.
3. **Dragged tooltip doesn't reposition when the anchor text moves** (e.g., on dynamic page changes). Acceptable — user dragged it somewhere deliberate.

---

## v0.0.2 — additions (rev 2 — superseded)

### Highlight visual — real marker-pen look (rev 2)

Earlier revision used a horizontal `linear-gradient` with slanted fade edges, but it still sat as a rectangle behind the text. Replaced with an inline-SVG polygon background:

- SVG contains a **parallelogram** tilted up-to-the-right (top edge rises from (1.5, 11) to (198.5, 4)), plus a thin lighter stripe at the top for depth.
- `preserveAspectRatio='none'` so it stretches to the text run width — and because each wrapped text node stretches independently (via `box-decoration-break: clone`), multi-line highlights look slightly different on each line, which reinforces the hand-drawn feel.
- Shape is **60% of text line-height**, positioned at 72% from top (covers the x-height band, not ascenders) — matches how a real highlighter catches the middle of letters.
- Color: warm yellow `#ffd94a` at 70% opacity. Dark mode: amber `#ffb84a` at 55%.
- Hover swells the height slightly (60% → 68%) for a subtle interaction hint.

### Highlight is editable / removable

- Each highlight action gets a `data-highlight-id`; all wrapped `<span>`s from that action share the id. This lets us treat a multi-segment highlight as one unit.
- Click any highlight → a small controls popover appears above it with two buttons:
  - **Adjust** — unwraps the spans, restores the original text nodes, re-selects the exact same text, then shows the selection toolbar. From there user drags/shift-clicks to change the range and clicks Highlight again to re-apply. Trust the user's native text-selection gestures rather than build custom drag-handles.
  - **Remove** — unwraps all spans in the group, restoring plain text.
- The controls popover dismisses on outside click, Escape, scroll, or resize.
- Cursor on `.ctx-highlight` is now `pointer` so it's obvious highlights are clickable.

### Known tradeoffs for this rev

1. **Adjust asks user to use native selection gestures** (drag, shift-click) rather than exposing draggable endpoint handles. Handles would be a bigger build. If shift-click feels unintuitive in practice I'll add explicit handles in v0.0.3.
2. **Highlights still don't persist across reloads.** Same as before — v0.0.3 candidate.
3. **Overlapping highlights not handled specially** — if you highlight text that's already partly highlighted, the new spans nest inside the old ones. Remove on the outer span leaves inner highlights intact. Uncommon in practice but worth flagging.

---

## v0.0.2 — additions (initial)

### Selection toolbar (phrase translation)

- When you click-and-drag to select text (spans a space, or is ≥12 chars), a small dark pill-toolbar appears **above** the selection with two buttons: **Translate** and **Highlight**.
- Word-level double-click still works unchanged — the toolbar is skipped for short single tokens because that path belongs to the existing flow.
- Toolbar dismisses on: new selection, Escape, click outside, scroll, resize.
- `mousedown` on the toolbar is `preventDefault`ed so clicking a button doesn't collapse the underlying selection before the click handler fires.

### Phrase translation (Gemini)

- New mode `phrase` on the same `translate` message. Background script picks `PHRASE_SYSTEM_PROMPT` + `PHRASE_SCHEMA` (`translation`, optional `notes`).
- System prompt is explicit about preserving tone and producing idiomatic (not literal) translation. `notes` is used only for idioms, slang, cultural bits, or tricky jargon — otherwise empty string.
- Surrounding paragraph is passed as context (for disambiguation only, explicitly not translated). This is what makes rare/polysemous words in a phrase come out right.
- Tooltip for phrase mode: source text in small italic at top (so you can see what was translated), translated text big in body color (not accent blue — a long sentence in bright blue is too loud), optional notes below a divider.
- Tooltip max-width is wider (440px vs 320px) when in phrase mode so long sentences don't wrap awkwardly.

### Hand-drawn highlight

- Click **Highlight** on the toolbar → selected range gets wrapped in `<span class="ctx-highlight">` per text node (handles selections that span elements/inline tags by walking text nodes and splitting boundaries).
- Visual: a warm yellow marker look via `linear-gradient(104deg, …)` — the 104° angle gives the slanted, hand-drawn slope you asked for. Edges fade in/out so it doesn't look like a rectangular block. Asymmetric `border-radius` (9px 3px 7px 2px) reinforces the uneven handmade feel.
- `box-decoration-break: clone` so highlights across line-wraps look like the pen lifted and restarted each line, not one giant blob.
- Hover grows the highlight height slightly (88% → 95%) — tiny playful interaction.
- Dark mode uses a darker amber with lower opacity so highlights are visible without glowing.
- **Highlights are ephemeral for v0.0.2** — they stay until page reload. Persistence (store per-URL and restore on load) is a v0.0.3 candidate.

### Known tradeoffs for this version

1. **Selection toolbar triggers on every drag-select**, including non-translation use cases (quoting text, copying a link label). Dismissal is one click outside. If this gets noisy I'll add a modifier-key gate (only show toolbar if you hold Alt while selecting).
2. **Highlight undo is not implemented yet.** To remove a highlight you currently need to reload the page. Easy add in v0.0.3 — click a highlight to remove, or add a "Remove highlight" action to the toolbar when the selection overlaps an existing highlight.
3. **Highlight wrapping may fragment semantic markup** on pages where the selected text crosses element boundaries in unusual ways (e.g., mid-link). Falls back gracefully (skips nodes inside our own UI) but could produce per-word spans on pages where every word is its own element. Rare in practice.
4. **No highlight color picker yet.** Single warm-yellow for now. Could expose 3–4 colors in v0.0.3 if you want.

---

## v0.0.1 — baseline

## Provider

- **Google Gemini** via the Generative Language API (`generativelanguage.googleapis.com/v1beta`). User supplies their own API key.
- Key sent via `x-goog-api-key` header (cleaner than query-string, doesn't show up in URLs/logs).

## Platform

- **Firefox MV3**, `strict_min_version: 115.0`. Uses `background.scripts` (event page) — Firefox supports this form alongside `service_worker`.
- `host_permissions: ["https://generativelanguage.googleapis.com/*"]` — required for cross-origin fetch from the background script.

## Trigger

- **Double-click** only. Single-click would break normal browsing (links, text selection). Double-click also naturally highlights the word — free visual feedback.
- Content script injected at `document_idle` on `<all_urls>`.
- `WORD_REGEX = /^[\p{L}\p{M}'-]+$/u` — only triggers on actual words. Ignores numbers, punctuation-only selections, anything > 60 chars.

## Context extraction

- Grab current selection's range, walk up to the containing element, slice a sentence around the word using `[.!?。！？\n]` as sentence enders (handles CJK punctuation too).
- Max context = 500 chars; if the "sentence" is longer, take a 200-char window around the word.
- Sent to Gemini as the `Sentence:` field alongside the `Word:`.

## API call (background.js)

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` via `fetch`. Raw HTTP — browser extensions don't ship with a Node SDK.
- Model: `gemini-2.5-flash` default, with `gemini-2.5-flash-lite` and `gemini-2.5-pro` as options. Flash is fast + cheap + good enough for single-word lookup; Pro reserved for tricky polysemous cases.
- **Thinking disabled on Flash variants** via `thinkingConfig.thinkingBudget: 0` — for a 4-field JSON lookup, thinking only adds latency with no quality win. Pro keeps thinking at default (dynamic).
- **Structured output** via `generationConfig.responseMimeType: "application/json"` + `responseSchema` (OpenAPI-like with `translation`, `meaning`, `part_of_speech`, `example`). Guarantees parseable responses.
- `systemInstruction` carries the lexicographer role prompt (Gemini's system-prompt equivalent).
- `temperature: 0.2` — low, this is a lookup task, not generative writing.
- `maxOutputTokens: 1024` — small response, plenty of headroom.
- No streaming. Responses are sub-second and small.

## System prompt

Roleplays a "bilingual lexicographer" with explicit rules:
- Focus on the in-context sense (not generic dictionary)
- Meaning = one short target-language sentence
- Translation = 1–3 words, no parentheses/notes
- Part of speech is always given
- Example sentence in the target language using the translated word

If the token is not a real word (gibberish, code), it returns the token unchanged with a short note.

## UI / UX

- **Floating tooltip**, absolute-positioned near the cursor, viewport-edge aware.
- Fade-in via CSS transition (`opacity + translateY`), 120ms.
- **Loading state**: shows the clicked word immediately + a small spinner.
- **Error state**: shows the word + a red error message (missing key, API error, network error, safety block).
- **Success state**:
  - Big bold **translation** in accent blue.
  - Meaning below in body color.
  - Example sentence below a thin divider, italic, slightly muted.
  - Part of speech tag top-right, small uppercase letter-spaced.
- **Dark mode**: `@media (prefers-color-scheme: dark)`.
- **Dismissal**: `Esc`, clicking outside, scrolling, or resizing.
- **z-index 2147483647** — max value, always on top.
- `user-select: text` inside the tooltip so you can copy the translation.

## Settings page

- Three cards: API key, Languages, Model. Soft-card aesthetic with generous whitespace.
- API key input has a show/hide toggle (password by default). Hint links to Google AI Studio where the key is free.
- Language inputs are free-text with a `<datalist>` of common languages as suggestions.
- `Ctrl/Cmd+Enter` saves from anywhere on the page.

## What I did NOT do in v0.0.1 (candidates for v0.0.2)

- Keyboard shortcut on current selection.
- Toolbar popup for manual typing/pasting.
- History of recent lookups.
- Pronounce button (browser TTS).
- Language auto-detect.
- PNG icons at 48/96 (shipped SVG for both sizes).
- Rate limiting / debouncing beyond `activeRequestId`.
- Streaming responses.

## Known tradeoffs to evaluate in review

1. **Flash as default vs Pro.** Flash is essentially free and fast. For rare/polysemous words Pro is better — exposed in settings so you can switch per your use pattern.
2. **Sentence boundary detection is heuristic.** On weird DOM (one word per `<span>`), `innerText` still works but long runs without punctuation may over-include context. Not wrong, just more tokens.
3. **No click-outside grace period.** Dismiss happens immediately on outside click.
4. **API key in `storage.sync`** means it roams with your Firefox account. Switch to `storage.local` in one line if you'd prefer device-only.
5. **Safety blocks** from Gemini surface as an error with the `blockReason` (e.g., `SAFETY`, `RECITATION`). Rare for vocabulary lookup but possible on edge-case inputs.
