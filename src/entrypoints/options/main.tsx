import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import { OptionsView, type OptionsTheme } from '@/entrypoints/options/OptionsView';
import {
  DEFAULT_SETTINGS,
  type WatchBetterSettings,
} from '@/features/settings/settings';
import type { ExtensionRequest, ExtensionResponse } from '@/messaging/messages';
import {
  SETTINGS_STORAGE_KEY,
  SettingsRepository,
} from '@/storage/settings-repository';

import './style.css';

const repository = new SettingsRepository();

const send = (request: ExtensionRequest): Promise<ExtensionResponse> =>
  browser.runtime.sendMessage(request);

function Options() {
  const [settings, setSettings] = useState<WatchBetterSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('Loading settings…');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [systemTheme, setSystemTheme] = useState<OptionsTheme>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    let disposed = false;

    const syncSettings = (nextStatus?: string) => {
      void repository
        .load()
        .then((loadedSettings) => {
          if (disposed) return;
          setSettings(loadedSettings);
          setLoaded(true);
          if (nextStatus) setStatus(nextStatus);
        })
        .catch(() => {
          if (disposed) return;
          setLoaded(true);
          if (nextStatus)
            setStatus('Could not load settings. Safe defaults are shown.');
        });
    };
    const handleStorageChange = (
      changes: Record<string, { readonly newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName === 'local' && SETTINGS_STORAGE_KEY in changes) syncSettings();
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    syncSettings('Settings loaded');

    return () => {
      disposed = true;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => setSystemTheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', updateTheme);
    return () => query.removeEventListener('change', updateTheme);
  }, []);

  const save = async (changes: Partial<WatchBetterSettings>) => {
    setSettings((current) => ({ ...current, ...changes }));
    setSaving(true);
    setStatus('Saving…');
    try {
      const response = await send({ type: 'settings:update', changes });
      if (!response.ok) throw new Error(response.message);
      if (response.type !== 'settings:updated') {
        throw new Error('Unexpected settings response.');
      }
      setSettings(response.settings);
      setStatus('Saved');
    } catch {
      setStatus('Could not save settings. Try again.');
      try {
        setSettings(await repository.load());
      } catch {
        // Keep the last visible values when storage remains unavailable.
      }
    } finally {
      setSaving(false);
    }
  };

  const manageExtension = async () => {
    setStatus('Opening extension management…');
    try {
      const response = await send({ type: 'settings:manage' });
      if (!response.ok) throw new Error(response.message);
      setStatus('Extension management opened');
    } catch {
      setStatus('Could not open extension management.');
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
      disabled={!loaded || saving}
      onChange={(next) => void save(next)}
      onManageExtension={() => void manageExtension()}
      onOpenWebChat={(provider) => void send({ type: 'webchat:open', provider })}
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
