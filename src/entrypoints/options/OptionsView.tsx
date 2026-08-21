import { BrandLogo } from '@/components/BrandLogo';
import { Icon } from '@/components/Icon';
import { resolveInitialProductTab } from '@/config/product-features';
import type {
  WatchBetterSettings,
  PanelTab,
  ThemePreference,
  TranscriptCachePolicy,
  TranscriptFontSize,
} from '@/features/settings/settings';
import {
  SMART_SKIP_CATEGORIES,
  SMART_SKIP_CATEGORY_LABELS,
  type SmartSkipStrictness,
} from '@/features/smart-skip/domain';
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
  readonly onManageExtension?: () => void;
}

export function OptionsView({
  settings,
  status,
  theme = 'light',
  disabled = false,
  onChange,
  onOpenWebChat,
  onManageExtension,
}: OptionsViewProps) {
  const update = (changes: Partial<WatchBetterSettings>) => {
    onChange(changes);
  };

  return (
    <main className="ct-options" data-theme={theme}>
      <header className="ct-options__header">
        <div className="ct-options__identity">
          <BrandLogo aria-hidden="true" className="ct-options__logo" />
          <div>
            <span className="ct-options__eyebrow">Extension settings</span>
            <h1>Watch Better</h1>
            <p>Configure your YouTube companion and signed-in AI sessions.</p>
          </div>
        </div>
        <button
          className="ct-button ct-button--manage"
          disabled={disabled || !onManageExtension}
          onClick={onManageExtension}
          type="button"
        >
          Manage extension
          <Icon name="external" />
        </button>
      </header>

      <section aria-labelledby="general-title" className="ct-options-card">
        <div className="ct-options-card__heading">
          <h2 id="general-title">Panel defaults</h2>
          <p>Choose how Watch Better appears when a supported video opens.</p>
        </div>
        <label className="ct-options-row">
          <span>
            <strong>Extension enabled</strong>
            <small>Show Watch Better on supported YouTube videos.</small>
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
            <small>Shown when Watch Better mounts on a video.</small>
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
            <option value="smart-skip">Smart Skip</option>
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
        <div className="ct-options-card__heading">
          <h2 id="transcript-title">Transcript</h2>
          <p>Control caption loading, following, and reading density.</p>
        </div>
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

      <section aria-labelledby="smart-skip-title" className="ct-options-card">
        <div className="ct-options-card__heading">
          <h2 id="smart-skip-title">Smart Skip</h2>
          <p>Choose how aggressively the instant local cut map skips.</p>
        </div>
        <label className="ct-options-row">
          <span>
            <strong>Strictness</strong>
            <small>Balanced keeps uncertain discussion intact.</small>
          </span>
          <select
            disabled={disabled}
            onChange={(event) =>
              update({
                smartSkip: {
                  ...settings.smartSkip,
                  strictness: event.currentTarget.value as SmartSkipStrictness,
                },
              })
            }
            value={settings.smartSkip.strictness}
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
        <label className="ct-options-row">
          <span>
            <strong>Start skipping immediately</strong>
            <small>Skips the opening while captions are still loading.</small>
          </span>
          <input
            checked={settings.smartSkip.autoSkip}
            disabled={disabled}
            onChange={(event) =>
              update({
                smartSkip: {
                  ...settings.smartSkip,
                  autoSkip: event.currentTarget.checked,
                },
              })
            }
            type="checkbox"
          />
        </label>
        <fieldset className="ct-options-smart-skip-categories" disabled={disabled}>
          <legend>Categories</legend>
          {SMART_SKIP_CATEGORIES.map((category) => (
            <label key={category}>
              <input
                checked={settings.smartSkip.categories.includes(category)}
                disabled={disabled}
                onChange={(event) => {
                  const categories = event.currentTarget.checked
                    ? [...settings.smartSkip.categories, category]
                    : settings.smartSkip.categories.filter(
                        (candidate) => candidate !== category,
                      );
                  if (categories.length === 0) return;
                  update({
                    smartSkip: {
                      ...settings.smartSkip,
                      categories,
                    },
                  });
                }}
                type="checkbox"
              />
              {SMART_SKIP_CATEGORY_LABELS[category]}
            </label>
          ))}
        </fieldset>
      </section>

      <section aria-labelledby="handoff-title" className="ct-options-card">
        <div className="ct-options-card__heading">
          <h2 id="handoff-title">AI sessions and privacy</h2>
          <p>Connect only through the official sites you already use.</p>
        </div>
        <div className="ct-options-row">
          <span>
            <strong>ChatGPT and Gemini</strong>
            <small>
              Both providers appear inside the panel and use your existing signed-in
              browser sessions.
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
          Watch Better stores no API keys, cookies, analytics, transcripts, or
          conversations permanently. Ask automatically submits bounded context with a
          READY-only instruction, then leaves questions to you. Smart Skip starts
          locally. When enabled and captions load, it automatically sends bounded
          caption chunks for a separate deep analysis. Results last for the browser
          session. Each provider applies its own draft, account, retention, and usage
          policies.
        </p>
      </section>

      <footer aria-live="polite" className="ct-options__status">
        {status}
      </footer>
    </main>
  );
}
