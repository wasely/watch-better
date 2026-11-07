import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import {
  PopupView,
  type PopupAction,
  type PopupTheme,
} from '@/entrypoints/popup/PopupView';
import { DEFAULT_SETTINGS, type ThemePreference } from '@/features/settings/settings';
import type {
  ExtensionRequest,
  ExtensionResponse,
  RuntimeStatus,
} from '@/messaging/messages';

import { SettingsRepository } from '@/storage/settings-repository';

import './style.css';

const settingsRepository = new SettingsRepository();

const send = (request: ExtensionRequest): Promise<ExtensionResponse> =>
  browser.runtime.sendMessage(request);

const statusMessage = (status: RuntimeStatus): string => {
  if (!status.enabled) return 'Turn it on to use Watch Better on videos.';
  if (!status.supportedPage) return 'Open a YouTube video to use Watch Better.';
  return status.panelMounted
    ? 'Ready on this video.'
    : 'Reload this video to show Watch Better.';
};

function Popup() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [message, setMessage] = useState('Checking this tab…');
  const [hasError, setHasError] = useState(false);
  const [busyAction, setBusyAction] = useState<PopupAction>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    DEFAULT_SETTINGS.theme,
  );
  const [systemTheme, setSystemTheme] = useState<PopupTheme>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    let disposed = false;

    void send({ type: 'runtime:get-status' })
      .then((response) => {
        if (disposed) return;
        if (response.ok && response.type === 'runtime:status') {
          setStatus(response.status);
          setHasError(false);
          setMessage(statusMessage(response.status));
        } else if (!response.ok) {
          setHasError(true);
          setMessage(response.message);
        }
      })
      .catch(() => {
        if (!disposed) {
          setHasError(true);
          setMessage('Could not read Watch Better status. Try again.');
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const query = matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemTheme(query.matches ? 'dark' : 'light');

    query.addEventListener('change', updateSystemTheme);
    void settingsRepository
      .load()
      .then((settings) => {
        if (!disposed) setThemePreference(settings.theme);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      query.removeEventListener('change', updateSystemTheme);
    };
  }, []);

  const resolvedTheme: PopupTheme =
    themePreference === 'system' ? systemTheme : themePreference;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [resolvedTheme]);

  const setEnabled = async (enabled: boolean) => {
    setBusyAction('toggle');
    try {
      const response = await send({ type: 'runtime:set-enabled', enabled });
      if (response.ok && response.type === 'settings:updated') {
        const updatedStatus = status ? { ...status, enabled } : null;
        setStatus(updatedStatus);
        setMessage(
          enabled
            ? updatedStatus
              ? statusMessage(updatedStatus)
              : 'Watch Better is on.'
            : 'Watch Better is off.',
        );
      } else if (!response.ok) {
        setMessage(response.message);
      }
    } catch {
      setMessage('Could not update Watch Better. Try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const openSettings = async () => {
    setBusyAction('settings');
    try {
      const response = await send({ type: 'settings:open' });
      if (!response.ok) {
        setMessage(response.message);
      }
    } catch {
      setMessage('Could not open settings. Use the extension management page.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <PopupView
      busyAction={busyAction}
      error={hasError}
      message={message}
      onOpenSettings={() => void openSettings()}
      onSetEnabled={(enabled) => void setEnabled(enabled)}
      status={status}
      theme={resolvedTheme}
    />
  );
}

const root = document.querySelector('#root');
if (!root) throw new Error('Popup root was not found.');

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
