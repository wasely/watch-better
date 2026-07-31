# Decision Log

| ID      | Decision                                                                                                                                                       | Reason                                                                 | Status    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------- |
| DEC-001 | Product and package name is **WatchBetter**; repository remains `watch-better`.                                                                                | One consistent public identity.                                        | Confirmed |
| DEC-002 | WXT 0.21, React, strict TypeScript, Manifest V3, and npm lockfile.                                                                                             | Existing validated stack.                                              | Confirmed |
| DEC-003 | Mount one Shadow Root UI in normal YouTube right-column flow.                                                                                                  | Isolated styles without covering/replacing page content.               | Confirmed |
| DEC-004 | One controller-owned generation handles YouTube SPA changes and aborts stale work.                                                                             | Prevent duplicates and cross-video state leaks.                        | Confirmed |
| DEC-005 | Use available YouTube captions only; show honest unavailable states.                                                                                           | No backend or speech-to-text scope.                                    | Confirmed |
| DEC-006 | Jump Cut uses padded caption gaps, is off by default, and restores playback rate on every exit.                                                                | Deterministic, reversible, no capture permission.                      | Confirmed |
| DEC-007 | Use CSS tokens, container queries, and no heavy UI dependency.                                                                                                 | Compact panel must adapt to the rail, not the viewport.                | Confirmed |
| DEC-008 | Settings persist locally; transcripts remain memory-only unless session caching is explicitly selected.                                                        | Minimize retained content.                                             | Confirmed |
| DEC-009 | Transcript context is bounded to 20,000 characters and discloses omissions.                                                                                    | Avoid unbounded provider prompts while retaining timestamped evidence. | Confirmed |
| DEC-010 | Ask supports ChatGPT and Gemini through their signed-in browser tabs.                                                                                          | Uses users' existing web accounts without API keys.                    | Confirmed |
| DEC-011 | Provider scripts may fill the composer and read rendered answers, but never access cookies/tokens, call provider APIs, embed sites, or strip security headers. | Narrow, inspectable privacy boundary.                                  | Confirmed |
| DEC-012 | Starting a WatchBetter conversation navigates the provider tab to its clean root; follow-ups reuse that tab.                                                   | Keeps multi-turn continuity without storing provider conversation IDs. | Confirmed |
| DEC-013 | Message and provider allowlists reject unknown fields, unsupported hosts, and oversized prompts.                                                               | Limits privileged routing and accidental data transfer.                | Confirmed |
| DEC-014 | No analytics, WatchBetter backend/account, remote code, broad host access, or semantic skipping.                                                               | Keep repository and runtime surface narrow.                            | Confirmed |

## Evidence-dependent follow-ups

- Update provider selectors only after live DOM verification.
- Add list virtualization only if real transcript profiling justifies it.
