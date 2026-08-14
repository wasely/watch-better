import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { BrandLogo } from '@/components/BrandLogo';
import { Icon, type IconName } from '@/components/Icon';
import { resolveInitialProductTab } from '@/config/product-features';
import { AskPanel, type AskPanelProps } from '@/features/ask/AskPanel';
import type { PanelTab, TranscriptFontSize } from '@/features/settings/settings';
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
  readonly initialAskFocused?: boolean;
  readonly collapsed?: boolean;
  readonly transcript?: TranscriptPanelProps;
  readonly ask?: AskPanelProps;
  readonly onTabChange?: (tab: PanelTab) => void;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
  readonly onOpenSettings?: () => void;
  readonly onDetach?: () => void | Promise<void>;
  readonly onClose?: () => void;
  readonly onAskFocusChange?: (focused: boolean) => void;
  readonly transcriptFontSize?: TranscriptFontSize;
  readonly videoTitle?: string;
  readonly allowCollapse?: boolean;
  /** Floating cards minimize to their title bar instead of collapsing to a launcher. */
  readonly minimized?: boolean;
  readonly onMinimizedChange?: (minimized: boolean) => void;
  readonly onToggleMaximized?: () => void;
  readonly presentation?: 'panel' | 'floating';
}

const tabs: readonly {
  readonly id: PanelTab;
  readonly label: string;
  readonly icon: IconName;
}[] = [
  { id: 'transcript', label: 'Transcript', icon: 'captions' },
  { id: 'ask', label: 'Ask', icon: 'message' },
];

