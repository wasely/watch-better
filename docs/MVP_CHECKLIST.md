# MVP Checklist

Legend: `[ ]` pending, `[~]` in progress, `[x]` verified, `[!]` blocked. Status changes require evidence in `STATUS.md`.

## Phase 0 — evidence and project controls

- [x] **MVP-000 · P0 · PRD-053 — Inspect repository and references**
  - Acceptance: Every repository file and supplied visual reference is inspected; toolchain and git state recorded.
  - Verify: file inventory, visual inspection, `git status`, tool version output.
  - Status: Verified 2026-07-29; repository was README-only and four supplied images are in `references/`.
- [x] **MVP-001 · P0 · PRD-053 — Establish persistent project documents**
  - Acceptance: Required concise docs exist with stable requirements, risks, commands, decisions, status, and test strategy.
  - Verify: manual document review plus link/path check.
  - Status: Verified 2026-07-29; implementation-dependent details remain continuously maintained.

## Phase 1 — foundation

- [x] **MVP-010 · P0 · PRD-053 — Scaffold WXT/React/TypeScript**
  - Acceptance: WXT MV3 extension starts, builds, and has strict TS with pinned npm lockfile.
  - Verify: `npm ci`, `npm run typecheck`, `npm run build`.
  - Status: Verified 2026-07-29; clean install, strict typecheck, and production Chromium build passed.
- [x] **MVP-011 · P0 · PRD-053 — Configure quality commands**
  - Acceptance: format check, ESLint, strict typecheck, Vitest, component tests, build, and zip scripts are canonical and passing.
  - Verify: run every script and record outputs.
  - Status: Verified 2026-07-29; 9 tests passed and build/zip produced the development package.
- [x] **MVP-012 · P0 · PRD-040, PRD-044 — Typed storage and minimal manifest**
  - Acceptance: settings defaults/validation/repository work; manifest requests only documented implemented permissions.
  - Verify: unit tests, manifest inspection, production build.
  - Status: Verified 2026-07-29; settings tests passed and built manifest contains only `storage` plus YouTube host access.
- [~] **MVP-013 · P1 · PRD-001, PRD-050 — Design tokens and UI primitives**
  - Acceptance: isolated tokens/primitives support dark/light, focus, reduced motion, and narrow widths without host rem leakage.
  - Verify: component tests and harness visual inspection.
  - Status: In progress; master tokens and shell primitives exist, dark 402px screenshot passed visual review; full theme/width matrix remains.
- [x] **MVP-014 · P0 · PRD-052 — Fixture harness foundation**
  - Acceptance: local harness runs production panel components and switches fixture/theme/width/neighbor states.
  - Verify: `npm run dev:harness`, browser smoke test.
  - Status: Verified 2026-07-29; Vite harness launched, controls rendered, and Playwright captured an inspected screenshot.

## Phase 2 — complete fixture UI

- [ ] **MVP-020 · P0 · PRD-010–PRD-019 — Transcript fixture UI**
  - Acceptance: normal/loading/unavailable/disabled/error/multi-track/long/search/selected/active states and required interactions render.
  - Verify: component tests, keyboard checks, screenshots.
  - Status: Pending.
- [ ] **MVP-021 · P0 · PRD-020–PRD-025 — Ask fixture UI**
  - Acceptance: contexts, suggestions, question composer, size disclosure, copy/open feedback, and honest handoff explanation render and behave.
  - Verify: component tests and screenshots.
  - Status: Pending.
- [ ] **MVP-022 · P0 · PRD-030–PRD-035 — Skip fixture UI**
  - Acceptance: disabled/enabled/presets/status/warning/time/advanced/reset states render and behave.
  - Verify: component tests and screenshots.
  - Status: Pending.
- [ ] **MVP-023 · P1 · PRD-004, PRD-042, PRD-050 — Shell, settings, popup states**
  - Acceptance: header/tabs/collapse/settings and constrained popup are complete in fixtures.
  - Verify: component tests and screenshots.
  - Status: Pending.
- [ ] **MVP-024 · P1 · PRD-050–PRD-052 — Visual/accessibility fixture review**
  - Acceptance: inspected dark/light × narrow/wide screenshots show no clipping/overflow and keyboard/focus/accessibility checks pass.
  - Verify: artifacts under `artifacts/ui/`, automated accessibility checks, manual inspection notes.
  - Status: Pending.

## Phase 3 — YouTube lifecycle

- [ ] **MVP-030 · P0 · PRD-001, PRD-003 — Right-column Shadow DOM mount**
  - Acceptance: exactly one normal-flow host mounts above existing secondary content without deleting or covering it.
  - Verify: integration fixture plus live YouTube manual check.
  - Status: Pending.
- [ ] **MVP-031 · P0 · PRD-002 — Typed page lifecycle controller**
  - Acceptance: enter/change/leave, abort, cleanup, reload recovery, and no-duplicate behavior pass.
  - Verify: integration tests and multi-video live navigation.
  - Status: Pending.
