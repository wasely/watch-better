import { Icon } from '@/components/Icon';
import type { RuntimeStatus } from '@/messaging/messages';

import './PopupView.css';

export type PopupTheme = 'dark' | 'light';
export type PopupAction = 'toggle' | 'restore' | 'settings' | null;

export interface PopupViewProps {
  readonly status: RuntimeStatus | null;
  readonly message: string;
  readonly error?: boolean;
  readonly theme?: PopupTheme;
  readonly busyAction?: PopupAction;
  readonly onSetEnabled: (enabled: boolean) => void;
  readonly onRestorePanel: () => void;
  readonly onOpenSettings: () => void;
}

const statusTitle = (status: RuntimeStatus | null, error: boolean): string => {
  if (error) return 'Status unavailable';
  if (!status) return 'Checking this tab';
  if (!status.enabled) return 'WatchBetter is disabled';
  if (!status.supportedPage) return 'Unsupported page';
  return status.panelMounted ? 'Panel visible' : 'Watch page ready';
};

const statusTone = (status: RuntimeStatus | null, error: boolean): string => {
  if (error) return 'warning';
  if (!status) return 'neutral';
  if (!status.enabled || !status.supportedPage) return 'warning';
  return 'ready';
};

export function PopupView({
  status,
  message,
  error = false,
  theme = 'dark',
  busyAction = null,
  onSetEnabled,
  onRestorePanel,
  onOpenSettings,
}: PopupViewProps) {
  const enabled = status?.enabled ?? false;
  const loading = status === null && !error;
  const toggleTitle = status
    ? enabled
      ? 'Extension enabled'
      : 'Extension disabled'
    : 'Extension status';
  const toggleDescription = status
    ? 'Show the panel on supported videos'
    : error
      ? 'Enablement could not be read'
      : 'Reading saved enablement…';
  const restoreDisabled =
    status === null ||
    error ||
    busyAction !== null ||
    !status.enabled ||
    !status.supportedPage ||
    status.panelMounted;

  return (
    <main className="ct-popup" data-theme={theme}>
      <header className="ct-popup__header">
        <span aria-hidden="true" className="ct-popup__logo">
          <Icon name="spark" />
        </span>
        <div>
          <strong>WatchBetter</strong>
          <span>v{status?.version ?? '0.1.0'}</span>
        </div>
      </header>

      <section
        aria-live="polite"
        className={`ct-popup-status ct-popup-status--${statusTone(status, error)}`}
      >
        <span aria-hidden="true" />
        <div>
          <strong>{statusTitle(status, error)}</strong>
          <p>{message}</p>
        </div>
      </section>

      <button
        aria-checked={enabled}
        aria-label={toggleTitle}
        className="ct-popup-toggle"
        disabled={loading || error || busyAction !== null}
        onClick={() => onSetEnabled(!enabled)}
        role="switch"
        type="button"
      >
        <span>
          <strong>{toggleTitle}</strong>
          <small>{toggleDescription}</small>
        </span>
        <i aria-hidden="true">
          <b />
        </i>
      </button>

      <div className="ct-popup-actions">
        <button disabled={restoreDisabled} onClick={onRestorePanel} type="button">
          <Icon name="follow" />
          {status?.panelMounted ? 'Panel visible' : 'Restore panel'}
        </button>
        <button disabled={busyAction !== null} onClick={onOpenSettings} type="button">
          <Icon name="settings" />
          Settings
        </button>
      </div>

      <footer>
        <span aria-live="polite" role="status">
          {busyAction ? 'Working…' : 'No transcript or prompt content is stored here.'}
        </span>
      </footer>
    </main>
  );
}
