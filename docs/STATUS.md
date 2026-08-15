# Status

Updated: 2026-08-14

## Current state

**Private release candidate.** Watch Better's initial product includes Transcript
and Ask. Jump Cut remains in source but is feature-gated out. Ask embeds ChatGPT
and Gemini; both run inside the panel and Watch Better never opens a browser tab or
window on its own. No model API or provider credential collection is used. A clean-profile
Chrome smoke test passes; signed-in-provider checks in the daily profile remain the gate.

## Implemented

- Renamed every user-facing product label to Watch Better while preserving stable
  package, repository, file, and storage identifiers.
- Added compact ChatGPT/Gemini selection and provider readiness states.
  Each provider owns its composer, conversation history, and new-chat UI.
- Keeps each ChatGPT/Gemini iframe mounted after first use across panel tabs, collapse,
  provider switching, and YouTube video changes.
- Adds a focused AI overlay for the active session: the expand control opens a larger,
  background-blurring workspace; Escape or the close control returns to the panel without
  remounting the provider frame or losing that session.
- Starts both embedded provider frames when Watch Better opens, so ChatGPT and Gemini
  are ready before either provider is selected. No provider tab is ever opened.
- Embeds ChatGPT/Gemini and routes messages to the exact verified frame. Provider
  login remains in the browser; Watch Better does not read cookies, tokens,
  passwords, or API keys.
- Uses a tab- and provider-scoped session rule only for verified ChatGPT/Gemini frames,
  preserves it across provider navigation, and removes it when the YouTube tab
  closes or leaves YouTube; top-level pages are unchanged.
- Uses one-use frame session bindings plus direct-child `webNavigation`
  verification before routing provider status or prompt messages.
- Sends bounded transcript context only after **Send to AI**. Opening Ask and
  switching providers send nothing. Follow-ups use the provider composer.
- Retains transcript navigation, search, selection, seek, and SPA lifecycle handling.
- Supports desktop YouTube Shorts: active-reel playback, sizing, transcript loading,
  and a normal-flow details-panel mount all share the Short video ID.
- Resolves Short captions from matching active-page metadata, then YouTube's player
  response, then watch-page metadata; failed player requests fall through cleanly.
- Lets unavailable videos retry caption discovery without reloading the page.
- Detaches the exact mounted watch/Short runtime into a draggable card inside the
  current YouTube tab, preserving its transcript, provider iframe, and in-flight answer.
- Immediately creates a fresh normal rail runtime; later videos can be detached into
  additional independently movable cards.
- Pins every card to its original video and keys provider routing by tab, provider,
  and session. Closing removes only that card's frame routes.
- Detached timestamp actions open the pinned source separately instead of hijacking
  the video currently being browsed.
- Detached cards propagate their fixed host height through the Shadow DOM mount,
  keeping Transcript and the embedded AI workspace full-height like the sidebar.
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

- Canonical validation passed: Prettier, ESLint, strict TypeScript, 30 Vitest
  files / 155 tests, and WXT production build.
- Coverage: 67.88% statements, 62.47% branches, 69.85% functions, 70.96% lines.
- Build: `.output/chrome-mv3/`, 613.68 kB.
- Package: `.output/watchbetter-0.1.0-chrome.zip`, 234.89 kB reported by WXT.
- Package SHA-256: `267c3e72743f5e726202b6390bf0b73d7a428527a2da4757b02f53bc9596e875`.
- Built manifest: `storage`, scoped `declarativeNetRequest`, direct-frame
  `webNavigation`, and exact YouTube, ChatGPT, and Gemini hosts.
- Browser harness: Ask inspected at 320px dark and 480px light panel widths, and
  Settings at desktop width, with no clipping or horizontal overflow.
- Clean-profile Chrome: live YouTube captions loaded; the Gemini frame rendered;
  a detached Ask card kept a 418px × 452px provider frame; minimize, restore,
  maximize, two-video SPA persistence, two simultaneous cards, and close cleanup passed.
- Production audit tests reject provider API endpoints, cookie access, credential
  handling, broad host access, excess permissions, and any self-opened browser tab
  or window outside the two explicit user actions.
- `src/test/youtube-content-lifecycle.test.tsx` covers the previously untested
  content-script lifecycle: rail mount order, detach onto `<body>`, card survival
  across simulated SPA navigation, several independent cards, and no `tabs.create`.

## Remaining release gate

- Reload `C:\Code\watch-better\.output\chrome-mv3` in the daily Chrome profile.
- Sign in at ChatGPT and Gemini, then verify embedded frames, provider switch,
  first Ask, follow-up, and new-chat behavior.
- Verify caption fetch, selection Ask, seek, SPA navigation, theater/fullscreen,
  popup restore, two simultaneous detached cards, source-tab navigation, card close
  cleanup, and console cleanliness on live YouTube.
- Confirm a detached card stays put, keeps its position, and opens no tab while
  browsing on to other videos; its timestamps seek only when the tab is showing
  that card's own video.
- Provider DOM can change; failures remain explicit and retryable.

## Known product limits

- Requires usable YouTube captions; no speech-to-text fallback.
- ChatGPT/Gemini embedding depends on each site's frame behavior, rendered UI, and
  active user session.
- Jump Cut remains source-only and is not part of the initial product.
- No live streams, mobile, backend, account, sync, analytics, or model API.

## Shorts verification

- Automated route, mount, active-video, sizing, runtime, direct caption, sparse
  metadata, player fallback, watch fallback, and transcript tests pass.
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
guidance, and issue templates are included. Daily-profile signed-in provider,
theater/fullscreen, popup restore, and cold-restart checks remain the release gate.
