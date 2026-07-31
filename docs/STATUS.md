# Status

Updated: 2026-07-31

## Current state

**Automated release candidate.** WatchBetter's transcript, Ask, and Jump Cut flows
are implemented. Ask now uses the user's signed-in ChatGPT or Gemini web session;
it does not use a model API or collect provider credentials. A live unpacked-extension
smoke test remains the release gate.

## Implemented

- Renamed the product, package, UI, storage keys, docs, and build archive to
  WatchBetter.
- Added ChatGPT/Gemini selection, provider readiness states, new-chat/follow-up
  handling, and rendered-answer return to the YouTube panel.
- Reuses or opens the provider's official browser tab. Provider login remains in the
  browser; WatchBetter does not read cookies, tokens, passwords, or API keys.
- Sends a bounded transcript prompt only after the user submits an Ask request.
- Retains transcript navigation, search, selection, seek, SPA lifecycle handling,
  and conservative transcript-gap Jump Cut.
- Keeps memory-only transcript handling by default, with bounded session caching as
  an explicit opt-in.

## Validation results

- Canonical validation passed: Prettier, ESLint, strict TypeScript, 23 Vitest files /
  97 tests, and WXT production build.
- Coverage: 63.60% statements / 66.68% lines overall; YouTube adapters 82.12%
  statements / 90.10% lines; Ask 89.83% statements / 96.15% lines.
- Build: `.output/chrome-mv3/`, 531.06 kB.
- Package: `.output/watchbetter-0.1.0-chrome.zip`, 164.11 kB.
- Built manifest: only `storage` plus exact YouTube, ChatGPT, and Gemini hosts.
- Browser harness: dark Ask connected/disconnected states inspected at 402px and
  320px; no horizontal overflow or console errors.
- Production audit tests reject provider API endpoints, cookie access, credential
  handling, broad host access, and excess permissions.

## Remaining release gate

- Reload `.output/chrome-mv3/` in `chrome://extensions`.
- Sign in at ChatGPT and Gemini, then verify first Ask, follow-up, provider switch,
  and new-chat behavior against their live sites.
- Verify caption fetch, selection Ask, seek, Jump Cut, SPA navigation, theater/fullscreen,
  popup restore, and console cleanliness on live YouTube.
- Provider DOM can change; failures remain explicit and retryable.

## Known product limits

- Requires usable YouTube captions; no speech-to-text fallback.
- ChatGPT/Gemini automation depends on their rendered web UI and active user session.
- Caption gaps approximate silence and can miss or clip content; Jump Cut remains
  experimental and disabled by default.
- No Shorts, live streams, mobile, backend, account, sync, analytics, or model API.

## Exact commands

```bash
npm run format
npm run validate
npm run test:coverage
npm run zip
```

## Commit status

Prepared for branch `feat/watchbetter-web-chat`.
