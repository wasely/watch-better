# Watch Better Privacy Policy

Last updated: August 25, 2026

Watch Better is a browser extension that adds thumbnail Quick Learn, transcript
navigation, Smart Skip, and optional ChatGPT or Gemini workflows to desktop YouTube.

## Data Watch Better handles

Watch Better processes video titles, URLs, available captions, caption timestamps,
and the transcript rows you select. Quick Learn requests a video's captions only after
you press its thumbnail button, opens an in-page Watch Better card, and submits that
public YouTube thumbnail URL/image plus a bounded, timestamped transcript copy to
embedded Gemini for a direct briefing and follow-up questions.

To make Gemini receive the thumbnail as an image, Watch Better temporarily places the
public thumbnail on the system clipboard, pastes it into Gemini, and restores the prior
clipboard contents immediately. Clipboard contents are not stored, logged, or sent
anywhere else by Watch Better. This happens only after **Quick Learn** is pressed.

When you open **Ask**, Watch Better submits a bounded copy of the current video
transcript to the selected provider with instructions to reply only `READY`. It does
not transfer that context while Ask is hidden. Actual questions remain user-submitted.
Choosing **Send to AI** explicitly submits the
selected rows—or the bounded full transcript when nothing is selected. Providers load inside
Ask. Quick Learn loads embedded Gemini only after its button is pressed. The provider may receive normal
browser request, draft-input, and account-session information and applies its own
privacy, retention, and account policies.

Smart Skip waits for matching captions, then locally identifies bounded caption gaps and
explicit low-value speech. It never captures audio or changes playback speed. Local
skipping does not contact an AI provider. Only pressing **Start deep scan** sends bounded
caption chunks to the selected signed-in provider to find high-confidence semantic
filler. This optional pass uses a separate embedded conversation and never blocks local
skipping. The provider applies its own privacy, retention, and account policies.

## Storage

- Settings are stored in Chrome extension storage.
- Transcripts remain in memory by default.
- If session transcript caching is enabled, the bounded cache is stored only for
  the current browser session.
- Temporary provider-frame identifiers are stored only for the current browser
  session.
- Validated Smart Skip maps are stored only for the current browser session.
- Detached video cards remain only in the current YouTube tab and browser memory.
  Closing a card removes its provider-frame routing identifiers.

Watch Better does not operate a backend, sell data, include advertising, or send
analytics. It does not read or store provider passwords, cookies, authentication
tokens, or API keys.

## Permissions

Watch Better requests access only to YouTube, ChatGPT, and Gemini pages used by its
documented features. It uses Chrome storage for settings and session state,
`declarativeNetRequest` for selected ChatGPT/Gemini subframes, and `webNavigation` to
verify that prompt messages are routed only to the registered direct-child frame.

## Retention and deletion

Session data is cleared when the browser session ends. Uninstalling Watch Better
removes its extension storage through Chrome. Content sent to an AI provider is
retained or deleted according to that provider's controls and policies.

## Questions

Open a [GitHub issue](https://github.com/wasely/watch-better/issues) for privacy
questions without including personal or account data. Report security concerns
privately through [GitHub security advisories](https://github.com/wasely/watch-better/security/advisories/new).