- [ ] **MVP-032 · P0 · PRD-002, PRD-012 — Replacement-safe playback controller**
  - Acceptance: seek/time/rate subscriptions reconnect after video replacement and dispose fully.
  - Verify: integration tests and live replacement/navigation check.
  - Status: Pending.
- [ ] **MVP-033 · P1 · PRD-003, PRD-004 — Responsive/theater/fullscreen/collapse behavior**
  - Acceptance: approved placement states work without layout damage and persist appropriately.
  - Verify: responsive fixture plus live mode checks.
  - Status: Pending.

## Phase 4 — real transcript

- [ ] **MVP-040 · P0 · PRD-010, PRD-011, PRD-016 — Caption-track provider**
  - Acceptance: available tracks load and normalize behind the provider; aborts/stale requests cannot update UI.
  - Verify: provider/unit/integration tests and representative live videos.
  - Status: Pending.
- [ ] **MVP-041 · P0 · PRD-012–PRD-015 — Playback/search/selection/copy integration**
  - Acceptance: seek, active row, follow suspension, literal search, selection, and required clipboard format work with real normalized data.
  - Verify: component/integration tests and live check.
  - Status: Pending.
- [ ] **MVP-042 · P1 · PRD-017–PRD-019 — Transcript resilience and accessibility**
  - Acceptance: all failures are honest; long transcripts stay responsive; keyboard/screen-reader behavior meets spec.
  - Verify: stress fixtures, accessibility tests, live unavailable video.
  - Status: Pending.

## Phase 5 — ChatGPT handoff

- [ ] **MVP-050 · P0 · PRD-020, PRD-021, PRD-024 — Deterministic prompt provider**
  - Acceptance: each context/suggestion builds bounded, timestamp-preserving prompts without network calls.
  - Verify: unit snapshot/behavior tests including huge transcripts.
  - Status: Pending.
- [ ] **MVP-051 · P0 · PRD-022, PRD-023, PRD-025 — Explicit copy/open actions**
  - Acceptance: separate user actions copy prompt and open ChatGPT; no automation/hidden transmission/fake response exists.
  - Verify: service/component tests, manifest audit, manual tab check.
  - Status: Pending.

## Phase 6 — pause compression

- [ ] **MVP-060 · P0 · PRD-031 — Pause-detection feasibility spike**
  - Acceptance: four candidate methods are tested/researched and documented with permissions, reliability, and decision evidence.
  - Verify: spike tests/notes in architecture/decisions/risks.
  - Status: Pending.
- [ ] **MVP-061 · P0 · PRD-030, PRD-032, PRD-033, PRD-035 — Safe skip engine**
  - Acceptance: selected engine is off by default, validates timing, avoids ads/repeats, reverses immediately, and restores rate on all exits.
  - Verify: deterministic engine/controller integration tests.
  - Status: Pending.
- [ ] **MVP-062 · P1 · PRD-034 — Skip controls and measurement**
  - Acceptance: presets/advanced/reset/status/warnings/time-saved connect to engine and persist correctly.
  - Verify: component/integration tests and controlled playback fixture.
  - Status: Pending.

## Phase 7–8 — hardening and delivery

- [ ] **MVP-070 · P0 · PRD-005, PRD-040, PRD-041 — Settings/privacy integration**
  - Acceptance: settings survive navigation/reload; content retention defaults to memory-only; migrations handle unknown data safely.
  - Verify: storage/integration tests and reload check.
  - Status: Pending.
- [ ] **MVP-071 · P0 · PRD-002, PRD-043, PRD-044 — Lifecycle/privacy/permission audit**
  - Acceptance: no leaks, duplicate roots, hidden requests, excess permissions, secrets, tracking, or production fixture imports.
  - Verify: tests, built-manifest/source audit, browser console/memory review.
  - Status: Pending.
- [ ] **MVP-072 · P1 · PRD-019, PRD-051 — Accessibility/performance review**
  - Acceptance: keyboard, focus, screen readers, zoom, reduced motion, long content, and interaction performance meet documented thresholds.
  - Verify: automated checks, profiler/stress fixtures, manual review.
  - Status: Pending.
- [ ] **MVP-073 · P0 · PRD-053 — Full canonical validation**
  - Acceptance: clean install plus format/lint/type/tests/build/zip all pass with no critical/high defects.
  - Verify: exact commands and results in `STATUS.md`.
  - Status: Pending.
- [ ] **MVP-074 · P0 · PRD-001–PRD-053 — Production extension smoke test**
  - Acceptance: unpacked production build satisfies live YouTube Definition of Done checks; any unavailable manual verification is explicitly blocked, never implied.
  - Verify: Chrome unpacked/manual matrix and captured evidence.
  - Status: Pending.
- [ ] **MVP-075 · P1 · PRD-053 — Documentation and package delivery**
  - Acceptance: README/docs match implementation; zip exists; no unchecked P0/P1 item remains.
  - Verify: doc review, archive inspection, checklist audit.
  - Status: Pending.
