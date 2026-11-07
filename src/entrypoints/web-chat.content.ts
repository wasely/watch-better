import { browser } from 'wxt/browser';

import {
  isProviderStartUrl,
  isWebChatFrameBinding,
  isWebChatPageRequest,
  providerForHostname,
  type WebChatPageResponse,
} from '@/services/web-chat';
import {
  composerText,
  fillComposer,
  firstVisible,
  focusComposerAtEnd,
  isGenerating,
  responseTexts,
  submitComposerWhenReady,
} from '@/services/web-chat-dom';

/** Tight: every wait here is on the critical path between a click and a sent prompt. */
const POLL_INTERVAL_MS = 60;
const COMPOSER_TIMEOUT_MS = 15_000;
/** Status answers must not block the panel's poll loop, so they barely wait at all. */
const STATUS_TIMEOUT_MS = 250;
const FILL_TIMEOUT_MS = 1_500;
const SUBMIT_READY_TIMEOUT_MS = 5_000;
const SUBMIT_RETRY_TIMEOUT_MS = 1_500;
const SUBMIT_CONFIRM_TIMEOUT_MS = 3_000;
const RESPONSE_TIMEOUT_MS = 180_000;
const RESPONSE_POLL_INTERVAL_MS = 250;
const STABLE_RESPONSE_POLLS = 3;

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const waitForComposer = async (
  selectors: readonly string[],
  timeout = COMPOSER_TIMEOUT_MS,
): Promise<HTMLElement | null> => {
  const deadline = Date.now() + timeout;
  do {
    const composer = firstVisible(selectors);
    if (composer) return composer;
    await delay(POLL_INTERVAL_MS);
  } while (Date.now() < deadline);
  return null;
};

/** Rich editors settle a frame or two after the insert; the old fixed 150ms just guessed. */
const waitForComposerText = async (
  composer: HTMLElement,
  expected: string,
): Promise<boolean> => {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const normalizedExpected = normalize(expected);
  const prefix = normalizedExpected.slice(0, 120);
  const suffix = normalizedExpected.slice(-80);
  const deadline = Date.now() + FILL_TIMEOUT_MS;
  do {
    const actual = normalize(composerText(composer));
    if (
      actual === normalizedExpected ||
      (actual.length >= normalizedExpected.length * 0.92 &&
        actual.startsWith(prefix) &&
        actual.endsWith(suffix))
    )
      return true;
    await delay(POLL_INTERVAL_MS);
  } while (Date.now() < deadline);
  return false;
};

/** The composer empties (or generation starts) the moment a provider accepts a prompt. */
const waitForSubmission = async (
  definition: NonNullable<ReturnType<typeof providerForHostname>>,
  composer: HTMLElement,
  responseCount: number,
): Promise<boolean> => {
  const deadline = Date.now() + SUBMIT_CONFIRM_TIMEOUT_MS;
  do {
    if (
      composerText(composer) === '' ||
      isGenerating(definition) ||
      responseTexts(definition).length > responseCount
    )
      return true;
    await delay(POLL_INTERVAL_MS);
  } while (Date.now() < deadline);
  return false;
};

const waitForStableResponse = async (
  definition: NonNullable<ReturnType<typeof providerForHostname>>,
  responseCount: number,
): Promise<string | null> => {
  const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
  let previous = '';
  let stablePolls = 0;
  do {
    const responses = responseTexts(definition);
    const text = responses.length > responseCount ? (responses.at(-1) ?? '') : '';
    if (text && !isGenerating(definition)) {
      stablePolls = text === previous ? stablePolls + 1 : 0;
      previous = text;
      if (stablePolls >= STABLE_RESPONSE_POLLS) return text;
    } else {
      stablePolls = 0;
      previous = text;
    }
    await delay(RESPONSE_POLL_INTERVAL_MS);
  } while (Date.now() < deadline);
  return null;
};

