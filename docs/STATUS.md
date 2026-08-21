# Status

Updated: 2026-08-19

## Current state

**Smart Skip development build.** Watch Better includes Transcript, Ask, and Smart
Skip. Ask embeds ChatGPT and Gemini. Quick Learn opens the same movable in-page card as
Pop Out, starting on Gemini after its thumbnail button is pressed. No model API or provider credential collection is used. A clean-profile
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
- Starts only the selected provider frame; the unused provider stays unloaded until
  selected, reducing startup work. Ask never opens a provider tab.
- Embeds ChatGPT/Gemini and routes messages to the exact verified frame. Provider
  login remains in the browser; Watch Better does not read cookies, tokens,
  passwords, or API keys.
- Uses a tab- and provider-scoped session rule only for verified ChatGPT/Gemini frames,
  preserves it across provider navigation, and removes it when the YouTube tab
  closes or leaves YouTube; top-level pages are unchanged.
- Uses one-use frame session bindings plus direct-child `webNavigation`
  verification before routing provider status or prompt messages.
- Auto-submits bounded transcript context with a `READY`-only instruction, then focuses
  the cleared composer. **Send to AI** remains an explicit focused submission;
  follow-ups use the provider composer.
- Retains transcript navigation, search, selection, seek, and SPA lifecycle handling.
- Keeps transcript auto-follow inside its own list by excluding the injected panel from
  YouTube page scroll anchoring and preventing keyboard focus from moving the host page.
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
- Keeps memory-only transcript handling by default, with bounded session caching as
  an explicit opt-in.
- Replaced provider-gated Smart Skip with an instant local pipeline: a provisional
  opening cut activates before captions finish loading, then caption rules update the
  cut map without AI sign-in or a network request.
- Added session-only Smart Skip caching, a semantic seek engine, ad/unsupported-state
  suspension, per-cut disable, immediate undo, and stale-navigation rejection.
- Added the third-tab cut-map UI, strictness/category controls, saved-time reporting,
  instant/no-caption/empty states, and responsive harness fixtures.
- Added an isolated, non-blocking Gemini deep scan for subtle middle-video tangents,
  restatements, housekeeping, and false starts; validated cuts merge into the live map
  without touching Ask or resetting saved-time state. It begins during browser idle
  after captions load rather than waiting for the Smart Skip tab.
- Reworked Smart Skip into the shared white-metal visual system with labeled solid and
  hatched cut sources, accessible scan progress, a restrained edge sheen, and a Strict
  default.
- Ask submits bounded transcript context before its tab opens, verifies provider
  acceptance, then focuses the empty composer for the user's question.
- Adds Quick Learn controls to standard video and Short thumbnails. A click fetches
  captions without navigating, opens a movable in-page Ask/Gemini card, and submits
  bounded timestamped context with a `READY` instruction.

## Validation results

- Canonical validation passed: Prettier, ESLint, strict TypeScript, 34 Vitest
  files / 176 tests, and WXT production build.
- Build: `.output/chrome-mv3/`, 688.78 kB.
- Built manifest: `storage`, scoped `declarativeNetRequest`, direct-frame
  `webNavigation`, and exact YouTube, ChatGPT, and Gemini hosts.
- Browser harness: the Quick Learn floating card was inspected at 320px dark and
  480px light with all tabs and window controls visible and no horizontal overflow.
- Browser harness: Smart Skip's metallic ready/analyzing states were inspected at
  320/402/480px across dark and light themes with no clipping or overlap.
- Clean-profile Chrome: live YouTube captions loaded; the Gemini frame rendered;
  a detached Ask card kept a 418px × 452px provider frame; minimize, restore,
  maximize, two-video SPA persistence, two simultaneous cards, and close cleanup passed.
- Production audit tests reject provider API endpoints, cookie access, credential
  handling, broad host access, excess permissions, and Quick Learn tab/window creation.
- `src/test/youtube-content-lifecycle.test.tsx` covers the previously untested
  content-script lifecycle: rail mount order, detach onto `<body>`, card survival
  across simulated SPA navigation, several independent cards, and no `tabs.create`.

## Remaining release gate

- Reload `C:\Code\watch-better\.output\chrome-mv3` in the daily Chrome profile.
- Verify Quick Learn opens the movable in-page Gemini card, receives `READY`, accepts a
  follow-up, reuses its card, and leaves the YouTube page unchanged.
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
- Smart Skip starts locally on video detection. Its automatic idle deep refinement
  requires the selected signed-in provider; failure never disables instant cuts.
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
