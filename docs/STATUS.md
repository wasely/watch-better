# Status

Updated: 2026-08-10

## Current state

**Automated release candidate.** Watch Better's initial product includes Transcript
and Ask. Jump Cut remains in source but is feature-gated out. Ask embeds ChatGPT
and Gemini; DeepSeek uses its normal full tab because its security challenge blocks
embedded pages. No model API or provider credential collection is used. A live
unpacked-extension smoke test remains the release gate.

## Implemented

- Renamed every user-facing product label to Watch Better while preserving stable
  package, repository, file, and storage identifiers.
- Added compact ChatGPT/Gemini/DeepSeek selection and provider readiness states.
  Each provider owns its composer, conversation history, and new-chat UI.
- Keeps each ChatGPT/Gemini iframe mounted after first use across panel tabs, collapse,
  provider switching, and YouTube video changes.
- Adds a focused AI overlay for the active session: the expand control opens a larger,
  background-blurring workspace; Escape or the close control returns to the panel without
  remounting the provider frame or losing that session.
- Starts both embedded provider frames when Watch Better opens, so ChatGPT and Gemini
  are ready before either provider is selected. It also opens or reuses a background
  DeepSeek tab on supported YouTube pages without moving focus or sending transcript data.
- Embeds ChatGPT/Gemini and routes messages to the exact verified frame. DeepSeek
  routes only to its normal full tab. Provider login remains in the browser; Watch Better does not read cookies,
  tokens, passwords, or API keys.
- Uses a tab- and provider-scoped session rule only for verified ChatGPT/Gemini frames,
  preserves it across provider navigation, and removes it when the YouTube tab
  closes, leaves the supported page, or resets; top-level pages are unchanged.
- Uses one-use frame session bindings plus direct-child `webNavigation`
  verification before routing provider status or prompt messages.
- Sends bounded transcript context only after **Send to AI**. Opening Ask and
  switching providers send nothing. Follow-ups use the provider composer.
- Retains transcript navigation, search, selection, seek, and SPA lifecycle handling.
- Supports desktop YouTube Shorts: active-reel playback, sizing, transcript loading,
  and a normal-flow details-panel mount all share the Short video ID.
- Keeps the panel height stable when YouTube shrinks its player during page scrolling.
- Keeps the panel content fixed in its normal page position while scrolling instead of
  adding player-to-masthead overlap as top padding.
- Uses a branded collapsed launcher and persistently visible, centered transcript selectors.
- Adds a responsive Settings page with consistent spacing and a working Chrome
  **Manage extension** action.
- Retains Jump Cut source and tests for later development without exposing or
  running it in the initial product.
- Keeps memory-only transcript handling by default, with bounded session caching as
  an explicit opt-in.

## Validation results

- Canonical validation passed: Prettier, ESLint, strict TypeScript, 27 Vitest
  files / 119 tests, coverage, and WXT production build.
- Coverage: 61.09% statements, 57.80% branches, 66.38% functions, 63.76% lines.
- Build: `.output/chrome-mv3/`, 597.38 kB.
- Package: `.output/watchbetter-0.1.0-chrome.zip`, 229.94 kB reported by WXT.
- Built manifest: `storage`, scoped `declarativeNetRequest`, direct-frame
  `webNavigation`, and exact YouTube, ChatGPT, Gemini, and DeepSeek hosts.
- Browser harness: Settings inspected at desktop and narrow widths with zero
  horizontal overflow; DeepSeek full-tab state inspected in the 402px panel.
- Production audit tests reject provider API endpoints, cookie access, credential
  handling, broad host access, and excess permissions.

## Remaining release gate

- Reload `.output/chrome-mv3/` in `chrome://extensions`.
- Sign in at ChatGPT, Gemini, and DeepSeek, then verify embedded ChatGPT/Gemini,
  full-tab DeepSeek, provider switch, first Ask, follow-up, and new-chat behavior.
- Verify caption fetch, selection Ask, seek, SPA navigation, theater/fullscreen,
  popup restore, and console cleanliness on live YouTube.
- Provider DOM can change; failures remain explicit and retryable.

## Known product limits

- Requires usable YouTube captions; no speech-to-text fallback.
- ChatGPT/Gemini embedding depends on each site's frame behavior, rendered UI, and
  active user session. DeepSeek intentionally uses a normal tab.
- Jump Cut remains source-only and is not part of the initial product.
- No live streams, mobile, backend, account, sync, analytics, or model API.

## Shorts verification

- Automated route, mount, active-video, sizing, runtime, and transcript tests pass.
- Harness screenshots were visually inspected at 320px dark and 480px light panel widths.
- A live Short smoke test remains part of the unpacked-extension release gate.

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
