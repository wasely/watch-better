import { useCallback, useEffect, useRef, useState } from 'react';

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
const PROVIDER_IDS = ['chatgpt', 'gemini', 'deepseek'] as const;
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
  readonly sendRequestId?: number;
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

interface ProviderFrameProps {
  readonly active: boolean;
  readonly provider: WebChatProviderId;
  readonly status: WebChatProviderStatus['state'];
  readonly onPrepareWebChat?: AskPanelProps['onPrepareWebChat'];
  readonly onOpenWebChat?: AskPanelProps['onOpenWebChat'];
}

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

function ProviderFrame({
  active,
  provider,
  status,
  onPrepareWebChat,
  onOpenWebChat,
}: ProviderFrameProps) {
  const definition = WEB_CHAT_PROVIDERS[provider];
  const [sessionId] = useState(() => `${provider}:${createFrameSessionId()}`);
  const [prepared, setPrepared] = useState(!onPrepareWebChat);
  const [timedOut, setTimedOut] = useState(false);
  const [preparationError, setPreparationError] = useState('');
  const [tabError, setTabError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bindingTimersRef = useRef<readonly number[]>([]);
  const prepareRef = useRef(onPrepareWebChat);

  useEffect(() => {
    prepareRef.current = onPrepareWebChat;
  }, [onPrepareWebChat]);

  useEffect(() => {
    if (definition.surface !== 'embedded') return;
    const prepare = prepareRef.current;
    if (!prepare) return;
    let disposed = false;
    void Promise.resolve(prepare(provider, sessionId))
      .then(() => {
        if (!disposed) setPrepared(true);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setPreparationError(
          error instanceof Error ? error.message : 'Could not prepare the AI frame.',
        );
      });
    return () => {
      disposed = true;
    };
  }, [definition.surface, provider, sessionId]);

  useEffect(() => {
    if (definition.surface !== 'embedded') return;
    if (status === 'ready' || status === 'sign-in-required') return;
    const timer = window.setTimeout(() => setTimedOut(true), 20_000);
    return () => window.clearTimeout(timer);
  }, [definition.surface, status]);

  useEffect(
    () => () => {
      for (const timer of bindingTimersRef.current) window.clearTimeout(timer);
    },
    [],
  );

  const bindFrame = useCallback(() => {
    for (const timer of bindingTimersRef.current) window.clearTimeout(timer);
    const postBinding = () => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'watchbetter:webchat-frame-binding',
          provider,
          sessionId,
        },
        new URL(definition.url).origin,
      );
    };
    postBinding();
    bindingTimersRef.current = [100, 500, 1_500].map((delay) =>
      window.setTimeout(postBinding, delay),
    );
  }, [definition.url, provider, sessionId]);

  const ready = status === 'ready' || status === 'sign-in-required';
  const loading = !preparationError && !timedOut && (!prepared || !ready);
  const issue = preparationError
    ? preparationError
    : timedOut && !ready
      ? `${definition.displayName} is taking longer than expected. Open it in a full tab if sign-in is required.`
      : '';

  if (definition.surface === 'tab') {
    const openInTab = () => {
      if (!onOpenWebChat) return;
      setTabError('');
      void Promise.resolve(onOpenWebChat(provider)).catch((error: unknown) => {
        setTabError(
          error instanceof Error ? error.message : 'Could not open DeepSeek.',
        );
      });
    };
    return (
      <div
        aria-hidden={!active}
        className={`ct-provider-frame ct-provider-frame--${status}`}
        data-provider={provider}
        hidden={!active}
      >
        <div className="ct-provider-frame__state">
          <strong>DeepSeek works in a full tab</strong>
          <p>
            DeepSeek blocks embedded panels with a security challenge. Open its normal
            tab, then Send to AI adds transcript context there.
          </p>
          <button
            className="ct-provider-frame__open"
            disabled={!onOpenWebChat}
            onClick={openInTab}
            type="button"
          >
            Open DeepSeek
            <Icon name="external" />
          </button>
          {tabError ? <p role="alert">{tabError}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden={!active}
      className={`ct-provider-frame ct-provider-frame--${status}`}
      data-provider={provider}
      hidden={!active}
    >
      {prepared ? (
        <iframe
          onLoad={bindFrame}
          ref={iframeRef}
          referrerPolicy="no-referrer"
          src={`${definition.url}#watchbetter-frame=${encodeURIComponent(sessionId)}`}
          title={`${definition.displayName} embedded chat`}
        />
      ) : null}

      {issue || loading ? (
        <div className="ct-provider-frame__state" role={issue ? 'alert' : 'status'}>
          {issue ? null : <span aria-hidden="true" />}
          <strong>
            {issue
              ? `${definition.displayName} frame unavailable`
              : `Loading ${definition.displayName}…`}
          </strong>
          {issue ? <p>{issue}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AskPanel({
  transcript,
  selectedSegmentIds = EMPTY_SELECTION,
  currentTimeSeconds = null,
  initialScope = 'entire-video',
  provider = DEFAULT_PROMPT_PROVIDER,
  providerStatuses = {},
  sendRequestId = 0,
  onSendWebChat,
  onOpenWebChat,
  onPrepareWebChat,
}: AskPanelProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<WebChatProviderId>('chatgpt');
  const [mountedProviders, setMountedProviders] = useState<
    ReadonlySet<WebChatProviderId>
  >(() => new Set(['chatgpt']));
  const [primeState, setPrimeState] = useState<PrimeState>({ kind: 'idle' });
  const [handledRequestId, setHandledRequestId] = useState(0);

  const providerDefinition = WEB_CHAT_PROVIDERS[selectedProvider];
  const providerStatus = providerStatuses[selectedProvider]?.state ?? 'not-open';
  const providerReady = providerStatus === 'ready';
  const primeSending = primeState.kind === 'sending';
  const requestPending = sendRequestId > 0 && handledRequestId !== sendRequestId;
  const waitingForProvider =
    requestPending && !providerReady && providerStatus !== 'sign-in-required';
  const signInMessage =
    requestPending && providerStatus === 'sign-in-required'
      ? `Sign in to ${providerDefinition.displayName} before sending.`
      : '';

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
    if (sendRequestId <= 0 || handledRequestId === sendRequestId || !onSendWebChat)
      return;
    const message = buildTranscriptPrompt();
    if (!message) return;
    if (!providerReady) return;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed || handledRequestId === sendRequestId) return;
      setHandledRequestId(sendRequestId);
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
    handledRequestId,
    onSendWebChat,
    sendRequestId,
    providerReady,
    selectedProvider,
  ]);

  const selectProvider = (providerId: WebChatProviderId) => {
    if (providerId === selectedProvider || primeSending) return;
    setMountedProviders((current) => {
      if (current.has(providerId)) return current;
      const next = new Set(current);
      next.add(providerId);
      return next;
    });
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

  return (
    <div className="ct-ask">
      <div className="ct-provider-toolbar">
        <div
          aria-label="AI provider"
          className="ct-provider-picker"
          data-provider={selectedProvider}
          role="group"
        >
          {PROVIDER_IDS.map((providerId) => (
            <button
              aria-pressed={selectedProvider === providerId}
              disabled={primeSending}
              key={providerId}
              onClick={() => selectProvider(providerId)}
              type="button"
            >
              {WEB_CHAT_PROVIDERS[providerId].displayName}
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

      <div className="ct-provider-stage" data-testid="provider-frame">
        {PROVIDER_IDS.filter((providerId) => mountedProviders.has(providerId)).map(
          (providerId) => (
            <ProviderFrame
              active={selectedProvider === providerId}
              key={providerId}
              onOpenWebChat={onOpenWebChat}
              onPrepareWebChat={onPrepareWebChat}
              provider={providerId}
              status={providerStatuses[providerId]?.state ?? 'not-open'}
            />
          ),
        )}

        {primeState.kind === 'sending' ? (
          <div className="ct-provider-frame__notice" role="status">
            Sending transcript to {providerDefinition.displayName}…
          </div>
        ) : null}
        {waitingForProvider ? (
          <div className="ct-provider-frame__notice" role="status">
            Waiting for {providerDefinition.displayName}…
          </div>
        ) : null}
        {primeState.kind === 'sent' ? (
          <div className="ct-provider-frame__notice" role="status">
            Transcript sent to {providerDefinition.displayName}.
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
        {signInMessage ? (
          <div
            className="ct-provider-frame__notice ct-provider-frame__notice--error"
            role="alert"
          >
            {signInMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
