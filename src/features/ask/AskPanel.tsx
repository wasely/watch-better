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
}

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
}: AskPanelProps) {
  const [scope, setScope] = useState<AIContextScope>(() =>
    resolveScope(initialScope, selectedSegmentIds.size, currentTimeSeconds),
  );
  const [question, setQuestion] = useState(initialQuestion);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<WebChatProviderId>('chatgpt');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const primeSeenRef = useRef(0);
  const resolvedScope = resolveScope(
    scope,
    selectedSegmentIds.size,
    currentTimeSeconds,
  );
  const providerDefinition = WEB_CHAT_PROVIDERS[selectedProvider];
  const providerStatus = providerStatuses[selectedProvider]?.state ?? 'not-open';
  const providerReady = providerStatus === 'ready';

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
      setFeedback(`Sending to your ${providerDefinition.displayName} web session…`);
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
    primeSeenRef.current = primeRequestId;
    void sendQuestion(
      PRIME_QUESTION,
      'Use this transcript and get ready for questions.',
    );
  }, [primeRequestId, sendQuestion]);

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

  if (!transcript) return <AskUnavailableState />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = question.trim();
    if (!next) return;
    setQuestion('');
    void sendQuestion(next);
  };

  const newConversation = () => {
    setMessages([]);
    setPreviousResponseId(null);
    setFeedback('New conversation. The next message will include transcript context.');
  };

  const selectProvider = (providerId: WebChatProviderId) => {
    if (providerId === selectedProvider || sending) return;
    setSelectedProvider(providerId);
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
            {providerDefinition.displayName} web session
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

      {!providerReady ? (
        <div className="ct-chat__setup" role="status">
          <Icon name="external" />
          <div>
            <strong>Connect {providerDefinition.displayName}</strong>
            <span>
              Open the official site and sign in. WatchBetter uses that browser tab; no
              API key, cookie access, or copied sign-in data.
            </span>
          </div>
          <button
            className="ct-button ct-button--primary"
            onClick={() => void onOpenWebChat?.(selectedProvider)}
            type="button"
          >
            Open {providerDefinition.displayName}
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
        aria-label={`${providerDefinition.displayName} conversation`}
        aria-live="polite"
        className="ct-chat__messages"
        ref={messagesRef}
        role="log"
      >
        {messages.length === 0 ? (
          <div className="ct-chat__welcome">
            <Icon name="message" />
            <strong>Ask anything about this video</strong>
            <span>
              Your first message includes bounded timestamped transcript context.
            </span>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className={`ct-chat-message ct-chat-message--${message.role}${message.pending ? ' is-pending' : ''}${message.error ? ' is-error' : ''}`}
              key={message.id}
            >
              <strong>
                {message.role === 'user' ? 'You' : providerDefinition.displayName}
              </strong>
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>

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
              ? `Ready · ${providerDefinition.displayName} web`
              : `${providerDefinition.displayName} not connected`)}
        </span>
        <button
          className="ct-link-button"
          onClick={() => void onOpenWebChat?.(selectedProvider)}
          type="button"
        >
          Open {providerDefinition.displayName} ↗
        </button>
      </div>
    </div>
  );
}
