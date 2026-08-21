import { Icon } from '@/components/Icon';
import {
  SMART_SKIP_CATEGORIES,
  SMART_SKIP_CATEGORY_LABELS,
  type SmartSkipAnalysisState,
  type SmartSkipCategory,
  type SmartSkipConfiguration,
  type SmartSkipInterval,
  type SmartSkipRefinementState,
} from '@/features/smart-skip/domain';
import type { SmartSkipEngineSnapshot } from '@/features/smart-skip/smart-skip-engine';

import './SmartSkipPanel.css';

const formatDuration = (seconds: number): string => {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(2, '0')}`
    : `${remainder}s`;
};

const formatTimestamp = (seconds: number): string => {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const intervalDuration = (interval: SmartSkipInterval): number =>
  Math.max(0, interval.endSeconds - interval.startSeconds);

export interface SmartSkipPanelProps {
  readonly configuration: SmartSkipConfiguration;
  readonly analysisState: SmartSkipAnalysisState;
  readonly refinementState?: SmartSkipRefinementState;
  readonly engineSnapshot: SmartSkipEngineSnapshot;
  readonly durationSeconds: number | null;
  readonly transcriptAvailable: boolean;
  readonly onConfigurationChange?: (configuration: SmartSkipConfiguration) => void;
  readonly onEnabledChange?: (enabled: boolean) => void;
  readonly onIntervalEnabledChange?: (intervalId: string, enabled: boolean) => void;
  readonly onUndo?: () => void;
  readonly onSeek?: (seconds: number) => void;
}

const cutPosition = (
  interval: SmartSkipInterval,
  durationSeconds: number | null,
): 'Open' | 'Middle' | 'End' => {
  if (!durationSeconds || durationSeconds <= 0) return 'Middle';
  if (interval.startSeconds <= durationSeconds * 0.12) return 'Open';
  if (interval.endSeconds >= durationSeconds * 0.88) return 'End';
  return 'Middle';
};

export function SmartSkipPanel({
  configuration,
  analysisState,
  refinementState = { kind: 'idle' },
  engineSnapshot,
  durationSeconds,
  transcriptAvailable,
  onConfigurationChange,
  onEnabledChange,
  onIntervalEnabledChange,
  onUndo,
  onSeek,
}: SmartSkipPanelProps) {
  const analysis = analysisState.kind === 'ready' ? analysisState.analysis : null;
  const intervals = analysis?.intervals ?? [];
  const activeCuts = intervals.filter((interval) => interval.enabled);
  const proposedSavings = activeCuts.reduce(
    (total, interval) => total + intervalDuration(interval),
    0,
  );
  const deepCutCount = intervals.filter(
    (interval) => interval.source === 'deep',
  ).length;
  const enabled = engineSnapshot.state !== 'disabled';
  const scanning =
    refinementState.kind === 'connecting' || refinementState.kind === 'analyzing';
  const refinementProgress =
    refinementState.kind === 'analyzing'
      ? {
          completed: Math.max(0, refinementState.completed),
          total: Math.max(1, refinementState.total),
        }
      : null;

  const refinementLabel = (() => {
    switch (refinementState.kind) {
      case 'idle':
        return transcriptAvailable ? 'Deep scan queued' : 'Waiting for captions';
      case 'connecting':
        return 'Deep scan connecting';
      case 'analyzing':
        return `Deep scan ${refinementState.completed}/${refinementState.total}`;
      case 'complete':
        return refinementState.addedCuts === 0
          ? 'Deep scan complete'
          : `${refinementState.addedCuts} deeper ${refinementState.addedCuts === 1 ? 'cut' : 'cuts'} found`;
      case 'unavailable':
        return 'Strict local scan active';
    }
  })();

  const updateConfiguration = (patch: Partial<SmartSkipConfiguration>) =>
    onConfigurationChange?.({ ...configuration, ...patch });

  const toggleCategory = (category: SmartSkipCategory, checked: boolean) => {
    const categories = checked
      ? [...configuration.categories, category]
      : configuration.categories.filter((candidate) => candidate !== category);
    if (categories.length > 0) updateConfiguration({ categories });
  };

  return (
    <div className="ct-smart-skip">
      <section className="ct-smart-skip__hero">
        <div className="ct-smart-skip__identity">
          <span className="ct-smart-skip__mark" aria-hidden="true">
            <Icon name="spark" />
          </span>
          <span>
            <small>Cut intelligence</small>
            <strong>Smart Skip</strong>
          </span>
        </div>
        <button
          aria-checked={enabled}
          className="ct-smart-skip__switch"
          disabled={!onEnabledChange}
          onClick={() => onEnabledChange?.(!enabled)}
          role="switch"
          type="button"
        >
          <span aria-hidden="true">
            <i />
          </span>
          {enabled ? 'Live' : 'Off'}
        </button>
      </section>

      <section
        className={`ct-smart-skip__overview${scanning ? ' ct-smart-skip__overview--scanning' : ''}`}
      >
        <div aria-label="Smart Skip summary" className="ct-smart-skip__summary">
          <div>
            <small>Queued</small>
            <strong>{formatDuration(proposedSavings)}</strong>
          </div>
          <div>
            <small>Saved</small>
            <strong>{formatDuration(engineSnapshot.timeSavedSeconds)}</strong>
          </div>
          <div>
            <small>Cuts</small>
            <strong>{activeCuts.length}</strong>
          </div>
        </div>

        <div
          aria-label="Video cut map"
          className={`ct-smart-skip__map${scanning ? ' ct-smart-skip__map--scanning' : ''}`}
          role="region"
        >
          <div className="ct-smart-skip__map-track">
            {durationSeconds && durationSeconds > 0
              ? activeCuts.map((interval) => (
                  <button
                    aria-label={`${SMART_SKIP_CATEGORY_LABELS[interval.category]} at ${formatTimestamp(interval.startSeconds)}`}
                    className="ct-smart-skip__map-cut"
                    data-source={interval.source ?? 'instant'}
                    key={interval.id}
                    onClick={() => onSeek?.(interval.startSeconds)}
                    style={{
                      left: `${Math.max(0, (interval.startSeconds / durationSeconds) * 100)}%`,
                      width: `${Math.max(1.2, (intervalDuration(interval) / durationSeconds) * 100)}%`,
                    }}
                    title={interval.reason}
                    type="button"
                  />
                ))
              : null}
            {scanning ? (
              <i aria-hidden="true" className="ct-smart-skip__scan-beam" />
            ) : null}
          </div>
          <div className="ct-smart-skip__map-labels">
            <span>0:00</span>
            <span className="ct-smart-skip__map-legend">
              <i data-source="instant" /> Instant
              <i data-source="deep" /> Deep
            </span>
            <span>{formatTimestamp(durationSeconds ?? 0)}</span>
          </div>
        </div>
      </section>

      {engineSnapshot.lastSkipped ? (
        <div className="ct-smart-skip__undo" role="status">
          <span>{engineSnapshot.message}</span>
          <button onClick={onUndo} type="button">
            Undo
          </button>
        </div>
      ) : null}

      <section className="ct-smart-skip__control" aria-labelledby="smart-skip-control">
        <div className="ct-smart-skip__control-status">
          <span
            className="ct-smart-skip__pulse"
            data-active={scanning}
            aria-hidden="true"
          />
          <div className="ct-smart-skip__status-copy">
            <strong id="smart-skip-control">{refinementLabel}</strong>
            <small>
              {refinementState.kind === 'unavailable'
                ? refinementState.message
                : deepCutCount > 0
                  ? 'Context-aware cuts use hatched markers.'
                  : 'Instant cuts stay active during analysis.'}
            </small>
            {refinementProgress ? (
              <div className="ct-smart-skip__progress">
                <span
                  aria-label="Deep scan progress"
                  aria-valuemax={refinementProgress.total}
                  aria-valuemin={0}
                  aria-valuenow={Math.min(
                    refinementProgress.completed,
                    refinementProgress.total,
                  )}
                  role="progressbar"
                >
                  <i
                    style={{
                      width: `${Math.min(100, (refinementProgress.completed / refinementProgress.total) * 100)}%`,
                    }}
                  />
                </span>
                <small>
                  {refinementProgress.completed} of {refinementProgress.total} sections
                </small>
              </div>
            ) : null}
          </div>
        </div>

        <label className="ct-smart-skip__intensity">
          <span>Skip intensity</span>
          <select
            aria-label="Skip intensity"
            onChange={(event) =>
              updateConfiguration({
                strictness: event.currentTarget
                  .value as SmartSkipConfiguration['strictness'],
              })
            }
            value={configuration.strictness}
          >
            <option value="conservative">Safe</option>
            <option value="balanced">Strict</option>
            <option value="aggressive">Maximum</option>
          </select>
        </label>

        <details className="ct-smart-skip__categories">
          <summary>Cut targets</summary>
          <div>
            {SMART_SKIP_CATEGORIES.map((category) => (
              <label key={category}>
                <input
                  checked={configuration.categories.includes(category)}
                  onChange={(event) =>
                    toggleCategory(category, event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>{SMART_SKIP_CATEGORY_LABELS[category]}</span>
              </label>
            ))}
          </div>
        </details>

        {analysis?.reviewRequired ? (
          <p className="ct-smart-skip__warning" role="alert">
            Large cut map. Review the hatched middle cuts before leaving it on.
          </p>
        ) : null}
      </section>

      {analysis && intervals.length === 0 ? (
        <section className="ct-smart-skip__empty">
          <strong>No safe cuts found</strong>
          <p>The strict pass kept the full video.</p>
        </section>
      ) : null}

      {intervals.length > 0 ? (
        <section className="ct-smart-skip__cuts" aria-labelledby="smart-skip-cuts">
          <div className="ct-smart-skip__section-heading">
            <span>
              <small>Editorial queue</small>
              <strong id="smart-skip-cuts">Cut list</strong>
            </span>
            <span>{intervals.length} mapped</span>
          </div>
          <div className="ct-smart-skip__cut-list">
            {intervals.map((interval) => {
              const source = interval.source ?? 'instant';
              return (
                <article
                  className="ct-smart-skip__cut"
                  data-source={source}
                  key={interval.id}
                >
                  <button
                    className="ct-smart-skip__timestamp"
                    onClick={() => onSeek?.(interval.startSeconds)}
                    type="button"
                  >
                    {formatTimestamp(interval.startSeconds)}
                  </button>
                  <div>
                    <div className="ct-smart-skip__cut-title">
                      <strong>{SMART_SKIP_CATEGORY_LABELS[interval.category]}</strong>
                      <span data-source={source}>
                        {source === 'deep' ? 'Deep' : 'Instant'}
                      </span>
                      <span>{cutPosition(interval, durationSeconds)}</span>
                    </div>
                    <p>{interval.reason}</p>
                    <small>
                      {formatDuration(intervalDuration(interval))} cut ·{' '}
                      {Math.round(interval.confidence * 100)}% confidence
                    </small>
                  </div>
                  <input
                    aria-label={`${interval.enabled ? 'Disable' : 'Enable'} ${SMART_SKIP_CATEGORY_LABELS[interval.category]} cut at ${formatTimestamp(interval.startSeconds)}`}
                    checked={interval.enabled}
                    onChange={(event) =>
                      onIntervalEnabledChange?.(
                        interval.id,
                        event.currentTarget.checked,
                      )
                    }
                    type="checkbox"
                  />
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
