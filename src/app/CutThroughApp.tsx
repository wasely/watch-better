import { useId, useState, type KeyboardEvent } from 'react';

import { Icon, type IconName } from '@/components/Icon';
import type { PanelTab } from '@/features/settings/settings';
import {
  TranscriptPanel,
  type TranscriptPanelProps,
} from '@/features/transcript/TranscriptPanel';
import {
  LOADING_TRANSCRIPT_STATE,
  type TranscriptViewState,
} from '@/features/transcript/transcript-view-state';
import { writeClipboardText } from '@/services/clipboard';

import './CutThroughApp.css';

export type ResolvedTheme = 'dark' | 'light';
export type PanelReadiness = 'loading' | 'ready' | 'unavailable';

export interface CutThroughAppProps {
  readonly theme?: ResolvedTheme;
  readonly initialTab?: PanelTab;
  readonly initialCollapsed?: boolean;
  readonly transcript?: TranscriptPanelProps;
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

const transcriptStatus = (
  state: TranscriptViewState,
): { readonly readiness: PanelReadiness; readonly label: string } => {
  switch (state.kind) {
    case 'loading':
      return { readiness: 'loading', label: 'Loading transcript' };
    case 'ready':
      return { readiness: 'ready', label: 'Transcript ready' };
    case 'disabled':
      return { readiness: 'unavailable', label: 'Transcript loading off' };
    case 'unavailable':
      return { readiness: 'unavailable', label: 'No transcript' };
    case 'error':
      return { readiness: 'unavailable', label: 'Transcript error' };
  }
};

function PlaceholderContent({
  tab,
}: {
  readonly tab: Exclude<PanelTab, 'transcript'>;
}) {
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

export function CutThroughApp({
  theme = 'dark',
  initialTab = 'transcript',
  initialCollapsed = false,
  transcript,
  onOpenSettings,
}: CutThroughAppProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const id = useId();
  const transcriptProps: TranscriptPanelProps = transcript ?? {
    state: LOADING_TRANSCRIPT_STATE,
  };
  const status = transcriptStatus(transcriptProps.state);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const current = tabs.findIndex((tab) => tab.id === activeTab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
            tabs.length;
    const next = tabs[nextIndex];
    if (!next) return;

    const tablist = event.currentTarget;
    setActiveTab(next.id);
    requestAnimationFrame(() => {
      Array.from(tablist.querySelectorAll<HTMLElement>('[data-tab-id]'))
        .find((element) => element.dataset.tabId === next.id)
        ?.focus();
    });
  };

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
          <span
            className={`ct-launcher__status ct-launcher__status--${status.readiness}`}
          />
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
              <span className={`ct-status ct-status--${status.readiness}`}>
                <i aria-hidden="true" />
                {status.label}
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

        <nav
          aria-label="CutThrough sections"
          className="ct-tabs"
          onKeyDown={handleTabKeyDown}
          role="tablist"
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                aria-controls={`${id}-${tab.id}-panel`}
                aria-selected={selected}
                className="ct-tab"
                data-tab-id={tab.id}
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
          {activeTab === 'transcript' ? (
            <TranscriptPanel
              {...transcriptProps}
              onCopy={transcriptProps.onCopy ?? writeClipboardText}
            />
          ) : (
            <PlaceholderContent tab={activeTab} />
          )}
        </div>
      </section>
    </div>
  );
}
