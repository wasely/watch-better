import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Icon, type IconName } from '@/components/Icon';
import { AskPanel, type AskPanelProps } from '@/features/ask/AskPanel';
import {
  DEFAULT_SKIP_CONFIGURATION,
  type PanelTab,
  type TranscriptFontSize,
} from '@/features/settings/settings';
import { SkipPanel, type SkipPanelProps } from '@/features/skip/SkipPanel';
import {
  TranscriptPanel,
  type TranscriptPanelProps,
} from '@/features/transcript/TranscriptPanel';
import {
  LOADING_TRANSCRIPT_STATE,
  type TranscriptViewState,
} from '@/features/transcript/transcript-view-state';
import { writeClipboardText } from '@/services/clipboard';

import './WatchBetterApp.css';

export type ResolvedTheme = 'dark' | 'light';
export type PanelReadiness = 'loading' | 'ready' | 'unavailable';

export interface WatchBetterAppProps {
  readonly theme?: ResolvedTheme;
  readonly initialTab?: PanelTab;
  readonly activeTab?: PanelTab;
  readonly initialCollapsed?: boolean;
  readonly collapsed?: boolean;
  readonly transcript?: TranscriptPanelProps;
  readonly ask?: AskPanelProps;
  readonly skip?: SkipPanelProps;
  readonly onTabChange?: (tab: PanelTab) => void;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
  readonly onOpenSettings?: () => void;
  readonly transcriptFontSize?: TranscriptFontSize;
}

const tabs: readonly {
  readonly id: PanelTab;
  readonly label: string;
  readonly icon: IconName;
}[] = [
  { id: 'transcript', label: 'Transcript', icon: 'captions' },
  { id: 'ask', label: 'Ask', icon: 'message' },
  { id: 'skip', label: 'Jump Cut', icon: 'speed' },
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

export function WatchBetterApp({
  theme = 'dark',
  initialTab = 'transcript',
  activeTab: controlledActiveTab,
  initialCollapsed = false,
  collapsed: controlledCollapsed,
  transcript,
  ask,
  skip,
  onTabChange,
  onCollapsedChange,
  onOpenSettings,
  transcriptFontSize = 'standard',
}: WatchBetterAppProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<PanelTab>(initialTab);
  const [internalCollapsed, setInternalCollapsed] = useState(initialCollapsed);
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const collapseFocusTarget = useRef<boolean | null>(null);
  const transcriptProps: TranscriptPanelProps = transcript ?? {
    state: LOADING_TRANSCRIPT_STATE,
  };
  const askProps: AskPanelProps = ask ?? {
    transcript:
      transcriptProps.state.kind === 'ready' ? transcriptProps.state.document : null,
  };
  const skipProps: SkipPanelProps = skip ?? {
    configuration: DEFAULT_SKIP_CONFIGURATION,
    snapshot: {
      state: 'unsupported',
      timeSavedSeconds: 0,
      message: 'Jump cutter is not connected to this player yet.',
    },
  };
  const status = transcriptStatus(transcriptProps.state);

  useLayoutEffect(() => {
    if (collapseFocusTarget.current !== collapsed) return;

    const target = collapsed
      ? rootRef.current?.querySelector<HTMLElement>('.ct-launcher')
      : rootRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
    target?.focus();
    collapseFocusTarget.current = null;
  }, [activeTab, collapsed]);

  const selectTab = (nextTab: PanelTab) => {
    if (controlledActiveTab === undefined) setInternalActiveTab(nextTab);
    onTabChange?.(nextTab);
  };

  const setPanelCollapsed = (nextCollapsed: boolean) => {
    collapseFocusTarget.current = nextCollapsed;
    if (controlledCollapsed === undefined) setInternalCollapsed(nextCollapsed);
    onCollapsedChange?.(nextCollapsed);
  };

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
    selectTab(next.id);
    requestAnimationFrame(() => {
      Array.from(tablist.querySelectorAll<HTMLElement>('[data-tab-id]'))
        .find((element) => element.dataset.tabId === next.id)
        ?.focus();
    });
  };

  return (
    <div
      className="watchbetter-root"
      data-theme={theme}
      data-transcript-font-size={transcriptFontSize}
      ref={rootRef}
    >
      {collapsed ? (
        <button
          aria-label={`Expand WatchBetter. ${status.label}.`}
          className="ct-launcher"
          onClick={() => setPanelCollapsed(false)}
          title={`Expand WatchBetter — ${status.label}`}
          type="button"
        >
          <span className="ct-brand-mark" aria-hidden="true">
            <Icon name="spark" />
          </span>
          <span
            aria-hidden="true"
            className={`ct-launcher__status ct-launcher__status--${status.readiness}`}
          >
            {status.readiness === 'ready'
              ? '✓'
              : status.readiness === 'loading'
                ? '…'
                : '!'}
          </span>
        </button>
      ) : null}

      <section
        aria-label="WatchBetter video companion"
        className="ct-panel"
        hidden={collapsed}
      >
        <header className="ct-header">
          <div className="ct-identity">
            <span className="ct-brand-mark" aria-hidden="true">
              <Icon name="spark" />
            </span>
            <div className="ct-identity__copy">
              <strong>WatchBetter</strong>
              <span className={`ct-status ct-status--${status.readiness}`}>
                <i aria-hidden="true" />
                {status.label}
              </span>
            </div>
          </div>
          <div className="ct-header__actions">
            <button
              aria-label="Open WatchBetter settings"
              className="ct-icon-button"
              disabled={!onOpenSettings}
              onClick={onOpenSettings}
              title="Settings"
              type="button"
            >
              <Icon name="settings" />
            </button>
            <button
              aria-label="Collapse WatchBetter"
              className="ct-icon-button"
              onClick={() => setPanelCollapsed(true)}
              title="Collapse"
              type="button"
            >
              <Icon name="chevron-down" />
            </button>
          </div>
        </header>

        <nav
          aria-label="WatchBetter sections"
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
                onClick={() => selectTab(tab.id)}
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
          aria-labelledby={`${id}-transcript-tab`}
          className="ct-panel__body"
          hidden={activeTab !== 'transcript'}
          id={`${id}-transcript-panel`}
          role="tabpanel"
          tabIndex={activeTab === 'transcript' ? 0 : -1}
        >
          <TranscriptPanel
            {...transcriptProps}
            key={
              transcriptProps.state.kind === 'ready'
                ? `${transcriptProps.state.document.videoId}:${transcriptProps.state.selectedTrackId}`
                : transcriptProps.state.kind
            }
            onCopy={transcriptProps.onCopy ?? writeClipboardText}
          />
        </div>
        <div
          aria-labelledby={`${id}-ask-tab`}
          className="ct-panel__body"
          hidden={activeTab !== 'ask'}
          id={`${id}-ask-panel`}
          role="tabpanel"
          tabIndex={activeTab === 'ask' ? 0 : -1}
        >
          <AskPanel
            {...askProps}
            key={askProps.transcript?.videoId ?? 'no-transcript'}
          />
        </div>
        <div
          aria-labelledby={`${id}-skip-tab`}
          className="ct-panel__body"
          hidden={activeTab !== 'skip'}
          id={`${id}-skip-panel`}
          role="tabpanel"
          tabIndex={activeTab === 'skip' ? 0 : -1}
        >
          <SkipPanel {...skipProps} />
        </div>
      </section>
    </div>
  );
}
