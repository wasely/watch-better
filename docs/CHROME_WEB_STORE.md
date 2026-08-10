# Chrome Web Store launch checklist

Watch Better is a pre-release Chrome extension. Complete the live checks below
before submitting version 0.1.0.

## Listing copy

**Short description**

Search, copy, and navigate YouTube transcripts, then send selected context to
ChatGPT, Gemini, or DeepSeek from a focused companion panel.

**Single purpose**

Help people understand and work with captioned YouTube videos faster through a
searchable transcript and an explicit transcript-to-AI workflow.

## Required listing material

- Use the packaged 128px icon from `public/icon/128.png`.
- Capture real extension screenshots after the live test; do not use harness-only
  or generated screenshots as product evidence.
- Provide an accurate support URL and this repository's `PRIVACY.md` URL.
- Disclose YouTube, ChatGPT, Gemini, DeepSeek, storage, `declarativeNetRequest`, and
  `webNavigation` access exactly as documented in the README.
- State that ChatGPT/Gemini embedding can require normal-tab sign-in, DeepSeek uses
  a full tab, and provider interfaces may need compatibility updates.

## Release gate

- Fresh `npm ci`, `npm run validate`, and `npm run zip` pass.
- CI validation passes on Windows, macOS, and Linux with the pinned Node/npm
  dependency graph.
- Load the production build from `.output/chrome-mv3/` in a clean Chrome profile.
- Verify ChatGPT/Gemini frame load, DeepSeek full-tab routing, sign-in fallback,
  explicit single send, provider switching, and errors.
- Verify transcript load, search, selection, copy, seek, SPA navigation, theater,
  fullscreen, 200% zoom, and dark/light themes.
- Inspect the packaged manifest and archive; include no source maps, credentials,
  private data, test output, or unrelated files.
- Confirm the listing privacy disclosures match `PRIVACY.md` and actual behavior.

## Supported-platform disclosure

- Chrome 111+ on supported desktop Windows, macOS, Linux, and ChromeOS.
- One OS-neutral MV3 ZIP; no native binaries or OS-specific runtime paths.
- Chrome on Android and iOS does not install Chrome extensions and is not supported.
- Before public promotion, spot-check the live unpacked build on Windows, macOS, and
  Linux; on Linux cover the available Wayland or X11 session and record which one ran.

Do not begin paid promotion until the submitted build is approved and the public
store URL works from a clean browser profile.
