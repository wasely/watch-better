import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { Icon } from '@/components/Icon';
import type { AIContextScope, AIProvider } from '@/features/ask/ai-provider';
import { TranscriptPromptProvider } from '@/features/ask/transcript-prompt-provider';
import type {
  TranscriptDocument,
  TranscriptSegmentId,
} from '@/features/transcript/domain';
import { buildQuickLearnQuestion } from '@/features/quick-learn/quick-learn-prompt';
import {
  WEB_CHAT_PROVIDERS,
  type WebChatProviderId,
  type WebChatProviderStatus,
} from '@/services/web-chat';

import './AskPanel.css';

const DEFAULT_PROMPT_PROVIDER = new TranscriptPromptProvider();
const EMPTY_SELECTION = new Set<TranscriptSegmentId>();
const PROVIDER_IDS = ['gemini', 'chatgpt'] as const;
const PROVIDER_PICKER_LABELS: Readonly<Record<WebChatProviderId, string>> = {
  gemini: 'Google Gemini',
  chatgpt: 'Codex',
};
const PRIME_QUESTION =
  'Load this video transcript as context for my next message. Do not summarize it or answer any question yet. Reply only READY. For later questions, cite useful timestamps and say when the transcript does not establish an answer.';

const videoAccentStyle = (videoId: string): CSSProperties => {
  const hue = [...videoId].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) % 360,
    210,
  );
  return { '--ct-video-accent': `hsl(${hue} 78% 62%)` } as CSSProperties;
};

function QuickLearnThumbnail({
  src,
  videoTitle,
}: {
  readonly src: string | undefined;
  readonly videoTitle: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed)
    return (
      <span className="ct-quick-learn-context__fallback" aria-hidden="true">
        <Icon name="spark" />
      </span>
    );

  return (
    <img
      alt={`Thumbnail for ${videoTitle}`}
      draggable={false}
      height="52"
      onError={() => setFailed(true)}
      src={src}
      width="92"
    />
  );
}

