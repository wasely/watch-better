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
import type {
  SkipConfiguration,
  SkipEngineSnapshot,
} from '@/features/skip/skip-engine';
import type { RuntimeStatus } from '@/messaging/messages';
import type { TranscriptViewState } from '@/features/transcript/transcript-view-state';
import { skipFixtures, type SkipFixtureId } from '@/test/fixtures/skip';
import {
  spanishTranscript,
  transcriptFixtureStates,
  type TranscriptFixtureId,
} from '@/test/fixtures/transcripts';

import './style.css';

const widths = [320, 402, 480] as const;
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
    message: 'Reading the active tab status…',
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
    message: 'Watch page detected. Restore the panel if it is hidden.',
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
    message: 'WatchBetter is mounted on this video.',
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
    message: 'Open a desktop YouTube watch page to use WatchBetter.',
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
    message: 'Enable the extension to show its YouTube panel.',
    error: false,
  },
  busy: {
    label: 'Restore in progress',
    status: {
      enabled: true,
      supportedPage: true,
      panelMounted: false,
      version: '0.1.0',
    },
    message: 'Waiting for the panel restore request to finish.',
    error: false,
    busyAction: 'restore',
  },
  error: {
    label: 'Status error',
    status: null,
    message: 'Could not read WatchBetter status. Try again.',
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
const initialTab: PanelTab =
  requestedTab === 'ask' || requestedTab === 'skip' ? requestedTab : 'transcript';
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
const requestedSkipFixture = harnessParams.get('skip');
const initialSkipFixtureId: SkipFixtureId =
  requestedSkipFixture && requestedSkipFixture in skipFixtures
    ? (requestedSkipFixture as SkipFixtureId)
    : 'off';
const openShouldFail = harnessParams.get('open') === 'error';
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
  const [skipFixtureId, setSkipFixtureId] =
    useState<SkipFixtureId>(initialSkipFixtureId);
  const [skipConfiguration, setSkipConfiguration] = useState<SkipConfiguration>(
    skipFixtures[initialSkipFixtureId].configuration,
  );
  const [skipSnapshot, setSkipSnapshot] = useState<SkipEngineSnapshot>(
    skipFixtures[initialSkipFixtureId].snapshot,
  );
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
  const askInitialQuestion =
    harnessParams.get('empty') === '1'
      ? ''
      : scenario === 'podcast'
        ? 'Summarize this video with the strongest evidence and important caveats.'
        : scenario === 'selected'
          ? 'Explain why these selected sections matter and identify the evidence.'
          : scenario === 'search'
            ? 'Find where they discuss evidence and explain the surrounding context.'
            : 'List the key ideas and cite the strongest timestamped evidence.';

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

  const changeSkipFixture = (nextId: SkipFixtureId) => {
    const nextFixture = skipFixtures[nextId];
    setSkipFixtureId(nextId);
    setSkipConfiguration(nextFixture.configuration);
    setSkipSnapshot(nextFixture.snapshot);
    setInstance((value) => value + 1);
  };

  const updateSkipConfiguration = (next: SkipConfiguration) => {
    setSkipConfiguration(next);
    setSkipSnapshot((current) => {
      if (!next.enabled) {
        return {
          state: 'disabled',
          timeSavedSeconds: current.timeSavedSeconds,
          message: 'Playback restored. No pause compression is active.',
        };
      }
      if (current.state === 'disabled') {
        return {
          state: 'ready',
          timeSavedSeconds: current.timeSavedSeconds,
          message: 'Candidate gaps are ready for this fixture.',
        };
      }
      return current;
    });
  };

  const changePopupFixture = (nextId: PopupFixtureId) => {
    const nextFixture = popupFixtures[nextId];
    setPopupFixtureId(nextId);
    setPopupStatus(nextFixture.status);
    setPopupMessage(nextFixture.message);
  };

  const updatePopupEnabled = (enabled: boolean) => {
    setPopupStatus((current) => (current ? { ...current, enabled } : current));
    setPopupMessage(enabled ? 'WatchBetter enabled.' : 'WatchBetter disabled.');
  };

  const restorePopupPanel = () => {
    setPopupStatus((current) =>
      current ? { ...current, panelMounted: true } : current,
    );
    setPopupMessage('Panel restore simulated in the fixture.');
  };

  const updateOptions = (changes: Partial<WatchBetterSettings>) => {
    setOptionsSettings((current) => ({ ...current, ...changes }));
    setOptionsStatus('Saved');
  };

  return (
    <div className={`harness-page harness-page--${theme}`}>
      <aside aria-label="Harness controls" className="harness-controls">
        <div>
          <strong>WatchBetter harness</strong>
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
                <option value="skip">Jump Cut</option>
              </select>
            </label>

            {panelTab === 'skip' ? (
              <label>
                Skip state
                <select
                  onChange={(event) =>
                    changeSkipFixture(event.currentTarget.value as SkipFixtureId)
                  }
                  value={skipFixtureId}
                >
                  {(Object.keys(skipFixtures) as SkipFixtureId[]).map((fixtureId) => (
                    <option key={fixtureId} value={fixtureId}>
                      {skipFixtures[fixtureId].label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

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
                initialQuestion: askInitialQuestion,
                providerStatuses: {
                  chatgpt: {
                    provider: 'chatgpt',
                    state: openShouldFail ? 'sign-in-required' : 'ready',
                  },
                  gemini: { provider: 'gemini', state: 'ready' },
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
              }}
              activeTab={panelTab}
              collapsed={collapsed}
              key={`${instance}-${scenario}`}
              onCollapsedChange={setCollapsed}
              onOpenSettings={() => setSurface('options')}
              onTabChange={setPanelTab}
              skip={{
                configuration: skipConfiguration,
                snapshot: skipSnapshot,
                detectionLabel: 'Transcript-gap fixture candidate',
                initialAdvancedOpen: skipFixtures[skipFixtureId].advancedOpen ?? false,
                onConfigurationChange: updateSkipConfiguration,
                onReset: () => changeSkipFixture('off'),
              }}
              theme={theme}
              transcript={{
                state: transcriptState,
                activeSegmentId: activeSegment?.id ?? null,
                initialQuery: scenario === 'search' ? 'evidence' : '',
                ...(selectedFixtureIds
                  ? { initialSelectedSegmentIds: selectedFixtureIds }
                  : {}),
                onAskSelection: () => undefined,
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
            onRestorePanel={restorePopupPanel}
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
