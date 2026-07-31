# Architecture

## Runtime surfaces

WatchBetter is a WXT Manifest V3 extension with five production surfaces:

1. `youtube.content.tsx` mounts one React Shadow Root panel on supported YouTube
   watch pages.
2. `WatchBetterRuntime.tsx` owns settings, transcript, playback, Ask, and jump-cut
   state.
3. `background.ts` validates extension messages and routes work between YouTube
   and provider tabs.
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
Ask panel -> typed background message -> signed-in provider tab
                                            |
                                            v
Ask panel <- typed rendered-text result <- provider content script
```

The first turn starts a clean provider conversation and includes bounded transcript
context. Follow-up turns contain only the new question and continue in that provider
tab. Switching providers or selecting **New chat** makes the next turn start clean.

No provider credential, cookie, token, or API key crosses this flow. No direct model
API is called.

## Provider adapter

`src/services/web-chat.ts` is the provider allowlist and selector contract.
`src/services/web-chat-dom.ts` handles composer input, submit fallback, visible
response extraction, and generation-state detection. `web-chat.content.ts` polls for
a stable rendered answer with a three-minute timeout.

The adapter is intentionally limited to:

- `https://chatgpt.com/*`
- `https://gemini.google.com/*`

Provider UI changes can break selectors. Failures are explicit; WatchBetter opens
the provider tab so the user can sign in or inspect the unfinished response.

## YouTube lifecycle

One controller owns each YouTube SPA generation. It aborts stale transcript loads,
resets video-scoped selection, reconnects after video-element replacement, keeps one
extension host first in the right rail, and unmounts outside supported watch pages.
The extension never deletes or reparents YouTube or third-party content.

## Storage

- Local: validated WatchBetter settings only.
- Memory: default transcript cache and current Ask UI state.
- Session storage: optional bounded transcript cache (three documents; two million
  serialized characters per document).

Version 2 settings use `watchbetter:settings:v2`. No conversations or provider
secrets are stored.

## Messaging

Public extension requests are strict discriminated unions:

- runtime status/enable
- panel status/restore
- settings update/open
- `webchat:open`
- `webchat:get-status`
- `webchat:send`

Provider-page requests use a separate internal allowlist with status and send only.
Unknown fields, unsupported providers, empty messages, and messages over 24,000
characters are rejected.

## Permissions

- `storage` for typed settings and optional session cache.
- YouTube host access for the panel and captions.
- ChatGPT/Gemini host access for the user-initiated web-session bridge.

There is no `tabs`, `cookies`, `scripting`, `tabCapture`, clipboard,
`declarativeNetRequest`, broad-host, iframe-header bypass, or remote-code permission.
Standard tab methods are used to open/query already-allowlisted provider pages.

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
- Manual: unpacked extension against live YouTube, ChatGPT, and Gemini pages.
