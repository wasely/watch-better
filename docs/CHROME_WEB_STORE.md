# Chrome Web Store launch checklist

WatchBetter is a pre-release Chrome extension. Complete the live checks below
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
- State that provider embedding can require normal-tab sign-in and may need
  compatibility updates when provider interfaces change.

## Release gate

- Fresh `npm ci`, `npm run validate`, and `npm run zip` pass.
- Load the production build from `.output/chrome-mv3/` in a clean Chrome profile.
- Verify ChatGPT, Gemini, and DeepSeek frame load, sign-in fallback, explicit single send,
  provider switching, and errors.
- Verify transcript load, search, selection, copy, seek, SPA navigation, theater,
  fullscreen, 200% zoom, and dark/light themes.
- Inspect the packaged manifest and archive; include no source maps, credentials,
  private data, test output, or unrelated files.
- Confirm the listing privacy disclosures match `PRIVACY.md` and actual behavior.

Do not begin paid promotion until the submitted build is approved and the public
store URL works from a clean browser profile.
