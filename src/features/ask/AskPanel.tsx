import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { Icon } from '@/components/Icon';
import type { AIContextScope, AIProvider } from '@/features/ask/ai-provider';
import { TranscriptPromptProvider } from '@/features/ask/transcript-prompt-provider';
import { SUGGESTED_ASK_ACTIONS } from '@/features/ask/suggested-actions';
import type {
  TranscriptDocument,
  TranscriptSegmentId,
} from '@/features/transcript/domain';
import { formatTimestamp } from '@/features/transcript/transcript-utils';
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

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly pending?: boolean;
  readonly error?: boolean;
}

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
  readonly initialQuestion?: string;
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

const createFrameSessionId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const resolveScope = (
  scope: AIContextScope,
  selectedCount: number,
  currentTimeSeconds: number | null,
): AIContextScope => {
  if (scope === 'selection' && selectedCount === 0) return 'entire-video';
  if (scope === 'current-section' && currentTimeSeconds === null) return 'entire-video';
  return scope;
};

const scopeLabel = (
  scope: AIContextScope,
  transcript: TranscriptDocument,
  selectedCount: number,
  currentTimeSeconds: number | null,
): string => {
  if (scope === 'selection') return `${selectedCount} selected rows`;
  if (scope === 'current-section')
    return `Around ${formatTimestamp(currentTimeSeconds ?? 0)}`;
  return `${transcript.segments.length.toLocaleString()} transcript rows`;
};

const messageId = (): string => crypto.randomUUID();

function AskUnavailableState() {
  return (
    <div className="ct-ask-state" role="status">
      <span aria-hidden="true" className="ct-ask-state__icon">
        <Icon name="message" />
      </span>
      <strong>Transcript context is required</strong>
      <p>Load the video's transcript before starting a grounded chat.</p>
    </div>
  );
}

