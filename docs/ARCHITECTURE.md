# Architecture

## System shape

CutThrough is a WXT Manifest V3 extension with four runtime surfaces:

1. **YouTube content script** — observes supported watch-page lifecycle, mounts one WXT Shadow Root UI, and connects feature controllers.
2. **Panel React app** — renders Transcript, Ask, Skip, settings, and explicit state machines using domain interfaces only.
3. **Background service worker** — performs extension-privileged operations only when required, such as opening a ChatGPT tab and typed message routing.
4. **Popup and fixture harness** — popup exposes status/control only; harness renders production components against fixtures without YouTube.

## Boundaries

```text
src/
  entrypoints/
    youtube.content.tsx   content composition root
    background.ts         privileged message handlers
    popup/                 lightweight extension popup
    options/               persistent settings page
  app/                     panel composition and app state
  components/              reusable primitives
  features/transcript/     domain, provider contract, UI, state
  features/ask/            prompt domain, provider contract, UI
  features/skip/           engine contract, controller, UI
  features/settings/       settings UI and schemas
  adapters/youtube/        selectors, page and playback controllers
  services/                clipboard/tab/open integration
  storage/                 typed Chrome storage repository
  messaging/               typed message contracts
  shared/                  reusable types/utilities
  styles/                  tokens and isolated global panel styles
  test/                    fixtures and shared test utilities
harness/                   local Vite fixture harness
```

WXT may generate `.wxt/` and `.output/`; both are build artifacts.

## Core interfaces

- `TranscriptProvider.load(request, signal): Promise<TranscriptDocument>` and `listTracks(...)` isolate caption acquisition.
- `YouTubePageController.subscribe(listener)` emits enter/change/leave snapshots and owns DOM observers/listeners.
- `PlaybackController` provides current time, duration, seek, rate, ad/unsupported state, and replacement-safe subscriptions.
- `AIProvider.buildPrompt(request)` returns deterministic prompt text and size metadata; V1 implementation is `ChatGPTHandoffProvider`.
- `SkipEngine.enable(config)`, `update(config)`, `disable()`, and `dispose()` own every playback mutation.
- `SettingsRepository` reads, validates, migrates, and writes typed settings.

## State and data flow

1. Page controller emits current `videoId` and mount target.
2. Composition root aborts prior work, resets video-scoped state, reconnects playback, and loads settings/transcript.
3. Provider emits normalized immutable transcript data to React state.
4. Playback time selects the active segment using binary search; UI virtualization does not own timing.
5. Ask actions build local prompt text. Clipboard/open operations occur only from explicit click handlers.
6. Skip engine receives normalized timing and playback abstraction. Disabling/disposal always restores prior rate.

No transcript fixture import is reachable from production entrypoints.

## YouTube lifecycle

Use a single controller with an `AbortController` per video generation. Observe URL/video ID and relevant container replacement, also listen for YouTube navigation events where available. Every generation:

- aborts old transcript loads;
- disposes old playback and skip subscriptions;
- reuses or remounts exactly one host identified by a stable extension-owned attribute;
- reconnects when `HTMLVideoElement` changes;
- never deletes or reparents YouTube/third-party content;
- unmounts when leaving supported watch pages.

Selectors live in one adapter and use ordered fallbacks. A local fixture DOM tests lifecycle invariants independently from live YouTube.

## UI isolation

WXT Shadow Root UI with `cssInjectionMode: 'ui'` isolates styles. Use pixel/root-owned CSS custom properties rather than host `rem`. The host occupies normal flow at 100% available column width. Theme resolution uses explicit setting, then YouTube/document color scheme signals. All production UI consumes the same token set.

## Storage

`chrome.storage.local` through a typed repository. Store only settings and optional bounded transcript cache metadata/content when the user enables temporary caching. Default cache policy is memory-only. Validate/migrate unknown persisted values before use.

## Messaging

Discriminated-union messages with request and response schemas. Initial messages:

- `runtime:get-status`
- `runtime:set-enabled`
- `panel:restore`
- `settings:open`
- `chatgpt:open`

No message carries transcript content for `chatgpt:open`; opening and copying are separate explicit UI actions.

## Permissions

Planned minimum:

- `storage` — persistent typed settings.
- Host match `https://www.youtube.com/*` — run the content script on supported pages.

Opening a normal `https://chatgpt.com/` tab from an explicit click uses `chrome.tabs.create` when background handling is implemented; add `tabs` only if proven necessary. No ChatGPT host permission because V1 does not automate the page. No `tabCapture`, `scripting`, broad web host, clipboard, or network permission unless an implemented and documented requirement proves it necessary.

## Testing layers

- Unit: normalization, search, prompt building, settings validation, gap detection, timing lookup.
- Component: transcript states/interactions, Ask handoff, Skip controls, popup, accessibility.
- Integration: page lifecycle, video replacement, provider aborts, storage/message adapters.
- Browser/harness: dark/light/narrow/wide visuals and keyboard flows.
- Manual live YouTube: actual mount, SPA navigation, caption extraction, seeking, ad behavior, console, unpacked reload.

## Packaging

`wxt build` creates an unpacked Chromium extension; `wxt zip` creates the distributable archive. Nothing is pushed, published, or deployed by automation.