export interface ChatTurnRequest {
  readonly provider: WebChatProviderId;
  readonly sessionId: string;
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
  readonly initialProvider?: WebChatProviderId;
  readonly selectedProvider?: WebChatProviderId;
  readonly sendRequestId?: number;
  readonly quickLearn?: {
    readonly thumbnailUrl?: string;
  };
  readonly onPrimeWebChat?: (request: ChatTurnRequest) => Promise<void>;
  readonly onFocusWebChat?: (
    provider: WebChatProviderId,
    sessionId: string,
  ) => Promise<void>;
  readonly onSendWebChat?: (request: ChatTurnRequest) => Promise<ChatTurnResult>;
  readonly onOpenWebChat?: (provider: WebChatProviderId) => void | Promise<void>;
  readonly onPrepareWebChat?: (
    provider: WebChatProviderId,
    sessionId: string,
  ) => void | Promise<void>;
  readonly onResetWebChat?: (
    provider: WebChatProviderId,
    sessionId: string,
  ) => void | Promise<void>;
  readonly focused?: boolean;
  readonly visible?: boolean;
  readonly onFocusedChange?: (focused: boolean) => void;
  readonly onProviderChange?: (provider: WebChatProviderId) => void;
  readonly onProviderSessionChange?: (
    provider: WebChatProviderId,
    sessionId: string,
  ) => void;
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
  readonly onSessionReady?: (provider: WebChatProviderId, sessionId: string) => void;
  readonly onPrepareWebChat?: AskPanelProps['onPrepareWebChat'];
  readonly onResetWebChat?: AskPanelProps['onResetWebChat'];
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
  onSessionReady,
  onPrepareWebChat,
  onResetWebChat,
}: ProviderFrameProps) {
  const definition = WEB_CHAT_PROVIDERS[provider];
  const [sessionId] = useState(() => `${provider}:${createFrameSessionId()}`);
  const [prepared, setPrepared] = useState(!onPrepareWebChat);
  const [timedOut, setTimedOut] = useState(false);
  const [preparationError, setPreparationError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bindingTimersRef = useRef<readonly number[]>([]);
  const prepareRef = useRef(onPrepareWebChat);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    prepareRef.current = onPrepareWebChat;
  }, [onPrepareWebChat]);

  useEffect(() => {
    onSessionReady?.(provider, sessionId);
  }, [onSessionReady, provider, sessionId]);

  useEffect(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (!onResetWebChat) return;
    return () => {
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null;
        void Promise.resolve(onResetWebChat(provider, sessionId)).catch(
          () => undefined,
        );
      }, 0);
    };
  }, [onResetWebChat, provider, sessionId]);

  useEffect(() => {
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
  }, [provider, sessionId]);

  useEffect(() => {
    if (status === 'ready' || status === 'sign-in-required') return;
    const timer = window.setTimeout(() => setTimedOut(true), 20_000);
    return () => window.clearTimeout(timer);
  }, [status]);

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

  return (
    <div
      aria-hidden={!active}
      className={`ct-provider-frame ct-provider-frame--${status}${
        active ? '' : ' ct-provider-frame--inactive'
      }`}
      data-provider={provider}
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
  initialProvider = 'gemini',
  selectedProvider: controlledSelectedProvider,
  sendRequestId = 0,
  quickLearn,
  onPrimeWebChat,
  onFocusWebChat,
  onSendWebChat,
  onOpenWebChat,
  onPrepareWebChat,
  onResetWebChat,
  focused = false,
  visible = true,
  onFocusedChange,
  onProviderChange,
  onProviderSessionChange,
}: AskPanelProps) {
  const [internalSelectedProvider, setInternalSelectedProvider] =
    useState<WebChatProviderId>(initialProvider);
  const selectedProvider = controlledSelectedProvider ?? internalSelectedProvider;
  const [mountedProviders, setMountedProviders] = useState<
    ReadonlySet<WebChatProviderId>
  >(() => new Set([controlledSelectedProvider ?? initialProvider]));
  const [primeState, setPrimeState] = useState<PrimeState>({ kind: 'idle' });
  const [handledRequestId, setHandledRequestId] = useState(0);
  const [providerSessionIds, setProviderSessionIds] = useState<
    Partial<Record<WebChatProviderId, string>>
  >({});
  const [settledFocusProvider, setSettledFocusProvider] =
    useState<WebChatProviderId | null>(null);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const primingContextsRef = useRef(new Set<string>());
  const focusedContextRef = useRef('');
  const [primedContextKey, setPrimedContextKey] = useState('');

  const providerDefinition = WEB_CHAT_PROVIDERS[selectedProvider];
  const providerStatus = providerStatuses[selectedProvider]?.state ?? 'not-open';
  const providerReady = providerStatus === 'ready';
  const primeSending = primeState.kind === 'sending';
  const requestPending = sendRequestId > 0 && handledRequestId !== sendRequestId;
  const focusSettling = focused && settledFocusProvider !== selectedProvider;
  const waitingForProvider =
    requestPending && !providerReady && providerStatus !== 'sign-in-required';
  const signInMessage =
    requestPending && providerStatus === 'sign-in-required'
      ? `Sign in to ${providerDefinition.displayName} before sending.`
      : '';

  const registerProviderSession = useCallback(
    (providerId: WebChatProviderId, sessionId: string) => {
      setProviderSessionIds((current) =>
        current[providerId] === sessionId
          ? current
          : { ...current, [providerId]: sessionId },
      );
      onProviderSessionChange?.(providerId, sessionId);
    },
    [onProviderSessionChange],
  );

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

  const buildPrimePrompt = useCallback((): string | null => {
    if (!transcript) return null;
    const prompt = provider.buildPrompt({
      transcript,
      scope: 'entire-video',
      currentTimeSeconds: null,
      selectedSegmentIds: EMPTY_SELECTION,
      question: PRIME_QUESTION,
    }).text;
    return prompt;
  }, [provider, transcript]);

  const buildQuickLearnPrompt = useCallback((): string | null => {
    if (!transcript || !quickLearn) return null;
    return provider.buildPrompt({
      transcript,
      scope: 'entire-video',
      currentTimeSeconds: null,
      selectedSegmentIds: EMPTY_SELECTION,
      question: buildQuickLearnQuestion({
        videoTitle: transcript.videoTitle,
      }),
    }).text;
  }, [provider, quickLearn, transcript]);

  const currentPrimeContextKey = (() => {
    if (!transcript) return '';
    const sessionId = providerSessionIds[selectedProvider];
    if (!sessionId) return '';
    return [
      selectedProvider,
      sessionId,
      transcript.videoId,
      transcript.languageCode,
      transcript.segments.length,
      transcript.segments.at(-1)?.endSeconds ?? 0,
    ].join(':');
  })();

  useEffect(() => {
    if (
      quickLearn ||
      !visible ||
      requestPending ||
      !onPrimeWebChat ||
      !transcript ||
      !providerReady
    )
      return;
    const sessionId = providerSessionIds[selectedProvider];
    if (!sessionId) return;
    const contextKey = currentPrimeContextKey;
    if (!contextKey) return;
    if (primedContextKey === contextKey || primingContextsRef.current.has(contextKey))
      return;
    const message = buildPrimePrompt();
    if (!message) return;
    primingContextsRef.current.add(contextKey);
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) setPrimeState({ kind: 'sending' });
    });
    void onPrimeWebChat({
      provider: selectedProvider,
      sessionId,
      message,
      newConversation: true,
    })
      .then(() => {
        primingContextsRef.current.delete(contextKey);
        if (!disposed) {
          setPrimedContextKey(contextKey);
          setPrimeState({ kind: 'sent' });
        }
      })
      .catch((error: unknown) => {
        primingContextsRef.current.delete(contextKey);
        if (disposed) return;
        setPrimeState({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Could not prepare video context.',
        });
      });
    return () => {
      disposed = true;
    };
  }, [
    buildPrimePrompt,
    currentPrimeContextKey,
    onPrimeWebChat,
    primedContextKey,
    providerReady,
    providerSessionIds,
    requestPending,
    selectedProvider,
    transcript,
    visible,
    quickLearn,
  ]);

  useEffect(() => {
    if (
      !quickLearn ||
      !visible ||
      requestPending ||
      !onSendWebChat ||
      !transcript ||
      !providerReady
    )
      return;
    const sessionId = providerSessionIds[selectedProvider];
    if (!sessionId) return;
    const contextKey = currentPrimeContextKey;
    if (!contextKey) return;
    if (primedContextKey === contextKey || primingContextsRef.current.has(contextKey))
      return;
    const message = buildQuickLearnPrompt();
    if (!message) return;
    primingContextsRef.current.add(contextKey);
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) setPrimeState({ kind: 'sending' });
    });
    void onSendWebChat({
      provider: selectedProvider,
      sessionId,
      message,
      newConversation: true,
    })
      .then(() => {
        primingContextsRef.current.delete(contextKey);
        if (!disposed) {
          setPrimedContextKey(contextKey);
          setPrimeState({ kind: 'sent' });
        }
      })
      .catch((error: unknown) => {
        primingContextsRef.current.delete(contextKey);
        if (disposed) return;
        setPrimeState({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Could not start Quick Learn.',
        });
      });
    return () => {
      disposed = true;
    };
  }, [
    buildQuickLearnPrompt,
    currentPrimeContextKey,
    onSendWebChat,
    primedContextKey,
    providerReady,
    providerSessionIds,
    quickLearn,
    requestPending,
    selectedProvider,
    transcript,
    visible,
  ]);

  useEffect(() => {
    if (!visible || quickLearn) {
      focusedContextRef.current = '';
      return;
    }
    if (
      !onFocusWebChat ||
      !currentPrimeContextKey ||
      primedContextKey !== currentPrimeContextKey ||
      focusedContextRef.current === currentPrimeContextKey
    )
      return;
    const sessionId = providerSessionIds[selectedProvider];
    if (!sessionId) return;
    focusedContextRef.current = currentPrimeContextKey;
    queueMicrotask(() => {
      void onFocusWebChat(selectedProvider, sessionId).catch(() => {
        focusedContextRef.current = '';
      });
    });
  }, [
    currentPrimeContextKey,
    onFocusWebChat,
    primedContextKey,
    providerSessionIds,
    selectedProvider,
    visible,
    quickLearn,
  ]);

  useEffect(() => {
    if (primeState.kind !== 'sent') return;
    const timer = window.setTimeout(() => setPrimeState({ kind: 'idle' }), 1_500);
    return () => window.clearTimeout(timer);
  }, [primeState.kind]);

  useEffect(() => {
    if (
      sendRequestId <= 0 ||
      handledRequestId === sendRequestId ||
      !onSendWebChat ||
      primeSending
    )
      return;
    const message = buildTranscriptPrompt();
    if (!message) return;
    if (!providerReady) return;
    const sessionId = providerSessionIds[selectedProvider];
    if (!sessionId) return;
    const contextKey = currentPrimeContextKey;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed || handledRequestId === sendRequestId) return;
      setHandledRequestId(sendRequestId);
      setPrimeState({ kind: 'sending' });
      void onSendWebChat({
        provider: selectedProvider,
        sessionId,
        message,
        newConversation: true,
      })
        .then(() => {
          if (!disposed) {
            if (contextKey) setPrimedContextKey(contextKey);
            setPrimeState({ kind: 'sent' });
          }
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
    currentPrimeContextKey,
    handledRequestId,
    onSendWebChat,
    primeSending,
    sendRequestId,
    providerReady,
    providerSessionIds,
    selectedProvider,
  ]);

  useEffect(() => {
    if (!focused) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onFocusedChange?.(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    focusButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [focused, onFocusedChange]);

  useLayoutEffect(() => {
    if (!focusSettling) return;
    const timer = window.setTimeout(
      () => setSettledFocusProvider(selectedProvider),
      450,
    );
    return () => window.clearTimeout(timer);
  }, [focusSettling, selectedProvider]);

  const selectProvider = (providerId: WebChatProviderId) => {
    if (providerId === selectedProvider || primeSending) return;
    setMountedProviders((current) => {
      if (current.has(providerId)) return current;
      const next = new Set(current);
      next.add(providerId);
      return next;
    });
    setPrimeState({ kind: 'idle' });
    if (controlledSelectedProvider === undefined)
      setInternalSelectedProvider(providerId);
    onProviderChange?.(providerId);
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
    <div className={`ct-ask${focused ? ' ct-ask--focused' : ''}`}>
      <div
        aria-label={focused ? 'Focused AI session' : undefined}
        aria-modal={focused || undefined}
        className="ct-ask__surface"
        role={focused ? 'dialog' : undefined}
      >
        {quickLearn && transcript ? (
          <section
            aria-label={`Quick Learn video: ${transcript.videoTitle}`}
            className="ct-quick-learn-context"
            style={videoAccentStyle(transcript.videoId)}
          >
            <QuickLearnThumbnail
              key={quickLearn.thumbnailUrl}
              src={quickLearn.thumbnailUrl}
              videoTitle={transcript.videoTitle}
            />
            <span className="ct-quick-learn-context__copy">
              <span className="ct-quick-learn-context__eyebrow">
                <i aria-hidden="true" />
                Current video
              </span>
              <strong title={transcript.videoTitle}>{transcript.videoTitle}</strong>
              <small>{transcript.languageLabel} captions</small>
            </span>
          </section>
        ) : null}

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
                {PROVIDER_PICKER_LABELS[providerId]}
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
          <button
            aria-label={focused ? 'Exit focused AI view' : 'Focus AI view'}
            className="ct-provider-toolbar__focus"
            onClick={() => onFocusedChange?.(!focused)}
            ref={focusButtonRef}
            title={focused ? 'Exit focused view (Esc)' : 'Focus this AI session'}
            type="button"
          >
            <Icon name={focused ? 'close' : 'expand'} />
          </button>
        </div>

        <div className="ct-provider-stage" data-testid="provider-frame">
          {PROVIDER_IDS.filter((providerId) => mountedProviders.has(providerId)).map(
            (providerId) => (
              <ProviderFrame
                active={selectedProvider === providerId}
                key={providerId}
                onPrepareWebChat={onPrepareWebChat}
                onResetWebChat={onResetWebChat}
                onSessionReady={registerProviderSession}
                provider={providerId}
                status={providerStatuses[providerId]?.state ?? 'not-open'}
              />
            ),
          )}

          {primeState.kind === 'sending' ? (
            <div className="ct-provider-frame__notice" role="status">
              {quickLearn
                ? `Answering the video’s click question in ${providerDefinition.displayName}…`
                : `Preparing video context in ${providerDefinition.displayName}…`}
            </div>
          ) : null}
          {waitingForProvider ? (
            <div className="ct-provider-frame__notice" role="status">
              Waiting for {providerDefinition.displayName}…
            </div>
          ) : null}
          {primeState.kind === 'sent' ? (
            <div className="ct-provider-frame__notice" role="status">
              {quickLearn
                ? `Quick answer sent to ${providerDefinition.displayName}.`
                : `Video context ready in ${providerDefinition.displayName}.`}
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
          {focusSettling ? (
            <div className="ct-provider-frame__focus-loading" role="status">
              <span aria-hidden="true" />
              <strong>Preparing your workspace…</strong>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
