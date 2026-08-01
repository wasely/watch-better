# Status

Updated: 2026-08-01

## Current state

**Automated release candidate.** WatchBetter's initial product includes Transcript
and Ask. Jump Cut remains in source but is feature-gated out. Ask displays the real ChatGPT or Gemini webpage inside the
YouTube panel; it does not use a model API or collect provider credentials. A live
unpacked-extension smoke test remains the release gate.

## Implemented

- Renamed the product, package, UI, storage keys, docs, and build archive to
  WatchBetter.
- Added compact ChatGPT/Gemini selection and provider readiness states. The
  embedded provider owns its composer, conversation history, and new-chat UI.
- Keeps each provider iframe mounted after first use across panel tabs, collapse,
  provider switching, and YouTube video changes.
- Embeds the selected official provider page and routes messages to its exact frame
  ID. Provider login remains in the browser; WatchBetter does not read cookies,
  tokens, passwords, or API keys.
- Uses a tab- and provider-scoped session rule for the verified provider frame,
  preserves it across provider navigation, and removes it when the YouTube tab
  closes, leaves the supported page, or resets; top-level pages are unchanged.
- Uses one-use frame session bindings plus direct-child `webNavigation`
  verification before routing provider status or prompt messages.
- Sends bounded transcript context only after **Send to AI**. Opening Ask and
  switching providers send nothing. Follow-ups use the provider composer.
- Retains transcript navigation, search, selection, seek, and SPA lifecycle handling.
- Retains Jump Cut source and tests for later development without exposing or
  running it in the initial product.
- Keeps memory-only transcript handling by default, with bounded session caching as
  an explicit opt-in.

## Validation results

- Canonical validation passed: Prettier, ESLint, strict TypeScript, 26 Vitest
  files / 107 tests, and WXT production build.
- Build: `.output/chrome-mv3/`, 588.74 kB.
- Package: `.output/watchbetter-0.1.0-chrome.zip`, 228.31 kB reported by WXT.
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
- Verify caption fetch, selection Ask, seek, SPA navigation, theater/fullscreen,
  popup restore, and console cleanliness on live YouTube.
- Provider DOM can change; failures remain explicit and retryable.

## Known product limits

- Requires usable YouTube captions; no speech-to-text fallback.
- ChatGPT/Gemini embedding depends on their frame behavior, rendered UI, and active
  user session. Some sign-in flows require the normal-tab fallback.
- Jump Cut remains source-only and is not part of the initial product.
- No Shorts, live streams, mobile, backend, account, sync, analytics, or model API.

## Exact commands

```bash
npm run format
npm run validate
npm run test:coverage
npm run zip
```

## Repository status

Public launch documentation, CI, privacy policy, security reporting, contribution
guidance, and issue templates are included. The live unpacked-extension smoke test
remains the release gate.
