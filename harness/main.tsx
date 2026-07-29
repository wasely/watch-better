import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  CutThroughApp,
  type PanelReadiness,
  type ResolvedTheme,
} from '@/app/CutThroughApp';

import './style.css';

const widths = [320, 402, 480] as const;
type HarnessWidth = (typeof widths)[number];

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

function Harness() {
  const [theme, setTheme] = useState<ResolvedTheme>('dark');
  const [width, setWidth] = useState<HarnessWidth>(402);
  const [readiness, setReadiness] = useState<PanelReadiness>('loading');
  const [collapsed, setCollapsed] = useState(false);
  const [neighborFirst, setNeighborFirst] = useState(false);
  const [instance, setInstance] = useState(0);

  const remount = (nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed);
    setInstance((value) => value + 1);
  };

  return (
    <main className={`harness-page harness-page--${theme}`}>
      <aside aria-label="Harness controls" className="harness-controls">
        <div>
          <strong>CutThrough harness</strong>
          <span>Foundation shell</span>
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
          Transcript state
          <select
            onChange={(event) =>
              setReadiness(event.currentTarget.value as PanelReadiness)
            }
            value={readiness}
          >
            <option value="loading">Loading</option>
            <option value="ready">Ready</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>

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
            initialCollapsed={collapsed}
            key={instance}
            readiness={readiness}
            theme={theme}
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
