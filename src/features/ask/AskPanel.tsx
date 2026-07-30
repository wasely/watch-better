import { useMemo, useRef, useState } from 'react';

import { Icon } from '@/components/Icon';
import type {
  AIContextScope,
  AIProvider,
  GeneratedPrompt,
} from '@/features/ask/ai-provider';
import { ChatGPTHandoffProvider } from '@/features/ask/chatgpt-handoff-provider';
import {
  SUGGESTED_ASK_ACTIONS,
  type SuggestedAskAction,
} from '@/features/ask/suggested-actions';
import type {
  TranscriptDocument,
  TranscriptSegmentId,
} from '@/features/transcript/domain';
import { formatTimestamp } from '@/features/transcript/transcript-utils';

import './AskPanel.css';

const DEFAULT_PROVIDER = new ChatGPTHandoffProvider();
const EMPTY_SELECTION = new Set<TranscriptSegmentId>();

export interface AskPanelProps {
  readonly transcript: TranscriptDocument | null;
  readonly selectedSegmentIds?: ReadonlySet<TranscriptSegmentId>;
  readonly currentTimeSeconds?: number | null;
  readonly initialScope?: AIContextScope;
  readonly initialQuestion?: string;
  readonly provider?: AIProvider;
  readonly onCopy?: (text: string) => void | Promise<void>;
  readonly onOpenChatGPT?: () => void | Promise<void>;
}

const scopeLabel = (
  scope: AIContextScope,
  transcript: TranscriptDocument,
  selectedCount: number,
  currentTimeSeconds: number | null,
): string => {
  switch (scope) {
    case 'entire-video':
      return `Entire video · ${transcript.segments.length.toLocaleString()} rows`;
    case 'current-section':
      return `Current section · around ${formatTimestamp(currentTimeSeconds ?? 0)}`;
    case 'selection':
      return `Selection · ${selectedCount.toLocaleString()} rows`;
  }
};

const approximateTokens = (characters: number): string =>
  Math.max(1, Math.ceil(characters / 4)).toLocaleString();

const resolveAvailableScope = (
  scope: AIContextScope,
  selectedCount: number,
  currentTimeSeconds: number | null,
): AIContextScope => {
  if (scope === 'selection' && selectedCount === 0) return 'entire-video';
  if (scope === 'current-section' && currentTimeSeconds === null) return 'entire-video';
  return scope;
};

function AskUnavailableState() {
  return (
    <div className="ct-ask-state" role="status">
      <span aria-hidden="true" className="ct-ask-state__icon">
        <Icon name="message" />
      </span>
      <strong>Transcript context is required</strong>
      <p>
        Load an available transcript before building a timestamped ChatGPT handoff.
        CutThrough will not invent missing video context.
      </p>
    </div>
  );
}

