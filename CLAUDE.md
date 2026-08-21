# Watch Better

Read `docs/STATUS.md`, `docs/MVP_CHECKLIST.md`, and `docs/DECISIONS.md` before selecting work.

## Objective

Build a polished Manifest V3 Chrome extension that mounts transcript navigation,
signed-in ChatGPT/Gemini Ask, and explicit AI-assisted Smart Skip controls beside
desktop YouTube watch pages and Shorts.

## MVP boundaries

Included: YouTube watch pages and Shorts, available caption tracks, transcript
navigation/search/selection/copy, explicit ChatGPT/Gemini web-session Ask and Smart
Skip analysis, movable in-page per-video cards, semantic skip maps, persistent
settings, popup status/settings, fixture harness.

Excluded: live/mobile/other sites, backend/accounts/payments/analytics, model APIs,
provider credential/cookie/token access, bundled secrets, video downloading, cloud
sync, and no-caption speech-to-text.

## Canonical commands

```bash
npm ci
npm run dev
npm run dev:harness
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run zip
```

## Architecture rules

- WXT + React + strict TypeScript; follow WXT entrypoint conventions.
- Domain/UI code never queries YouTube directly. Use `TranscriptProvider`, `YouTubePageController`, `PlaybackController`, `AIProvider`, `SmartSkipEngine`, storage, and messaging boundaries.
- Keep YouTube selectors/adapters in `src/adapters/youtube`.
- Mount one Shadow Root UI; handle SPA navigation with explicit cleanup and aborts.
- Minimal permissions; document every permission in `docs/ARCHITECTURE.md`.
- No remote executable code, secrets, transcript persistence by default, or hidden network requests.
- Fixture data must never enter production behavior.

## Conventions

- Feature-oriented files; small typed modules; no global state library unless evidence requires it.
- Accessible semantic controls, visible focus, reduced-motion support, and CSS design tokens.
- Tests colocated as `*.test.ts(x)` where practical.
- Record durable architecture/scope decisions in `docs/DECISIONS.md`.
- Update checklist/status after every verified slice.

## Verification

Run formatting, lint, typecheck, relevant tests, and production build after meaningful slices. UI work additionally requires harness screenshots in dark/light and narrow/wide states plus visual inspection. YouTube work requires live SPA/mount/cleanup checks when available; record unperformed manual checks honestly.

## Prohibited

Do not publish/deploy, use destructive commands, modify outside this repository,
access provider credentials/cookies/tokens, add undocumented permissions, send
transcript data without explicit action, hide failing tests, or add audio capture and
no-caption transcription. Push only when explicitly requested.

## Definition of done

All P0/P1 items in `docs/MVP_CHECKLIST.md` pass their acceptance and verification methods; production build/package succeeds; no known critical/high defect remains; docs match reality; unpacked installation instructions are exact.
