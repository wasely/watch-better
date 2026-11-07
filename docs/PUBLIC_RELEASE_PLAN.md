# Watch Better public release plan

Prepared September 9, 2026. Planning only; no submission or feature changes made.

## Outcome and scope

Finish the existing extension and publish a tested Chrome Web Store package. Keep
Transcript, Ask, Quick Learn, detachable cards, and Smart Skip. Prioritize broken
flows, speed, compatibility, and release material over new features or redesigns.
The developer account is already verified, per the owner.

Target Chrome 133+ on supported Windows, macOS, Linux, and ChromeOS. Test the
minimum version and current stable Chrome. Small screens, touch-capable laptops,
keyboard operation, high DPI, and browser zoom are part of desktop compatibility.
Chrome on Android/iPhone/iPad cannot install this extension; mobile requires a
separate product and feasibility plan. A responsive web app alone cannot inject
controls into the YouTube mobile app. [Google compatibility guidance][compatibility]

## Findings from this checkout

- Existing WXT/React/TypeScript Manifest V3 application, version 0.1.8, with tests,
  a fixture harness, icons, privacy documentation, and Windows/macOS/Linux CI.
- Fresh local `npm run validate` passed September 9: formatting, lint, strict
  TypeScript, 36 test files / 264 tests, and production build (677.3 kB total).
  This planning audit did not perform live-browser or other-OS verification.
- Many uncommitted changes already exist. Preserve them and identify the exact
  release snapshot before making fixes.
- `docs/STATUS.md` records earlier offline and clean-profile successes but leaves
  signed-in providers, live playback, fullscreen, and restart checks open.
- `PRIVACY.md` still describes thumbnail uploads and clipboard access; current
  decisions keep thumbnails local. Store and test documents repeat obsolete flows
  and the store checklist still names version 0.1.0. Reconcile against source and
  observed behavior before publishing anything.
- Embedded providers use DOM automation and header changes. The frame rule removes
  CSP and other security headers for provider subframes within a tab. Review its
  actual scope, routing, cleanup, security implications, and provider compatibility
  first. Store acceptance has not been established.
- Quick Learn observes page mutations and scans affected roots. Profile it on a
  busy feed before deciding which optimizations are worthwhile.

## Execution order

### 1. Establish the release baseline

Run canonical validation, inspect the production manifest, and load the actual
production extension in an isolated Chrome profile. Record Chrome version, package
version, console errors, and known failures. Prioritize user-blocking failures.
Preserve the existing architecture and working behavior.

### 2. Resolve the highest-risk dependency: signed-in AI

Test ChatGPT and Gemini from fresh signed-out and signed-in sessions: login
instructions, first Ask, selected-text send, follow-up, provider switch, new chat,
Quick Learn, optional deep scan, two concurrent cards, and provider outages or
rate limits. Confirm correct video context, single submission, visible progress,
bounded timeouts, retry, and no cross-card leakage.

Keep transcript and local skipping functional when AI is unavailable. Make the
data transfer clear before the triggering action. Audit frame-header exceptions,
frame verification, and cleanup against the documented behavior and MV3 rules.
Remote provider pages need a specific review; do not assume every iframe is banned
or that the existing integration is approved. [MV3 requirements][mv3]

If embedding cannot pass reliability/security review, present the concrete failure
and a scoped alternative before changing the established in-page experience.
Do not silently remove a core feature or add a backend/API-key requirement.

### 3. Finish real YouTube behavior

Verify captions on human-captioned, automatic, translated, unavailable, short, and
two-hour videos; watch pages and Shorts; rapid navigation and browser back/forward.
Check search, selection, copy, seek, follow, retry, popup, settings, and reload.
Confirm Quick Learn survives feed/hover replacement and identifies its source video.

Verify detach, drag, resize, minimize, restore, multiple cards, and close cleanup.
For Smart Skip, observe speech boundaries, ad suspension, unchanged user speed,
per-jump disable, undo, stale-map rejection, and the automatic jump budget. Missing
captions must produce an honest unavailable state, never invented content.

### 4. Measure and improve speed

Capture before/after traces using the same video, feed, hardware, and Chrome build.
Measure panel startup, click feedback, transcript rendering/search, caption fetch,
provider load, first answer, main-thread work, and retained memory separately.

Initial acceptance targets, to verify rather than advertise as achieved:

- Local click/search feedback at p95 under 100 ms in representative stress runs.
- No recurring extension-owned tasks over 50 ms during ordinary scrolling/playback.
- No unsolicited AI startup or transcript transfer; load only requested providers.
- No duplicate caption requests for the same active task; abort stale requests.
- No growing count of detached DOM nodes, frames, listeners, or session routes after
  repeated navigation and card open/close cycles, measured after garbage collection.

Optimize measured hotspots: deduplicate overlapping mutation roots, batch DOM reads
and writes, bound caches, release closed sessions, and virtualize long lists only
if traces justify it. Preserve active conversations when moving cards. Provider
network and generation time remain external; show status and recovery controls.

### 5. Verify supported devices and layouts

Run automated validation on Windows, macOS, and Linux; record actual CI results.
Run real extension smoke checks on all four claimed desktop OS families, including
ChromeOS. Build success is not evidence of device functionality. If an OS/device
is unavailable, record that gap and obtain a tester run before claiming it verified.

Inspect dark/light panels at 320, 402, and 480 px, laptop and large-screen layouts,
200% zoom, high DPI, theater/fullscreen, keyboard focus, reduced motion, and touch
targets. Exercise loading, empty, error, and success states. Use screenshots of
real components for layout checks, then confirm on live YouTube.

### 6. Prepare the public package and listing

Reconcile README, privacy policy, store checklist, test matrix, and release status
with the final behavior. Verify public support/privacy URLs without signing in.
Document the single purpose, every permission, processed data, provider transfer,
retention/deletion, caption limitations, and provider sign-in requirements.
[Store privacy fields][privacy]

Prepare the 128 px icon, required 440 x 280 promotional image, and 3–5 real product
screenshots at 1280 x 800. Write concise listing copy and reproducible reviewer
instructions with public sample videos and a signed-out recovery path.
[Store image requirements][images]

From the final release snapshot, run clean-install validation and ZIP packaging.
Inspect the archive for manifest-at-root, correct version, production-only files,
no secrets/test artifacts, and no remote executable extension code. Record the
ZIP hash. Test installation, browser restart/service-worker wake, settings
persistence, and upgrade from the current development version.

### 7. Submit and verify public installation

Upload the exact tested ZIP to the verified developer account. Complete listing,
privacy, distribution, and test instructions; submit after release gates pass.
Resolve review feedback, then verify the approved public listing and installation
in a fresh profile. Keep the previous release source and a tested fix-forward
process for regressions. Google's review duration is outside our control.
[Publishing process][publish]

## Completion evidence

The release is ready when no critical/high defect remains in advertised flows,
canonical validation passes, live checks have recorded evidence, performance
targets are met or explicitly revised from measurements, compatibility claims
match tested platforms, and privacy/listing text matches the packaged behavior.
Deliver the ZIP, hash, screenshots, listing text, reviewer instructions, test
results, known limitations, and submission/public URL when available.

Fastest path: baseline → provider gate → functional fixes → measured optimization
and compatibility → release package → review. Give a firmer effort estimate after
the provider gate; access to other OS devices and Google review are external waits.

[compatibility]: https://support.google.com/chrome_webstore/answer/1698338?hl=en
[mv3]: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
[privacy]: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
[images]: https://developer.chrome.com/docs/webstore/images
[publish]: https://developer.chrome.com/docs/webstore/publish
