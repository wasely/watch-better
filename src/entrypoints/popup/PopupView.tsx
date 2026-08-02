import { BrandLogo } from '@/components/BrandLogo';
import { Icon } from '@/components/Icon';
import type { RuntimeStatus } from '@/messaging/messages';

import './PopupView.css';

export type PopupTheme = 'dark' | 'light';
export type PopupAction = 'toggle' | 'settings' | null;

export interface PopupViewProps {
  readonly status: RuntimeStatus | null;
  readonly message: string;
  readonly error?: boolean;
  readonly theme?: PopupTheme;
  readonly busyAction?: PopupAction;
  readonly onSetEnabled: (enabled: boolean) => void;
  readonly onOpenSettings: () => void;
}

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
  onOpenSettings,
}: PopupViewProps) {
  const enabled = status?.enabled ?? false;
  const loading = status === null && !error;
  const toggleLabel = loading
    ? 'Watch Better status loading'
    : error
      ? 'Watch Better status unavailable'
      : enabled
        ? 'Turn Watch Better off'
        : 'Turn Watch Better on';

  return (
    <main className="ct-popup" data-theme={theme}>
      <header className="ct-popup__header">
        <div className="ct-popup__identity">
          <BrandLogo aria-hidden="true" className="ct-popup__logo" />
          <strong>Watch Better</strong>
        </div>
        <button
          aria-label="Open settings"
          className="ct-popup__settings"
          disabled={busyAction !== null}
          onClick={onOpenSettings}
          type="button"
        >
          <Icon name="settings" />
        </button>
      </header>

      <section
        aria-live="polite"
        className={`ct-popup-status ct-popup-status--${statusTone(status, error)}`}
      >
        <span aria-hidden="true" />
        <p>{message}</p>
      </section>

      <button
        aria-checked={enabled}
        aria-label={toggleLabel}
        className="ct-popup-toggle"
        disabled={loading || error || busyAction !== null}
        onClick={() => onSetEnabled(!enabled)}
        role="switch"
        type="button"
      >
        <strong>{enabled ? 'Enabled' : 'Disabled'}</strong>
        <i aria-hidden="true">
          <b />
        </i>
      </button>

      {busyAction ? (
        <span className="ct-popup__sr-only" aria-live="polite" role="status">
          Working…
        </span>
      ) : null}
    </main>
  );
}
