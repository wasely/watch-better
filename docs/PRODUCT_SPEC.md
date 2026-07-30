# CutThrough Product Specification

- Status: Locked MVP, implementation in progress
- Working title: CutThrough
- Target: invite-only desktop Chrome users who research or create from long YouTube videos

## Mission

Help users evaluate videos, extract useful information, and reduce viewing time without hiding what the extension is doing or changing semantic content.

## Requirements

### Platform and lifecycle

- **PRD-001 (P0):** On a supported desktop YouTube watch page, mount one CutThrough panel in the normal right content column without replacing or covering YouTube or third-party content.
- **PRD-002 (P0):** Detect YouTube in-page navigation, video ID changes, leaving watch pages, and replaced video elements without duplicate roots, stale data, listeners, observers, timers, or animation frames.
- **PRD-003 (P1):** Render above existing right-column content such as vidIQ while preserving that content; use a below-video fallback when the responsive right column is unavailable.
- **PRD-004 (P1):** Collapse to a restorable icon pill, remember collapse state, show a launcher in theater mode, and hide UI in fullscreen.
- **PRD-005 (P0):** Persist approved settings across video navigation and extension reloads.

### Transcript

- **PRD-010 (P0):** Discover caption tracks available to the viewer through a replaceable `TranscriptProvider`; never fabricate transcript content.
- **PRD-011 (P0):** Normalize track metadata and ordered segments with stable ID, start, end, and text plus video/title/language/automatic/duration metadata.
- **PRD-012 (P0):** Show sentence-like timestamped rows; clicking a row or timestamp seeks playback; highlight the active row.
- **PRD-013 (P0):** Provide case-insensitive literal search, highlighted matches, count, and previous/next navigation.
- **PRD-014 (P1):** Follow playback by default, suspend after manual transcript navigation, and provide explicit Resume Follow.
- **PRD-015 (P0):** Select rows using accessible subtle checkboxes and range selection; copy selected or full transcript with one source header and `MM:SS — text` rows.
- **PRD-016 (P1):** Honor YouTube's active track, otherwise prefer original-language human captions then automatic captions; label automatic tracks and expose a selector.
- **PRD-017 (P0):** Render explicit loading, disabled, unavailable, extraction-failed, and multi-language states.
- **PRD-018 (P1):** Remain responsive with very long transcripts and long segments through list windowing or an equivalent measured approach.
- **PRD-019 (P1):** Support keyboard navigation, visible focus, accessible names, text zoom, and screen readers.

### Ask and ChatGPT

- **PRD-020 (P0):** Offer Entire video, Current section, and Selected transcript contexts plus a custom question and specified suggested actions.
- **PRD-021 (P0):** Generate structured prompts with source identity and timestamps through an `AIProvider`; preserve an API-backed extension point.
- **PRD-022 (P0):** From Transcript, expose **Ask**; it switches tabs and explicitly primes chat with bounded timestamped transcript context.
- **PRD-023 (P0):** Provide native in-panel multi-turn chat through OpenAI's Responses API. Keep credentials/API calls in the service worker; do not iframe, modify, scrape, or automate ChatGPT.
- **PRD-024 (P1):** Show approximate context size and handle oversized transcripts using deterministic bounded context with a clear disclosure.
- **PRD-025 (P1):** Preserve conversation continuity with response IDs, expose honest API/configuration errors, and keep external ChatGPT opening separate and content-free.

### Jump cutter

- **PRD-030 (P0):** Ship pause compression disabled by default, explicitly enabled, immediately reversible, and labeled experimental when approximate.
- **PRD-031 (P0):** Complete and record a feasibility comparison of transcript gaps, video-element audio analysis, tab capture, and hybrid methods before selecting the engine.
- **PRD-032 (P0):** If using transcript gaps, act only on reliable positive gaps above threshold with configurable speech padding; reject malformed timing and duplicate boundary actions.
- **PRD-033 (P0):** Never act during detected ads or unsupported player states; restore the pre-feature playback rate when disabled, disposed, or navigated.
- **PRD-034 (P1):** Provide conservative/balanced/aggressive presets, advanced gap/padding/speech-speed/gap-speed/jump controls, detection status, reset, warning state, and approximate time saved.
- **PRD-035 (P1):** Implement behavior behind a replaceable `SkipEngine`.

### Settings, popup, privacy

- **PRD-040 (P0):** Store typed settings for enablement, default tab, transcript behavior/font size/theme/collapse, pause settings, handoff behavior, and temporary caching.
- **PRD-041 (P0):** CutThrough does not persist transcripts, prompts, questions, or conversation history locally by default; bound and document temporary cache, and disclose OpenAI API retention and billing implications for explicit chat.
- **PRD-042 (P1):** Toolbar popup contains status, enable/disable, settings, restore panel, and version only.
- **PRD-043 (P0):** No CutThrough backend, analytics, tracking, authentication, remote executable code, or hidden transcript transmission. Store a user-supplied OpenAI key locally and send bounded context only on explicit Ask/Send.
- **PRD-044 (P0):** Request only permissions needed for implemented MVP behavior and document each one.

### UI and quality

- **PRD-050 (P1):** Provide compact Transcript, Ask, and Skip tabs with dark/light themes, one restrained accent, design tokens, and no host-page rem dependence.
- **PRD-051 (P1):** Remain usable in narrow/normal right columns, high DPI, long translated text, reduced motion, keyboard-only use, and 200% text zoom.
- **PRD-052 (P1):** Provide a fixture harness covering supplied data/layout/state combinations and save inspected UI screenshots under `artifacts/ui/`.
- **PRD-053 (P0):** Formatting, lint, strict type checking, tests, production build, and extension package must pass.

## Out of scope

Semantic or sponsor skipping; content-value classification; no-caption speech-to-text; Shorts/live/mobile/other websites; ChatGPT page automation; accounts/payments/cloud sync; video downloading/editing; analytics/tracking.

## Success indicators

- User reaches a transcript row and seeks in under two interactions after load.
- Search/selection/copy and explicit transcript-grounded chat work without hidden transmission.
- SPA navigation repeatedly leaves one current panel and one current transcript.
- Jump cutting cannot leave playback altered after disable/navigation.
- All P0/P1 acceptance conditions are verified or transparently marked as manual blockers.
