import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { CutThroughApp, type ResolvedTheme } from '@/app/CutThroughApp';
import type { PanelTab } from '@/features/settings/settings';
import type {
  SkipConfiguration,
  SkipEngineSnapshot,
} from '@/features/skip/skip-engine';
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
const requestedSkipFixture = harnessParams.get('skip');
const initialSkipFixtureId: SkipFixtureId =
  requestedSkipFixture && requestedSkipFixture in skipFixtures
    ? (requestedSkipFixture as SkipFixtureId)
    : 'off';
const copyShouldFail = harnessParams.get('copy') === 'error';
const openShouldFail = harnessParams.get('open') === 'error';

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
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <main className={`harness-page harness-page--${theme}`}>
      <aside aria-label="Harness controls" className="harness-controls">
        <div>
          <strong>CutThrough harness</strong>
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
            <option value="skip">Skip</option>
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
              onChange={(event) => setActiveIndex(Number(event.currentTarget.value))}
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
      </aside>

      <section className="harness-stage" aria-label="Simulated YouTube page">
        <div className="harness-video">
          <span>Simulated YouTube player</span>
          <div />
        </div>
        <aside className="harness-column" style={{ width }}>
          {neighborFirst ? <NeighborCard /> : null}
          <CutThroughApp
            ask={{
              transcript:
                transcriptState.kind === 'ready' ? transcriptState.document : null,
              selectedSegmentIds: askSelectedSegmentIds,
              currentTimeSeconds: activeSegment?.startSeconds ?? null,
              initialScope: scenario === 'selected' ? 'selection' : 'entire-video',
              initialQuestion: askInitialQuestion,
              onCopy: () =>
                copyShouldFail
                  ? Promise.reject(new Error('Fixture clipboard failure.'))
                  : Promise.resolve(),
              onOpenChatGPT: () =>
                openShouldFail
                  ? Promise.reject(new Error('Fixture tab failure.'))
                  : Promise.resolve(),
            }}
            initialCollapsed={collapsed}
            initialTab={panelTab}
            key={`${instance}-${scenario}-${panelTab}`}
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
              onOpenSelectionInChatGPT: () => undefined,
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
      </section>
    </main>
  );
}

const root = document.querySelector('#root');
if (!root) throw new Error('Harness root was not found.');

createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
