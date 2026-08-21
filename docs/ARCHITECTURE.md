# Architecture

## Runtime surfaces

Watch Better is a WXT Manifest V3 extension with five production surfaces:

1. `youtube.content.tsx` runs a lightweight Quick Learn thumbnail controller on listing
   pages and mounts one active React Shadow Root rail panel on supported watch pages
   and Shorts, plus user-detached floating roots.
2. `WatchBetterRuntime.tsx` owns settings, transcript, playback, Ask, and Smart Skip
   state.
3. `background.ts` validates extension messages and routes work to an exact ChatGPT
   or Gemini frame.
4. `web-chat.content.ts` runs only on ChatGPT and Gemini, using the rendered page
   composer and assistant response DOM.
5. Popup/options surfaces expose status, restore, settings, and provider links.

The fixture harness renders production components without YouTube or live provider
accounts.

## Data flow

```text
YouTube captions -> normalized transcript -> bounded timestamped prompt
                                            |
                                            v
Transcript Ask -> typed background prompt -> ChatGPT/Gemini verified frame

Thumbnail click -> floating Watch Better card -> embedded Gemini + bounded transcript

Video starts -> provisional opening cut -> local seek engine
Captions load -> instant local classification -> updated cut map

YouTube rail panel -> state-preserving detach -> movable in-page per-video card
                                      \----> fresh rail runtime for next video
```

The initially selected Ask provider loads alongside the transcript. Once its verified
frame and captions are ready, Watch Better auto-submits bounded context with a
`READY`-only instruction. The viewer types a question into the focused composer and submits through
the provider UI. **Send to AI** remains an explicit focused-context submission. Other
providers load only when selected; mounted frames stay alive across panel tabs,
collapse, and YouTube video changes. Quick Learn creates the same floating runtime used
by Pop Out, starts on Ask/Gemini, and stays inside the YouTube page.

No provider credential, cookie, token, or API key crosses this flow. No direct model
API is called.

Smart Skip installs a short provisional opening cut as soon as a video is detected,
then synchronously classifies available caption segments. Opening Smart Skip mounts a
separate provider frame that asynchronously adds validated high-confidence semantic
cuts, including middle tangents and repetition. The Ask composer is never reused, and
provider sign-in, latency, or failure cannot block or disable local playback skipping.

Before mounting ChatGPT or Gemini, the YouTube panel creates a one-use frame session
ID and registers it with the background worker. After load, the panel sends that
binding into the iframe. The provider content script returns the same binding, and
the background accepts it only when `webNavigation` confirms a direct child frame
of the originating YouTube tab. Stale, nested, wrong-provider, and cross-session frame
registrations are rejected.

Detaching changes the already-mounted runtime from rail presentation to a fixed,
draggable in-page card. React and the provider iframe are not remounted, preserving
the exact transcript, selection, conversation, and in-flight answer. The card swaps
to a static video controller before the rail receives a fresh runtime. Each provider
iframe is keyed by top-level tab, provider, and frame session ID, so multiple cards
in one YouTube tab cannot route prompts into each other. Closing a card resets only
its sessions. Timestamp actions open the pinned source video separately because a
detached card intentionally no longer controls the newly browsed player.
Chrome 133's state-preserving `moveBefore()` relocates the Shadow host to `body`
without resetting its provider iframe.

## Provider adapter

`src/services/web-chat.ts` is the provider allowlist and selector contract.
`src/services/web-chat-dom.ts` handles composer input, submit fallback, visible
response extraction, and generation-state detection. `web-chat.content.ts` polls for
a stable rendered answer with a three-minute timeout.

The iframe and frame-bypass path are intentionally limited to:

- `https://chatgpt.com/*`
- `https://gemini.google.com/*`

A Chrome session rule removes anti-frame response headers and frame-identifying
fetch headers only for prepared provider frames in one YouTube tab. It remains active
for that provider frame's navigations and is removed when the tab closes, leaves a
YouTube page, or resets all frames for that tab. Closing one card removes its exact
frame binding while retaining the shared tab/provider rule for other cards. Provider UI changes can
break selectors. Watch Better can open the provider in a normal tab for sign-in, but
only from an explicit click.

## YouTube lifecycle

One active controller owns each YouTube SPA generation. It aborts stale transcript
loads, resets video-scoped selection, reconnects after video-element replacement,
and keeps one active extension host first in the watch-page right rail or active Short
details area. Detached static controllers remain pinned until their card closes; the
active rail unmounts outside supported video pages.
The extension never deletes or reparents YouTube or third-party content.

Quick Learn uses one mutation-batched listing controller and creates a per-video floating
runtime only after a direct click. Repeated clicks bring the existing card forward. The
card reuses the normal transcript loader, Gemini frame bridge, and move/resize controls.

## Storage

- Local: validated Watch Better settings only.
- Memory: default transcript cache and current Ask UI state.
- Session storage: optional bounded transcript cache (three documents; two million
  serialized characters per document), up to 20 validated Smart Skip maps, plus
  non-sensitive ChatGPT/Gemini frame IDs.

Version 3 settings use `watchbetter:settings:v3` and migrate version 2 values. No conversations or provider
secrets are stored.

## Messaging

Public extension requests are strict discriminated unions:

- runtime status/enable
- panel status/restore
- settings update/open/manage
- `webchat:open`
- `webchat:frame-prepare`
- `webchat:frame-ready`
- `webchat:frame-reset`
- `webchat:get-status`
- `webchat:send`
- `webchat:analyze`

Provider-page requests use a separate internal allowlist with status and send only.
Unknown fields, unsupported providers, empty messages, and messages over 24,000
characters are rejected.

## Permissions

- `storage` for typed settings and optional session cache.
- `declarativeNetRequest` for YouTube-initiated provider subframes only.
- `webNavigation` to verify registered provider frames are direct YouTube children.
- YouTube host access for the panel and captions.
- Exact ChatGPT/Gemini host access for the user-initiated web-session bridge.

There is no requested `tabs`, `cookies`, `scripting`, `tabCapture`, clipboard,
`browsingData`, broad-host, main-frame rewrite, or remote-code permission. Standard
tab methods are used only for the explicit full-tab sign-in fallback.

## Smart Skip boundary

Smart Skip activates on video detection when its saved master switch is on. A short
opening cut works before captions are ready; the remaining classifications require
available YouTube captions. Local rules activate immediately; an isolated provider
pass begins during browser idle after captions load and merges only validated cuts.
It has no audio capture or speech-to-text fallback. The local engine suspends during
ads/unsupported playback, supports per-cut disable and undo, and never changes playback
speed. Maps are session-only and keyed by video, track, transcript fingerprint,
categories, and intensity.

## Verification

- Unit: transcript normalization/search, prompt bounding, settings, Smart Skip
  chunking/parsing/cache/playback,
  provider contracts, and provider DOM helpers.
- Component: panel states/interactions, Ask providers, popup/options, accessibility.
- Integration: YouTube lifecycle, stale-load aborts, playback, storage, messaging,
  detached-controller isolation, exact iframe preservation, and floating-card geometry.
- Build audit: exact host permissions, no provider API or credential handling.
- Manual: unpacked extension against live YouTube, ChatGPT, and Gemini pages.
