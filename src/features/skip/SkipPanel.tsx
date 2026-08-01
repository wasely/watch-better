import { useId, useState } from 'react';

import { Icon } from '@/components/Icon';
import type {
  SkipConfiguration,
  SkipDetectionState,
  SkipEngineSnapshot,
  SkipPresetId,
} from '@/features/skip/skip-engine';
import {
  configurationForSkipPreset,
  findMatchingSkipPreset,
  SKIP_PRESETS,
} from '@/features/skip/skip-presets';

import './SkipPanel.css';

const RESET_CONFIGURATION = configurationForSkipPreset('conservative', false);
const ELEVATED_RISK_BASELINE = configurationForSkipPreset('balanced', true);

const STATUS_CONTENT: Readonly<
  Record<
    SkipDetectionState,
    { readonly label: string; readonly fallback: string; readonly tone: string }
  >
> = {
  disabled: {
    label: 'Off',
    fallback: 'Playback is unchanged.',
    tone: 'neutral',
  },
  'waiting-for-transcript': {
    label: 'Waiting',
    fallback: 'Waiting for reliable transcript timing.',
    tone: 'waiting',
  },
  ready: {
    label: 'Ready',
    fallback: 'Reliable candidate gaps are available.',
    tone: 'ready',
  },
  active: {
    label: 'Compressing',
    fallback: 'A detected gap is being compressed.',
    tone: 'active',
  },
  unsupported: {
    label: 'Unavailable',
    fallback: 'This player state does not support pause compression.',
    tone: 'warning',
  },
  error: {
    label: 'Attention needed',
    fallback: 'Pause detection stopped safely.',
    tone: 'warning',
  },
};

const formatCompactNumber = (value: number): string =>
  value
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');

const formatDuration = (seconds: number): string => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
};

const hasElevatedRisk = (configuration: SkipConfiguration): boolean =>
  configuration.jumpLongGaps ||
  configuration.minimumGapSeconds < ELEVATED_RISK_BASELINE.minimumGapSeconds ||
  configuration.leadingPaddingSeconds < ELEVATED_RISK_BASELINE.leadingPaddingSeconds ||
  configuration.trailingPaddingSeconds <
    ELEVATED_RISK_BASELINE.trailingPaddingSeconds ||
  configuration.speechPlaybackRate > ELEVATED_RISK_BASELINE.speechPlaybackRate ||
  configuration.gapPlaybackRate > ELEVATED_RISK_BASELINE.gapPlaybackRate;

interface RangeFieldProps {
  readonly id: string;
  readonly label: string;
  readonly valueLabel: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly disabled: boolean;
  readonly onChange: (value: number) => void;
}