export function AskPanel({
  transcript,
  selectedSegmentIds = EMPTY_SELECTION,
  currentTimeSeconds = null,
  initialScope = 'entire-video',
  initialQuestion = '',
  provider = DEFAULT_PROVIDER,
  onCopy,
  onOpenChatGPT,
}: AskPanelProps) {
  const initialResolvedScope = resolveAvailableScope(
    initialScope,
    selectedSegmentIds.size,
    currentTimeSeconds,
  );
  const [scope, setScope] = useState<AIContextScope>(initialResolvedScope);
  const [question, setQuestion] = useState(initialQuestion);
  const [feedback, setFeedback] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const resolvedScope = resolveAvailableScope(
    scope,
    selectedSegmentIds.size,
    currentTimeSeconds,
  );

  const generated = useMemo<GeneratedPrompt | null>(() => {
    if (!transcript || !question.trim()) return null;
    return provider.buildPrompt({
      transcript,
      scope: resolvedScope,
      currentTimeSeconds,
      selectedSegmentIds,
      question,
    });
  }, [
    currentTimeSeconds,
    provider,
    question,
    resolvedScope,
    selectedSegmentIds,
    transcript,
  ]);
  const copied = generated !== null && copiedPrompt === generated.text;

  if (!transcript) return <AskUnavailableState />;

  const chooseScope = (nextScope: AIContextScope) => {
    setScope(nextScope);
    setFeedback('');
  };

  const copyPrompt = async () => {
    if (!generated || !onCopy) return;
    try {
      await onCopy(generated.text);
      setCopiedPrompt(generated.text);
      setFeedback('Prompt copied. Open ChatGPT and paste when you are ready.');
    } catch {
      setCopiedPrompt(null);
      setFeedback('Could not copy the prompt. Check clipboard access and try again.');
    }
  };

  const openChatGPT = async () => {
    if (!onOpenChatGPT) return;
    try {
      await onOpenChatGPT();
      setFeedback(
        copied
          ? 'ChatGPT opened. Paste the copied prompt when ready.'
          : 'ChatGPT opened. Nothing was copied or sent automatically.',
      );
    } catch {
      setFeedback('Could not open ChatGPT. Open chatgpt.com manually.');
    }
  };

  const applySuggestedAction = (action: SuggestedAskAction) => {
    setQuestion(action.question);
    setScope(
      resolveAvailableScope(action.scope, selectedSegmentIds.size, currentTimeSeconds),
    );
    setFeedback('');
    requestAnimationFrame(() => {
      questionRef.current?.focus();
      if (action.id === 'find-topic') {
        questionRef.current?.setSelectionRange(
          action.question.length,
          action.question.length,
        );
      }
    });
  };

  return (
    <div className="ct-ask">
      <div className="ct-ask__mode">
        <div>
          <span className="ct-mode-badge">
            <Icon name="external" />
            Handoff mode
          </span>
          <span>
            {scopeLabel(
              resolvedScope,
              transcript,
              selectedSegmentIds.size,
              currentTimeSeconds,
            )}
          </span>
        </div>
        <p>CutThrough builds a prompt locally. It never reads or automates ChatGPT.</p>
      </div>

      <fieldset className="ct-context-picker">
        <legend>Context</legend>
        <div>
          <button
            aria-pressed={resolvedScope === 'entire-video'}
            onClick={() => chooseScope('entire-video')}
            type="button"
          >
            Entire video
          </button>
          <button
            aria-pressed={resolvedScope === 'current-section'}
            disabled={currentTimeSeconds === null}
            onClick={() => chooseScope('current-section')}
            type="button"
          >
            Current section
          </button>
          <button
            aria-pressed={resolvedScope === 'selection'}
            disabled={selectedSegmentIds.size === 0}
            onClick={() => chooseScope('selection')}
            type="button"
          >
            Selected ({selectedSegmentIds.size})
          </button>
        </div>
      </fieldset>

      <section aria-labelledby="ct-suggested-actions" className="ct-suggestions">
        <div className="ct-section-heading">
          <strong id="ct-suggested-actions">Suggested actions</strong>
          <span>Choose one or write your own</span>
        </div>
        <div className="ct-suggestion-list">
          {SUGGESTED_ASK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => applySuggestedAction(action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
        <label className="ct-suggestion-select">
          <span>Suggested task</span>
          <select
            defaultValue=""
            onChange={(event) => {
              const action = SUGGESTED_ASK_ACTIONS.find(
                (candidate) => candidate.id === event.currentTarget.value,
              );
              if (action) applySuggestedAction(action);
              event.currentTarget.value = '';
            }}
          >
            <option disabled value="">
              Choose a suggested task…
            </option>
            {SUGGESTED_ASK_ACTIONS.map((action) => (
              <option key={action.id} value={action.id}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section aria-labelledby="ct-question-label" className="ct-composer">
        <div className="ct-section-heading">
          <strong id="ct-question-label">Question or task</strong>
          <span>{question.length.toLocaleString()} characters</span>
        </div>
        <textarea
          aria-labelledby="ct-question-label"
          maxLength={4_000}
          onChange={(event) => {
            setQuestion(event.currentTarget.value);
            setFeedback('');
          }}
          placeholder="What do you want ChatGPT to analyze?"
          ref={questionRef}
          rows={4}
          value={question}
        />
      </section>

      <section aria-label="Generated handoff details" className="ct-handoff-summary">
        {generated ? (
          <>
            <div className="ct-handoff-summary__stats">
              <span>
                <strong>{generated.characterCount.toLocaleString()}</strong> chars
              </span>
              <span>≈{approximateTokens(generated.characterCount)} tokens</span>
              <span>{generated.includedSegmentCount.toLocaleString()} included</span>
            </div>
            {generated.wasTruncated ? (
              <div className="ct-context-warning" role="status">
                <strong>Context trimmed</strong>
                <span>
                  {generated.omittedSegmentCount > 0
                    ? `${generated.omittedSegmentCount.toLocaleString()} rows omitted. `
                    : 'Part of one transcript row was shortened. '}
                  The prompt tells ChatGPT not to imply the missing context was checked.
                </span>
              </div>
            ) : null}
            <details>
              <summary>Preview generated prompt</summary>
              <pre>{generated.text}</pre>
            </details>
          </>
        ) : (
          <p className="ct-handoff-summary__empty">
            Choose a suggested action or enter a question to build the local prompt.
          </p>
        )}
      </section>

      <div className="ct-handoff-actions">
        <div>
          <Icon name="spark" />
          <span>1. Copy prompt. 2. Open ChatGPT. Opening never transfers content.</span>
        </div>
        <div>
          <button
            className="ct-button ct-button--primary"
            disabled={!generated || !onCopy}
            onClick={() => void copyPrompt()}
            type="button"
          >
            <Icon name={copied ? 'check' : 'copy'} />
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
          <button
            className="ct-button"
            disabled={!generated || !onOpenChatGPT}
            onClick={() => void openChatGPT()}
            type="button"
          >
            <Icon name="external" />
            Open ChatGPT
          </button>
        </div>
      </div>

      <div aria-live="polite" className="ct-ask__feedback">
        {feedback}
      </div>
    </div>
  );
}
