import {
  memo,
  useCallback,
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
  readonly onSendToAI?: (segmentIds: ReadonlySet<TranscriptSegmentId>) => void;
  readonly onRetry?: () => void;
  readonly onEnableTranscript?: () => void;
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

/** Segment ids are URI-encoded track ids plus digits, so quoting is all that is needed. */
const findSegmentElement = (
  container: HTMLElement | null,
  id: TranscriptSegmentId,
): HTMLElement | null =>
  container?.querySelector<HTMLElement>(
    `[data-segment-id="${id.replace(/["\\]/g, '\\$&')}"]`,
  ) ?? null;

const scrollSegmentWithinList = (
  list: HTMLElement,
  segment: HTMLElement,
  behavior: ScrollBehavior,
) => {
  const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight);
  const centeredTop =
    segment.offsetTop - (list.clientHeight - segment.offsetHeight) / 2;
  const top = Math.min(maxScrollTop, Math.max(0, centeredTop));

  if (typeof list.scrollTo === 'function') list.scrollTo({ behavior, top });
  else list.scrollTop = top;
};

interface TranscriptRowProps {
  readonly segment: TranscriptSegment;
  readonly index: number;
  readonly active: boolean;
  readonly selected: boolean;
  readonly searchCurrent: boolean;
  /** Empty unless this row matches, so a search only re-renders the rows it touches. */
  readonly highlightQuery: string;
  readonly onSeek: (segment: TranscriptSegment) => void;
  readonly onToggleSelection: (
    index: number,
    id: TranscriptSegmentId,
    range: boolean,
  ) => void;
  readonly onRangeIntent: (range: boolean) => void;
}

/**
 * Memoized because the list can hold thousands of rows and the panel re-renders every
 * time the active segment moves. Only the rows whose own props changed re-render.
 */
const TranscriptRow = memo(function TranscriptRow({
  segment,
  index,
  active,
  selected,
  searchCurrent,
  highlightQuery,
  onSeek,
  onToggleSelection,
  onRangeIntent,
}: TranscriptRowProps) {
  return (
    <div
      aria-current={active ? 'true' : undefined}
      className={`ct-transcript-row${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}${searchCurrent ? ' is-search-current' : ''}`}
      data-segment-id={segment.id}
      role="listitem"
    >
      <label className="ct-row-select" title="Select segment">
        <input
          aria-label={`Select transcript segment at ${formatTimestamp(segment.startSeconds)}`}
          checked={selected}
          onClick={(event) => onToggleSelection(index, segment.id, event.shiftKey)}
          onMouseDown={(event) => onRangeIntent(event.shiftKey)}
          readOnly
          type="checkbox"
        />
      </label>
      <button
        aria-label={`Seek to ${formatTimestamp(segment.startSeconds)}`}
        className="ct-row-time"
        onClick={() => onSeek(segment)}
        type="button"
      >
        {formatTimestamp(segment.startSeconds)}
      </button>
      <button
        className="ct-row-text"
        data-segment-seek
        onClick={() => onSeek(segment)}
        type="button"
      >
        {highlightQuery ? highlightText(segment.text, highlightQuery) : segment.text}
      </button>
    </div>
  );
});

function TranscriptReadyView({
  state,
  activeSegmentId = null,
  initialQuery = '',
  initialSelectedSegmentIds = EMPTY_SELECTION,
  autoFollow = true,
  onSeek,
  onTrackChange,
  onCopy,
  onSendToAI,
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
  // Rows are memoized, so they get a stable seek callback instead of the parent's.
  const seekRef = useRef(onSeek);
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
    seekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    if (!following || !activeSegmentId) return;
    const list = listRef.current;
    const active = findSegmentElement(list, activeSegmentId);
    if (!list || !active) return;
    ignoreScrollUntilRef.current = performance.now() + 500;
    scrollSegmentWithinList(list, active, 'auto');
  }, [activeSegmentId, following]);

  const suspendFollow = () => {
    if (following) setFollowing(false);
  };

  const focusMatch = (nextIndex: number) => {
    if (matches.length === 0) return;
    const wrapped = (nextIndex + matches.length) % matches.length;
    setCurrentMatch(wrapped);
    const segmentIndex = matches[wrapped];
    const segment = segmentIndex === undefined ? undefined : segments[segmentIndex];
    if (!segment) return;

    suspendFollow();
    const list = listRef.current;
    const row = findSegmentElement(list, segment.id);
    if (!list || !row) return;
    scrollSegmentWithinList(list, row, 'smooth');
    row
      .querySelector<HTMLElement>('[data-segment-seek]')
      ?.focus({ preventScroll: true });
  };

  const toggleSelection = useCallback(
    (index: number, id: TranscriptSegmentId, shiftHeld: boolean) => {
      const range = shiftHeld || rangeModifierRef.current;
      rangeModifierRef.current = false;
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
    },
    [segments],
  );

  const seekSegment = useCallback((segment: TranscriptSegment) => {
    seekRef.current?.(segment);
  }, []);

  const rememberRangeIntent = useCallback((range: boolean) => {
    rangeModifierRef.current = range;
  }, []);

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
    ]?.focus({ preventScroll: true });
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
          <span className="ct-search__nav">
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
          </span>
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
            aria-label="Copy transcript"
            className="ct-mini-button ct-mini-button--labeled"
            onClick={() =>
              void copyTranscript(undefined, 'Full transcript copied to clipboard.')
            }
            title="Copy every caption to clipboard"
            type="button"
          >
            <Icon name="copy" />
            <span>Copy</span>
          </button>
          <button
            aria-label="Send to AI"
            className="ct-send-button"
            disabled={!onSendToAI}
            onClick={() => onSendToAI?.(selectedIds)}
            type="button"
          >
            <Icon name="message" />
            <span>Send to AI</span>
          </button>
        </div>
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
        {segments.map((segment, index) => (
          <TranscriptRow
            active={activeSegmentId === segment.id}
            highlightQuery={matchingIndexes.has(index) ? query : ''}
            index={index}
            key={segment.id}
            onRangeIntent={rememberRangeIntent}
            onSeek={seekSegment}
            onToggleSelection={toggleSelection}
            searchCurrent={matches[currentMatch] === index}
            segment={segment}
            selected={selectedIds.has(segment.id)}
          />
        ))}
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
              aria-label="Send selected transcript to AI"
              className="ct-selection-action ct-selection-action--primary"
              disabled={!onSendToAI}
              onClick={() => onSendToAI?.(selectedIds)}
              type="button"
            >
              <Icon name="message" />
              <span>Send to AI</span>
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
          actionLabel="Check again"
          description="YouTube did not return captions for this video. If captions just became available, check again."
          icon="captions"
          onAction={props.onRetry}
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
