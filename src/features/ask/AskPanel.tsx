import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/components/Icon';
import type { AIContextScope, AIProvider } from '@/features/ask/ai-provider';
import { TranscriptPromptProvider } from '@/features/ask/transcript-prompt-provider';
import type {
  TranscriptDocument,
  TranscriptSegmentId,
} from '@/features/transcript/domain';
import {
  WEB_CHAT_PROVIDERS,
  type WebChatProviderId,
  type WebChatProviderStatus,
} from '@/services/web-chat';

import './AskPanel.css';

const DEFAULT_PROMPT_PROVIDER = new TranscriptPromptProvider();
const EMPTY_SELECTION = new Set<TranscriptSegmentId>();
const PRIME_QUESTION =
  'Use this transcript as the source of truth. Get ready to answer my questions about this video, cite useful timestamps, and say when the transcript does not establish an answer.';

export interface ChatTurnRequest {
  readonly provider: WebChatProviderId;
  readonly message: string;
  readonly newConversation: boolean;
}

export interface ChatTurnResult {
  readonly text: string;
  readonly responseId: string;
  readonly provider: WebChatProviderId;
}

export interface AskPanelProps {
  readonly transcript: TranscriptDocument | null;
  readonly selectedSegmentIds?: ReadonlySet<TranscriptSegmentId>;
  readonly currentTimeSeconds?: number | null;
  readonly initialScope?: AIContextScope;
  readonly provider?: AIProvider;
  readonly providerStatuses?: Partial<Record<WebChatProviderId, WebChatProviderStatus>>;
  readonly primeRequestId?: number;
  readonly onSendWebChat?: (request: ChatTurnRequest) => Promise<ChatTurnResult>;
  readonly onOpenWebChat?: (provider: WebChatProviderId) => void | Promise<void>;
  readonly onPrepareWebChat?: (
    provider: WebChatProviderId,
    sessionId: string,
  ) => void | Promise<void>;
}

type PrimeState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent' }
  | { readonly kind: 'error'; readonly message: string };

const createFrameSessionId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const resolvePrimeScope = (
  initialScope: AIContextScope,
  selectedCount: number,
  currentTimeSeconds: number | null,
): AIContextScope => {
  if (selectedCount > 0) return 'selection';
  if (initialScope === 'current-section' && currentTimeSeconds !== null)
    return 'current-section';
  return 'entire-video';
};

