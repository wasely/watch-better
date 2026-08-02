# Architecture

## Runtime surfaces

WatchBetter is a WXT Manifest V3 extension with five production surfaces:

1. `youtube.content.tsx` mounts one React Shadow Root panel on supported YouTube
   watch pages.
2. `WatchBetterRuntime.tsx` owns settings, transcript, playback, Ask, and jump-cut
   state.
3. `background.ts` validates extension messages and routes work to an exact provider
   frame ID inside the originating YouTube tab.
4. `web-chat.content.ts` runs only on ChatGPT, Gemini, and DeepSeek, using the rendered page
   composer and assistant response DOM.
5. Popup/options surfaces expose status, restore, settings, and provider links.

The fixture harness renders production components without YouTube or live provider
accounts.

## Data flow

```text
YouTube captions -> normalized transcript -> bounded timestamped prompt
                                            |
                                            v
Transcript Ask -> typed background prompt -> embedded signed-in provider frame
                                                 |
                                                 v
User follow-ups -> provider's own composer -> conversation stays in frame
```

The transcript **Send to AI** action starts a clean provider conversation with
bounded context. Opening Ask or switching providers sends nothing.
Follow-ups and new chats use the provider's own controls inside that frame. Switching
providers lazily loads its separate frame once; both provider frames then stay mounted
across panel tabs, collapse, and YouTube video changes.

No provider credential, cookie, token, or API key crosses this flow. No direct model
API is called.

Before mounting a provider URL, the YouTube panel creates a one-use frame session
ID and registers it with the background worker. After load, the panel sends that
binding into the iframe. The provider content script returns the same binding, and
the background accepts it only when `webNavigation` confirms a direct child frame
of the originating YouTube tab. Stale, nested, wrong-provider, and cross-tab frame
registrations are rejected.

## Provider adapter

`src/services/web-chat.ts` is the provider allowlist and selector contract.
`src/services/web-chat-dom.ts` handles composer input, submit fallback, visible
response extraction, and generation-state detection. `web-chat.content.ts` polls for
a stable rendered answer with a three-minute timeout.

The iframe, frame-bypass script, and adapter are intentionally limited to:

- `https://chatgpt.com/*`
- `https://gemini.google.com/*`

A Chrome session rule removes anti-frame response headers and frame-identifying
fetch headers only for one prepared provider in one YouTube tab. It remains active
for that provider frame's navigations and is removed when the tab closes, leaves a
supported YouTube page, or explicitly resets the frame. Provider UI changes can
break selectors. WatchBetter can open the provider in a normal tab for sign-in.

## YouTube lifecycle

One controller owns each YouTube SPA generation. It aborts stale transcript loads,
resets video-scoped selection, reconnects after video-element replacement, keeps one
extension host first in the right rail, and unmounts outside supported watch pages.
The extension never deletes or reparents YouTube or third-party content.

## Storage

- Local: validated WatchBetter settings only.
- Memory: default transcript cache and current Ask UI state.
- Session storage: optional bounded transcript cache (three documents; two million
  serialized characters per document) plus non-sensitive provider frame IDs.

Version 2 settings use `watchbetter:settings:v2`. No conversations or provider
secrets are stored.

## Messaging

Public extension requests are strict discriminated unions:

- runtime status/enable
- panel status/restore
- settings update/open
- `webchat:open`
- `webchat:frame-prepare`
- `webchat:frame-ready`
- `webchat:frame-reset`
- `webchat:get-status`
- `webchat:send`

Provider-page requests use a separate internal allowlist with status and send only.
Unknown fields, unsupported providers, empty messages, and messages over 24,000
characters are rejected.

## Permissions

- `storage` for typed settings and optional session cache.
- `declarativeNetRequest` for YouTube-initiated provider subframes only.
- `webNavigation` to verify registered provider frames are direct YouTube children.
- YouTube host access for the panel and captions.
- Exact ChatGPT/Gemini/DeepSeek host access for the user-initiated web-session bridge.

There is no requested `tabs`, `cookies`, `scripting`, `tabCapture`, clipboard,
`browsingData`, broad-host, main-frame rewrite, or remote-code permission. Standard
tab methods are used only for the explicit full-tab sign-in fallback.

## Jump-cut boundary

Jump Cut uses padded caption gaps only. It is off by default, suspends during ads or
unsafe timing, and restores the previous playback rate on disable/dispose. Audio
capture and Web Audio routing remain deliberately excluded.

## Verification

- Unit: transcript normalization/search, prompt bounding, settings, gap detection,
  provider contracts, and provider DOM helpers.
- Component: panel states/interactions, Ask providers, popup/options, accessibility.
- Integration: YouTube lifecycle, stale-load aborts, playback, storage, messaging.
- Build audit: exact host permissions, no provider API or credential handling.
- Manual: unpacked extension against live YouTube, ChatGPT, Gemini, and DeepSeek pages.
