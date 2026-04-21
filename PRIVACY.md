# Privacy Policy — Phoebus

_Last updated: 2026-04-21_

## What the extension does

Phoebus lets you double-click a word or select a phrase on any web page
and get a context-aware translation powered by Google Gemini.

## What data is collected and where it goes

- **Text you interact with** — when you double-click a word or select a
  phrase and press *Translate*, the selected text plus a short surrounding
  sentence (for disambiguation) is sent to the Google Gemini API over HTTPS.
  This is the only outbound network traffic the extension makes.
- **Your Gemini API key** — stored locally in `browser.storage.sync` so
  Firefox can sync it to your other signed-in Firefox profiles. It is sent
  only to Google Gemini (`generativelanguage.googleapis.com`) as the
  `x-goog-api-key` request header.
- **Your highlights** — when you highlight a phrase, the highlighted text
  plus a short anchor (prefix/suffix of surrounding text, per-page URL) is
  stored locally in `browser.storage.local` so the highlight survives page
  reloads. This never leaves your device.

## What is NOT collected

- No analytics, telemetry, or crash reports.
- No browsing history.
- No account or sign-in required on our side — the extension has no
  server; all AI calls go directly from your browser to Google.
- The extension author has no access to any of your data.

## Third-party service

Translations are produced by **Google Gemini**. Your selected text and
API key are governed by Google's terms and privacy policy:
<https://ai.google.dev/terms> and <https://policies.google.com/privacy>.

## Uninstalling

Removing the extension deletes all locally stored data (API key, settings,
highlights).

## Contact

Questions or requests: open an issue at the extension's homepage (see the
AMO listing or `manifest.json`).
