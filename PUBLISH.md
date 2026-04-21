# Publishing Guide

Two parallel tracks: **open-source on GitHub** and **publish to addons.mozilla.org (AMO)**.
Do GitHub first — AMO listing links to it.

---

## Part 1 — Open source on GitHub

### 1. Fill in your identity

Edit these placeholders before the first public push:

All identity fields (`manifest.json`, `LICENSE`, `README.md`, `PRIVACY.md`,
`PUBLISH.md`) are already pointed at `jeffoodchain/phoebus`. Nothing to
fill in.

### 2. Create the GitHub repo

1. On GitHub, create a new **public** repo named `phoebus` under
   `jeffoodchain`. Do **not** add a README/license on the GitHub side
   (we already have ours).
2. Initialize locally and push:

   ```bash
   cd /Users/jeff/dev/sp/phoebus
   git init
   git add .
   git commit -m "Initial public release v0.1.0"
   git branch -M main
   git remote add origin git@github.com:jeffoodchain/phoebus.git
   git push -u origin main
   ```

3. On GitHub, go to **Settings → General → Features** and make sure
   *Issues* is enabled (users will need somewhere to report problems).

### 3. Tag the first release

```bash
git tag -a v0.1.0 -m "v0.1.0 — first public release"
git push origin v0.1.0
```

On GitHub → *Releases → Draft a new release* → choose tag `v0.1.0`, write
short notes, and upload the signed `.xpi` from Part 2 step 5 as an attached
asset (so people can download without AMO).

---

## Part 2 — Publish to AMO

### 1. Create an AMO account

Go to <https://addons.mozilla.org/developers/>, sign in with a Mozilla
account, and accept the developer agreement. Enable 2FA on your Mozilla
account — AMO requires it for signing.

### 2. Get API credentials for CLI signing

Open <https://addons.mozilla.org/developers/addon/api/key/> and generate
a new pair. You'll get:

- `JWT issuer` — looks like `user:1234567:89`
- `JWT secret` — long random string

**Do not commit these.** Export them as env vars when you run the signing
command.

### 3. Install the build tool

```bash
cd /Users/jeff/dev/sp/phoebus
npm install
```

This installs `web-ext` locally.

### 4. Lint

```bash
npm run lint
```

Fix any errors. Warnings are usually fine.

### 5. Build and sign

```bash
npm run build
```

Produces `web-ext-artifacts/phoebus-0.1.0.zip`. This is an unsigned
build — fine for local testing, not for distribution.

For the official signed release that you submit to AMO:

```bash
WEB_EXT_API_KEY="user:1234567:89" \
WEB_EXT_API_SECRET="your-long-secret" \
npm run sign
```

`web-ext sign --channel=listed` uploads to AMO and queues the add-on for
the public listing review. When review passes, AMO generates the signed
`.xpi` and publishes it.

### 6. Fill in the AMO listing

After the first `sign` upload, log into the AMO Developer Hub and finish
the listing for your add-on. Fields you'll need:

| Field | Suggested content |
|---|---|
| **Name** | Phoebus |
| **Summary** (≤250 chars) | Double-click any word for a contextual translation from Google Gemini. Select a phrase to translate a full sentence or highlight it with a hand-drawn marker that sticks across reloads. Bring your own free Gemini API key. |
| **Description** | See draft below |
| **Categories** | Language Support, Productivity |
| **Tags** | translation, dictionary, gemini, language-learning, highlighter |
| **License** | MIT |
| **Privacy Policy** | Paste the contents of `PRIVACY.md`, or link to it on GitHub |
| **Homepage** | Your GitHub repo URL |
| **Support Email / URL** | GitHub Issues URL of the repo |
| **Screenshots** | 3–5 images, ≥1280×800 (see *Screenshots to capture* below) |
| **Icon** | `icons/icon.svg` (AMO accepts SVG; will render 128×128) |

### 7. Description (draft — edit to taste)

```
Phoebus turns any web page into a language-learning companion.

• Double-click any word — the floating tooltip shows the meaning of the
  word *as used in that sentence* (not a generic dictionary entry), the
  translation, part of speech, and a natural example sentence in your
  target language.

• Select a phrase or sentence — a small toolbar appears above the
  selection with two actions:
  – Translate: full-sentence translation with natural phrasing, plus
    short notes for idioms, slang, or cultural references.
  – Highlight: wraps the selection in a hand-drawn marker style that
    persists across page reloads. Click a highlight to adjust its range
    or remove it.

• Configurable source / target languages. Default English →
  Traditional Chinese; change it in the extension preferences.

• Bring your own Google Gemini API key — free tier is plenty for daily
  use. Get one at https://aistudio.google.com/apikey and paste it in
  the extension's preferences page.

• Everything runs locally: there is no server, no analytics, no
  tracking. Your API key and highlights live only on your device.
  Translated text goes directly from your browser to Google Gemini
  over HTTPS.

Open source under the MIT license. Source, issues, and roadmap:
https://github.com/jeffoodchain/phoebus
```

### 8. Reviewer notes

Reviewers need to test the translation feature, which requires a key.
Either:

- **Option A (preferred)** — tell them to get a free key at
  https://aistudio.google.com/apikey (takes 30 seconds with a Google
  account). Paste this sentence in the *Notes to reviewer* field:
  > "Translation features require a free Google Gemini API key. Get one
  > at https://aistudio.google.com/apikey, paste into the extension's
  > Preferences page, then double-click any word or select a phrase on
  > any page."

- **Option B** — paste a temporary key in the Notes field (AMO reviewer
  notes are private). Revoke it after approval.

### 9. Screenshots to capture

Take 1280×800 PNGs of:

1. A word tooltip on an English article (shows translation + POS +
   example).
2. The selection toolbar above a highlighted phrase.
3. A phrase translation tooltip with a full sentence.
4. The highlight marker stroke over a paragraph.
5. The Preferences page with the API key / language fields.

Edit the screenshots to blur any personal info before uploading.

### 10. Submit and wait

Public listing review usually takes 1–7 days for a small, clean add-on.
If the reviewer finds issues, AMO emails you — fix, bump version in
`manifest.json` + `package.json` + git tag, and re-run `npm run sign`.

---

## Subsequent releases

1. Bump `version` in `manifest.json` and `package.json` (keep them equal).
2. Commit, tag `vX.Y.Z`, push.
3. `npm run sign` → AMO validates + publishes the update automatically
   (public listings still go through review on each version).
4. Draft a GitHub release with notes.
