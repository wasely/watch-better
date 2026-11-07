# Status

Updated: 2026-08-26

## Current state

**Smart Skip development build.** Watch Better includes Transcript, Ask, and Smart
Skip. Ask embeds ChatGPT and Gemini. Quick Learn opens the same movable in-page card as
Pop Out, keeps the clicked video's thumbnail and title visible in a local identity card,
and sends a direct click-hook briefing to Gemini after its thumbnail button is pressed.
No thumbnail is transferred to Gemini. No model API or provider credential collection is used. A clean-profile
Chrome smoke test passes; signed-in-provider checks in the daily profile remain the gate.

## Implemented

- Added a persistent Quick Learn video passport with the local thumbnail, a two-line
  title, caption language, and a stable per-video accent. Floating and minimized cards
  retain their video identity when several answers are open.
- Quick Learn prefers a native English caption track, exposes YouTube's translated
  English track when the source captions are non-English, and asks Gemini to answer only
  in English.
- Quick Learn sends the normal bounded transcript context in its first turn, skips image
  upload, opens a clean provider conversation, and requests one direct 2–4 sentence
  paragraph capped at 80 words.
- Strengthened local Smart Skip jump cut detection: a sponsor brand lexicon seeds
  cuts when the word "sponsor" is never spoken, promotional-support boundary growth
  extends each seed across its whole section with per-strictness caps, and tangent
  ("hot take", story time) plus filler-run seeds cut announced rants and low-information
  stretches under Strict/Maximum. A fresh local map that lands just after playback
  enters a span now catches up immediately; deep provider merges stay deferred.
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
- After Ask opens, submits bounded transcript context with a `READY`-only instruction, then focuses
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
- Quick Learn cards open at a roomier 560px × 760px desktop target so provider answers
  are readable without manual resizing, with responsive viewport caps and edge clamping.
- Keeps the panel height stable when YouTube shrinks its player during page scrolling.
- Keeps the panel content fixed in its normal page position while scrolling instead of
  adding player-to-masthead overlap as top padding.
- Uses a branded collapsed launcher and persistently visible, centered transcript selectors.
- Adds a responsive Settings page with consistent spacing and a working Chrome
  **Manage extension** action.
- Keeps memory-only transcript handling by default, with bounded session caching as
  an explicit opt-in.
- Replaced blind opening deletion with caption-gated skipping: long padded dead-air
  spans and explicit low-value speech jump while the viewer's chosen YouTube speed stays
  untouched.
- Preserves raw caption-cue speech timing separately from sentence transcript timing,
  enabling precise pause handling without audio capture or new permissions.
- Added session-only Smart Skip caching, ad/pause/unsupported-state suspension,
  confirmed-seek accounting, speed preservation, per-action disable, immediate undo,
  stale-navigation rejection, and a 35% automatic hard-jump budget.
- Rebuilt the third-tab UI around Safe/Strict/Maximum skip intensity, estimated versus
  confirmed savings, a jump timeline, explicit speed-preservation status, and accessible
  controls.
- Added an explicit, isolated, non-blocking Gemini deep scan for subtle middle-video tangents,
  restatements, housekeeping, and false starts; validated jumps merge into the live map
  without touching Ask or resetting saved-time state. It begins only after the viewer
  presses **Start deep scan**.
- Reworked Smart Skip into the shared white-metal visual system with restrained material
  accents, solid/hatched source markers, action-specific styling, accessible scan
  progress, larger targets, and responsive narrow-panel behavior.
- Ask submits bounded transcript context only after its tab opens, verifies provider
  acceptance, then focuses the empty composer for the user's question.
- Adds Quick Learn controls to standard video and Short thumbnails. A click fetches
  captions without navigating, opens a movable in-page Ask/Gemini card, and directly
  asks Gemini to explain the title's promise, important claims, why they matter, caveats,
  usefulness, and official links. The thumbnail identifies the local card only.
- Keeps a labeled Quick Learn pill visible before, during, and after hover on every
  standard and Short thumbnail. It survives hover-preview DOM replacement and owns the
  top-left slot while avoiding neighboring extension controls by their full footprint.

## Validation results

- Canonical offline validation passed: Prettier, ESLint, strict TypeScript, 36 Vitest
  files / 264 tests, and WXT production build.
- Quick Learn regressions cover persistent labeled controls on every Shorts card,
  hover-removal re-mounting, delayed mutation delivery, and the collision-free
  top-left thumbnail slot.
- Build: `.output/chrome-mv3/`.
- Production-dependency audit reports zero known vulnerabilities.
- Built manifest: `storage`, scoped `declarativeNetRequest`, direct-frame
  `webNavigation`, and exact YouTube, ChatGPT, and Gemini hosts. No clipboard access.
- Browser harness: the Quick Learn floating card was inspected at 320px dark and
  480px light with all tabs and window controls visible and no horizontal overflow.
- Smart Skip harness fixtures cover ready/analyzing/error/empty jump maps and functional
  controls. Skip-only speed-preservation UI was inspected at 320px dark and 480px light
  with no horizontal overflow.
- Clean-profile Chrome: live YouTube captions loaded; the Gemini frame rendered;
  a detached Ask card kept a 418px × 452px provider frame; minimize, restore,
  maximize, two-video SPA persistence, two simultaneous cards, and close cleanup passed.
- Daily Chrome: unpacked extension reloaded and a live YouTube tab refreshed. Playback
  measured about 1×; a simulated 2× user rate remained exactly 2×. Smart Skip showed
  speed unchanged, optional deep scan, and no deep-analysis frame before the button.
- Production audit tests reject provider API endpoints, cookie access, credential
  handling, broad host access, excess permissions, and Quick Learn tab/window creation.
- `src/test/youtube-content-lifecycle.test.tsx` covers the previously untested
  content-script lifecycle: rail mount order, detach onto `<body>`, card survival
  across simulated SPA navigation, several independent cards, and no `tabs.create`.

## Remaining release gate

- Inspect the redesigned Smart Skip panel at narrow watch/Short docks in light and dark
  themes; verify jumps preserve speech edges, user speed is never changed, ads suspend
  skipping, undo works, and navigation cannot
  reuse a stale map.
- Verify Quick Learn opens the movable in-page Gemini card, clearly identifies its video,
  streams the direct English answer without transferring the thumbnail, accepts a
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
- Smart Skip begins locally after matching captions load. Optional deep refinement starts
  only after **Start deep scan** and requires the selected signed-in provider; failure
  never disables local jumps.
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
