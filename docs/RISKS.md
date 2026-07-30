# Risk Register

Scale: likelihood (L/M/H), impact (L/M/H/Critical).

| ID      | Risk                                                                                                                                           | Likelihood |   Impact | Mitigation / evidence gate                                                                                                                     | Status    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RSK-001 | YouTube exposes caption tracks through changing, partly internal page/player data; extraction may break or differ by session/region.           |          H | Critical | Provider abstraction, ordered strategies, fixtures from real payloads, honest errors, representative live matrix, selectors/parsers isolated.  | Open      |
| RSK-002 | YouTube SPA and DOM replacement causes duplicate panels, stale transcript, leaked observers, or disconnected playback.                         |          H | Critical | One page controller, generation aborts, owned cleanup, stable host marker, replacement tests; repeated live navigation remains a release gate. | Mitigated |
| RSK-003 | Transcript gaps do not reliably represent audible silence; skipping may clip speech or act on malformed timing.                                |          H | Critical | Approximate, disabled-by-default engine with padding, ad/timing guards, one-jump protection, and immediate rate restoration.                   | Mitigated |
| RSK-004 | Right-column structure differs by width/mode/experiments and conflicts with vidIQ or other injected content.                                   |          M |        H | Ordered mount fallbacks, normal-flow insertion only, responsive harness, theater/fullscreen states, live coexistence checks.                   | Open      |
| RSK-005 | ChatGPT handoff accidentally becomes hidden data transmission or brittle site automation.                                                      |          M |        H | Separate explicit actions, no prompt-bearing open message, no ChatGPT permission/script, and production source audit.                          | Mitigated |
| RSK-006 | Long transcripts degrade render, search, active-row lookup, prompt size, or storage/memory.                                                    |          H |        H | Binary timing lookup, measured windowing, bounded prompts, memory-only default, 2-hour stress fixture/profiling.                               | Open      |
| RSK-007 | WXT or test tooling incompatibility with Node 24/Windows causes non-reproducible builds.                                                       |          M |        M | Pin versions/lockfile, clean `npm ci`, canonical scripts, CI-like local validation, document supported Node if downgrade required.             | Open      |
| RSK-008 | Theme/host CSS and narrow layouts make a polished harness diverge from live YouTube.                                                           |          M |        H | Shadow root, owned pixel/token scale, real mount screenshots, dark/light/narrow/zoom matrix.                                                   | Open      |
| RSK-009 | Browser clipboard/tab APIs behave differently outside direct user gestures.                                                                    |          M |        H | Invoke from explicit handlers, service adapter tests, visible error/fallback, manual Chrome check.                                             | Open      |
| RSK-010 | Prior discovery required no-caption STT and auto-send, but locked build prompt requires honest no-transcript states and no ChatGPT automation. |          H |        H | `DEC-005`/`DEC-006` declare latest locked prompt authoritative; keep docs/UI consistent and do not silently reintroduce superseded scope.      | Mitigated |

## Five largest implementation risks

1. Caption acquisition reliability (`RSK-001`).
2. YouTube SPA/DOM lifecycle correctness (`RSK-002`).
3. Pause-compression safety (`RSK-003`).
4. Responsive/coexisting right-rail placement (`RSK-004`).
5. Long-transcript performance and context bounds (`RSK-006`).

A risk closes only with cited test/manual evidence, not implementation confidence.
