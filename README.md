# Watch Better

[![CI](https://github.com/wasely/watch-better/actions/workflows/ci.yml/badge.svg)](https://github.com/wasely/watch-better/actions/workflows/ci.yml)

<p align="center">
  <img src="docs/assets/watchbetter-logo.png" alt="Watch Better logo" width="180" />
</p>

Watch Better is a Chrome extension for desktop YouTube watch pages. It adds a
compact transcript navigator and transcript-grounded Ask panel beside the video.

## Features

- Copy every available YouTube caption from the transcript toolbar—no speech-to-text wait.
- Search, select, copy, and seek through timestamped caption rows.
- Ask ChatGPT, Google Gemini, or DeepSeek about bounded timestamped transcript context.
- Use ChatGPT and Gemini inside Watch Better, or DeepSeek in its normal full tab—no API key.
- Use each provider's own composer, conversation history, and new-chat controls.
- Keep loaded ChatGPT and Gemini frames alive across panel tabs, collapse, and
  YouTube video changes so returning to either prepared provider is instant.
- Light/dark themes, keyboard navigation, responsive panel layouts, and a compact
  collapsed launcher.

## How Ask works

1. In Watch Better's **Ask** tab, choose ChatGPT, Gemini, or DeepSeek. Opening Ask sends nothing.
2. Watch Better loads ChatGPT or Gemini directly inside Ask. DeepSeek opens in a
   normal full tab because its security challenge blocks embedded pages.
3. Sign in on the provider's official site. For ChatGPT or Gemini, use the
   external-tab button if embedded sign-in is refused, then return to YouTube.
4. In **Transcript**, optionally select rows, then choose **Send to AI**. This is the
   only action that transfers transcript content; with no selection, it sends the
   full bounded transcript.
5. Ask follow-up questions with the provider's own composer. ChatGPT and Gemini
   stay inside Watch Better; DeepSeek stays in its full tab.

Watch Better never reads browser cookies or tokens, stores an API key, calls a model
API, or sends analytics. To show ChatGPT and Gemini inside YouTube, Watch Better
creates a tab- and provider-scoped Chrome session rule immediately before loading a
verified frame, keeps it only while that YouTube tab needs the provider, and removes
it when the tab closes or leaves YouTube. It does not
modify top-level pages, other sites, or account data. Provider interfaces can change
without notice, so their adapters may need updates.

## Requirements

- Desktop Chrome or another Chromium browser supporting Manifest V3
- Node.js 22+
- npm 10+
- A signed-in ChatGPT, Google, and/or DeepSeek account for provider use

## Install for development

```bash
npm ci
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load
unpacked**, and select `.output/chrome-mv3/`.

Open a normal `youtube.com/watch?v=…` page. Watch Better uses captions exposed by
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
| `declarativeNetRequest` | Permit one prepared provider subframe in the current YouTube tab while it is needed.   |
| `webNavigation`         | Verify a registered provider is the panel's direct child frame before routing prompts. |
| `youtube.com`           | Mount the panel and read captions exposed on the current watch page.                   |
| `chatgpt.com`           | Detect the signed-in composer, send an explicit prompt, and read the resulting answer. |
| `gemini.google.com`     | Detect the signed-in composer, send an explicit prompt, and read the resulting answer. |
| `chat.deepseek.com`     | Detect the signed-in composer, send an explicit prompt, and read the resulting answer. |

No broad host match, cookie permission, scripting permission, top-level header
rewrite, browsing-data access, or remote executable code is included.

## Privacy

Transcripts and conversations are not persisted by default. The optional browser
session cache is bounded and cleared with the browser session. Transcript context
is sent only after an explicit Ask action, to the provider selected by the user.
ChatGPT, Gemini, and DeepSeek then apply their own account, retention, and usage policies.
See the full [privacy policy](PRIVACY.md) and [security policy](SECURITY.md).

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
- Provider web UI automation can require maintenance after provider changes.
- Some authentication flows refuse third-party frames; the full-tab sign-in fallback
  remains available.
- Jump Cut source is retained for later development but feature-gated out of the
  initial product.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Public launch preparation and the remaining
live release gate are tracked in [docs/CHROME_WEB_STORE.md](docs/CHROME_WEB_STORE.md).

## License

Watch Better is available under the [MIT License](LICENSE).
