import { BrandLogo } from '@/components/BrandLogo';
import { resolveInitialProductTab } from '@/config/product-features';
import type {
  WatchBetterSettings,
  PanelTab,
  ThemePreference,
  TranscriptCachePolicy,
  TranscriptFontSize,
} from '@/features/settings/settings';
import type { WebChatProviderId } from '@/services/web-chat';

import './OptionsView.css';

export type OptionsTheme = 'dark' | 'light';

export interface OptionsViewProps {
  readonly settings: WatchBetterSettings;
  readonly status: string;
  readonly theme?: OptionsTheme;
  readonly disabled?: boolean;
  readonly onChange: (changes: Partial<WatchBetterSettings>) => void;
  readonly onOpenWebChat?: (provider: WebChatProviderId) => void;
}

export function OptionsView({
  settings,
  status,
  theme = 'light',
  disabled = false,
  onChange,
  onOpenWebChat,
}: OptionsViewProps) {
  const update = (changes: Partial<WatchBetterSettings>) => {
    onChange(changes);
  };

  return (
    <main className="ct-options" data-theme={theme}>
      <header className="ct-options__header">
        <BrandLogo aria-hidden="true" className="ct-options__logo" />
        <div>
          <h1>WatchBetter settings</h1>
          <p>Configure the YouTube companion without storing transcript content.</p>
        </div>
      </header>

      <section aria-labelledby="general-title" className="ct-options-card">
        <h2 id="general-title">Panel defaults</h2>
        <label className="ct-options-row">
          <span>
            <strong>Extension enabled</strong>
            <small>Show WatchBetter on supported YouTube videos.</small>
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
            <small>Shown when WatchBetter mounts on a video.</small>
          </span>
          <select
            disabled={disabled}
            onChange={(event) =>
              update({ defaultTab: event.currentTarget.value as PanelTab })
            }
            value={resolveInitialProductTab(settings.defaultTab)}
          >
            <option value="transcript">Transcript</option>
            <option value="ask">Ask</option>
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

      <section aria-labelledby="handoff-title" className="ct-options-card">
        <h2 id="handoff-title">AI sessions and privacy</h2>
        <div className="ct-options-row">
          <span>
            <strong>ChatGPT, Gemini, and DeepSeek</strong>
            <small>
              Sign in on each official site. WatchBetter embeds the matching live page
              for grounded questions.
            </small>
          </span>
          <div className="ct-options-actions">
            <button
              className="ct-button"
              disabled={disabled || !onOpenWebChat}
              onClick={() => onOpenWebChat?.('chatgpt')}
              type="button"
            >
              Open ChatGPT
            </button>
            <button
              className="ct-button"
              disabled={disabled || !onOpenWebChat}
              onClick={() => onOpenWebChat?.('gemini')}
              type="button"
            >
              Open Gemini
            </button>
            <button
              className="ct-button"
              disabled={disabled || !onOpenWebChat}
              onClick={() => onOpenWebChat?.('deepseek')}
              type="button"
            >
              Open DeepSeek
            </button>
          </div>
        </div>
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
          WatchBetter stores no API keys, cookies, analytics, transcripts, or
          conversations permanently. Ask sends bounded transcript context only after an
          explicit action, through the signed-in ChatGPT, Gemini, or DeepSeek website.
          Each provider applies its own account, retention, and usage policies.
        </p>
      </section>

      <footer aria-live="polite" className="ct-options__status">
        {status}
      </footer>
    </main>
  );
}
