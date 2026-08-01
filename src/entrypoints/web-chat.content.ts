import { browser } from 'wxt/browser';

import {
  isWebChatFrameBinding,
  isWebChatPageRequest,
  providerForHostname,
  type WebChatPageResponse,
} from '@/services/web-chat';
import {
  composerText,
  fillComposer,
  firstVisible,
  isGenerating,
  pressEnter,
  responseTexts,
} from '@/services/web-chat-dom';

const POLL_INTERVAL_MS = 300;
const COMPOSER_TIMEOUT_MS = 15_000;
const RESPONSE_TIMEOUT_MS = 180_000;
const STABLE_RESPONSE_MS = 1_800;

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

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://gemini.google.com/*'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    const definition = providerForHostname(location.hostname);
    if (!definition) return;
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

    const bindToYouTubePanel = (event: MessageEvent<unknown>) => {
      if (event.origin !== 'https://www.youtube.com') return;
      if (!isWebChatFrameBinding(event.data)) return;
      if (event.data.provider !== definition.id) return;
      boundSessionId = event.data.sessionId;
      void announceReady(boundSessionId);
    };

    const respond = async (
      message: unknown,
    ): Promise<WebChatPageResponse | undefined> => {
      if (!isWebChatPageRequest(message)) return undefined;

      const composer = await waitForComposer(
        definition.composerSelectors,
        message.type === 'watchbetter:webchat-page-status'
          ? 1_500
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
        const baseline = responseTexts(definition);
        const baselineLast = baseline.at(-1) ?? '';
        fillComposer(composer, message.message);
        await delay(150);
        if (composerText(composer) !== message.message.trim())
          throw new Error(`${definition.displayName} did not accept the prompt.`);

        const sendButton = firstVisible(definition.sendSelectors);
        if (sendButton instanceof HTMLButtonElement && !sendButton.disabled)
          sendButton.click();
        else pressEnter(composer);

        const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
        let candidate = '';
        let candidateSince = 0;
        do {
          await delay(POLL_INTERVAL_MS);
          const current = responseTexts(definition);
          const latest = current.at(-1) ?? '';
          const isNew = current.length > baseline.length || latest !== baselineLast;
          if (!isNew || !latest) continue;
          if (latest !== candidate) {
            candidate = latest;
            candidateSince = Date.now();
            continue;
          }
          if (
            !isGenerating(definition) &&
            Date.now() - candidateSince >= STABLE_RESPONSE_MS
          )
            return { ok: true, type: 'webchat-page:response', text: candidate };
        } while (Date.now() < deadline);

        return {
          ok: false,
          type: 'webchat-page:error',
          code: 'response-timeout',
          message: `${definition.displayName} did not finish within three minutes. Open its tab to check the response.`,
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
    window.addEventListener('message', bindToYouTubePanel);
    window.addEventListener('load', () => {
      if (boundSessionId) void announceReady(boundSessionId);
    });
  },
});
