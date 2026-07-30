# Status

Updated: 2026-07-29

## Last completed task

**MVP-013/MVP-020 — Verified responsive transcript fixture experience.** CutThrough now renders all transcript states, searchable timestamped rows, active playback state, language selection, row/range selection, approved clipboard formatting, explicit Ask/ChatGPT selection actions, auto-follow suspension/resume, and long-transcript fixtures through production components.

## Current task

**MVP-021 — Build the complete Ask fixture UI and deterministic handoff model.**

## Validation results

- Formatting, ESLint, strict TypeScript, and production WXT build passed.
- Full suite: 5 files, 22 tests passed.
- Coverage: 63.41% statements / 66.17% lines overall; transcript feature 87.3% statements and utilities 100% lines.
- Production build: `.output/chrome-mv3/`, 438.91 kB total.
- Development package: `.output/cutthrough-0.1.0-chrome.zip`, 138.68 kB.
- Production bundle audit found no podcast/fixture strings.
- Two-hour fixture: 720 rows, 656ms navigation-to-ready in local Playwright run, no horizontal panel overflow.
- Automated responsive checks: no panel/body horizontal overflow for 320px technical, 320px selection, or 480px search fixtures.
- Narrow container-query check: header visible, secondary labels collapsed, selection toolbar stacked.
- Screenshot artifacts:
  - `artifacts/ui/transcript-dark-402-tutorial.png`
  - `artifacts/ui/transcript-light-480-search.png`
  - `artifacts/ui/transcript-dark-320-selected.png`
  - `artifacts/ui/transcript-light-320-technical.png`
  - `artifacts/ui/transcript-dark-402-error.png`
  - `artifacts/ui/transcript-dark-402-podcast.png`
- First visual review found sticky harness overlap, missing settled active row, viewport-query failure at 320px, and contradictory search/follow state. Replaced sticky harness behavior, made follow scroll deterministic, switched to panel container queries, and initialized search with follow suspended. Re-captured matrix passed visual review.
- Range-selection test exposed an async ref-ordering defect; previous selection index is now captured before the React state updater. Regression test passes.

## Known defects

- Ask and Skip bodies remain placeholders.
- Transcript components currently consume fixtures/default loading only; real YouTube caption acquisition and playback wiring are not implemented.
- Popup Restore Panel intentionally returns a not-connected error until lifecycle integration.
- Background status cannot yet prove `panelMounted`; it reports false.
- Content script still mounts only when initially injected on a watch page; full YouTube SPA lifecycle is not implemented.
- Production extension has not yet been loaded manually in Chrome or tested on live YouTube.
- Real-world transcript performance still needs representative live payload profiling before closing the virtualization decision.

## Blockers

None.

## Next recommended task

Implement MVP-021 as one slice: Ask contexts/suggestions/composer/size and bounded-context states, deterministic prompt fixture model, explicit copy/open feedback, tests, dark/light/narrow screenshots, and visual repair.

## Exact commands last run

```bash
npm --prefix /c/code/watch-better run format
npm --prefix /c/code/watch-better run lint
npm --prefix /c/code/watch-better run typecheck
npm --prefix /c/code/watch-better run test
npm --prefix /c/code/watch-better run test:coverage
npm --prefix /c/code/watch-better run build
npm --prefix /c/code/watch-better run dev:harness -- --host 127.0.0.1
playwright screenshot --browser chromium --viewport-size "1440,900" --full-page --wait-for-selector ".ct-transcript-row" --wait-for-timeout 150 "http://127.0.0.1:4173/?theme=dark&width=402&scenario=tutorial" /c/code/watch-better/artifacts/ui/transcript-dark-402-tutorial.png
playwright screenshot --browser chromium --viewport-size "1440,900" --full-page --wait-for-selector ".ct-transcript-row" --wait-for-timeout 150 "http://127.0.0.1:4173/?theme=light&width=480&scenario=search" /c/code/watch-better/artifacts/ui/transcript-light-480-search.png
playwright screenshot --browser chromium --viewport-size "1280,900" --full-page --wait-for-selector ".ct-selection-bar" --wait-for-timeout 150 "http://127.0.0.1:4173/?theme=dark&width=320&scenario=selected" /c/code/watch-better/artifacts/ui/transcript-dark-320-selected.png
playwright screenshot --browser chromium --viewport-size "1280,900" --full-page --wait-for-selector ".ct-transcript-row" --wait-for-timeout 150 "http://127.0.0.1:4173/?theme=light&width=320&scenario=technical" /c/code/watch-better/artifacts/ui/transcript-light-320-technical.png
npm --prefix /c/code/watch-better run format && npm --prefix /c/code/watch-better run validate && npm --prefix /c/code/watch-better run test:coverage && npm --prefix /c/code/watch-better run zip
```

## Commit status

Foundation commit: `417ff68`. Transcript slice is verified and ready for its required local commit. Remote push remains prohibited.
