import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import type {
  ExtensionRequest,
  ExtensionResponse,
  RuntimeStatus,
} from '@/messaging/messages';

import './style.css';

const send = (request: ExtensionRequest): Promise<ExtensionResponse> =>
  browser.runtime.sendMessage(request);

function Popup() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [message, setMessage] = useState('Checking this tab…');

  useEffect(() => {
    void send({ type: 'runtime:get-status' }).then((response) => {
      if (response.ok && response.type === 'runtime:status') {
        setStatus(response.status);
        setMessage(
          response.status.supportedPage
            ? 'YouTube watch page detected'
            : 'Open a desktop YouTube video to use CutThrough',
        );
      } else if (!response.ok) {
        setMessage(response.message);
      }
    });
  }, []);

  const setEnabled = async (enabled: boolean) => {
    const response = await send({ type: 'runtime:set-enabled', enabled });
    if (response.ok && response.type === 'settings:updated') {
      setStatus((current) => (current ? { ...current, enabled } : current));
      setMessage(enabled ? 'CutThrough enabled' : 'CutThrough disabled');
    } else if (!response.ok) {
      setMessage(response.message);
    }
  };

  const invoke = async (request: ExtensionRequest) => {
    const response = await send(request);
    if (!response.ok) setMessage(response.message);
  };

  return (
    <main className="popup-shell">
      <header>
        <span aria-hidden="true" className="popup-logo">
          C
        </span>
        <div>
          <strong>CutThrough</strong>
          <span>v{status?.version ?? '0.1.0'}</span>
        </div>
      </header>

      <section aria-live="polite" className="popup-status">
        <span
          aria-hidden="true"
          className={status?.supportedPage ? 'is-ready' : undefined}
        />
        {message}
      </section>

      <label className="popup-toggle">
        <span>
          <strong>Extension enabled</strong>
          <small>Show CutThrough on supported videos</small>
        </span>
        <input
          checked={status?.enabled ?? true}
          disabled={!status}
          onChange={(event) => void setEnabled(event.currentTarget.checked)}
          type="checkbox"
        />
      </label>

      <div className="popup-actions">
        <button onClick={() => void invoke({ type: 'panel:restore' })} type="button">
          Restore panel
        </button>
        <button onClick={() => void invoke({ type: 'settings:open' })} type="button">
          Settings
        </button>
      </div>
    </main>
  );
}

const root = document.querySelector('#root');
if (!root) throw new Error('Popup root was not found.');

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
