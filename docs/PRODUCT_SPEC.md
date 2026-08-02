# Watch Better Product Specification

## Goal

Help desktop YouTube viewers navigate captions, ask grounded questions through
their existing ChatGPT, Gemini, or DeepSeek web session, and optionally compress long caption
gaps without replacing YouTube's player or content.

## P0 requirements

- Mount one panel in normal right-column flow on `youtube.com/watch` pages.
- Survive YouTube SPA navigation, player replacement, theater/fullscreen changes,
  extension reloads, and missing captions without duplicate UI.
- Discover available caption tracks, normalize timestamps, search, select, copy,
  seek, and follow playback.
- Build bounded timestamped transcript prompts for entire video, current section,
  or selected rows.
- Support ChatGPT, Gemini, and DeepSeek provider selection.
- Embed ChatGPT and Gemini inside Ask. Route DeepSeek through its normal full tab
  because its security challenge blocks embedded pages.
- Send transcript context only after the explicit **Send to AI** action.
- Start clean conversations and preserve follow-up continuity in each provider's
  supported surface.
- Bind each ChatGPT/Gemini load to a one-use session ID and route only to its
  verified direct child frame in the originating YouTube tab.
- Never store/copy provider credentials or call model APIs. Limit frame-header
  changes to provider subframes initiated by YouTube.
- Keep settings validated, messages allowlisted, and transcript caching memory-only
  by default.
- Keep Jump Cut disabled by default and restore playback behavior on disable/error.

## P1 requirements

- Light/dark/system themes, compact/standard/large transcript text.
- Keyboard-accessible tabs and controls, visible focus, reduced-motion support,
  narrow panel and 200% zoom layouts.
- Explicit provider-not-open, sign-in-required, busy, timeout, and response errors.
- Popup enable/restore actions and options links for ChatGPT/Gemini/DeepSeek.

## Privacy requirements

- No Watch Better backend, analytics, account, payments, tracking, or remote code.
- No persistent transcripts, prompts, or conversations by default.
- Optional transcript cache uses browser session storage with hard size/count bounds.
- Host access limited to YouTube, ChatGPT, Gemini, and DeepSeek.
- No cookie, scripting, capture, clipboard, broad-host, or main-frame header changes.
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
- Manual unpacked-Chrome smoke covers one YouTube video, embedded signed-in ChatGPT
  and Gemini turns, plus a signed-in DeepSeek full-tab turn before live verification.
