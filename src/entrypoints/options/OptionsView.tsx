import { useState } from 'react';

import { Icon } from '@/components/Icon';
import type {
  ChatGPTHandoffBehavior,
  CutThroughSettings,
  PanelTab,
  ThemePreference,
  TranscriptCachePolicy,
  TranscriptFontSize,
} from '@/features/settings/settings';
import type { SkipPresetId } from '@/features/skip/skip-engine';
import { configurationForSkipPreset } from '@/features/skip/skip-presets';

import './OptionsView.css';

export type OptionsTheme = 'dark' | 'light';

export interface OptionsViewProps {
  readonly settings: CutThroughSettings;
  readonly status: string;
  readonly theme?: OptionsTheme;
  readonly disabled?: boolean;
  readonly onChange: (changes: Partial<CutThroughSettings>) => void;
  readonly chatConfigured?: boolean;
  readonly chatModel?: string;
  readonly onConfigureChatGPT?: (apiKey: string) => void;
}

export function OptionsView({
  settings,
  status,
  theme = 'light',
  disabled = false,
  onChange,
  chatConfigured = false,
  chatModel = 'gpt-5.6',
  onConfigureChatGPT,
}: OptionsViewProps) {
  const [apiKey, setApiKey] = useState('');
  const update = (changes: Partial<CutThroughSettings>) => {
    onChange(changes);
  };

  return (
    <main className="ct-options" data-theme={theme}>
      <header className="ct-options__header">
        <span aria-hidden="true">
          <Icon name="spark" />
        </span>
        <div>
          <h1>CutThrough settings</h1>
          <p>Configure the YouTube companion without storing transcript content.</p>
        </div>
      </header>

      <section aria-labelledby="general-title" className="ct-options-card">
        <h2 id="general-title">Panel defaults</h2>
        <label className="ct-options-row">
          <span>
            <strong>Extension enabled</strong>
            <small>Show CutThrough on supported YouTube videos.</small>
          </span>
          <input
            checked={settings.extensionEnabled}
            disabled={disabled}
            onChange={(event) =>
              update({ extensionEnabled: event.currentTarget.checked })
            }
            type="checkbox"
          />
        </label>
        <label className="ct-options-row">
          <span>
            <strong>Default tab</strong>
            <small>Shown when CutThrough mounts on a video.</small>
          </span>
          <select
            disabled={disabled}
            onChange={(event) =>
              update({ defaultTab: event.currentTarget.value as PanelTab })
            }
            value={settings.defaultTab}
          >
            <option value="transcript">Transcript</option>
            <option value="ask">Ask</option>
            <option value="skip">Jump Cut</option>
          </select>
        </label>
        <label className="ct-options-row">
          <span>
            <strong>Theme</strong>
            <small>System follows the browser appearance.</small>
          </span>
          <select
            disabled={disabled}
            onChange={(event) =>
              update({ theme: event.currentTarget.value as ThemePreference })
            }
            value={settings.theme}
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="ct-options-row">
          <span>
            <strong>Start collapsed</strong>
            <small>Mount as the compact launcher until expanded.</small>
          </span>
          <input
            checked={settings.panelCollapsed}
            disabled={disabled}
            onChange={(event) =>
              update({ panelCollapsed: event.currentTarget.checked })
            }
            type="checkbox"
          />
        </label>
      </section>

      <section aria-labelledby="transcript-title" className="ct-options-card">
        <h2 id="transcript-title">Transcript</h2>
        <label className="ct-options-row">
          <span>
            <strong>Load captions automatically</strong>
            <small>Uses available YouTube caption tracks only.</small>
          </span>
          <input
            checked={settings.autoLoadTranscript}
            disabled={disabled}
            onChange={(event) =>
              update({ autoLoadTranscript: event.currentTarget.checked })
            }
            type="checkbox"
          />
        </label>
        <label className="ct-options-row">
          <span>
            <strong>Follow playback</strong>
            <small>Stops automatically after manual transcript scrolling.</small>
          </span>
          <input
            checked={settings.autoFollowTranscript}
            disabled={disabled}
            onChange={(event) =>
              update({ autoFollowTranscript: event.currentTarget.checked })
            }
            type="checkbox"
          />
        </label>
        <label className="ct-options-row">
          <span>
            <strong>Transcript text size</strong>
            <small>Applies inside the isolated panel only.</small>
          </span>
          <select
            disabled={disabled}
            onChange={(event) =>
              update({
                transcriptFontSize: event.currentTarget.value as TranscriptFontSize,
              })
            }
            value={settings.transcriptFontSize}
          >
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="large">Large</option>
          </select>
        </label>
      </section>

      <section aria-labelledby="pause-title" className="ct-options-card">
        <h2 id="pause-title">Jump cutter</h2>
        <label className="ct-options-row">
          <span>
            <strong>Enable experimental controls</strong>
            <small>Off by default; compresses padded transcript gaps.</small>
          </span>
          <input
            checked={settings.pause.enabled}
            disabled={disabled}
            onChange={(event) =>
              update({
                pause: { ...settings.pause, enabled: event.currentTarget.checked },
              })
            }
            type="checkbox"
          />
        </label>
        <label className="ct-options-row">
          <span>
            <strong>Default preset</strong>
            <small>Advanced values remain editable in the panel.</small>
          </span>
          <select
            disabled={disabled}
            onChange={(event) =>
              update({
                pause: configurationForSkipPreset(
                  event.currentTarget.value as SkipPresetId,
                  settings.pause.enabled,
                ),
              })
            }
            value={settings.pause.preset}
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
      </section>

      <section aria-labelledby="handoff-title" className="ct-options-card">
        <h2 id="handoff-title">Handoff and privacy</h2>
        <div className="ct-options-row ct-options-row--credential">
          <span>
            <strong>Embedded ChatGPT</strong>
            <small>
              {chatConfigured
                ? `Connected with ${chatModel}. Enter a new key to replace it.`
                : 'Add your OpenAI API key to chat with the video inside CutThrough.'}
            </small>
          </span>
          <div className="ct-options-credential">
            <input
              aria-label="OpenAI API key"
              autoComplete="off"
              disabled={disabled || !onConfigureChatGPT}
              onChange={(event) => setApiKey(event.currentTarget.value)}
              placeholder={chatConfigured ? 'API key saved' : 'sk-…'}
              type="password"
              value={apiKey}
            />
            <button
              className="ct-button"
              disabled={disabled || !onConfigureChatGPT || !apiKey.trim()}
              onClick={() => {
                onConfigureChatGPT?.(apiKey);
                setApiKey('');
              }}
              type="button"
            >
              {chatConfigured ? 'Replace key' : 'Save key'}
            </button>
            {chatConfigured ? (
              <button
                className="ct-button"
                disabled={disabled || !onConfigureChatGPT}
                onClick={() => onConfigureChatGPT?.('')}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <label className="ct-options-row">
          <span>
            <strong>ChatGPT actions</strong>
            <small>Both actions remain separate and explicit.</small>
          </span>
          <select
            disabled={disabled}
            onChange={(event) =>
              update({
                chatgptHandoff: event.currentTarget.value as ChatGPTHandoffBehavior,
              })
            }
            value={settings.chatgptHandoff}
          >
            <option value="copy-only">Copy only</option>
            <option value="open-only">Open only</option>
            <option value="copy-and-open">Copy and open</option>
          </select>
        </label>
        <label className="ct-options-row">
          <span>
            <strong>Transcript cache</strong>
            <small>Memory-only is cleared when the panel unloads.</small>
          </span>
          <select
            disabled={disabled}
            onChange={(event) =>
              update({
                transcriptCachePolicy: event.currentTarget
                  .value as TranscriptCachePolicy,
              })
            }
            value={settings.transcriptCachePolicy}
          >
            <option value="memory-only">Memory only</option>
            <option value="session">Browser session</option>
          </select>
        </label>
        <p className="ct-options-privacy">
          CutThrough stores no analytics, transcripts, or conversations permanently.
          Chat sends bounded transcript context to OpenAI only after an explicit Ask or
          Send action, subject to your OpenAI API data controls. The API key stays in
          local extension storage and is never returned to the page. OpenAI retains
          Responses API state for at least 30 days by default; API usage can incur
          charges.
        </p>
      </section>

      <footer aria-live="polite" className="ct-options__status">
        {status}
      </footer>
    </main>
  );
}
