# CutThrough

CutThrough is a compact Chrome extension companion for desktop YouTube watch pages. It mounts beside the video and combines transcript navigation, transcript-aware ChatGPT handoff, and conservative pause compression.

> Production release candidate. Automated validation passes; live unpacked-Chrome verification is the remaining release gate. See [`docs/STATUS.md`](docs/STATUS.md).

## MVP boundaries

- Available YouTube caption tracks only; no invented transcript or no-caption speech-to-text.
- ChatGPT handoff copies a prompt and opens ChatGPT only through explicit actions; it never automates or reads ChatGPT.
- Pause compression is experimental, conservative, and disabled by default.
- No backend, account, tracking, analytics, API key, semantic skipping, Shorts, live streams, or mobile support.

## Requirements

- Chrome desktop
- Node.js 22+ (Node 24 is used during development)
- npm 11+

## Install dependencies

```bash
npm ci
```

Use `npm install` only when intentionally changing dependencies.

## Develop

```bash
npm run dev
```

WXT prints the development output/browser instructions. For the isolated UI harness:

```bash
npm run dev:harness
```

## Validate

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

## Load the unpacked extension

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Choose `.output/chrome-mv3/` in this repository.
6. Open a normal desktop `youtube.com/watch?v=…` page.

The panel loads available YouTube captions automatically. Click a transcript row to seek, select rows to build a grounded prompt, use **Copy prompt** and **Open ChatGPT** as separate actions, or explicitly enable conservative pause compression under **Skip**. The extension never sends transcript text to ChatGPT.

Development output from `npm run dev` is under `.output/chrome-mv3-dev/` when WXT uses its normal Chromium convention.

## Package

```bash
npm run zip
```

The archive is generated under `.output/`. This project does not publish or push automatically.

## Repository map

- `src/entrypoints/` — WXT content/background/popup/options composition roots
- `src/` — product domain, features, adapters, services, storage, messaging, styles, tests
- `docs/` — product, architecture, decisions, checklist, test matrix, status, risks
- `references/` — supplied visual references
- `artifacts/ui/` — useful inspected harness screenshots

## Documentation

Start with:

1. [`docs/STATUS.md`](docs/STATUS.md)
2. [`docs/MVP_CHECKLIST.md`](docs/MVP_CHECKLIST.md)
3. [`docs/DECISIONS.md`](docs/DECISIONS.md)
4. [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
5. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Privacy

Transcripts and generated prompts remain in memory by default. CutThrough sends no analytics and has no backend. Clipboard and ChatGPT-opening actions require an explicit user gesture.
