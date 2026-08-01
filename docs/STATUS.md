# Status

Updated: 2026-07-31

## Current state

**Automated release candidate.** WatchBetter's transcript, Ask, and Jump Cut flows
are implemented. Ask now displays the real ChatGPT or Gemini webpage inside the
YouTube panel; it does not use a model API or collect provider credentials. A live
unpacked-extension smoke test remains the release gate.

## Implemented

- Renamed the product, package, UI, storage keys, docs, and build archive to
  WatchBetter.
- Added compact ChatGPT/Gemini selection and provider readiness states. The
  embedded provider owns its composer, conversation history, and new-chat UI.
- Embeds the selected official provider page and routes messages to its exact frame
  ID. Provider login remains in the browser; WatchBetter does not read cookies,
  tokens, passwords, or API keys.
- Uses a static YouTube-initiated subframe rule for the two provider hosts only;
  top-level pages and unrelated frames are unchanged.
- Uses one-use frame session bindings plus direct-child `webNavigation`
  verification before routing provider status or prompt messages.
- Sends a bounded transcript prompt only after the user clicks Transcript Ask;
  follow-ups use the embedded provider's own composer.
- Retains transcript navigation, search, selection, seek, SPA lifecycle handling,
  and conservative transcript-gap Jump Cut.
- Keeps memory-only transcript handling by default, with bounded session caching as
  an explicit opt-in.

## Validation results

- Canonical validation passed: Prettier, ESLint, strict TypeScript, 23 Vitest files /
  99 tests, and WXT production build.
- Coverage: 62.37% statements / 65.34% lines overall; YouTube adapters 82.12%
  statements / 90.10% lines; Ask 90.12% statements / 98% lines.
- Build: `.output/chrome-mv3/`, 529.6 kB.
- Package: `.output/watchbetter-0.1.0-chrome.zip`, 164.65 kB.
- Built manifest: `storage`, scoped `declarativeNetRequest`, direct-frame
  `webNavigation`, and exact YouTube, ChatGPT, and Gemini hosts.
- Browser harness: real ChatGPT frame inspected at dark 320px and light 480px;
  success/loading/error states inspected; measured zero horizontal overflow.
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
- ChatGPT/Gemini embedding depends on their frame behavior, rendered UI, and active
  user session. Some sign-in flows require the normal-tab fallback.
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
