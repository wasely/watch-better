# WatchBetter

WatchBetter is a Chrome extension for desktop YouTube watch pages. It adds a
compact transcript navigator, transcript-grounded Ask panel, and optional
caption-gap jump cutter beside the video.

## Features

- Instantly copy every available YouTube caption with **Get Captions**—no speech-to-text wait.
- Search, select, copy, and seek through timestamped caption rows.
- Ask ChatGPT or Google Gemini about bounded timestamped transcript context.
- Use ChatGPT or Gemini as a live embedded webpage inside WatchBetter—no API key.
- Use each provider's own composer, conversation history, and new-chat controls.
- Speed through or jump long caption gaps with conservative controls that are off
  by default.
- Light/dark themes, keyboard navigation, responsive panel layouts, and a compact
  collapsed launcher.

## How Ask works

1. In WatchBetter's **Ask** tab, choose ChatGPT or Gemini.
2. WatchBetter loads the provider's real website directly inside the Ask tab.
3. If embedded sign-in is refused, use the external-tab button, sign in normally,
   and return to YouTube.
4. Clicking **Ask** from the transcript primes that exact embedded frame with
   bounded timestamped context.
5. Ask follow-up questions with the provider's own composer. Its normal
   conversation and new-chat controls stay inside WatchBetter.

WatchBetter never reads browser cookies or tokens, stores an API key, calls a model
API, or sends analytics. To show the two official sites inside YouTube, one static
Chrome rule removes anti-frame headers only from ChatGPT/Gemini subframes initiated
by YouTube. It does not modify top-level pages, other sites, requests, or account
data. Provider interfaces can change without notice, so their adapters may need
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

| Permission or host      | Purpose                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `storage`               | Save settings, optional session transcripts, and embedded-frame routing IDs.           |
| `declarativeNetRequest` | Permit only the scoped ChatGPT/Gemini subframe header rule needed for embedding.       |
| `webNavigation`         | Verify a registered provider is the panel's direct child frame before routing prompts. |
| `youtube.com`           | Mount the panel and read captions exposed on the current watch page.                   |
| `chatgpt.com`           | Detect the signed-in composer, send an explicit prompt, and read the resulting answer. |
| `gemini.google.com`     | Detect the signed-in composer, send an explicit prompt, and read the resulting answer. |

No broad host match, cookie permission, scripting permission, top-level header
rewrite, browsing-data access, or remote executable code is included.

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
- Some authentication flows refuse third-party frames; the full-tab sign-in fallback
  remains available.
- Jump Cut is experimental and disabled by default.
