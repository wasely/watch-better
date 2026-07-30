# Status

Updated: 2026-07-29

## Last completed task

**MVP-021/MVP-050 — Verified Ask fixture UI and deterministic handoff provider.** CutThrough now renders full/current/selected context controls, seven suggested tasks, a question composer, prompt size/context disclosure, preview, explicit Copy/Open actions, honest failure feedback, and unavailable state. Generated prompts preserve timestamps, remain bounded, prefer relevant oversized context when possible, and disclose omissions.

## Current task

**MVP-022 — Build the complete Skip fixture UI.**

## Validation results

- Formatting, ESLint, strict TypeScript, full Vitest suite, coverage, and production WXT build passed.
- Full suite: 7 files, 38 tests passed.
- Coverage: 73.38% statements / 77.08% lines overall; Ask feature 91.62% statements / 97.76% lines.
- Production build: `.output/chrome-mv3/`, 457.6 kB total. Development package: `.output/cutthrough-0.1.0-chrome.zip`, 142.94 kB.
- Ask provider tests cover short/full, selected, current-section, oversized stratified, and topic-relevant context.
- Ask source audit found no `fetch`, XHR, Chrome, or browser API calls.
- Browser-driven compact flow applied a suggested task, copied explicitly, then opened explicitly; feedback matched each action and no automatic action occurred.
- Responsive measurements: 320/402/480px panels had no horizontal overflow; Open ChatGPT stayed inside panel bounds; 320px used three context columns plus the compact suggestion picker.
- Screenshot artifacts:
  - `artifacts/ui/ask-dark-402-composed.png`
  - `artifacts/ui/ask-light-480-trimmed.png`
  - `artifacts/ui/ask-dark-320-selected.png`
  - `artifacts/ui/ask-light-320-empty.png`
- First Ask visual review found a clipped 402px action, ambiguous action hierarchy, weak warning contrast, and excessive narrow height. Copy is now primary, Open secondary, transfer wording explicit, footer stacks below 440px, warning readability increased, and narrow suggestions collapse to an accessible select. Re-captured matrix passed independent visual review.
- Earlier verified transcript evidence remains under `artifacts/ui/transcript-*.png`; the 720-row fixture remains covered by a 10-second instrumented stress-test budget.

## Known defects

- Skip body remains a placeholder.
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

Implement MVP-022 as one slice: off/default state, enable control, conservative presets, current status, risk warning, estimated time saved, advanced controls, reset, component tests, responsive screenshots, and visual repair.

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
playwright screenshot --browser chromium --viewport-size "1440,1000" --full-page --wait-for-selector ".ct-ask" "http://127.0.0.1:4173/?tab=ask&theme=dark&width=402&scenario=tutorial" artifacts/ui/ask-dark-402-composed.png
```

## Commit status

Foundation: `417ff68`. Transcript slice: `484260d`. Ask slice is verified for local history. Remote push remains prohibited.
