import { Icon } from '@/components/Icon';
import {
  SMART_SKIP_CATEGORIES,
  SMART_SKIP_CATEGORY_LABELS,
  type SmartSkipAnalysisState,
  type SmartSkipCategory,
  type SmartSkipConfiguration,
  type SmartSkipInterval,
  type SmartSkipRefinementState,
  type SmartSkipStrictness,
} from '@/features/smart-skip/domain';
import type { SmartSkipEngineSnapshot } from '@/features/smart-skip/smart-skip-engine';

import './SmartSkipPanel.css';

const STRICTNESS_OPTIONS: readonly {
  value: SmartSkipStrictness;
  label: string;
}[] = [
  { value: 'conservative', label: 'Safe' },
  { value: 'balanced', label: 'Strict' },
  { value: 'aggressive', label: 'Maximum' },
];

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

const formatRate = (rate: number): string =>
  `${Number.isInteger(rate) ? rate : Number(rate.toFixed(2))}×`;

const intervalDuration = (interval: SmartSkipInterval): number =>
  Math.max(0, interval.endSeconds - interval.startSeconds);

const estimatedIntervalSavings = (
  interval: SmartSkipInterval,
  basePlaybackRate: number,
): number =>
  intervalDuration(interval) / Math.min(16, Math.max(0.25, basePlaybackRate));

export interface SmartSkipPanelProps {
  readonly configuration: SmartSkipConfiguration;
  readonly analysisState: SmartSkipAnalysisState;
  readonly refinementState?: SmartSkipRefinementState;
  readonly engineSnapshot: SmartSkipEngineSnapshot;
  readonly durationSeconds: number | null;
  readonly transcriptAvailable: boolean;
  readonly refinementRequested?: boolean;
  readonly onConfigurationChange?: (configuration: SmartSkipConfiguration) => void;
  readonly onEnabledChange?: (enabled: boolean) => void;
  readonly onIntervalEnabledChange?: (intervalId: string, enabled: boolean) => void;
  readonly onUndo?: () => void;
  readonly onSeek?: (seconds: number) => void;
  readonly onRefinementRequest?: () => void;
}

