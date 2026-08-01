import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { Icon } from '@/components/Icon';
import type {
  TranscriptSegment,
  TranscriptSegmentId,
} from '@/features/transcript/domain';
import type { TranscriptViewState } from '@/features/transcript/transcript-view-state';
import {
  findTranscriptMatches,
  formatTimestamp,
  formatTranscriptForClipboard,
} from '@/features/transcript/transcript-utils';

import './TranscriptPanel.css';

export interface TranscriptPanelProps {
  readonly state: TranscriptViewState;
  readonly activeSegmentId?: TranscriptSegmentId | null;
  readonly initialQuery?: string;
  readonly initialSelectedSegmentIds?: readonly TranscriptSegmentId[];
  readonly autoFollow?: boolean;
  readonly onSeek?: (segment: TranscriptSegment) => void;
  readonly onTrackChange?: (trackId: string) => void;
  readonly onCopy?: (text: string) => void | Promise<void>;
  readonly onAskTranscript?: () => void;
  readonly onAskSelection?: (segmentIds: ReadonlySet<TranscriptSegmentId>) => void;
  readonly onRetry?: () => void;
  readonly onEnableTranscript?: () => void;
  readonly onFollowChange?: (following: boolean) => void;
}

const EMPTY_SELECTION: readonly TranscriptSegmentId[] = [];

function TranscriptSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="ct-transcript-skeleton">
      <div className="ct-search-skeleton" />
      {[78, 92, 66, 84, 56, 74].map((width, index) => (
        <div className="ct-row-skeleton" key={width}>
          <span />
          <div>
            <i style={{ width: `${width}%` }} />
            <i style={{ width: `${Math.max(38, width - index * 7)}%` }} />
          </div>
        </div>
      ))}
      <span className="ct-sr-only">Loading transcript</span>
    </div>
  );
}

function TranscriptStateMessage({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  readonly icon: 'captions' | 'close';
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: (() => void) | undefined;
}) {
  return (
    <div className="ct-transcript-state" role="status">
      <span aria-hidden="true" className="ct-transcript-state__icon">
        <Icon name={icon} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button className="ct-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

const highlightText = (text: string, query: string): ReactNode => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return text;

  const parts: ReactNode[] = [];
  const lowerText = text.toLocaleLowerCase();
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(needle, cursor);
    if (matchIndex < 0) {
      parts.push(text.slice(cursor));
      break;
    }

    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <mark key={`${matchIndex}-${key++}`}>
        {text.slice(matchIndex, matchIndex + needle.length)}
      </mark>,
    );
    cursor = matchIndex + needle.length;
  }

  return parts;
};

const findSegmentElement = (
  container: HTMLElement | null,
  id: TranscriptSegmentId,
): HTMLElement | undefined =>
  Array.from(container?.querySelectorAll<HTMLElement>('[data-segment-id]') ?? []).find(
    (element) => element.dataset.segmentId === id,
  );