function RangeField({
  id,
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: RangeFieldProps) {
  return (
    <label className="ct-skip-range" htmlFor={id}>
      <span>{label}</span>
      <output htmlFor={id}>{valueLabel}</output>
      <input
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

export interface SkipPanelProps {
  readonly configuration: SkipConfiguration;
  readonly snapshot: SkipEngineSnapshot;
  readonly detectionLabel?: string;
  readonly initialAdvancedOpen?: boolean;
  readonly onConfigurationChange?: (configuration: SkipConfiguration) => void;
  readonly onReset?: () => void;
}

export function SkipPanel({
  configuration,
  snapshot,
  detectionLabel = 'Transcript-gap candidate',
  initialAdvancedOpen = false,
  onConfigurationChange,
  onReset,
}: SkipPanelProps) {
  const id = useId();
  const [advancedOpen, setAdvancedOpen] = useState(initialAdvancedOpen);
  const status = STATUS_CONTENT[snapshot.state];
  const matchingPreset = findMatchingSkipPreset(configuration);
  const canChange = Boolean(onConfigurationChange);
  const unavailable = snapshot.state === 'unsupported' || snapshot.state === 'error';
  const elevatedRisk = hasElevatedRisk(configuration);
  const canToggle = canChange && (configuration.enabled || !unavailable);
  const resetEnabled = Boolean(onReset || onConfigurationChange);

  const updateConfiguration = (patch: Partial<SkipConfiguration>) => {
    onConfigurationChange?.({ ...configuration, ...patch });
  };

  const applyPreset = (preset: SkipPresetId) => {
    onConfigurationChange?.(configurationForSkipPreset(preset, configuration.enabled));
  };

  const reset = () => {
    if (onReset) {
      onReset();
      return;
    }
    onConfigurationChange?.(RESET_CONFIGURATION);
  };

  return (
    <div className="ct-skip">
      <section aria-labelledby={`${id}-title`} className="ct-skip-intro">
        <div className="ct-skip-intro__heading">
          <div>
            <span aria-hidden="true" className="ct-skip-intro__icon">
              <Icon name="speed" />
            </span>
            <span>
              <strong id={`${id}-title`}>Jump Cut</strong>
              <small>Beta</small>
            </span>
          </div>
          <button
            aria-checked={configuration.enabled}
            aria-label={
              configuration.enabled
                ? 'Disable pause compression'
                : 'Enable pause compression'
            }
            className="ct-skip-switch"
            disabled={!canToggle}
            onClick={() => updateConfiguration({ enabled: !configuration.enabled })}
            role="switch"
            type="button"
          >
            <span aria-hidden="true">
              <i />
            </span>
            {configuration.enabled ? (unavailable ? 'Turn off' : 'On') : 'Enable'}
          </button>
        </div>
        <p>Compresses caption gaps. Speech controls remain separate.</p>
      </section>

      <section aria-label="Jump Cut status" className="ct-skip-status">
        <div aria-live="polite" className="ct-skip-status__state">
          <span className={`ct-skip-status__dot ct-skip-status__dot--${status.tone}`} />
          <span>
            <small>Status</small>
            <strong>{status.label}</strong>
          </span>
          <p>{snapshot.message ?? status.fallback}</p>
        </div>
        <div className="ct-skip-status__saved">
          <strong>{formatDuration(snapshot.timeSavedSeconds)}</strong>
          <span>saved</span>
        </div>
      </section>

      <section aria-labelledby={`${id}-presets`} className="ct-skip-presets">
        <div className="ct-skip-section-heading">
          <strong id={`${id}-presets`}>Preset</strong>
        </div>
        <div className="ct-skip-preset-grid">
          {SKIP_PRESETS.map((preset) => (
            <button
              aria-pressed={matchingPreset === preset.id}
              disabled={!canChange}
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              type="button"
            >
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      {configuration.enabled && snapshot.state !== 'error' ? (
        <div
          className={`ct-skip-warning${elevatedRisk ? ' ct-skip-warning--strong' : ''}`}
          role="status"
        >
          <strong>
            {elevatedRisk
              ? 'Aggressive controls can remove context'
              : 'Timing is approximate'}
          </strong>
          <span>
            Caption gaps can misrepresent silence. Turn this off immediately if speech
            is affected.
          </span>
        </div>
      ) : null}

      {snapshot.state === 'error' ? (
        <div className="ct-skip-unavailable" role="status">
          <strong>Playback restored</strong>
          <span>{snapshot.message ?? status.fallback}</span>
        </div>
      ) : null}

      <details
        className="ct-skip-advanced"
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        open={advancedOpen}
      >
        <summary>
          <span>
            <strong>Advanced controls</strong>
            <small>Gap, padding and playback rates</small>
          </span>
          <Icon name="chevron-down" />
        </summary>
        <div className="ct-skip-advanced__body">
          <RangeField
            disabled={!canChange}
            id={`${id}-minimum-gap`}
            label="Minimum gap"
            max={30}
            min={0.5}
            onChange={(value) => updateConfiguration({ minimumGapSeconds: value })}
            step={0.1}
            value={configuration.minimumGapSeconds}
            valueLabel={`${formatCompactNumber(configuration.minimumGapSeconds)}s`}
          />
          <RangeField
            disabled={!canChange}
            id={`${id}-leading-padding`}
            label="Leading padding"
            max={3}
            min={0}
            onChange={(value) => updateConfiguration({ leadingPaddingSeconds: value })}
            step={0.05}
            value={configuration.leadingPaddingSeconds}
            valueLabel={`${formatCompactNumber(configuration.leadingPaddingSeconds)}s`}
          />
          <RangeField
            disabled={!canChange}
            id={`${id}-trailing-padding`}
            label="Trailing padding"
            max={3}
            min={0}
            onChange={(value) => updateConfiguration({ trailingPaddingSeconds: value })}
            step={0.05}
            value={configuration.trailingPaddingSeconds}
            valueLabel={`${formatCompactNumber(configuration.trailingPaddingSeconds)}s`}
          />
          <RangeField
            disabled={!canChange}
            id={`${id}-speech-rate`}
            label="Speech speed"
            max={3}
            min={0.5}
            onChange={(value) => updateConfiguration({ speechPlaybackRate: value })}
            step={0.05}
            value={configuration.speechPlaybackRate}
            valueLabel={`${formatCompactNumber(configuration.speechPlaybackRate)}×`}
          />
          <RangeField
            disabled={!canChange}
            id={`${id}-gap-rate`}
            label="Gap speed"
            max={16}
            min={1}
            onChange={(value) => updateConfiguration({ gapPlaybackRate: value })}
            step={0.25}
            value={configuration.gapPlaybackRate}
            valueLabel={`${formatCompactNumber(configuration.gapPlaybackRate)}×`}
          />
          <label className="ct-skip-check">
            <input
              checked={configuration.jumpLongGaps}
              disabled={!canChange}
              onChange={(event) =>
                updateConfiguration({ jumpLongGaps: event.currentTarget.checked })
              }
              type="checkbox"
            />
            <span>
              <strong>Jump long gaps</strong>
              <small>Seek instead of speeding through</small>
            </span>
          </label>
          <RangeField
            disabled={!canChange || !configuration.jumpLongGaps}
            id={`${id}-jump-threshold`}
            label="Jump threshold"
            max={60}
            min={2}
            onChange={(value) => updateConfiguration({ jumpThresholdSeconds: value })}
            step={1}
            value={configuration.jumpThresholdSeconds}
            valueLabel={`${formatCompactNumber(configuration.jumpThresholdSeconds)}s`}
          />
        </div>
      </details>

      <footer className="ct-skip-footer">
        <small>{detectionLabel}</small>
        <button
          className="ct-button"
          disabled={!resetEnabled}
          onClick={reset}
          type="button"
        >
          Reset controls
        </button>
      </footer>
    </div>
  );
}