const actionPosition = (
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
  refinementRequested = false,
  onConfigurationChange,
  onEnabledChange,
  onIntervalEnabledChange,
  onUndo,
  onSeek,
  onRefinementRequest,
}: SmartSkipPanelProps) {
  const analysis = analysisState.kind === 'ready' ? analysisState.analysis : null;
  const intervals = analysis?.intervals ?? [];
  const jumpIntervals = intervals;
  const enabledJumps = jumpIntervals.filter((interval) => interval.enabled);
  const basePlaybackRate = Math.min(
    16,
    Math.max(0.25, engineSnapshot.basePlaybackRate),
  );
  const proposedSavings = enabledJumps.reduce(
    (total, interval) => total + estimatedIntervalSavings(interval, basePlaybackRate),
    0,
  );
  const deepActionCount = jumpIntervals.filter(
    (interval) => interval.source === 'deep',
  ).length;
  const runtimeReady = transcriptAvailable && analysisState.kind === 'ready';
  const enabled = configuration.autoSkip && runtimeReady;
  const switchLabel = !transcriptAvailable
    ? 'Needs captions'
    : analysisState.kind !== 'ready'
      ? 'Preparing'
      : enabled
        ? 'On'
        : 'Off';
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
        return transcriptAvailable
          ? refinementRequested
            ? 'Deep scan queued'
            : 'Optional deep scan'
          : 'Waiting for captions';
      case 'connecting':
        return 'Deep scan connecting';
      case 'analyzing':
        return `Deep scan ${refinementState.completed}/${refinementState.total}`;
      case 'complete':
        return refinementState.addedCuts === 0
          ? 'Deep scan complete'
          : `${refinementState.addedCuts} deeper ${refinementState.addedCuts === 1 ? 'jump' : 'jumps'} found`;
      case 'unavailable':
        return 'Strict local scan active';
    }
  })();
  const canRequestRefinement =
    transcriptAvailable &&
    analysisState.kind === 'ready' &&
    !refinementRequested &&
    refinementState.kind !== 'complete';
  const refinementProvider = configuration.provider === 'gemini' ? 'Gemini' : 'ChatGPT';

  const updateConfiguration = (patch: Partial<SmartSkipConfiguration>) =>
    onConfigurationChange?.({ ...configuration, ...patch });

  const toggleCategory = (category: SmartSkipCategory, checked: boolean) => {
    const categories = checked
      ? [...new Set([...configuration.categories, category])]
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
            <small>Automatic skipping</small>
            <strong>Smart Skip</strong>
          </span>
        </div>
        <button
          aria-checked={enabled}
          aria-label={
            runtimeReady
              ? 'Automatic Smart Skip'
              : transcriptAvailable
                ? 'Automatic Smart Skip is preparing'
                : 'Automatic Smart Skip requires captions'
          }
          className="ct-smart-skip__switch"
          disabled={!onEnabledChange || !runtimeReady}
          onClick={() => onEnabledChange?.(!configuration.autoSkip)}
          role="switch"
          type="button"
        >
          <span aria-hidden="true">
            <i />
          </span>
          {switchLabel}
        </button>
      </section>

      <section className="ct-smart-skip__profile" aria-labelledby="smart-skip-profile">
        <div className="ct-smart-skip__profile-heading">
          <span>
            <strong id="smart-skip-profile">Skip intensity</strong>
            <small>Playback stays at your YouTube speed</small>
          </span>
          <span className="ct-smart-skip__rates" aria-label="Playback speed behavior">
            <i>YouTube speed · {formatRate(basePlaybackRate)}</i>
            <i>Never changed</i>
          </span>
        </div>
        <div
          aria-label="Skip intensity"
          className="ct-smart-skip__segments"
          role="group"
        >
          {STRICTNESS_OPTIONS.map((option) => (
            <button
              aria-pressed={configuration.strictness === option.value}
              disabled={!onConfigurationChange}
              key={option.value}
              onClick={() => updateConfiguration({ strictness: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section
        className={`ct-smart-skip__overview${scanning ? ' ct-smart-skip__overview--scanning' : ''}`}
      >
        <div aria-label="Smart Skip summary" className="ct-smart-skip__summary">
          <div>
            <small>Full-video potential</small>
            <strong>{formatDuration(proposedSavings)}</strong>
          </div>
          <div>
            <small>Saved this play</small>
            <strong>{formatDuration(engineSnapshot.timeSavedSeconds)}</strong>
          </div>
          <div>
            <small>Jumps</small>
            <strong>{enabledJumps.length}</strong>
          </div>
          <div>
            <small>Speed</small>
            <strong>Yours</strong>
          </div>
        </div>

        <div aria-label="Video action map" className="ct-smart-skip__map" role="region">
          <div className="ct-smart-skip__map-track">
            {durationSeconds && durationSeconds > 0
              ? jumpIntervals.map((interval) => {
                  const actionLabel = 'Jump';
                  return (
                    <span
                      className="ct-smart-skip__map-marker"
                      data-action="skip"
                      data-enabled={interval.enabled}
                      data-source={interval.source ?? 'instant'}
                      key={interval.id}
                      style={{
                        left: `${Math.max(0, (interval.startSeconds / durationSeconds) * 100)}%`,
                        width: `${Math.max(1.2, (intervalDuration(interval) / durationSeconds) * 100)}%`,
                      }}
                    >
                      <button
                        aria-label={`${interval.enabled ? actionLabel : `Held ${actionLabel.toLocaleLowerCase()}`} ${SMART_SKIP_CATEGORY_LABELS[interval.category]} at ${formatTimestamp(interval.startSeconds)}`}
                        className="ct-smart-skip__map-action"
                        disabled={!onSeek}
                        onClick={() => onSeek?.(interval.startSeconds)}
                        title={`${interval.enabled ? actionLabel : `Held ${actionLabel.toLocaleLowerCase()}`} · ${interval.reason}`}
                        type="button"
                      />
                    </span>
                  );
                })
              : null}
          </div>
          <div className="ct-smart-skip__map-labels">
            <span>0:00</span>
            <span className="ct-smart-skip__map-legend">
              <span>
                <i data-action="skip" /> Jump
              </span>
              {jumpIntervals.some((interval) => !interval.enabled) ? (
                <span>
                  <i data-enabled="false" /> Held
                </span>
              ) : null}
            </span>
            <span>{formatTimestamp(durationSeconds ?? 0)}</span>
          </div>
        </div>
      </section>

      <div className="ct-smart-skip__runtime" role="status">
        <span>{engineSnapshot.message}</span>
        {engineSnapshot.lastSkipped ? (
          <button disabled={!onUndo} onClick={onUndo} type="button">
            Undo
          </button>
        ) : null}
      </div>

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
              {analysisState.kind === 'error'
                ? analysisState.message
                : refinementState.kind === 'unavailable'
                  ? refinementState.message
                  : canRequestRefinement
                    ? `Sends bounded caption chunks to ${refinementProvider} only when you start it.`
                    : deepActionCount > 0
                      ? 'Deeper context jumps use hatched markers.'
                      : 'Local jumps work immediately.'}
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
          {canRequestRefinement ? (
            <button
              className="ct-smart-skip__refine"
              disabled={!onRefinementRequest}
              onClick={onRefinementRequest}
              type="button"
            >
              Start deep scan
            </button>
          ) : null}
        </div>

        <details className="ct-smart-skip__categories">
          <summary>Skip targets</summary>
          <div>
            {SMART_SKIP_CATEGORIES.map((category) => (
              <label key={category}>
                <input
                  checked={configuration.categories.includes(category)}
                  disabled={!onConfigurationChange}
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
            Safety limit reached. Lower-confidence jumps beyond 35% of the video are
            held off until you review and enable them.
          </p>
        ) : null}
      </section>

      {analysis && jumpIntervals.length === 0 ? (
        <section className="ct-smart-skip__empty">
          <strong>No safe jumps found</strong>
          <p>The current profile kept the full video.</p>
        </section>
      ) : null}

      {jumpIntervals.length > 0 ? (
        <section
          className="ct-smart-skip__actions"
          aria-labelledby="smart-skip-actions"
        >
          <div className="ct-smart-skip__section-heading">
            <span>
              <small>Playback map</small>
              <strong id="smart-skip-actions">Actions</strong>
            </span>
            <span>{jumpIntervals.length} mapped</span>
          </div>
          <div className="ct-smart-skip__action-list">
            {jumpIntervals.map((interval) => {
              const source = interval.source ?? 'instant';
              return (
                <article
                  className="ct-smart-skip__action"
                  data-source={source}
                  key={interval.id}
                >
                  <button
                    aria-label={`Seek to ${formatTimestamp(interval.startSeconds)}`}
                    className="ct-smart-skip__timestamp"
                    disabled={!onSeek}
                    onClick={() => onSeek?.(interval.startSeconds)}
                    type="button"
                  >
                    {formatTimestamp(interval.startSeconds)}
                  </button>
                  <div>
                    <div className="ct-smart-skip__action-title">
                      <strong>{SMART_SKIP_CATEGORY_LABELS[interval.category]}</strong>
                      <span data-action="skip">Jump</span>
                      <span data-source={source}>
                        {source === 'deep' ? 'Deep' : 'Local'}
                      </span>
                      <span>{actionPosition(interval, durationSeconds)}</span>
                    </div>
                    <p>{interval.reason}</p>
                    <small>
                      {formatDuration(intervalDuration(interval))} jumped ·{' '}
                      {Math.round(interval.confidence * 100)}% confidence
                    </small>
                  </div>
                  <input
                    aria-label={`${interval.enabled ? 'Disable' : 'Enable'} ${SMART_SKIP_CATEGORY_LABELS[interval.category]} jump at ${formatTimestamp(interval.startSeconds)}`}
                    checked={interval.enabled}
                    disabled={!onIntervalEnabledChange}
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