export function AskPanel({
  transcript,
  selectedSegmentIds = EMPTY_SELECTION,
  currentTimeSeconds = null,
  initialScope = 'entire-video',
  initialQuestion = '',
  provider = DEFAULT_PROMPT_PROVIDER,
  providerStatuses = {},
  primeRequestId = 0,
  onSendWebChat,
  onOpenWebChat,
  onPrepareWebChat,
}: AskPanelProps) {
  const [scope, setScope] = useState<AIContextScope>(() =>
    resolveScope(initialScope, selectedSegmentIds.size, currentTimeSeconds),
  );
  const [question, setQuestion] = useState(initialQuestion);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<WebChatProviderId>('chatgpt');
  const [frameEpoch, setFrameEpoch] = useState(0);
  const [framePrepared, setFramePrepared] = useState(!onPrepareWebChat);
  const [frameTimedOut, setFrameTimedOut] = useState(false);
  const [framePreparationError, setFramePreparationError] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const providerFrameRef = useRef<HTMLIFrameElement>(null);
  const bindingTimersRef = useRef<readonly number[]>([]);
  const prepareWebChatRef = useRef(onPrepareWebChat);
  const primeSeenRef = useRef(0);
  const resolvedScope = resolveScope(
    scope,
    selectedSegmentIds.size,
    currentTimeSeconds,
  );
  const providerDefinition = WEB_CHAT_PROVIDERS[selectedProvider];
  const providerStatus = providerStatuses[selectedProvider]?.state ?? 'not-open';
  const providerReady = providerStatus === 'ready';
  const frameSessionId = useMemo(
    () => `${selectedProvider}:${frameEpoch}:${createFrameSessionId()}`,
    [frameEpoch, selectedProvider],
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

  useEffect(() => {
    messagesRef.current?.scrollTo?.({ top: messagesRef.current.scrollHeight });
  }, [messages]);

  const buildFirstTurn = useCallback(
    (userQuestion: string): string => {
      if (!transcript) return userQuestion;
      return provider.buildPrompt({
        transcript,
        scope: resolvedScope,
        currentTimeSeconds,
        selectedSegmentIds,
        question: userQuestion,
      }).text;
    },
    [currentTimeSeconds, provider, resolvedScope, selectedSegmentIds, transcript],
  );

  const sendQuestion = useCallback(
    async (userQuestion: string, displayText = userQuestion) => {
      const trimmed = userQuestion.trim();
      if (!trimmed || sending) return;
      if (!providerReady || !onSendWebChat) {
        setFeedback(`Open ${providerDefinition.displayName} and sign in first.`);
        return;
      }
      const userId = messageId();
      const assistantId = messageId();
      setSending(true);
      setFeedback(`Sending to the embedded ${providerDefinition.displayName} window…`);
      setMessages((current) => [
        ...current,
        { id: userId, role: 'user', text: displayText },
        { id: assistantId, role: 'assistant', text: 'Thinking…', pending: true },
      ]);
      try {
        const result = await onSendWebChat({
          provider: selectedProvider,
          message: previousResponseId ? trimmed : buildFirstTurn(trimmed),
          newConversation: previousResponseId === null,
        });
        setPreviousResponseId(result.responseId);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { id: assistantId, role: 'assistant', text: result.text }
              : message,
          ),
        );
        setFeedback('Ready');
      } catch (error) {
        const text =
          error instanceof Error
            ? error.message
            : `${providerDefinition.displayName} could not answer.`;
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { id: assistantId, role: 'assistant', text, error: true }
              : message,
          ),
        );
        setFeedback('Message failed');
      } finally {
        setSending(false);
      }
    },
    [
      buildFirstTurn,
      onSendWebChat,
      previousResponseId,
      providerDefinition.displayName,
      providerReady,
      selectedProvider,
      sending,
    ],
  );

  useEffect(() => {
    if (primeRequestId <= 0 || primeSeenRef.current === primeRequestId) return;
    if (!providerReady || !onSendWebChat) return;
    primeSeenRef.current = primeRequestId;
    queueMicrotask(
      () =>
        void sendQuestion(
          PRIME_QUESTION,
          'Use this transcript and get ready for questions.',
        ),
    );
  }, [onSendWebChat, primeRequestId, providerReady, sendQuestion]);

  const transcriptSummary = useMemo(
    () =>
      transcript
        ? scopeLabel(
            resolvedScope,
            transcript,
            selectedSegmentIds.size,
            currentTimeSeconds,
          )
        : '',
    [currentTimeSeconds, resolvedScope, selectedSegmentIds.size, transcript],
  );

  const resetProviderFrame = (providerId: WebChatProviderId) => {
    setFrameEpoch((current) => current + 1);
    setFeedback(`${WEB_CHAT_PROVIDERS[providerId].displayName} frame reloading.`);
  };

  if (!transcript) return <AskUnavailableState />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = question.trim();
    if (!next) return;
    setQuestion('');
    void sendQuestion(next);
  };

  const newConversation = () => {
    resetProviderFrame(selectedProvider);
    setMessages([]);
    setPreviousResponseId(null);
    setFeedback('New conversation. The next message will include transcript context.');
  };

  const selectProvider = (providerId: WebChatProviderId) => {
    if (providerId === selectedProvider || sending) return;
    setSelectedProvider(providerId);
    resetProviderFrame(providerId);
    setMessages([]);
    setPreviousResponseId(null);
    setFeedback(
      `${WEB_CHAT_PROVIDERS[providerId].displayName} selected. Your next message starts a new chat.`,
    );
  };

  return (
    <div className="ct-ask ct-chat">
      <div className="ct-chat__head">
        <div>
          <span className="ct-mode-badge">
            <Icon name="spark" />
            {providerDefinition.displayName} embedded
          </span>
          <strong>{transcript.videoTitle}</strong>
          <span>{transcriptSummary}</span>
        </div>
        <button
          className="ct-mini-button ct-mini-button--labeled"
          disabled={sending}
          onClick={newConversation}
          type="button"
        >
          New chat
        </button>
      </div>

      <div aria-label="AI provider" className="ct-provider-picker" role="group">
        {(['chatgpt', 'gemini'] as const).map((providerId) => (
          <button
            aria-pressed={selectedProvider === providerId}
            disabled={sending}
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

      {providerStatus === 'sign-in-required' ||
      providerStatus === 'not-open' ||
      frameTimedOut ||
      framePreparationError ? (
        <div className="ct-chat__setup" role="status">
          <Icon name="external" />
          <div>
            <strong>Connect {providerDefinition.displayName}</strong>
            <span>
              The live site is embedded below. If its sign-in flow refuses the frame,
              sign in once in a normal tab and return here.
            </span>
          </div>
          <button
            className="ct-button ct-button--primary"
            onClick={() => void onOpenWebChat?.(selectedProvider)}
            type="button"
          >
            Open sign-in tab
          </button>
        </div>
      ) : null}

      <fieldset className="ct-context-picker">
        <legend>Transcript context</legend>
        <div>
          <button
            aria-pressed={resolvedScope === 'entire-video'}
            onClick={() => setScope('entire-video')}
            type="button"
          >
            Entire video
          </button>
          <button
            aria-pressed={resolvedScope === 'current-section'}
            disabled={currentTimeSeconds === null}
            onClick={() => setScope('current-section')}
            type="button"
          >
            Current section
          </button>
          <button
            aria-pressed={resolvedScope === 'selection'}
            disabled={selectedSegmentIds.size === 0}
            onClick={() => setScope('selection')}
            type="button"
          >
            Selected ({selectedSegmentIds.size})
          </button>
        </div>
      </fieldset>

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
        {framePreparationError ||
        (!frameTimedOut &&
          providerStatus !== 'ready' &&
          providerStatus !== 'sign-in-required') ? (
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
      </div>

      {messages.length > 0 ? (
        <div
          aria-label={`${providerDefinition.displayName} WatchBetter transcript`}
          aria-live="polite"
          className="ct-chat__messages"
          ref={messagesRef}
          role="log"
        >
          {messages.map((message) => (
            <article
              className={`ct-chat-message ct-chat-message--${message.role}${message.pending ? ' is-pending' : ''}${message.error ? ' is-error' : ''}`}
              key={message.id}
            >
              <strong>
                {message.role === 'user' ? 'You' : providerDefinition.displayName}
              </strong>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      ) : null}

      <div aria-label="Suggested video questions" className="ct-chat__suggestions">
        {SUGGESTED_ASK_ACTIONS.slice(0, 4).map((action) => (
          <button
            key={action.id}
            onClick={() => {
              setQuestion(action.question);
              setScope(
                resolveScope(action.scope, selectedSegmentIds.size, currentTimeSeconds),
              );
            }}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>

      <form className="ct-chat__composer" onSubmit={submit}>
        <label className="ct-sr-only" htmlFor="ct-chat-question">
          Ask about this video
        </label>
        <textarea
          disabled={!providerReady || sending}
          id="ct-chat-question"
          maxLength={4_000}
          onChange={(event) => setQuestion(event.currentTarget.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter')
              event.currentTarget.form?.requestSubmit();
          }}
          placeholder="Ask a question about the video…"
          rows={3}
          value={question}
        />
        <button
          className="ct-button ct-button--primary"
          disabled={!providerReady || sending || !question.trim()}
          type="submit"
        >
          <Icon name="spark" />
          {sending ? 'Thinking…' : 'Send'}
        </button>
      </form>

      <div className="ct-chat__footer">
        <span aria-live="polite">
          {feedback ||
            (providerReady
              ? `Ready · ${providerDefinition.displayName} embedded`
              : `${providerDefinition.displayName} frame loading`)}
        </span>
        <button
          className="ct-link-button"
          onClick={() => void onOpenWebChat?.(selectedProvider)}
          type="button"
        >
          Open full tab ↗
        </button>
      </div>
    </div>
  );
}
