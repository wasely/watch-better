# WatchBetter Product Specification

## Goal

Help desktop YouTube viewers navigate captions, ask grounded questions through
their existing ChatGPT or Gemini web session, and optionally compress long caption
gaps without replacing YouTube's player or content.

## P0 requirements

- Mount one panel in normal right-column flow on `youtube.com/watch` pages.
- Survive YouTube SPA navigation, player replacement, theater/fullscreen changes,
  extension reloads, and missing captions without duplicate UI.
- Discover available caption tracks, normalize timestamps, search, select, copy,
  seek, and follow playback.
- Build bounded timestamped transcript prompts for entire video, current section,
  or selected rows.
- Support ChatGPT and Gemini provider selection.
- Open/reuse each official provider tab and use its signed-in web session.
- Send only after an explicit Ask action; return rendered assistant text to the
  WatchBetter panel.
- Start clean conversations and preserve follow-up continuity within each provider
  tab.
- Never store/copy provider credentials, call model APIs, or use iframe/header
  bypasses.
- Keep settings validated, messages allowlisted, and transcript caching memory-only
  by default.
- Keep Jump Cut disabled by default and restore playback behavior on disable/error.

## P1 requirements

- Light/dark/system themes, compact/standard/large transcript text.
- Keyboard-accessible tabs and controls, visible focus, reduced-motion support,
  narrow panel and 200% zoom layouts.
- Explicit provider-not-open, sign-in-required, busy, timeout, and response errors.
- Popup enable/restore actions and options links for ChatGPT/Gemini.

## Privacy requirements

- No WatchBetter backend, analytics, account, payments, tracking, or remote code.
- No persistent transcripts, prompts, or conversations by default.
- Optional transcript cache uses browser session storage with hard size/count bounds.
- Host access limited to YouTube, ChatGPT, and Gemini.
- No cookie, scripting, capture, clipboard, broad-host, or network-header permission.
- Explain that submitted transcript context is handled under the selected provider's
  account and data policies.

## Out of scope

Shorts, live streams, mobile, no-caption speech-to-text, sponsor/semantic detection,
video downloading/editing, additional AI providers, background/headless accounts,
and guaranteed compatibility with unannounced provider UI changes.

## Acceptance

- Format, lint, strict types, unit/component/integration tests, and WXT build pass.
- Built manifest matches the documented permissions.
- Source and generated package contain no secret, API key, credential store,
  dependency directory, or direct model API endpoint.
- Manual unpacked-Chrome smoke covers one YouTube video plus signed-in ChatGPT and
  Gemini turns before a release is called live-verified.
