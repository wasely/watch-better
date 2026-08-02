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
  if (!status.enabled) return 'Enable the extension to show its YouTube panel.';
  if (!status.supportedPage)
    return 'Open a desktop YouTube watch page to use Watch Better.';
  return status.panelMounted
    ? 'Watch Better is mounted on this video.'
    : 'Watch page detected. Restore the panel if it is hidden.';
};

function Popup() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [message, setMessage] = useState('Reading the active tab status…');
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
              : 'Watch Better enabled.'
            : 'Watch Better disabled. Existing playback remains unchanged.',
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

  const invoke = async (
    action: Exclude<PopupAction, 'toggle' | null>,
    request: ExtensionRequest,
  ) => {
    setBusyAction(action);
    try {
      const response = await send(request);
      if (!response.ok) {
        setMessage(response.message);
      } else {
        if (action === 'restore') {
          setStatus((current) =>
            current ? { ...current, panelMounted: true } : current,
          );
          setMessage('Watch Better panel restored.');
        } else {
          setMessage('Settings opened.');
        }
      }
    } catch {
      setMessage(
        action === 'restore'
          ? 'Could not restore the panel. Reload the YouTube tab and try again.'
          : 'Could not open settings. Use the extension management page.',
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <PopupView
      busyAction={busyAction}
      error={hasError}
      message={message}
      onOpenSettings={() => void invoke('settings', { type: 'settings:open' })}
      onRestorePanel={() => void invoke('restore', { type: 'panel:restore' })}
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
