# Watch Better Product Specification

## Goal

Help desktop YouTube viewers navigate captions, ask grounded questions through their
existing ChatGPT or Gemini web session, and skip high-confidence unnecessary sections
without replacing YouTube's player or content.

## P0 requirements

- Mount one panel in normal flow on `youtube.com/watch` pages and active desktop Shorts.
- Add a keyboard-accessible Quick Learn control to video and Short thumbnails on
  listing surfaces; open a movable in-page Watch Better card on click, embed Gemini,
  attach the allowlisted YouTube thumbnail, submit one bounded timestamped answer prompt
  that resolves the title/thumbnail's click questions, and never navigate away from
  YouTube.
- Survive YouTube SPA navigation, player replacement, theater/fullscreen changes,
  extension reloads, and missing captions without duplicate UI.
- Discover available caption tracks, normalize timestamps, search, select, copy,
  seek, and follow playback.
- Build bounded timestamped transcript prompts for entire video, current section,
  or selected rows.
- Support ChatGPT and Gemini provider selection.
- Embed every supported provider inside the YouTube page. Never open a browser tab or
  window for Quick Learn.
- Submit bounded transcript context to the selected Ask provider only after the viewer
  opens Ask and the verified frame is ready; request only a `READY` acknowledgement.
- Submit actual questions only after the user uses the provider composer, the explicit
  **Send to AI** action, or the explicit **Quick Learn** thumbnail action.
- Start Smart Skip as soon as matching captions are available and its master switch is
  enabled; do not wait for its tab, an AI provider, or network analysis. Never perform
  a blind opening jump before captions.
- Start clean conversations and preserve follow-up continuity in each provider's
  supported surface.
- Detach the exact mounted watch/Short Transcript and Ask session into a draggable
  card inside the current YouTube tab; create a fresh normal panel immediately and
  allow multiple cards while the source tab keeps navigating.
- Require Chrome 133+ so `moveBefore()` preserves the mounted provider iframe during
  the rail-to-floating DOM move.
- Bind each ChatGPT/Gemini load to a one-use session ID and route only to its
  verified direct child frame in the originating YouTube tab.
- Never store/copy provider credentials or call model APIs. Limit frame-header
  changes to provider subframes initiated by YouTube.
- Keep settings validated, messages allowlisted, and transcript caching memory-only
  by default.
- Add a Smart Skip tab with Safe/Strict/Maximum skip intensity, category controls,
  jump map, per-jump toggles, master switch, estimated/confirmed savings, and undo.
- Build the initial map locally from caption semantics and raw speech-cue gaps. Jump long
  padded gaps and low-value spans, never change the viewer's YouTube speed, and cap
  automatic hard jumps at 35% of video duration.
- Offer **Start deep scan** after local analysis. Only that explicit action may send
  bounded caption chunks to a separate provider session. Keep Ask context untouched and
  local skipping active through provider latency, sign-in, or failure.

## P1 requirements

- Light/dark/system themes, compact/standard/large transcript text.
- Keyboard-accessible tabs and controls, visible focus, reduced-motion support,
  narrow panel and 200% zoom layouts.
- Explicit provider-not-open, sign-in-required, busy, timeout, and response errors.
- Popup enable/restore actions and options links for ChatGPT/Gemini.
- Detached cards preserve the current provider iframe, identify their pinned video,
  can be dragged/closed, and never switch when the normal YouTube page navigates.
- Smart Skip suspends during ads and unsupported/detached playback and discards stale
  analysis on video changes.

## Privacy requirements

- No Watch Better backend, analytics, account, payments, tracking, or remote code.
- No persistent transcripts, prompts, or conversations by default.
- Keep Quick Learn runtime state tab-memory-only and disclose its text-only embedded
  Gemini transcript send. Thumbnails remain local.
- Optional transcript cache uses browser session storage with hard size/count bounds.
- Detached-card state remains tab-local and closing resets only that card's frame IDs.
- Smart Skip maps are bounded and stored only in browser session storage.
- Host access limited to YouTube, ChatGPT, and Gemini.
- No cookie, scripting, capture, clipboard, broad-host, or main-frame header changes.
- Explain that submitted transcript context is handled under the selected provider's
  account and data policies.

## Out of scope

Live streams, mobile, no-caption speech-to-text, video downloading/editing, additional
AI providers, background/headless accounts, and guaranteed compatibility with
unannounced provider UI changes.

## Acceptance

- Format, lint, strict types, unit/component/integration tests, and WXT build pass.
- Built manifest matches the documented permissions.
- Source and generated package contain no secret, API key, credential store,
  dependency directory, or direct model API endpoint.
- Manual unpacked-Chrome smoke covers one YouTube video, embedded signed-in ChatGPT
  and Gemini turns, plus two concurrent detached video cards
  turn before live verification.