const transcriptStatus = (
  state: TranscriptViewState,
): { readonly readiness: PanelReadiness; readonly label: string } => {
  switch (state.kind) {
    case 'loading':
      return { readiness: 'loading', label: 'Loading transcript' };
    case 'ready':
      return { readiness: 'ready', label: 'Ready' };
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
  initialAskFocused = false,
  collapsed: controlledCollapsed,
  transcript,
  ask,
  onTabChange,
  onCollapsedChange,
  onOpenSettings,
  onDetach,
  onClose,
  onAskFocusChange,
  transcriptFontSize = 'standard',
  videoTitle,
  allowCollapse = true,
  presentation = 'panel',
  minimized = false,
  onMinimizedChange,
  onToggleMaximized,
}: WatchBetterAppProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<PanelTab>(() =>
    resolveInitialProductTab(initialTab),
  );
  const [internalCollapsed, setInternalCollapsed] = useState(initialCollapsed);
  const [askFocused, setAskFocused] = useState(initialAskFocused);
  const [detachState, setDetachState] = useState<'idle' | 'opening' | 'error'>('idle');
  const activeTab = resolveInitialProductTab(controlledActiveTab ?? internalActiveTab);
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
    if (nextTab === activeTab) return;
    if (controlledActiveTab === undefined) setInternalActiveTab(nextTab);
    onTabChange?.(nextTab);
  };

  const setPanelCollapsed = (nextCollapsed: boolean) => {
    if (nextCollapsed && askFocused) {
      setAskFocused(false);
      onAskFocusChange?.(false);
    }
    collapseFocusTarget.current = nextCollapsed;
    if (controlledCollapsed === undefined) setInternalCollapsed(nextCollapsed);
    onCollapsedChange?.(nextCollapsed);
  };

  const setAskFocus = (nextFocused: boolean) => {
    if (nextFocused === askFocused) return;
    setAskFocused(nextFocused);
    onAskFocusChange?.(nextFocused);
  };

  const detachPanel = () => {
    if (!onDetach || detachState === 'opening') return;
    setDetachState('opening');
    void Promise.resolve(onDetach())
      .then(() => setDetachState('idle'))
      .catch(() => setDetachState('error'));
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
      data-ask-focus={askFocused}
      data-collapsed={collapsed}
      data-minimized={minimized}
      data-presentation={presentation}
      data-theme={theme}
      data-transcript-font-size={transcriptFontSize}
      ref={rootRef}
    >
      {collapsed ? (
        <button
          aria-label={`Expand Watch Better. ${status.label}.`}
          className="ct-launcher"
          onClick={() => setPanelCollapsed(false)}
          title={`Expand Watch Better — ${status.label}`}
          type="button"
        >
          <span className="ct-launcher__brand" aria-hidden="true">
            <span className="ct-brand-mark">
              <BrandLogo />
            </span>
            <span
              className={`ct-launcher__status ct-launcher__status--${status.readiness}`}
            />
          </span>
          <span className="ct-launcher__copy">
            <strong>Watch Better</strong>
            <small>{status.label}</small>
          </span>
          <Icon name="arrow-right" />
        </button>
      ) : null}

      <section
        aria-label="Watch Better video companion"
        className="ct-panel"
        hidden={collapsed}
      >
        <header className="ct-header">
          <div className="ct-identity">
            <span className="ct-brand-mark" aria-hidden="true">
              <BrandLogo />
            </span>
            <div className="ct-identity__copy">
              <strong>Watch Better</strong>
              {videoTitle ? (
                <span className="ct-video-title" title={videoTitle}>
                  {videoTitle}
                </span>
              ) : null}
              {status.readiness !== 'ready' ? (
                <span
                  className={`ct-status ct-status--${status.readiness}`}
                  title={status.label}
                >
                  <i aria-hidden="true" />
                  <span>{status.label}</span>
                </span>
              ) : null}
            </div>
          </div>
          <div className="ct-header__actions">
            {onDetach ? (
              <button
                aria-label="Detach Watch Better for this video"
                className="ct-icon-button"
                disabled={detachState === 'opening'}
                onClick={detachPanel}
                title={
                  detachState === 'error'
                    ? 'Could not detach. Try again.'
                    : 'Detach into a movable video card'
                }
                type="button"
              >
                <Icon name="detach" />
              </button>
            ) : null}
            <button
              aria-label="Open Watch Better settings"
              className="ct-icon-button"
              disabled={!onOpenSettings}
              onClick={onOpenSettings}
              title="Settings"
              type="button"
            >
              <Icon name="settings" />
            </button>
            {allowCollapse ? (
              <button
                aria-label="Collapse Watch Better"
                className="ct-icon-button"
                onClick={() => setPanelCollapsed(true)}
                title="Collapse"
                type="button"
              >
                <Icon name="chevron-down" />
              </button>
            ) : null}
            {presentation === 'floating' && onMinimizedChange ? (
              <button
                aria-label={
                  minimized
                    ? 'Restore detached Watch Better'
                    : 'Minimize detached Watch Better'
                }
                className="ct-icon-button"
                onClick={() => onMinimizedChange(!minimized)}
                title={minimized ? 'Restore' : 'Minimize'}
                type="button"
              >
                <Icon name={minimized ? 'restore' : 'minimize'} />
              </button>
            ) : null}
            {presentation === 'floating' && onToggleMaximized ? (
              <button
                aria-label="Maximize or restore detached Watch Better"
                className="ct-icon-button"
                onClick={onToggleMaximized}
                title="Maximize / restore (or double-click this bar)"
                type="button"
              >
                <Icon name="maximize" />
              </button>
            ) : null}
            {presentation === 'floating' && onClose ? (
              <button
                aria-label="Close detached Watch Better"
                className="ct-icon-button"
                onClick={onClose}
                title="Close detached card"
                type="button"
              >
                <Icon name="close" />
              </button>
            ) : null}
            <span aria-live="polite" className="ct-sr-only">
              {detachState === 'opening'
                ? 'Detaching Watch Better into a movable card.'
                : detachState === 'error'
                  ? 'Could not detach Watch Better.'
                  : ''}
            </span>
          </div>
        </header>

        <nav
          aria-label="Watch Better sections"
          className={`ct-tabs ct-tabs--${tabs.length}`}
          data-active-tab={activeTab}
          hidden={minimized}
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
          hidden={minimized || activeTab !== 'transcript'}
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
          hidden={minimized || activeTab !== 'ask'}
          id={`${id}-ask-panel`}
          role="tabpanel"
          tabIndex={activeTab === 'ask' ? 0 : -1}
        >
          <AskPanel {...askProps} focused={askFocused} onFocusedChange={setAskFocus} />
        </div>
      </section>
    </div>
  );
}
