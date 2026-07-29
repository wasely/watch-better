# Status

Updated: 2026-07-29

## Last completed task

**MVP-010/MVP-011/MVP-012/MVP-014 — Verified extension foundation.** CutThrough now has a pinned WXT/React/strict TypeScript MV3 scaffold, typed settings/storage/messaging/domain boundaries, background/popup/options entrypoints, isolated panel shell, local fixture harness, tests, production build, and zip package.

## Current task

**MVP-020 — Build the complete Transcript fixture UI**, while finishing the theme/width matrix for MVP-013.

## Validation results

- `npm ci`: passed; 381 packages installed, 0 vulnerabilities. First attempt hit an EPERM lock from the harness Vite child; the owned process was identified/stopped and clean install then passed.
- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed after WXT type generation.
- `npm run test`: 3 files, 9 tests passed.
- `npm run test:coverage`: passed; foundation coverage 30.46% statements / 32.62% lines. Entry composition roots remain intentionally uncovered and require later integration tests.
- `npm run build`: passed; `.output/chrome-mv3/`, 421.04 kB total.
- `npm run zip`: passed; `.output/cutthrough-0.1.0-chrome.zip`, 134.36 kB.
- Built manifest inspected: only `storage` permission and `https://www.youtube.com/*` host permission.
- `npm run dev:harness`: launched at `http://127.0.0.1:4173/`.
- Playwright rendered and captured `artifacts/ui/foundation-dark-402.png`.
- Visual review found low skeleton contrast, oversized active underline, and mismatched header icons; all were repaired and final screenshot review passed.

## Known defects

- Transcript, Ask, and Skip bodies are foundation placeholders, not completed feature UI.
- Popup Restore Panel intentionally returns a not-connected error until lifecycle integration.
- Background status cannot yet prove `panelMounted`; it reports false.
- Only the dark 402px shell screenshot is verified; light and narrow/wide matrices remain.
- Content script mounts only when initially injected on a watch page; full YouTube SPA lifecycle is not implemented.
- Real caption extraction, ChatGPT prompt construction, and pause compression are not implemented.
- Production extension has not yet been loaded manually in Chrome or tested on live YouTube.

## Blockers

None.

## Next recommended task

Implement MVP-020 as one vertical slice: fixture transcript domain/state/search/selection/follow UI, long-data fixtures, component tests, then dark/light × narrow/wide screenshots and repair.

## Exact commands last run

```bash
npm install --prefix /c/code/watch-better
npm --prefix /c/code/watch-better run format
npm --prefix /c/code/watch-better run lint
npm --prefix /c/code/watch-better run typecheck
npm --prefix /c/code/watch-better run test
npm --prefix /c/code/watch-better run build
npm ci --prefix /c/code/watch-better
npm --prefix /c/code/watch-better run format:check
npm --prefix /c/code/watch-better run lint && npm --prefix /c/code/watch-better run typecheck && npm --prefix /c/code/watch-better run test
npm --prefix /c/code/watch-better run test:coverage
npm --prefix /c/code/watch-better run build && npm --prefix /c/code/watch-better run zip
npm --prefix /c/code/watch-better run dev:harness -- --host 127.0.0.1
playwright screenshot --browser chromium --viewport-size "1440,900" --wait-for-selector ".ct-panel" --wait-for-timeout 400 http://127.0.0.1:4173/ /c/code/watch-better/artifacts/ui/foundation-dark-402.png
npm --prefix /c/code/watch-better run format && npm --prefix /c/code/watch-better run validate
```

## Commit status

Foundation slice is verified and ready for its required local commit. Remote push remains prohibited.