function TranscriptReadyView({
  state,
  activeSegmentId = null,
  initialQuery = '',
  initialSelectedSegmentIds = EMPTY_SELECTION,
  autoFollow = true,
  onSeek,
  onTrackChange,
  onCopy,
  onAskTranscript,
  onAskSelection,
  onFollowChange,
}: TranscriptPanelProps & {
  readonly state: Extract<TranscriptViewState, { readonly kind: 'ready' }>;
}) {
  const { document, tracks, selectedTrackId } = state;
  const [query, setQuery] = useState(initialQuery);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<TranscriptSegmentId>>(
    () => new Set(initialSelectedSegmentIds),
  );
  const [following, setFollowing] = useState(
    () => autoFollow && initialQuery.trim().length === 0,
  );
  const [feedback, setFeedback] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const lastSelectionIndexRef = useRef<number | null>(null);
  const rangeModifierRef = useRef(false);
  const ignoreScrollUntilRef = useRef(0);
  const segments = document.segments;
  const matches = useMemo(
    () => findTranscriptMatches(segments, query),
    [query, segments],
  );
  const matchingIndexes = useMemo(() => new Set(matches), [matches]);

  useEffect(() => {
    if (!following || !activeSegmentId) return;
    const active = findSegmentElement(listRef.current, activeSegmentId);
    if (!active) return;
    ignoreScrollUntilRef.current = performance.now() + 500;
    active.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [activeSegmentId, following]);

  const setFollow = (next: boolean) => {
    setFollowing(next);
    onFollowChange?.(next);
  };

  const suspendFollow = () => {
    if (following) setFollow(false);
  };

  const focusMatch = (nextIndex: number) => {
    if (matches.length === 0) return;
    const wrapped = (nextIndex + matches.length) % matches.length;
    setCurrentMatch(wrapped);
    const segmentIndex = matches[wrapped];
    const segment = segmentIndex === undefined ? undefined : segments[segmentIndex];
    if (!segment) return;

    suspendFollow();
    const row = findSegmentElement(listRef.current, segment.id);
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row?.querySelector<HTMLElement>('[data-segment-seek]')?.focus();
  };

  const toggleSelection = (index: number, id: TranscriptSegmentId, range: boolean) => {
    const lastIndex = lastSelectionIndexRef.current;
    setSelectedIds((current) => {
      const next = new Set(current);
      const shouldSelect = !next.has(id);

      if (range && lastIndex !== null) {
        const start = Math.min(lastIndex, index);
        const end = Math.max(lastIndex, index);
        for (let selectionIndex = start; selectionIndex <= end; selectionIndex += 1) {
          const segment = segments[selectionIndex];
          if (!segment) continue;
          if (shouldSelect) next.add(segment.id);
          else next.delete(segment.id);
        }
      } else if (shouldSelect) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
    lastSelectionIndexRef.current = index;
  };

  const copyTranscript = async (
    selected: ReadonlySet<TranscriptSegmentId> | undefined,
    label: string,
  ) => {
    if (!onCopy) {
      setFeedback('Clipboard is unavailable in this view.');
      return;
    }

    try {
      await onCopy(formatTranscriptForClipboard(document, selected));
      setFeedback(label);
    } catch {
      setFeedback('Could not copy. Check clipboard permission and try again.');
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rowButtons = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-segment-seek]') ?? [],
    );
    const currentIndex = rowButtons.findIndex((button) => button === event.target);
    if (currentIndex < 0) return;

    event.preventDefault();
    suspendFollow();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    rowButtons[
      Math.max(0, Math.min(rowButtons.length - 1, currentIndex + direction))
    ]?.focus();
  };

  const matchPosition =
    matches.length > 0 ? Math.min(currentMatch + 1, matches.length) : 0;

  return (
    <div className="ct-transcript">
      <div className="ct-transcript__tools">
        <div className="ct-search">
          <Icon name="search" />
          <label className="ct-sr-only" htmlFor="ct-transcript-search">
            Search transcript
          </label>
          <input
            autoComplete="off"
            id="ct-transcript-search"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setCurrentMatch(0);
              if (event.currentTarget.value) suspendFollow();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                focusMatch(currentMatch + (event.shiftKey ? -1 : 1));
              } else if (event.key === 'Escape') {
                setQuery('');
                setCurrentMatch(0);
              }
            }}
            placeholder="Search transcript"
            type="search"
            value={query}
          />
          {query ? (
            <span className="ct-search__count" aria-live="polite">
              {matchPosition}/{matches.length}
            </span>
          ) : null}
          <button
            aria-label="Previous transcript search result"
            className="ct-mini-button"
            disabled={matches.length === 0}
            onClick={() => focusMatch(currentMatch - 1)}
            title="Previous result"
            type="button"
          >
            <Icon name="arrow-left" />
          </button>
          <button
            aria-label="Next transcript search result"
            className="ct-mini-button"
            disabled={matches.length === 0}
            onClick={() => focusMatch(currentMatch + 1)}
            title="Next result"
            type="button"
          >
            <Icon name="arrow-right" />
          </button>
        </div>

        <div className="ct-transcript__meta">
          <label className="ct-track-picker">
            <span className="ct-sr-only">Transcript language</span>
            <select
              aria-label="Transcript language"
              disabled={tracks.length < 2}
              onChange={(event) => onTrackChange?.(event.currentTarget.value)}
              value={selectedTrackId}
            >
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.languageLabel}
                  {track.isAutomatic ? ' · Auto' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            className="ct-mini-button ct-mini-button--labeled ct-mini-button--ask"
            disabled={!onAskTranscript}
            onClick={onAskTranscript}
            type="button"
          >
            <Icon name="message" />
            <span>Ask</span>
          </button>
          <button
            aria-pressed={following}
            className={`ct-follow-button${following ? ' is-active' : ''}`}
            onClick={() => setFollow(!following)}
            title={following ? 'Following playback' : 'Resume following playback'}
            type="button"
          >
            <Icon name="follow" />
            <span>{following ? 'Following' : 'Resume follow'}</span>
          </button>
        </div>
      </div>

      <div className="ct-transcript__caption-action">
        <button
          className="ct-get-captions-button"
          onClick={() =>
            void copyTranscript(undefined, 'Captions copied to clipboard.')
          }
          title="Copy all available captions"
          type="button"
        >
          <Icon name="copy" />
          <span>Get Captions</span>
        </button>
      </div>

      <div
        aria-label={`Transcript for ${document.videoTitle}`}
        className="ct-transcript__list"
        onKeyDown={handleListKeyDown}
        onScroll={() => {
          if (performance.now() > ignoreScrollUntilRef.current) suspendFollow();
        }}
        onWheel={suspendFollow}
        ref={listRef}
        role="list"
        tabIndex={-1}
      >
        {segments.map((segment, index) => {
          const selected = selectedIds.has(segment.id);
          const active = activeSegmentId === segment.id;
          const matching = matchingIndexes.has(index);
          const currentSearchMatch = matches[currentMatch] === index;

          return (
            <div
              aria-current={active ? 'true' : undefined}
              className={`ct-transcript-row${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}${currentSearchMatch ? ' is-search-current' : ''}`}
              data-segment-id={segment.id}
              key={segment.id}
              role="listitem"
            >
              <label className="ct-row-select" title="Select segment">
                <input
                  aria-label={`Select transcript segment at ${formatTimestamp(segment.startSeconds)}`}
                  checked={selected}
                  onClick={(event) => {
                    toggleSelection(
                      index,
                      segment.id,
                      event.shiftKey || rangeModifierRef.current,
                    );
                    rangeModifierRef.current = false;
                  }}
                  onMouseDown={(event) => {
                    rangeModifierRef.current = event.shiftKey;
                  }}
                  readOnly
                  type="checkbox"
                />
              </label>
              <button
                aria-label={`Seek to ${formatTimestamp(segment.startSeconds)}`}
                className="ct-row-time"
                onClick={() => onSeek?.(segment)}
                type="button"
              >
                {formatTimestamp(segment.startSeconds)}
              </button>
              <button
                className="ct-row-text"
                data-segment-seek
                onClick={() => onSeek?.(segment)}
                type="button"
              >
                {matching ? highlightText(segment.text, query) : segment.text}
              </button>
            </div>
          );
        })}
      </div>

      {selectedIds.size > 0 ? (
        <div aria-label="Transcript selection actions" className="ct-selection-bar">
          <div>
            <strong>{selectedIds.size}</strong>
            <span>selected</span>
            <button
              aria-label="Clear transcript selection"
              className="ct-mini-button"
              onClick={() => setSelectedIds(new Set())}
              title="Clear selection"
              type="button"
            >
              <Icon name="close" />
            </button>
          </div>
          <div>
            <button
              className="ct-selection-action"
              onClick={() =>
                void copyTranscript(selectedIds, `${selectedIds.size} segments copied.`)
              }
              type="button"
            >
              <Icon name="copy" />
              Copy
            </button>
            <button
              className="ct-selection-action ct-selection-action--primary"
              disabled={!onAskSelection}
              onClick={() => onAskSelection?.(selectedIds)}
              type="button"
            >
              <Icon name="message" />
              Ask
            </button>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="ct-transcript__feedback">
        {feedback}
      </div>
    </div>
  );
}

export function TranscriptPanel(props: TranscriptPanelProps) {
  switch (props.state.kind) {
    case 'loading':
      return <TranscriptSkeleton />;
    case 'disabled':
      return (
        <TranscriptStateMessage
          actionLabel="Load transcript"
          description="Automatic transcript loading is disabled in settings."
          icon="captions"
          onAction={props.onEnableTranscript}
          title="Transcript loading is off"
        />
      );
    case 'unavailable':
      return (
        <TranscriptStateMessage
          description="This video does not expose a caption track to the viewer. WatchBetter will not invent transcript text."
          icon="captions"
          title="No transcript available"
        />
      );
    case 'error':
      return (
        <TranscriptStateMessage
          actionLabel="Try again"
          description={props.state.message}
          icon="close"
          onAction={props.onRetry}
          title="Transcript could not be loaded"
        />
      );
    case 'ready':
      return <TranscriptReadyView {...props} state={props.state} />;
  }
}
