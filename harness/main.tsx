import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { WatchBetterApp, type ResolvedTheme } from '@/app/WatchBetterApp';
import { OptionsView } from '@/entrypoints/options/OptionsView';
import { PopupView, type PopupAction } from '@/entrypoints/popup/PopupView';
import {
  DEFAULT_SETTINGS,
  type WatchBetterSettings,
  type PanelTab,
} from '@/features/settings/settings';
import type { RuntimeStatus } from '@/messaging/messages';
import type { TranscriptViewState } from '@/features/transcript/transcript-view-state';
import {
  spanishTranscript,
  transcriptFixtureStates,
  type TranscriptFixtureId,
} from '@/test/fixtures/transcripts';

import './style.css';

const widths = [320, 360, 402, 480] as const;
type HarnessWidth = (typeof widths)[number];
type HarnessScenarioId = TranscriptFixtureId | 'search' | 'selected';
type HarnessSurface = 'panel' | 'popup' | 'options';
type PopupFixtureId =
  'loading' | 'supported' | 'mounted' | 'unsupported' | 'disabled' | 'busy' | 'error';

interface PopupFixture {
  readonly label: string;
  readonly status: RuntimeStatus | null;
  readonly message: string;
  readonly error: boolean;
  readonly busyAction?: Exclude<PopupAction, null>;
}

const popupFixtures: Readonly<Record<PopupFixtureId, PopupFixture>> = {
  loading: {
    label: 'Loading',
    status: null,
    message: 'Checking this tab…',
    error: false,
  },
  supported: {
    label: 'Watch page ready',
    status: {
      enabled: true,
      supportedPage: true,
      panelMounted: false,
      version: '0.1.0',
    },
    message: 'Reload this video to show Watch Better.',
    error: false,
  },
  mounted: {
    label: 'Panel visible',
    status: {
      enabled: true,
      supportedPage: true,
      panelMounted: true,
      version: '0.1.0',
    },
    message: 'Ready on this video.',
    error: false,
  },
  unsupported: {
    label: 'Unsupported page',
    status: {
      enabled: true,
      supportedPage: false,
      panelMounted: false,
      version: '0.1.0',
    },
    message: 'Open a YouTube video to use Watch Better.',
    error: false,
  },
  disabled: {
    label: 'Extension disabled',
    status: {
      enabled: false,
      supportedPage: true,
      panelMounted: false,
      version: '0.1.0',
    },
    message: 'Turn it on to use Watch Better on videos.',
    error: false,
  },
  busy: {
    label: 'Settings opening',
    status: {
      enabled: true,
      supportedPage: true,
      panelMounted: false,
      version: '0.1.0',
    },
    message: 'Opening settings…',
    error: false,
    busyAction: 'settings',
  },
  error: {
    label: 'Status error',
    status: null,
    message: 'Could not read Watch Better status. Try again.',
    error: true,
  },
};

const scenarioLabels: Record<HarnessScenarioId, string> = {
  tutorial: '5-minute tutorial',
  podcast: '2-hour podcast',
  fragments: 'Short caption fragments',
  technical: 'Long technical rows',
  multilingual: 'Multiple languages',
  search: 'Search results',
  selected: 'Selected rows',
  loading: 'Loading',
  unavailable: 'No transcript',
  disabled: 'Transcript disabled',
  error: 'Extraction error',
};

const harnessParams = new URLSearchParams(location.search);
const initialTheme: ResolvedTheme =
  harnessParams.get('theme') === 'light' ? 'light' : 'dark';
const requestedWidth = Number(harnessParams.get('width'));
const initialWidth: HarnessWidth = widths.includes(requestedWidth as HarnessWidth)
  ? (requestedWidth as HarnessWidth)
  : 402;
const requestedScenario = harnessParams.get('scenario');
const initialScenario: HarnessScenarioId =
  requestedScenario && requestedScenario in scenarioLabels
    ? (requestedScenario as HarnessScenarioId)
    : 'tutorial';
const requestedTab = harnessParams.get('tab');
const initialTab: PanelTab = requestedTab === 'ask' ? requestedTab : 'transcript';
const requestedSurface = harnessParams.get('surface');
const initialSurface: HarnessSurface =
  requestedSurface === 'popup' || requestedSurface === 'options'
    ? requestedSurface
    : 'panel';
const requestedPopupFixture = harnessParams.get('popup');
const initialPopupFixtureId: PopupFixtureId =
  requestedPopupFixture && requestedPopupFixture in popupFixtures
    ? (requestedPopupFixture as PopupFixtureId)
    : 'supported';
const openShouldFail = harnessParams.get('open') === 'error';
const frameShouldFail = harnessParams.get('frame') === 'error';
const providerFrameState =
  harnessParams.get('frame') === 'loading'
    ? ('loading' as const)
    : openShouldFail
      ? ('sign-in-required' as const)
      : ('ready' as const);
const initialCollapsed = harnessParams.get('collapsed') === '1';

function NeighborCard() {
  return (
    <div className="harness-neighbor">
      <div>
        <span />
        <strong>Other extension</strong>
      </div>
      <i />
      <i />
      <i />
    </div>
  );
}

