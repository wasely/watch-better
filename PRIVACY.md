# WatchBetter Privacy Policy

Last updated: August 1, 2026

WatchBetter is a browser extension that adds transcript navigation and an optional
ChatGPT, Gemini, or DeepSeek workflow to desktop YouTube watch pages.

## Data WatchBetter handles

WatchBetter processes the current video's title, URL, available captions, caption
timestamps, and the transcript rows you select. This processing happens locally in
the browser.

When you explicitly choose **Send to AI**, WatchBetter sends the selected transcript
rows—or the full transcript when nothing is selected—to the ChatGPT, Gemini, or DeepSeek page
you selected. Opening the Ask tab loads that provider's website inside the panel.
The provider may receive normal browser request and account-session information and
applies its own privacy, retention, and account policies.

## Storage

- Settings are stored in Chrome extension storage.
- Transcripts remain in memory by default.
- If session transcript caching is enabled, the bounded cache is stored only for
  the current browser session.
- Temporary provider-frame identifiers are stored only for the current browser
  session.

WatchBetter does not operate a backend, sell data, include advertising, or send
analytics. It does not read or store provider passwords, cookies, authentication
tokens, or API keys.

## Permissions

WatchBetter requests access only to YouTube, ChatGPT, Gemini, and DeepSeek pages used by its
documented features. It uses Chrome storage for settings and session state,
`declarativeNetRequest` for the selected provider subframe, and `webNavigation` to
verify that prompt messages are routed only to the registered direct-child frame.

## Retention and deletion

Session data is cleared when the browser session ends. Uninstalling WatchBetter
removes its extension storage through Chrome. Content sent to an AI provider is
retained or deleted according to that provider's controls and policies.

## Questions

Open a [GitHub issue](https://github.com/wasely/watch-better/issues) for privacy
questions without including personal or account data. Report security concerns
privately through [GitHub security advisories](https://github.com/wasely/watch-better/security/advisories/new).
