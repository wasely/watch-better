# Production readiness and compatibility research

Checked 2026-08-07. Scope: current WXT/Chrome Manifest V3 build; official or
first-party sources only. This is a release decision record, not legal advice.

## Decision

**Not yet safe to call public/release-ready.** Automated tests and responsive
harness coverage are strong, but the live cross-platform gate is still open and
the provider-web-UI design needs written provider approval or qualified legal
review before public distribution.

The honest support promise is **current desktop Google Chrome on supported
Windows, macOS, and Linux systems, on ordinary prerecorded `youtube.com/watch`
pages with usable captions**. Chrome Web Store extensions can be installed only
on computers, not mobile devices even in desktop mode
([Chrome Web Store Help](https://support.google.com/chrome_webstore/answer/1698338)).
Do not claim Android, iOS/iPadOS, mobile YouTube, or live support. Desktop Shorts
have automated coverage; a live Short smoke test remains required before release.

## Release blockers

1. **Provider authorization / terms review.** The extension programmatically
   drives consumer web UIs and extracts their responses. OpenAI's consumer Terms
   prohibit programmatic extraction of data or Output and bypassing protective
   measures ([OpenAI Terms of Use](https://openai.com/policies/row-terms-of-use/)).
   YouTube's Terms restrict automated access, reproduction/use of Content, and
   interference with security/use-limiting features absent permission or an
   applicable legal exception
   ([YouTube Terms](https://www.youtube.com/t/terms)).
   Obtain written authorization or counsel's approval for each shipped provider;
   otherwise do not publish that integration. The ChatGPT response-scraping path
   is the clearest blocker.
2. **Security-header removal needs explicit review.** The package removes provider
   CSP/X-Frame-Options and related response/request headers for selected subframes.
   Google's unwanted-software policy treats disabling or circumventing protection
   measures as affecting another program's integrity unless performed at the
   user's explicit, informed direction
   ([Google Unwanted Software Policy](https://help.youtube.com/about/unwanted-software-policy.html)).
   This behavior, its reason, scope, risks, and undo behavior must be disclosed to
   users and Chrome Web Store reviewers; provider permission remains preferable.
3. **Live evidence remains missing.** Pass the matrix below with the production
   ZIP loaded in clean profiles. Do not convert automated/harness evidence into a
   live-pass claim. Chrome explicitly requires testing the production extension
   before upload
   ([Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)).

## Platform baseline and test matrix

The code uses `chrome.storage.session` / `setAccessLevel` (Chrome 102+), CSS
container queries (Chrome 105+), and `color-mix()` throughout the shipped UI
(Chrome 111+). Add `minimum_chrome_version: "111"` or test and document an
equivalent higher floor; Chrome Web Store otherwise allows older Chrome versions
to install, while the manifest key prevents incompatible installs
([Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage),
[container queries in Chrome 105](https://developer.chrome.com/blog/new-in-chrome-105),
[`color-mix()` support](https://developer.chrome.com/docs/css-ui/css-color-mix),
[minimum Chrome version](https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version)).

Implementation note (2026-08-13): the shipped minimum is now Chrome 133 because
exact iframe-preserving detach uses `Element.moveBefore()`. This supersedes the
original Chrome 111 research floor.

Run at least one clean-profile end-to-end pass per row. Use the latest stable
Chrome available on each OS and record Chrome/OS version, display server, browser
zoom, OS scale, video URL/type, caption track, result, screenshot, and console
errors.

| Platform | Required live coverage                                                                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows  | Supported Windows 10 and Windows 11; 100%, 125%, 150%, 200% display scale; keyboard and mouse/touchpad.                                                                                                                                |
| macOS    | Supported macOS 13+; Intel and Apple Silicon if available; Retina and external non-Retina display; keyboard navigation and VoiceOver spot check.                                                                                       |
| Linux    | One supported Debian/Ubuntu-family and one Fedora/openSUSE-family install; Wayland **and** X11; keyboard, mouse, copy, provider sign-in, panel resize. Chrome documents Wayland/X11 differences specifically for copy/paste and input. |

Google's current supported OS floors are Windows 10+, macOS 13+, and selected
64-bit Ubuntu, Debian, openSUSE, and Fedora distributions on supported Intel or ARM
hardware
([Chrome system requirements](https://support.google.com/chrome/a/answer/7100626)).
Chrome supports both Linux Wayland and X11 and documents possible differences in
copy/paste and input behavior
([Chrome Linux install troubleshooting](https://support.google.com/chrome/answer/6315198)).

For every OS, exercise:

- Install/update/uninstall; cold browser start; extension reload; clean and
  existing provider sessions; blocked third-party cookies; private/managed
  profiles only as documented unsupported or supported.
- YouTube SPA navigation across at least five videos, back/forward, reload, player
  replacement, normal/theater/fullscreen, panel collapse/restore, dark/light/system
  theme, transcript fetch/search/select/copy/seek, provider switch, single explicit
  send, follow-up, new chat, timeout/error/retry, and zero uncaught console errors.
- Viewports 1024×768, 1280×720, 1366×768, 1440×900, 1920×1080, and 2560×1440;
  browser zoom 80%, 100%, 125%, 150%, 200%, and 400%; OS scaling combinations
  above. At every size: no horizontal page/panel scroll, overlap, clipped focus,
  unreachable control, duplicate panel, or unexpected YouTube layout shift.
- Panel/container widths around every current breakpoint: 180, 207, 208, 239,
  240, 319, 320, 359, 360, 402, and 480 CSS px; heights 366, 526, 600, and 706
  CSS px. Verify one pixel below/at/above each breakpoint and with long translated
  labels, long video titles, and 2-hour transcripts.

CSS pixels deliberately abstract physical pixel density, so high-DPI testing must
vary both available CSS viewport and OS scale rather than treating screenshot
resolution as layout width. WCAG 2.2 requires lossless reflow at 320 CSS px for
vertical content, text enlargement to 200%, keyboard operation, visible and
unobscured focus, minimum contrast, and at least 24×24 CSS-px pointer targets
([WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[Reflow explanation](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)).
Chrome's extension guidance also requires keyboard navigation, visible focus,
semantic/native controls, and accessible names/ARIA where native HTML is
insufficient
([Chrome extension accessibility](https://developer.chrome.com/docs/extensions/develop/ui/a11y)).

Accessibility gate: keyboard-only complete flows with no trap; correct tablist
arrow-key behavior; focus restored after collapse/dialog/state changes; screen
reader names/state announcements; 200% text zoom and 400% reflow; reduced motion;
forced-colors/high-contrast; light/dark contrast; non-color-only status; touch and
switch-sized targets. Run automated axe plus manual NVDA/Windows and VoiceOver/macOS
spot checks; automation alone is not a pass.

## YouTube surface contract

- **Supported:** desktop, prerecorded `/watch?v=…` pages with a caption track.
  YouTube itself guarantees a full transcript only for videos that have captions
  ([YouTube transcript help](https://support.google.com/youtube/answer/15930243)).
- **Expected unavailable state:** captions missing, disabled, still processing,
  unsupported language, very long/poor audio, silence, overlapping speakers, or
  multilingual speech. YouTube lists all of these as reasons automatic captions
  may not appear
  ([YouTube automatic captions](https://support.google.com/youtube/answer/6373554)).
  The extension must fail visibly and non-destructively.
- **Shorts:** automatic captions can exist. The runtime accepts desktop
  `/shorts/<videoId>` routes, uses the active reel's details area for the panel, and
  reuses the caption/playback flow. A live Short check remains required before release.
- **Live:** keep unsupported. Live automatic captions are English-only, require
  normal latency and channel/stream enablement, may be unavailable, and are
  regenerated differently after the stream ends
  ([YouTube automatic captions](https://support.google.com/youtube/answer/6373554),
  [live caption requirements](https://support.google.com/youtube/answer/3068031)).
- **Mobile:** unsupported by the Chrome extension platform. A separate mobile web
  or native product would be a new project, not a responsive patch.
- **Other routes:** `/embed`, channel, search, home, and Studio pages must be
  negative-tested to confirm the panel never mounts. This protects the product's
  stated single purpose and avoids unexpected page modification.

YouTube DOM/player payloads and provider DOMs are not published extension APIs.
Treat selectors, caption extraction, iframe policy, and provider composer/response
adapters as volatile: feature-detect, show retryable errors, retain tab fallbacks,
and require a small live canary suite before every release.

## Chrome Web Store gate

- ZIP only production output, with `manifest.json` at the archive root; verify name,
  monotonically increased version, icons, ≤132-character description, exact
  permissions/hosts, and no source maps, secrets, test/harness files, or remote
  executable code
  ([prepare/upload rules](https://developer.chrome.com/docs/webstore/prepare),
  [Manifest V3 remote-code rules](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)).
- Keep one narrow, accurate purpose. Every requested permission must be required by
  a currently shipped feature; Chrome requires the narrowest necessary permissions
  and treats excessive permissions as a policy issue
  ([minimum-permission FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
  [single-purpose guidance](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq)).
- Treat video title/URL/captions, selected transcript, prompt, and provider response
  as user data/website content even when processed locally. Declare handling and
  sharing consistently in the listing Privacy tab, listing copy, in-product send
  disclosure, and privacy policy; name ChatGPT/OpenAI and Gemini/Google
  as recipients. Local-only processing still requires disclosure
  ([Chrome user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
  [privacy-policy requirements](https://developer.chrome.com/docs/webstore/program-policies/privacy)).
- Keep transfer user-initiated and bounded, over HTTPS, with no background sends.
  Immediately before **Send to AI**, state which transcript data goes to which
  provider; the action must remain an affirmative choice. Chrome limits data use
  and transfer to the disclosed single purpose
  ([Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)).
- Supply reviewer instructions for one captioned test video and every provider
  flow. If restricted/paid credentials are required, the dashboard supports test
  credentials and instructions
  ([reviewer test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)).
- Capture listing screenshots only from the submitted production build. Confirm
  support/privacy URLs, developer contact, branding attribution/no implied provider
  endorsement, and the exact unsupported surfaces above.

## Ship criterion

Ship only after: provider/terms blocker resolved in writing; `npm ci`, canonical
validation, ZIP audit, and clean install pass; every OS row has evidence; all zoom,
breakpoint, accessibility, caption/error, SPA/mode, clipboard, and provider flows
pass; privacy/listing/dashboard disclosures match behavior; and the exact ZIP
tested is the ZIP submitted. Any unavailable row remains an explicit release
blocker, not an assumed pass.