const baseFixtureId = (scenario: HarnessScenarioId): TranscriptFixtureId =>
  scenario === 'search' || scenario === 'selected' ? 'tutorial' : scenario;

function Harness() {
  const [theme, setTheme] = useState<ResolvedTheme>(initialTheme);
  const [surface, setSurface] = useState<HarnessSurface>(initialSurface);
  const [popupFixtureId, setPopupFixtureId] =
    useState<PopupFixtureId>(initialPopupFixtureId);
  const [popupStatus, setPopupStatus] = useState<RuntimeStatus | null>(
    popupFixtures[initialPopupFixtureId].status,
  );
  const [popupMessage, setPopupMessage] = useState(
    popupFixtures[initialPopupFixtureId].message,
  );
  const [optionsSettings, setOptionsSettings] =
    useState<WatchBetterSettings>(DEFAULT_SETTINGS);
  const [optionsStatus, setOptionsStatus] = useState('Settings loaded');
  const [width, setWidth] = useState<HarnessWidth>(initialWidth);
  const [scenario, setScenario] = useState<HarnessScenarioId>(initialScenario);
  const [panelTab, setPanelTab] = useState<PanelTab>(initialTab);
  const [selectedTrackId, setSelectedTrackId] = useState('en-human');
  const [activeIndex, setActiveIndex] = useState(4);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [neighborFirst, setNeighborFirst] = useState(false);
  const [instance, setInstance] = useState(0);

  const fixture = transcriptFixtureStates[baseFixtureId(scenario)];
  const transcriptState = useMemo<TranscriptViewState>(() => {
    if (fixture.kind !== 'ready') return fixture;

    return {
      ...fixture,
      document: selectedTrackId === 'es-human' ? spanishTranscript : fixture.document,
      selectedTrackId: fixture.tracks.some((track) => track.id === selectedTrackId)
        ? selectedTrackId
        : fixture.selectedTrackId,
    };
  }, [fixture, selectedTrackId]);

  const activeSegment =
    transcriptState.kind === 'ready'
      ? (transcriptState.document.segments[activeIndex] ??
        transcriptState.document.segments[0])
      : undefined;
  const selectedFixtureIds =
    scenario === 'selected' && transcriptState.kind === 'ready'
      ? transcriptState.document.segments.slice(2, 6).map((segment) => segment.id)
      : undefined;
  const askSelectedSegmentIds = useMemo(
    () =>
      new Set(
        scenario === 'selected' && transcriptState.kind === 'ready'
          ? transcriptState.document.segments.slice(2, 6).map((segment) => segment.id)
          : [],
      ),
    [scenario, transcriptState],
  );
  const remount = (nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed);
    setInstance((value) => value + 1);
  };

  const changeScenario = (nextScenario: HarnessScenarioId) => {
    const nextFixture = transcriptFixtureStates[baseFixtureId(nextScenario)];
    setScenario(nextScenario);
    setActiveIndex(4);
    setSelectedTrackId(
      nextFixture.kind === 'ready' ? nextFixture.selectedTrackId : 'en-human',
    );
    setInstance((value) => value + 1);
  };

  const changePopupFixture = (nextId: PopupFixtureId) => {
    const nextFixture = popupFixtures[nextId];
    setPopupFixtureId(nextId);
    setPopupStatus(nextFixture.status);
    setPopupMessage(nextFixture.message);
  };

  const updatePopupEnabled = (enabled: boolean) => {
    setPopupStatus((current) => (current ? { ...current, enabled } : current));
    setPopupMessage(enabled ? 'Watch Better enabled.' : 'Watch Better disabled.');
  };

  const updateOptions = (changes: Partial<WatchBetterSettings>) => {
    setOptionsSettings((current) => ({ ...current, ...changes }));
    setOptionsStatus('Saved');
  };

  return (
    <div className={`harness-page harness-page--${theme}`}>
      <aside aria-label="Harness controls" className="harness-controls">
        <div>
          <strong>Watch Better harness</strong>
          <span>MVP fixture suite</span>
        </div>

        <label>
          Theme
          <select
            onChange={(event) => setTheme(event.currentTarget.value as ResolvedTheme)}
            value={theme}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label>
          Surface
          <select
            onChange={(event) =>
              setSurface(event.currentTarget.value as HarnessSurface)
            }
            value={surface}
          >
            <option value="panel">YouTube panel</option>
            <option value="popup">Toolbar popup</option>
            <option value="options">Settings page</option>
          </select>
        </label>

        {surface === 'panel' ? (
          <>
            <label>
              Panel tab
              <select
                onChange={(event) => {
                  setPanelTab(event.currentTarget.value as PanelTab);
                  setInstance((value) => value + 1);
                }}
                value={panelTab}
              >
                <option value="transcript">Transcript</option>
                <option value="ask">Ask</option>
              </select>
            </label>

            <label>
              Column width
              <select
                onChange={(event) =>
                  setWidth(Number(event.currentTarget.value) as HarnessWidth)
                }
                value={width}
              >
                {widths.map((option) => (
                  <option key={option} value={option}>
                    {option}px
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fixture
              <select
                onChange={(event) =>
                  changeScenario(event.currentTarget.value as HarnessScenarioId)
                }
                value={scenario}
              >
                {(Object.keys(scenarioLabels) as HarnessScenarioId[]).map((id) => (
                  <option key={id} value={id}>
                    {scenarioLabels[id]}
                  </option>
                ))}
              </select>
            </label>

            {transcriptState.kind === 'ready' ? (
              <label>
                Active row
                <input
                  max={transcriptState.document.segments.length - 1}
                  min="0"
                  onChange={(event) =>
                    setActiveIndex(Number(event.currentTarget.value))
                  }
                  type="range"
                  value={Math.min(
                    activeIndex,
                    transcriptState.document.segments.length - 1,
                  )}
                />
              </label>
            ) : null}

            <label className="harness-check">
              <input
                checked={collapsed}
                onChange={(event) => remount(event.currentTarget.checked)}
                type="checkbox"
              />
              Start collapsed
            </label>

            <label className="harness-check">
              <input
                checked={neighborFirst}
                onChange={(event) => setNeighborFirst(event.currentTarget.checked)}
                type="checkbox"
              />
              Neighbor above
            </label>
          </>
        ) : null}

        {surface === 'popup' ? (
          <label>
            Popup state
            <select
              onChange={(event) =>
                changePopupFixture(event.currentTarget.value as PopupFixtureId)
              }
              value={popupFixtureId}
            >
              {(Object.keys(popupFixtures) as PopupFixtureId[]).map((fixtureId) => (
                <option key={fixtureId} value={fixtureId}>
                  {popupFixtures[fixtureId].label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </aside>

      {surface === 'panel' ? (
        <main className="harness-stage" aria-label="Simulated YouTube page">
          <div className="harness-video">
            <span>Simulated YouTube player</span>
            <div />
          </div>
          <aside className="harness-column" style={{ width }}>
            {neighborFirst ? <NeighborCard /> : null}
            <WatchBetterApp
              ask={{
                transcript:
                  transcriptState.kind === 'ready' ? transcriptState.document : null,
                selectedSegmentIds: askSelectedSegmentIds,
                currentTimeSeconds: activeSegment?.startSeconds ?? null,
                initialScope: scenario === 'selected' ? 'selection' : 'entire-video',
                providerStatuses: {
                  chatgpt: {
                    provider: 'chatgpt',
                    state: providerFrameState,
                  },
                  gemini: { provider: 'gemini', state: 'ready' },
                  deepseek: { provider: 'deepseek', state: 'ready' },
                },
                onSendWebChat: ({ provider }) =>
                  Promise.resolve({
                    provider,
                    responseId: `web_${provider}_fixture`,
                    text: 'The video supports this point at [00:08] and adds context at [00:24].',
                  }),
                onOpenWebChat: () =>
                  openShouldFail
                    ? Promise.reject(new Error('Fixture tab failure.'))
                    : Promise.resolve(),
                onPrepareWebChat: () =>
                  frameShouldFail
                    ? Promise.reject(new Error('Fixture frame binding failure.'))
                    : Promise.resolve(),
              }}
              activeTab={panelTab}
              collapsed={collapsed}
              key={`${instance}-${scenario}`}
              onCollapsedChange={setCollapsed}
              onOpenSettings={() => setSurface('options')}
              onTabChange={setPanelTab}
              theme={theme}
              transcript={{
                state: transcriptState,
                activeSegmentId: activeSegment?.id ?? null,
                initialQuery: scenario === 'search' ? 'evidence' : '',
                ...(selectedFixtureIds
                  ? { initialSelectedSegmentIds: selectedFixtureIds }
                  : {}),
                onSendToAI: () => undefined,
                onCopy: () => Promise.resolve(),
                onEnableTranscript: () => changeScenario('tutorial'),
                onRetry: () => changeScenario('tutorial'),
                onSeek: (segment) => {
                  if (transcriptState.kind !== 'ready') return;
                  const index = transcriptState.document.segments.findIndex(
                    (candidate) => candidate.id === segment.id,
                  );
                  if (index >= 0) setActiveIndex(index);
                },
                onTrackChange: setSelectedTrackId,
              }}
            />
            {!neighborFirst ? <NeighborCard /> : null}
          </aside>
        </main>
      ) : surface === 'popup' ? (
        <div className="harness-standalone">
          <PopupView
            {...(popupFixtures[popupFixtureId].busyAction
              ? { busyAction: popupFixtures[popupFixtureId].busyAction }
              : {})}
            error={popupFixtures[popupFixtureId].error}
            message={popupMessage}
            onOpenSettings={() => setSurface('options')}
            onSetEnabled={updatePopupEnabled}
            status={popupStatus}
            theme={theme}
          />
        </div>
      ) : (
        <div className="harness-options">
          <OptionsView
            onChange={updateOptions}
            settings={optionsSettings}
            status={optionsStatus}
            theme={theme}
          />
        </div>
      )}
    </div>
  );
}

const root = document.querySelector('#root');
if (!root) throw new Error('Harness root was not found.');

createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
