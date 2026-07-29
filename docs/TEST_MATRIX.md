# Test Matrix

| Area                | Automated coverage                                                 | Fixture/browser coverage                                    | Live/manual coverage                                    |
| ------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------- |
| Build/config        | script smoke, strict TS                                            | production output inspection                                | load unpacked extension                                 |
| Settings            | defaults, validation, migration, read/write adapter                | popup/panel persistence fixture                             | reload Chrome/extension/video                           |
| YouTube lifecycle   | controller enter/change/leave, abort/dispose, duplicate prevention | simulated DOM/URL/video replacement                         | navigate 5+ videos, leave/return, reload extension      |
| Panel placement     | mount target ordering and fallback                                 | right rail with neighbor content, narrow/theater/fullscreen | normal/theater/fullscreen, vidIQ coexistence            |
| Transcript provider | extraction parsing, normalization, malformed data, abort           | fixture payload variants                                    | human/auto/multi-language/unavailable videos            |
| Playback            | seek, active lookup, follow suspension, replacement                | controllable fake video                                     | real timestamp seek/highlight                           |
| Transcript UI       | every state, search, selection, copy, keyboard                     | 5m/2h/fragmented/long/multilingual fixtures                 | representative live transcript                          |
| Ask                 | context selection, deterministic prompt, limits                    | copy/open feedback and error fixtures                       | clipboard content and explicit ChatGPT tab              |
| Skip engine         | gap planning, malformed timing, repeats, ads, restore/dispose      | deterministic fake playback clock                           | conservative real-video trial, speed/seek/ad/navigation |
| Popup/settings      | status/control/render/accessibility                                | extension-page smoke                                        | toolbar flow                                            |
| Accessibility       | roles/names/focus, axe where supported                             | keyboard, 200% zoom, reduced motion, contrast               | screen-reader spot check                                |
| Visual              | component render regressions                                       | dark/light × narrow/wide screenshots                        | compare live panel against harness/reference intent     |
| Privacy/permissions | static source/manifest audit                                       | network request observation                                 | Chrome permission UI and DevTools network               |
| Packaging           | build/zip script                                                   | archive content inspection                                  | fresh unpacked install                                  |

## Representative transcript fixtures

1. Five-minute tutorial with clean human captions.
2. Two-hour podcast with thousands of segments.
3. Highly fragmented automatic captions.
4. Long technical rows, URLs, code terms, and punctuation.
5. Multiple tracks: original human, translated human, automatic.
6. No track, disabled track, loading, timeout, malformed, and extraction error.
7. Search with zero/one/many matches and Unicode/long translated text.
8. Active row outside viewport, manual-scroll follow suspension, large selection.

## Required visual matrix

- Dark: narrow 320px, normal 402px, wide 480px.
- Light: narrow 320px, normal 402px, wide 480px.
- Transcript default/search/selection/loading/error/long.
- Ask empty/composed/oversized/copied/open-error.
- Skip disabled/enabled/advanced/unsupported.
- Collapsed pill and neighbor extension above/below.
- Keyboard focus and 200% browser text zoom.

## Live YouTube matrix

Use only normal desktop prerecorded watch pages:

- human captions;
- automatic captions;
- multiple languages;
- captions unavailable/disabled;
- short and two-hour video;
- rapid SPA transitions;
- history back/forward;
- theater/fullscreen/normal;
- video element replacement if reproducible;
- ad state if encountered naturally.

Never claim a live row passed without direct observation.
