# Status

Updated: 2026-07-30

## Current state

**Production release candidate.** The transcript receiver, first-position mount, native embedded chat, Transcript Ask flow, and built-in Jump Cut UI are implemented. Automated hardening, build, and package pass. Reloading the unpacked extension and completing the updated live YouTube/API smoke test is the remaining release gate.

## Implemented

- One normal-flow WXT Shadow Root host with right-rail, below-video, theater, fullscreen, collapse, popup restore, and no-duplicate lifecycle handling.
- Typed YouTube SPA generations, stale-load aborts, cleanup, and replacement-safe HTML video control.
- Real caption discovery from matching player bootstrap or credentialed watch HTML; JSON3/XML timed-text normalization, track choice, search, selection, active row, and seek.
- Bound transcript-grounded ChatGPT through OpenAI's Responses API, multi-turn response chaining, explicit Transcript Ask priming, local key configuration, and content-free external open.
- Conservative built-in transcript-gap jump cutting with ad/timing guards, one-jump protection, approximate savings, and rate restoration. Disabled by default.
- Persisted validated settings; three-entry bounded transcript cache, memory-only by default and session-only by explicit opt-in.
- Strict message allowlists, service-worker-only API credentials, no production fixtures/analytics/backend, explicit bounded transcript sends, and no ChatGPT page automation.

## Validation results

- `npm ci`: 382 packages installed from lockfile; 0 vulnerabilities.
- Canonical validation: Prettier, ESLint, strict TypeScript, 23 Vitest files / 93 tests, and WXT production build passed.
- Coverage: 67.74% statements / 71.06% lines overall; YouTube adapters 80.00% statements / 86.92% lines; Ask 89.73% statements / 95.93% lines.
- Build: `.output/chrome-mv3/`, 540.81 kB.
- Package: `.output/cutthrough-0.1.0-chrome.zip`, 167.04 kB.
- Built manifest: only `storage`, `https://www.youtube.com/*`, and `https://api.openai.com/*`.
- Production audit: no fixture imports/markers, prompt-bearing external-open message, iframe/security bypass, hidden send, or excess permission.
- Browser harness: inspected dark 320px Transcript and Ask states; both fit at 319px client/scroll width with no horizontal overflow.
- Existing full visual/accessibility matrix remains passing: Axe, keyboard/focus, reduced motion, high DPI, 200% zoom, dark/light, narrow/wide, popup, and options.

## Remaining release gate

- Reload `.output/chrome-mv3/` in `chrome://extensions`, then verify first-position mount, caption fetch, Transcript Ask priming, configured API answer/follow-up, Jump Cut, seek, SPA navigation/video replacement, theater/fullscreen, ad suspension, popup restore, external ChatGPT opening, and console cleanliness.
- Chrome internal pages cannot be automated by the connected browser session. No live-production claim is made until this is completed.

## Known product limits

- YouTube's internal caption endpoints and DOM can change; failures stay explicit and retryable.
- Caption gaps approximate silence and can miss/clip content despite padding. Feature remains experimental and off by default.
- Videos without usable YouTube captions show an unavailable state; no speech-to-text fallback.
- Embedded chat requires a user-supplied OpenAI API key; explicit chats follow the user's OpenAI API data controls.
- No Shorts, live streams, mobile, semantic skipping, ChatGPT page automation, CutThrough backend, account, sync, or analytics.

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
