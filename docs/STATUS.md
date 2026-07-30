# Status

Updated: 2026-07-30

## Current state

**Production release candidate.** The production runtime, automated hardening, clean install, build, and package pass. Loading the unpacked build in Chrome and completing the live YouTube matrix is the only remaining release gate.

## Implemented

- One normal-flow WXT Shadow Root host with right-rail, below-video, theater, fullscreen, collapse, popup restore, and no-duplicate lifecycle handling.
- Typed YouTube SPA generations, stale-load aborts, cleanup, and replacement-safe HTML video control.
- Real caption discovery from matching player bootstrap or credentialed watch HTML; JSON3/XML timed-text normalization, track choice, search, selection, active row, and seek.
- Deterministic bounded ChatGPT prompt creation; explicit copy and content-free open actions only.
- Conservative padded transcript-gap compression with ad/timing guards, one-jump protection, approximate savings, and rate restoration. Disabled by default.
- Persisted validated settings; three-entry bounded transcript cache, memory-only by default and session-only by explicit opt-in.
- Strict message allowlists, no production fixtures, no analytics/backend/secrets, and no hidden transcript/prompt transmission.

## Validation results

- `npm ci`: 382 packages installed from lockfile; 0 vulnerabilities.
- Canonical validation: Prettier, ESLint, strict TypeScript, 21 Vitest files / 86 tests, and WXT production build passed.
- Coverage: 68.03% statements / 71.29% lines overall; YouTube adapters 79.66% statements / 86.71% lines; transcript 87.30% statements / 91.01% lines.
- Build: `.output/chrome-mv3/`, 515.61 kB.
- Package: `.output/cutthrough-0.1.0-chrome.zip`, 157.99 kB.
- Built manifest: only `storage` and `https://www.youtube.com/*`.
- Production audit: no fixture imports/markers, no prompt-bearing ChatGPT-open message, no Ask-network call, no excess permission.
- Browser harness: inspected dark 320px Transcript and Ask states; both fit at 319px client/scroll width with no horizontal overflow.
- Existing full visual/accessibility matrix remains passing: Axe, keyboard/focus, reduced motion, high DPI, 200% zoom, dark/light, narrow/wide, popup, and options.

## Remaining release gate

- Manually load `.output/chrome-mv3/` in `chrome://extensions`, then verify live YouTube mount, caption fetch, seek, SPA navigation/video replacement, theater/fullscreen, ad suspension, popup restore, ChatGPT tab opening, and console cleanliness.
- Chrome internal pages cannot be automated by the connected browser session. No live-production claim is made until this is completed.

## Known product limits

- YouTube's internal caption endpoints and DOM can change; failures stay explicit and retryable.
- Caption gaps approximate silence and can miss/clip content despite padding. Feature remains experimental and off by default.
- Videos without usable YouTube captions show an unavailable state; no speech-to-text fallback.
- No Shorts, live streams, mobile, semantic skipping, ChatGPT automation, backend, account, sync, or analytics.

## Exact commands

```bash
npm run format
npm run validate
npm run test:coverage
npm run zip
npm ci
```

## Commit status

This release candidate ships on branch `feat/cutthrough-mvp` with its validation evidence and package instructions.
