import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  DEFAULT_SETTINGS,
  type CutThroughSettings,
  type PanelTab,
  type ThemePreference,
} from '@/features/settings/settings';
import { SettingsRepository } from '@/storage/settings-repository';

import './style.css';

const repository = new SettingsRepository();

function Options() {
  const [settings, setSettings] = useState<CutThroughSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('Loading settings…');

  useEffect(() => {
    void repository.load().then((loaded) => {
      setSettings(loaded);
      setStatus('Settings loaded');
    });
  }, []);

  const save = async (next: CutThroughSettings) => {
    setSettings(next);
    await repository.save(next);
    setStatus('Saved');
  };

  return (
    <main className="options-shell">
      <header>
        <span aria-hidden="true">C</span>
        <div>
          <h1>CutThrough settings</h1>
          <p>Configure the YouTube companion without storing transcript content.</p>
        </div>
      </header>

      <section aria-labelledby="appearance-title">
        <h2 id="appearance-title">Panel defaults</h2>
        <label>
          <span>
            Default tab
            <small>Shown when CutThrough mounts on a video.</small>
          </span>
          <select
            onChange={(event) =>
              void save({
                ...settings,
                defaultTab: event.currentTarget.value as PanelTab,
              })
            }
            value={settings.defaultTab}
          >
            <option value="transcript">Transcript</option>
            <option value="ask">Ask</option>
            <option value="skip">Skip</option>
          </select>
        </label>
        <label>
          <span>
            Theme
            <small>System follows the current appearance preference.</small>
          </span>
          <select
            onChange={(event) =>
              void save({
                ...settings,
                theme: event.currentTarget.value as ThemePreference,
              })
            }
            value={settings.theme}
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label>
          <span>
            Follow playback
            <small>
              Keep the active transcript row visible until you scroll manually.
            </small>
          </span>
          <input
            checked={settings.autoFollowTranscript}
            onChange={(event) =>
              void save({
                ...settings,
                autoFollowTranscript: event.currentTarget.checked,
              })
            }
            type="checkbox"
          />
        </label>
      </section>

      <section aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacy</h2>
        <p>
          Transcript and prompt content stays in memory by default. CutThrough has no
          analytics, account, or backend.
        </p>
      </section>

      <footer aria-live="polite">{status}</footer>
    </main>
  );
}

const root = document.querySelector('#root');
if (!root) throw new Error('Options root was not found.');

createRoot(root).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
