# Watch Better

[![CI](https://github.com/wasely/watch-better/actions/workflows/ci.yml/badge.svg)](https://github.com/wasely/watch-better/actions/workflows/ci.yml)

<p align="center">
  <img src="docs/assets/watchbetter-logo.png" alt="Watch Better logo" width="160" />
</p>

Watch Better is a Chrome extension for navigating YouTube transcripts and asking
ChatGPT, Gemini, or DeepSeek questions using timestamped video context.

## Watch the demos

| Transcript workflow                                                                                                                   | Ask workflow                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [![Play the Watch Better transcript demo](docs/assets/screenshots/transcript-panel-dark.webp)](docs/assets/demos/transcript-demo.mp4) | [![Play the Watch Better Ask demo](docs/assets/screenshots/ask-panel-light.webp)](docs/assets/demos/ask-demo.mp4) |
| [Play transcript demo (MP4)](docs/assets/demos/transcript-demo.mp4)                                                                   | [Play Ask demo (MP4)](docs/assets/demos/ask-demo.mp4)                                                             |

### Gemini inside Watch Better

| Full panel                                                                                       | YouTube context                                                                                |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| ![Gemini inside the dark Watch Better Ask panel](docs/assets/screenshots/gemini-panel-dark.webp) | ![Gemini panel beside a YouTube video](docs/assets/screenshots/gemini-panel-dark-context.webp) |

## Features

- Load every caption track exposed by the current YouTube video.
- Search timestamped rows and jump directly to matching moments.
- Select specific transcript lines or use the bounded full transcript.
- Copy captions or send context only after an explicit action.
- Use ChatGPT and Gemini inside the panel with your signed-in sessions.
- Open DeepSeek in a normal tab because its security challenge blocks embedded pages.
- Switch between light and dark themes, resize the panel, or collapse it to a launcher.
- Configure transcript behavior, default tab, caching, and appearance from one settings page.

## How Ask works

1. Open **Ask** and choose ChatGPT, Gemini, or DeepSeek. Nothing is sent yet.
2. Sign in on the provider's official website if needed.
3. In **Transcript**, optionally select the rows you want to reference.
4. Choose **Send to AI**. With no selection, Watch Better sends the bounded transcript.
5. Continue the conversation using the provider's own interface.

ChatGPT and Gemini run inside Watch Better. DeepSeek opens in a full tab. Provider
interfaces can change without notice, so their adapters may occasionally need updates.

## Install in Chrome

No programming or developer tools required.

1. Open the [latest Watch Better release](https://github.com/wasely/watch-better/releases/latest).
2. Download `watchbetter-0.1.0-chrome.zip`.
3. Extract the ZIP to a folder you will keep.
4. In Chrome, open `chrome://extensions`.
5. Turn on **Developer mode** in the top-right corner.
6. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
7. Pin **Watch Better**, then open a YouTube video with captions.

Chrome may remove the extension if you delete or move the extracted folder. Keep that
folder in place after installation.

### Build from source

Requires Node.js 22+ and npm 10+.

```bash
npm ci
npm run build
```

Load `.output/chrome-mv3/` from `chrome://extensions`.

To create a distributable archive:

```bash
npm run zip
```

The ZIP is written to `.output/watchbetter-0.1.0-chrome.zip`.

## Development

```bash
npm run dev
npm run dev:harness
npm run validate
```

`npm run validate` checks formatting, lint, TypeScript, all tests, and the
production extension build.

## Permissions

| Permission or host      | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `storage`               | Save settings, optional session transcripts, and embedded-frame routing IDs.       |
| `declarativeNetRequest` | Permit one prepared provider subframe in the current YouTube tab while needed.     |
| `webNavigation`         | Verify the registered provider is the panel's direct child before routing prompts. |
| `youtube.com`           | Mount Watch Better and read captions exposed by the current watch page.            |
| `chatgpt.com`           | Use the signed-in composer after an explicit send action.                          |
| `gemini.google.com`     | Use the signed-in composer after an explicit send action.                          |
| `chat.deepseek.com`     | Use the signed-in composer in a full tab after an explicit send action.            |

Watch Better has no cookie, browsing-data, broad host, or remote-code permission.

## Privacy

Watch Better stores no API keys and sends no analytics. Transcripts and conversations
are not persisted by default. The optional browser-session transcript cache is bounded
and cleared with the browser session. Transcript context is transferred only after you
choose **Send to AI**; the selected provider then applies its own account, retention,
and usage policies.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Project map

- `src/entrypoints/` — YouTube, background, popup, options, and provider entry points
- `src/features/` — transcript, Ask, settings, and feature-domain UI
- `src/services/web-chat*.ts` — provider allowlist and web-session adapters
- `harness/` — isolated UI scenarios for testing and visual review
- `docs/` — architecture, decisions, risks, release notes, and test documentation
- `design-system/watchbetter/` — visual system source of truth

## Current limits

- Desktop YouTube watch pages only; no Shorts, live streams, or mobile support.
- Uses available caption tracks only; there is no speech-to-text fallback.
- Provider web interfaces and embedded sign-in rules can change.
- Jump Cut code is retained for later development but disabled in the current product.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Chrome Web Store preparation is tracked in
[docs/CHROME_WEB_STORE.md](docs/CHROME_WEB_STORE.md).

## License

Watch Better is available under the [MIT License](LICENSE).
