import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import { PopupView, type PopupAction } from '@/entrypoints/popup/PopupView';
import type {
  ExtensionRequest,
  ExtensionResponse,
  RuntimeStatus,
} from '@/messaging/messages';

import './style.css';

const send = (request: ExtensionRequest): Promise<ExtensionResponse> =>
  browser.runtime.sendMessage(request);

const statusMessage = (status: RuntimeStatus): string => {
  if (!status.enabled) return 'Enable the extension to show its YouTube panel.';
  if (!status.supportedPage)
    return 'Open a desktop YouTube watch page to use CutThrough.';
  return status.panelMounted
    ? 'CutThrough is mounted on this video.'
    : 'Watch page detected. Restore the panel if it is hidden.';
};

function Popup() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [message, setMessage] = useState('Reading the active tab status…');
  const [hasError, setHasError] = useState(false);
  const [busyAction, setBusyAction] = useState<PopupAction>(null);

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
          setMessage('Could not read CutThrough status. Try again.');
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  const setEnabled = async (enabled: boolean) => {
    setBusyAction('toggle');
    try {
      const response = await send({ type: 'runtime:set-enabled', enabled });
      if (response.ok && response.type === 'settings:updated') {
        setStatus((current) => (current ? { ...current, enabled } : current));
        setMessage(
          enabled
            ? 'CutThrough enabled. Open a YouTube watch page to use it.'
            : 'CutThrough disabled. Existing playback remains unchanged.',
        );
      } else if (!response.ok) {
        setMessage(response.message);
      }
    } catch {
      setMessage('Could not update CutThrough. Try again.');
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
        setMessage(action === 'restore' ? 'Restore request sent.' : 'Settings opened.');
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