const startNewConversation = async (
  definition: NonNullable<ReturnType<typeof providerForHostname>>,
): Promise<HTMLElement> => {
  if (!isProviderStartUrl(definition, location.href)) {
    const control = firstVisible(definition.newConversationSelectors);
    if (!control)
      throw new Error(
        `${definition.displayName} new-chat control is unavailable. Open it in a full tab and start a new chat.`,
      );
    control.click();
  }

  const deadline = Date.now() + COMPOSER_TIMEOUT_MS;
  do {
    const composer = firstVisible(definition.composerSelectors);
    if (
      composer &&
      isProviderStartUrl(definition, location.href) &&
      composerText(composer) !== ''
    )
      fillComposer(composer, '');
    if (
      composer &&
      composerText(composer) === '' &&
      (isProviderStartUrl(definition, location.href) ||
        responseTexts(definition).length === 0)
    )
      return composer;
    await delay(POLL_INTERVAL_MS);
  } while (Date.now() < deadline);
  throw new Error(`${definition.displayName} did not open a clean conversation.`);
};

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://gemini.google.com/*'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    const definition = providerForHostname(location.hostname);
    if (!definition) return;
    const watchBetterOrigin = new URL(browser.runtime.getURL('/')).origin;
    let activeSend = false;
    let boundSessionId: string | null = null;

    const announceReady = (sessionId: string) =>
      browser.runtime
        .sendMessage({
          type: 'webchat:frame-ready',
          provider: definition.id,
          sessionId,
        })
        .catch(() => undefined);

    const bindToWatchBetterPanel = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent) return;
      if (
        event.origin !== 'https://www.youtube.com' &&
        event.origin !== watchBetterOrigin
      )
        return;
      if (!isWebChatFrameBinding(event.data)) return;
      if (event.data.provider !== definition.id) return;
      boundSessionId = event.data.sessionId;
      void announceReady(boundSessionId);
    };

    const respond = async (
      message: unknown,
    ): Promise<WebChatPageResponse | undefined> => {
      if (!isWebChatPageRequest(message)) return undefined;

      let composer = await waitForComposer(
        definition.composerSelectors,
        message.type === 'watchbetter:webchat-page-status'
          ? STATUS_TIMEOUT_MS
          : COMPOSER_TIMEOUT_MS,
      );
      if (message.type === 'watchbetter:webchat-page-status')
        return composer
          ? { ok: true, type: 'webchat-page:ready' }
          : {
              ok: false,
              type: 'webchat-page:error',
              code: 'not-ready',
              message: `Sign in to ${definition.displayName}, then return to YouTube.`,
            };

      if (message.type === 'watchbetter:webchat-page-focus') {
        if (!composer)
          return {
            ok: false,
            type: 'webchat-page:error',
            code: 'not-ready',
            message: `${definition.displayName} composer is not ready.`,
          };
        focusComposerAtEnd(composer);
        return { ok: true, type: 'webchat-page:focused' };
      }

      if (activeSend)
        return {
          ok: false,
          type: 'webchat-page:error',
          code: 'send-failed',
          message: `${definition.displayName} is already answering.`,
        };
      if (!composer)
        return {
          ok: false,
          type: 'webchat-page:error',
          code: 'not-ready',
          message: `Open ${definition.displayName} and sign in first.`,
        };

      activeSend = true;
      try {
        if (message.newConversation) composer = await startNewConversation(definition);
        const responseCount = responseTexts(definition).length;
        fillComposer(composer, message.message);
        if (!(await waitForComposerText(composer, message.message.trim()))) {
          fillComposer(composer, message.message);
          // Rich provider editors can virtualize long drafts and make their DOM text
          // unverifiable even when the send button holds the complete prompt. Submit
          // once, then use the provider's own empty-composer/generation state as truth.
        }

        let submitted =
          (await submitComposerWhenReady(definition, composer, {
            timeoutMs: SUBMIT_READY_TIMEOUT_MS,
          })) && (await waitForSubmission(definition, composer, responseCount));
        // A provider can acknowledge a programmatic click only after its UI settles.
        // Retry once only while the same draft is visibly still waiting in the composer.
        if (submitted === false && composerText(composer) !== '')
          submitted =
            (await submitComposerWhenReady(definition, composer, {
              timeoutMs: SUBMIT_RETRY_TIMEOUT_MS,
            })) && (await waitForSubmission(definition, composer, responseCount));

        if (!submitted)
          return {
            ok: false,
            type: 'webchat-page:error',
            code: 'send-failed',
            message: `${definition.displayName} did not start the answer. Try again.`,
          };

        if (message.type === 'watchbetter:webchat-page-prime') {
          focusComposerAtEnd(composer);
          return { ok: true, type: 'webchat-page:primed' };
        }

        // Ask remains fire-and-view. Smart Skip explicitly waits because validated
        // structured output drives local playback decisions.
        if (message.type === 'watchbetter:webchat-page-send')
          return { ok: true, type: 'webchat-page:submitted' };
        const responseText = await waitForStableResponse(definition, responseCount);
        if (responseText)
          return { ok: true, type: 'webchat-page:analysis', text: responseText };

        return {
          ok: false,
          type: 'webchat-page:error',
          code: 'response-timeout',
          message: `${definition.displayName} did not finish the analysis within three minutes.`,
        };
      } catch (error) {
        return {
          ok: false,
          type: 'webchat-page:error',
          code: 'send-failed',
          message:
            error instanceof Error
              ? error.message
              : `${definition.displayName} could not send the prompt.`,
        };
      } finally {
        activeSend = false;
      }
    };

    // WebExtension message listeners may return a promise response.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    browser.runtime.onMessage.addListener(respond);
    window.addEventListener('message', bindToWatchBetterPanel);
    window.addEventListener('load', () => {
      if (boundSessionId) void announceReady(boundSessionId);
    });
  },
});
