# CutThrough

CutThrough is a compact Chrome extension companion for desktop YouTube watch pages. It stays first beside the video and combines transcript navigation, embedded transcript-grounded ChatGPT, and a conservative jump cutter.

> Production release candidate. Automated validation passes; live unpacked-Chrome verification is the remaining release gate. See [`docs/STATUS.md`](docs/STATUS.md).

## MVP boundaries

- Available YouTube caption tracks only; no invented transcript or no-caption speech-to-text.
- Embedded ChatGPT sends bounded transcript context to OpenAI only after **Ask** or **Send**; external ChatGPT opening remains separate and content-free.
- The transcript-gap jump cutter is experimental, conservative, and disabled by default.
- No CutThrough backend, account, tracking, analytics, semantic skipping, Shorts, live streams, or mobile support.

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

The panel loads available YouTube captions automatically. Click a row to seek, then click the transcript **Ask** button to prime the embedded chat with bounded timestamped context. Add your OpenAI API key in CutThrough settings before chatting. **Open ChatGPT** opens a normal external tab without transferring content. Enable the experimental caption-gap cutter under **Jump Cut** only when wanted.

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

CutThrough does not persist transcripts or conversations locally. The OpenAI API key stays in local extension storage. CutThrough sends no analytics and has no backend. Bounded transcript context reaches OpenAI only after explicit **Ask** or **Send** actions. Multi-turn response state uses `store: true`; OpenAI documents at least 30 days of Responses API application-state retention by default. API usage can incur charges on the key's account. See [OpenAI API data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint).
