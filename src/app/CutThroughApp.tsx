import { useId, useState } from 'react';

import { Icon, type IconName } from '@/components/Icon';
import type { PanelTab } from '@/features/settings/settings';

import './CutThroughApp.css';

export type ResolvedTheme = 'dark' | 'light';
export type PanelReadiness = 'loading' | 'ready' | 'unavailable';

export interface CutThroughAppProps {
  readonly theme?: ResolvedTheme;
  readonly initialTab?: PanelTab;
  readonly initialCollapsed?: boolean;
  readonly readiness?: PanelReadiness;
  readonly onOpenSettings?: () => void;
}

const tabs: readonly {
  readonly id: PanelTab;
  readonly label: string;
  readonly icon: IconName;
}[] = [
  { id: 'transcript', label: 'Transcript', icon: 'captions' },
  { id: 'ask', label: 'Ask', icon: 'message' },
  { id: 'skip', label: 'Skip', icon: 'speed' },
];

const readinessLabels: Record<PanelReadiness, string> = {
  loading: 'Loading transcript',
  ready: 'Transcript ready',
  unavailable: 'Transcript unavailable',
};

function PlaceholderContent({ tab }: { readonly tab: PanelTab }) {
  if (tab === 'ask') {
    return (
      <div className="ct-placeholder">
        <div className="ct-placeholder__icon" aria-hidden="true">
          <Icon name="message" />
        </div>
        <strong>Ask with context</strong>
        <p>Build a timestamped prompt, then copy it or open ChatGPT explicitly.</p>
        <button className="ct-button ct-button--primary" type="button">
          Prepare a question
        </button>
      </div>
    );
  }

  if (tab === 'skip') {
    return (
      <div className="ct-placeholder">
        <div className="ct-placeholder__icon" aria-hidden="true">
          <Icon name="speed" />
        </div>
        <strong>Pause compression is off</strong>
        <p>Conservative controls will appear after transcript timing is ready.</p>
        <button className="ct-button" type="button">
          Review controls
        </button>
      </div>
    );
  }

  return (
    <div aria-busy="true" aria-live="polite" className="ct-transcript-skeleton">
      <div className="ct-search-skeleton" />
      {[78, 92, 66, 84, 56].map((width, index) => (
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

export function CutThroughApp({
  theme = 'dark',
  initialTab = 'transcript',
  initialCollapsed = false,
  readiness = 'loading',
  onOpenSettings,
}: CutThroughAppProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const id = useId();

  if (collapsed) {
    return (
      <div className="cutthrough-root" data-theme={theme}>
        <button
          aria-label="Expand CutThrough"
          className="ct-launcher"
          onClick={() => setCollapsed(false)}
          title="Expand CutThrough"
          type="button"
        >
          <span className="ct-brand-mark" aria-hidden="true">
            <Icon name="spark" />
          </span>
          <span className={`ct-launcher__status ct-launcher__status--${readiness}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="cutthrough-root" data-theme={theme}>
      <section aria-label="CutThrough video companion" className="ct-panel">
        <header className="ct-header">
          <div className="ct-identity">
            <span className="ct-brand-mark" aria-hidden="true">
              <Icon name="spark" />
            </span>
            <div className="ct-identity__copy">
              <strong>CutThrough</strong>
              <span className={`ct-status ct-status--${readiness}`}>
                <i aria-hidden="true" />
                {readinessLabels[readiness]}
              </span>
            </div>
          </div>
          <div className="ct-header__actions">
            <button
              aria-label="Open CutThrough settings"
              className="ct-icon-button"
              onClick={onOpenSettings}
              title="Settings"
              type="button"
            >
              <Icon name="settings" />
            </button>
            <button
              aria-label="Collapse CutThrough"
              className="ct-icon-button"
              onClick={() => setCollapsed(true)}
              title="Collapse"
              type="button"
            >
              <Icon name="chevron-down" />
            </button>
          </div>
        </header>

        <nav aria-label="CutThrough sections" className="ct-tabs" role="tablist">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                aria-controls={`${id}-${tab.id}-panel`}
                aria-selected={selected}
                className="ct-tab"
                id={`${id}-${tab.id}-tab`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <Icon name={tab.icon} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div
          aria-labelledby={`${id}-${activeTab}-tab`}
          className="ct-panel__body"
          id={`${id}-${activeTab}-panel`}
          role="tabpanel"
          tabIndex={0}
        >
          <PlaceholderContent tab={activeTab} />
        </div>
      </section>
    </div>
  );
}
