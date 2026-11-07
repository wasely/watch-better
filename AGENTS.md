# AGENTS.md

## Project

WXT/React/strict-TypeScript Chrome extension for YouTube caption previews, transcript navigation, signed-in ChatGPT/Gemini Ask, detachable panels, and Smart Skip.
No backend, provider credential access, model API, analytics, video download, or default transcript persistence.

## Commands

- Install: `npm ci`
- Dev extension: `npm run dev`
- Fixture harness: `npm run dev:harness`
- Validate all: `npm run validate`
- Coverage: `npm run test:coverage`
- Package: `npm run zip`

## Structure

- `src/adapters/youtube/` — YouTube selectors and page/player adapters.
- `src/features/transcript/` — transcript domain, search, selection, and UI.
- `src/features/ask/` — bounded context and provider handoff.
- `src/features/smart-skip/` — local/semantic analysis, cut maps, and controls.
- `src/features/detach/` — in-page movable session cards.
- `src/services/` / `src/messaging/` / `src/storage/` — browser boundaries and contracts.
- `harness/` — fixture UI for screenshots and interaction tests.
- `docs/STATUS.md`, `MVP_CHECKLIST.md`, `DECISIONS.md` — current scope and durable decisions.

## Rules

- Read `C:\code\UI-PLAYBOOK.md` plus the three status/decision docs before UI or scope work.
- Keep domain/UI code behind transcript, page, playback, AI, Smart Skip, storage, and messaging interfaces.
- Keep YouTube selectors inside `src/adapters/youtube`; handle SPA navigation with cleanup and aborts.
- Mount one Shadow Root; preserve YouTube player/site behavior outside owned surfaces.
- Use minimal documented permissions; never access provider cookies/tokens or add remote executable code.
- Fixture data must never enter production behavior; transcript sharing requires explicit user action.
- Tests stay colocated as `*.test.ts(x)` where practical; record durable decisions in `docs/DECISIONS.md`.

## Before finishing

- Run `npm run validate`.
- For UI changes, inspect harness screenshots in dark/light and narrow/wide states.
- For YouTube lifecycle changes, verify live SPA mount/cleanup and report skipped manual checks.
