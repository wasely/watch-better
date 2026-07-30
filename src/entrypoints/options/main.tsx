import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { OptionsView, type OptionsTheme } from '@/entrypoints/options/OptionsView';
import {
  DEFAULT_SETTINGS,
  type CutThroughSettings,
} from '@/features/settings/settings';
import { SettingsRepository } from '@/storage/settings-repository';

import './style.css';

const repository = new SettingsRepository();

function Options() {
  const [settings, setSettings] = useState<CutThroughSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('Loading settings…');
  const [loaded, setLoaded] = useState(false);
  const [systemTheme, setSystemTheme] = useState<OptionsTheme>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    let disposed = false;

    void repository
      .load()
      .then((loadedSettings) => {
        if (disposed) return;
        setSettings(loadedSettings);
        setLoaded(true);
        setStatus('Settings loaded');
      })
      .catch(() => {
        if (disposed) return;
        setLoaded(true);
        setStatus('Could not load settings. Safe defaults are shown.');
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => setSystemTheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', updateTheme);
    return () => query.removeEventListener('change', updateTheme);
  }, []);

  const save = async (next: CutThroughSettings) => {
    setSettings(next);
    setStatus('Saving…');
    try {
      await repository.save(next);
      setStatus('Saved');
    } catch {
      setStatus('Could not save settings. Try again.');
    }
  };

  const resolvedTheme: OptionsTheme =
    settings.theme === 'system' ? systemTheme : settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [resolvedTheme]);

  return (
    <OptionsView
      disabled={!loaded}
      onChange={(next) => void save(next)}
      settings={settings}
      status={status}
      theme={resolvedTheme}
    />
  );
}

const root = document.querySelector('#root');
if (!root) throw new Error('Options root was not found.');

createRoot(root).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
