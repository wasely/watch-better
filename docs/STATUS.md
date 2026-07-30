# Status

Updated: 2026-07-29

## Last completed task

**MVP-022 — Verified Skip fixture UI.** CutThrough now renders safe off, waiting, ready, active, aggressive, unsupported, and restored-error states; an explicit reversible switch; conservative/balanced/aggressive presets; approximate time saved; advanced timing/rate/jump controls; reset; and prominent approximate/aggressive safety warnings.

## Current task

**MVP-023 — Complete shell, settings, and popup fixture states.**

## Validation results

- Formatting, ESLint, strict TypeScript, full Vitest suite, coverage, and production WXT build passed for the latest verified code.
- Full suite: 9 files, 51 tests passed.
- Coverage: 74.96% statements / 78.45% lines overall; Skip feature 88.33% statements / 89.28% lines.
- Production build: `.output/chrome-mv3/`, 474.13 kB total. Development package: `.output/cutthrough-0.1.0-chrome.zip`, 146.18 kB.
- Vitest uses one thread with file parallelism disabled. Forked/multi-worker runs timed out while the host CPU was externally saturated; the bounded worker configuration completed the full suite and coverage without skipped tests.
- Browser-driven switch round-trip enabled a ready state and then restored Off; component tests cover full presets, custom controls, reset, elevated risk, malformed savings, and enabled error reversal.
- Responsive measurements: no horizontal overflow or out-of-panel buttons at 320/402/480px; measured panel heights were 508–576px closed and 714px with all advanced controls open.
- Skip screenshot artifacts:
  - `artifacts/ui/skip-dark-402-off.png`
  - `artifacts/ui/skip-light-480-active-advanced.png`
  - `artifacts/ui/skip-dark-320-aggressive.png`
  - `artifacts/ui/skip-light-320-unsupported.png`
  - `artifacts/ui/skip-dark-402-error.png`
- Error UI was repaired before final capture to remove a redundant approximate-warning card and replace misleading `On` copy with `Turn off`. The final dark/light × narrow/wide matrix passed independent visual review.
- Additional Ask action-state evidence:
  - `artifacts/ui/ask-dark-402-copied.png`
  - `artifacts/ui/ask-light-402-open-error.png`
- Production bundle audit found no transcript/Ask/Skip fixture markers; built manifest permissions remain `storage` plus the YouTube host only.

## Known defects

- Skip controls are fixture UI only. No detection method or playback-changing engine has been selected; MVP-060/MVP-061 remain pending.
- Transcript components still consume fixtures/default loading only; real YouTube caption acquisition and playback wiring are not implemented.
- Production Ask UI does not yet connect transcript selection state or the background ChatGPT tab-opening message; MVP-051 remains pending.
- Popup Restore Panel intentionally returns a not-connected error until lifecycle integration.
- Background status cannot yet prove `panelMounted`; it reports false.
- Content script still mounts only when initially injected on a watch page; full YouTube SPA lifecycle is not implemented.
- Production extension has not been loaded manually in Chrome or tested on live YouTube.
- Real-world transcript performance still needs representative live payload profiling before closing the virtualization decision.

## Blockers

None.

## Next recommended task

Implement MVP-023 as one slice: finish controlled header/tab/collapse/settings states, connect fixture settings behavior, complete constrained popup states/actions, add component tests, capture popup/shell screenshots, and repair visual defects.

## Exact commands last run

```bash
npm --prefix /c/code/watch-better run format
npm --prefix /c/code/watch-better run lint
npm --prefix /c/code/watch-better run typecheck
npm --prefix /c/code/watch-better run test
npm --prefix /c/code/watch-better run test:coverage
npm --prefix /c/code/watch-better run build
npm --prefix /c/code/watch-better run zip
npm --prefix /c/code/watch-better run dev:harness -- --host 127.0.0.1
playwright screenshot --browser chromium --viewport-size "1280,1000" --full-page --wait-for-selector ".ct-skip-warning--strong" "http://127.0.0.1:4173/?tab=skip&theme=dark&width=320&skip=aggressive" artifacts/ui/skip-dark-320-aggressive.png
```

## Commit status

Foundation: `417ff68`. Transcript: `484260d`. Ask: `8b21de7`. Skip slice is verified for local history. Remote push remains prohibited.
