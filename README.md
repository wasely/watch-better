# WatchBetter

WatchBetter is a Chrome extension for desktop YouTube watch pages. It adds a
compact transcript navigator, transcript-grounded Ask panel, and optional
caption-gap jump cutter beside the video.

## Features

- Search, select, copy, and seek through available YouTube captions.
- Ask ChatGPT or Google Gemini about bounded timestamped transcript context.
- Use the AI provider account already signed in through the browser—no API key.
- Keep multi-turn answers in WatchBetter while the matching provider tab performs
  the request.
- Speed through or jump long caption gaps with conservative controls that are off
  by default.
- Light/dark themes, keyboard navigation, responsive panel layouts, and a compact
  collapsed launcher.

## How Ask works

1. In WatchBetter's **Ask** tab, choose ChatGPT or Gemini.
2. Select **Open ChatGPT** or **Open Gemini** and sign in on the official site.
3. Return to YouTube. WatchBetter detects the ready web session.
4. Send a question. The first turn includes bounded timestamped transcript
   context; later turns continue in the same provider chat.
5. WatchBetter reads the rendered answer from that provider tab and displays it in
   the Ask panel.

WatchBetter never reads browser cookies or tokens, stores an API key, calls a model
API, strips iframe security headers, or sends analytics. Provider websites can
change their interface without notice, so their DOM adapters may occasionally need
updates.

## Requirements

- Desktop Chrome or another Chromium browser supporting Manifest V3
- Node.js 22+
- npm 10+
- A ChatGPT and/or Google account for signed-in provider use

## Install for development

```bash
npm ci
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load
unpacked**, and select `.output/chrome-mv3/`.

Open a normal `youtube.com/watch?v=…` page. WatchBetter uses captions exposed by
that video; it does not invent a transcript when captions are unavailable.

## Development

```bash
npm run dev
npm run dev:harness
npm run validate
npm run zip
```

`npm run validate` checks formatting, lint, types, tests, and the production build.
Generated browser output and archives are under `.output/`.

## Permissions

| Permission or host  | Purpose                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| `storage`           | Save user settings and an optional session-only transcript cache.                      |
| `youtube.com`       | Mount the panel and read captions exposed on the current watch page.                   |
| `chatgpt.com`       | Detect the signed-in composer, send an explicit prompt, and read the resulting answer. |
| `gemini.google.com` | Detect the signed-in composer, send an explicit prompt, and read the resulting answer. |

No broad host match, cookie permission, scripting permission, header-rewrite rule,
or remote executable code is included.

## Privacy

Transcripts and conversations are not persisted by default. The optional browser
session cache is bounded and cleared with the browser session. Transcript context
is sent only after an explicit Ask action, to the provider selected by the user.
ChatGPT and Gemini then apply their own account, retention, and usage policies.

## Project map

- `src/entrypoints/` — YouTube, background, popup, options, and provider-tab roots
- `src/features/` — transcript, Ask, settings, and jump-cutter UI/domain code
- `src/services/web-chat*.ts` — provider allowlist and DOM-session adapter
- `docs/` — product requirements, architecture, decisions, status, risks, tests
- `harness/` — isolated UI scenarios
- `design-system/watchbetter/` — project UI source of truth

## Current limits

- Desktop YouTube watch pages only; no Shorts, live streams, or mobile support.
- Available caption tracks only; no speech-to-text fallback.
- ChatGPT/Gemini web UI automation can require maintenance after provider changes.
- The provider tab must remain open during a request.
- Jump Cut is experimental and disabled by default.