export function AskPanel({
  transcript,
  selectedSegmentIds = EMPTY_SELECTION,
  currentTimeSeconds = null,
  initialScope = 'entire-video',
  provider = DEFAULT_PROMPT_PROVIDER,
  providerStatuses = {},
  primeRequestId = 0,
  onSendWebChat,
  onOpenWebChat,
  onPrepareWebChat,
}: AskPanelProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<WebChatProviderId>('chatgpt');
  const [framePrepared, setFramePrepared] = useState(!onPrepareWebChat);
  const [frameTimedOut, setFrameTimedOut] = useState(false);
  const [framePreparationError, setFramePreparationError] = useState('');
  const [primeState, setPrimeState] = useState<PrimeState>({ kind: 'idle' });
  const providerFrameRef = useRef<HTMLIFrameElement>(null);
  const bindingTimersRef = useRef<readonly number[]>([]);
  const prepareWebChatRef = useRef(onPrepareWebChat);
  const primeSeenRef = useRef(0);

  const providerDefinition = WEB_CHAT_PROVIDERS[selectedProvider];
  const providerStatus = providerStatuses[selectedProvider]?.state ?? 'not-open';
  const providerReady = providerStatus === 'ready';
  const primeSending = primeState.kind === 'sending';
  const frameSessionId = useMemo(
    () => `${selectedProvider}:${createFrameSessionId()}`,
    [selectedProvider],
  );

  useEffect(() => {
    prepareWebChatRef.current = onPrepareWebChat;
  }, [onPrepareWebChat]);

  useEffect(() => {
    if (!prepareWebChatRef.current) {
      setFramePrepared(true);
      setFrameTimedOut(false);
      setFramePreparationError('');
      return;
    }
    let disposed = false;
    setFramePrepared(false);
    setFrameTimedOut(false);
    setFramePreparationError('');
    void Promise.resolve(prepareWebChatRef.current(selectedProvider, frameSessionId))
      .then(() => {
        if (!disposed) setFramePrepared(true);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setFramePreparationError(
          error instanceof Error ? error.message : 'Could not prepare the AI frame.',
        );
      });
    return () => {
      disposed = true;
    };
  }, [frameSessionId, selectedProvider]);

  useEffect(() => {
    if (
      !framePrepared ||
      providerStatus === 'ready' ||
      providerStatus === 'sign-in-required'
    )
      return;
    const timer = window.setTimeout(() => setFrameTimedOut(true), 20_000);
    return () => window.clearTimeout(timer);
  }, [framePrepared, providerStatus]);

  useEffect(
    () => () => {
      for (const timer of bindingTimersRef.current) window.clearTimeout(timer);
    },
    [frameSessionId],
  );

  const bindProviderFrame = useCallback(() => {
    for (const timer of bindingTimersRef.current) window.clearTimeout(timer);
    const postBinding = () => {
      providerFrameRef.current?.contentWindow?.postMessage(
        {
          type: 'watchbetter:webchat-frame-binding',
          provider: selectedProvider,
          sessionId: frameSessionId,
        },
        new URL(providerDefinition.url).origin,
      );
    };
    postBinding();
    bindingTimersRef.current = [100, 500, 1_500].map((delay) =>
      window.setTimeout(postBinding, delay),
    );
  }, [frameSessionId, providerDefinition.url, selectedProvider]);

  const buildTranscriptPrompt = useCallback((): string | null => {
    if (!transcript) return null;
    return provider.buildPrompt({
      transcript,
      scope: resolvePrimeScope(
        initialScope,
        selectedSegmentIds.size,
        currentTimeSeconds,
      ),
      currentTimeSeconds,
      selectedSegmentIds,
      question: PRIME_QUESTION,
    }).text;
  }, [currentTimeSeconds, initialScope, provider, selectedSegmentIds, transcript]);

  useEffect(() => {
    if (
      primeRequestId <= 0 ||
      primeSeenRef.current === primeRequestId ||
      !providerReady ||
      !onSendWebChat
    )
      return;
    const message = buildTranscriptPrompt();
    if (!message) return;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed || primeSeenRef.current === primeRequestId) return;
      primeSeenRef.current = primeRequestId;
      setPrimeState({ kind: 'sending' });
      void onSendWebChat({
        provider: selectedProvider,
        message,
        newConversation: true,
      })
        .then(() => {
          if (!disposed) setPrimeState({ kind: 'sent' });
        })
        .catch((error: unknown) => {
          if (disposed) return;
          setPrimeState({
            kind: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not add transcript context.',
          });
        });
    });
    return () => {
      disposed = true;
    };
  }, [
    buildTranscriptPrompt,
    onSendWebChat,
    primeRequestId,
    providerReady,
    selectedProvider,
  ]);

  const selectProvider = (providerId: WebChatProviderId) => {
    if (providerId === selectedProvider || primeSending) return;
    setPrimeState({ kind: 'idle' });
    setSelectedProvider(providerId);
  };

  const openProviderTab = () => {
    if (!onOpenWebChat) return;
    void Promise.resolve(onOpenWebChat(selectedProvider)).catch((error: unknown) => {
      setPrimeState({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : `Could not open ${providerDefinition.displayName}.`,
      });
    });
  };

  const frameLoading =
    !frameTimedOut &&
    (!framePrepared ||
      (providerStatus !== 'ready' && providerStatus !== 'sign-in-required'));

  return (
    <div className="ct-ask">
      <div className="ct-provider-toolbar">
        <div aria-label="AI provider" className="ct-provider-picker" role="group">
          {(['chatgpt', 'gemini'] as const).map((providerId) => (
            <button
              aria-pressed={selectedProvider === providerId}
              disabled={primeSending}
              key={providerId}
              onClick={() => selectProvider(providerId)}
              type="button"
            >
              {WEB_CHAT_PROVIDERS[providerId].displayName}
              <i
                aria-hidden="true"
                className={`ct-provider-status ct-provider-status--${providerStatuses[providerId]?.state ?? 'not-open'}`}
              />
            </button>
          ))}
        </div>

        <button
          aria-label={`Open ${providerDefinition.displayName} in full tab`}
          className="ct-provider-toolbar__external"
          onClick={openProviderTab}
          title="Open full tab"
          type="button"
        >
          <Icon name="external" />
        </button>
      </div>

      <div
        className={`ct-provider-frame ct-provider-frame--${providerStatus}`}
        data-testid="provider-frame"
      >
        {framePrepared ? (
          <iframe
            allow="autoplay; camera; clipboard-read; clipboard-write; microphone"
            key={frameSessionId}
            onLoad={bindProviderFrame}
            ref={providerFrameRef}
            referrerPolicy="no-referrer"
            src={providerDefinition.url}
            title={`${providerDefinition.displayName} embedded chat`}
          />
        ) : null}

        {framePreparationError || frameLoading ? (
          <div className="ct-provider-frame__loading" role="status">
            {framePreparationError ? null : <span aria-hidden="true" />}
            <strong>
              {framePreparationError
                ? `${providerDefinition.displayName} frame unavailable`
                : `Loading ${providerDefinition.displayName}…`}
            </strong>
            {framePreparationError ? <p>{framePreparationError}</p> : null}
          </div>
        ) : null}

        {primeState.kind === 'sending' ? (
          <div className="ct-provider-frame__notice" role="status">
            Adding transcript context…
          </div>
        ) : null}
        {primeState.kind === 'error' ? (
          <div
            className="ct-provider-frame__notice ct-provider-frame__notice--error"
            role="alert"
          >
            {primeState.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
