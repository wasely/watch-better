import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@/features/settings/settings';
import { configurationForSkipPreset } from '@/features/skip/skip-presets';

import { OptionsView } from './OptionsView';

describe('OptionsView', () => {
  it('renders every typed settings group and privacy boundary', () => {
    render(
      <OptionsView
        onChange={() => undefined}
        settings={DEFAULT_SETTINGS}
        status="Settings loaded"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Panel defaults' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transcript' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Pause compression' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Handoff and privacy' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No analytics, account, backend/)).toBeInTheDocument();
    expect(screen.getByText('Settings loaded')).toBeInTheDocument();
  });

  it('emits complete settings for panel and transcript changes', () => {
    const onChange = vi.fn();
    render(
      <OptionsView
        onChange={onChange}
        settings={DEFAULT_SETTINGS}
        status="Settings loaded"
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /^Default tab/ }), {
      target: { value: 'skip' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      defaultTab: 'skip',
    });

    fireEvent.click(screen.getByRole('checkbox', { name: /^Follow playback/ }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      autoFollowTranscript: false,
    });
  });

  it('applies complete pause presets and explicit handoff behavior', () => {
    const onChange = vi.fn();
    render(
      <OptionsView
        onChange={onChange}
        settings={DEFAULT_SETTINGS}
        status="Settings loaded"
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /^Default preset/ }), {
      target: { value: 'aggressive' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      pause: configurationForSkipPreset('aggressive', false),
    });

    fireEvent.change(screen.getByRole('combobox', { name: /^ChatGPT actions/ }), {
      target: { value: 'copy-only' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      chatgptHandoff: 'copy-only',
    });
  });

  it('disables controls while settings are loading', () => {
    render(
      <OptionsView
        disabled
        onChange={() => undefined}
        settings={DEFAULT_SETTINGS}
        status="Loading settings…"
      />,
    );

    expect(
      screen
        .getAllByRole('combobox')
        .every((control) => control.hasAttribute('disabled')),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('checkbox')
        .every((control) => control.hasAttribute('disabled')),
    ).toBe(true);
  });
});
