import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SkipEngineSnapshot } from '@/features/skip/skip-engine';
import { configurationForSkipPreset } from '@/features/skip/skip-presets';

import { SkipPanel } from './SkipPanel';

const disabledSnapshot: SkipEngineSnapshot = {
  state: 'disabled',
  timeSavedSeconds: 0,
  message: null,
};

describe('SkipPanel', () => {
  it('renders the safe off-by-default state without implying engine activity', () => {
    render(
      <SkipPanel
        configuration={configurationForSkipPreset('conservative', false)}
        snapshot={disabledSnapshot}
      />,
    );

    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText('Playback is unchanged.')).toBeInTheDocument();
    expect(screen.getByText('0s')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Conservative/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText('Timing is approximate')).not.toBeInTheDocument();
  });

  it('requires an explicit switch action and reverses immediately', async () => {
    const user = userEvent.setup();
    const onConfigurationChange = vi.fn();
    const off = configurationForSkipPreset('conservative', false);
    const { rerender } = render(
      <SkipPanel
        configuration={off}
        onConfigurationChange={onConfigurationChange}
        snapshot={disabledSnapshot}
      />,
    );

    await user.click(screen.getByRole('switch', { name: 'Enable pause compression' }));
    expect(onConfigurationChange).toHaveBeenLastCalledWith({ ...off, enabled: true });

    const on = { ...off, enabled: true };
    rerender(
      <SkipPanel
        configuration={on}
        onConfigurationChange={onConfigurationChange}
        snapshot={{ ...disabledSnapshot, state: 'ready' }}
      />,
    );
    await user.click(screen.getByRole('switch', { name: 'Disable pause compression' }));
    expect(onConfigurationChange).toHaveBeenLastCalledWith({ ...on, enabled: false });
  });

  it('applies a complete preset while preserving enablement', async () => {
    const user = userEvent.setup();
    const onConfigurationChange = vi.fn();
    render(
      <SkipPanel
        configuration={configurationForSkipPreset('conservative', true)}
        onConfigurationChange={onConfigurationChange}
        snapshot={{ ...disabledSnapshot, state: 'ready' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Balanced/ }));
    expect(onConfigurationChange).toHaveBeenCalledWith(
      configurationForSkipPreset('balanced', true),
    );
  });

  it('exposes advanced timing, rate, and jump controls', async () => {
    const user = userEvent.setup();
    const onConfigurationChange = vi.fn();
    const configuration = configurationForSkipPreset('balanced', true);
    render(
      <SkipPanel
        configuration={configuration}
        initialAdvancedOpen
        onConfigurationChange={onConfigurationChange}
        snapshot={{ ...disabledSnapshot, state: 'ready' }}
      />,
    );

    fireEvent.change(screen.getByRole('slider', { name: /^Minimum gap/ }), {
      target: { value: '2.2' },
    });
    expect(onConfigurationChange).toHaveBeenLastCalledWith({
      ...configuration,
      minimumGapSeconds: 2.2,
    });

    await user.click(screen.getByRole('checkbox', { name: /Jump long gaps/ }));
    expect(onConfigurationChange).toHaveBeenLastCalledWith({
      ...configuration,
      jumpLongGaps: true,
    });
    expect(screen.getByRole('slider', { name: /^Speech speed/ })).toBeEnabled();
    expect(screen.getByRole('slider', { name: /^Gap speed/ })).toBeEnabled();
  });

  it('resets through an explicit action', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <SkipPanel
        configuration={configurationForSkipPreset('aggressive', true)}
        onReset={onReset}
        snapshot={{ ...disabledSnapshot, state: 'ready' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Reset controls' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('shows active status, approximate savings, and safety disclosure', () => {
    render(
      <SkipPanel
        configuration={configurationForSkipPreset('balanced', true)}
        onConfigurationChange={() => undefined}
        snapshot={{
          state: 'active',
          timeSavedSeconds: 73,
          message: 'Compressing a reliable caption gap at 3×.',
        }}
      />,
    );

    expect(screen.getByText('Compressing')).toBeInTheDocument();
    expect(screen.getByText('1m 13s')).toBeInTheDocument();
    expect(screen.getByText('Timing is approximate')).toBeInTheDocument();
    expect(screen.getByText(/Turn this off immediately/)).toBeInTheDocument();
  });

  it('raises a stronger warning for aggressive controls', () => {
    render(
      <SkipPanel
        configuration={configurationForSkipPreset('aggressive', true)}
        onConfigurationChange={() => undefined}
        snapshot={{ ...disabledSnapshot, state: 'ready' }}
      />,
    );

    expect(
      screen.getByText('Aggressive controls can remove context'),
    ).toBeInTheDocument();
  });

  it('raises the stronger warning for custom elevated-risk controls', () => {
    render(
      <SkipPanel
        configuration={{
          ...configurationForSkipPreset('balanced', true),
          gapPlaybackRate: 16,
        }}
        onConfigurationChange={() => undefined}
        snapshot={{ ...disabledSnapshot, state: 'ready' }}
      />,
    );

    expect(
      screen.getByText('Aggressive controls can remove context'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Balanced/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('renders malformed savings as zero rather than invalid text', () => {
    render(
      <SkipPanel
        configuration={configurationForSkipPreset('conservative', false)}
        snapshot={{ ...disabledSnapshot, timeSavedSeconds: Number.NaN }}
      />,
    );

    expect(screen.getByText('0s')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('lets an enabled error state turn off after playback restoration', async () => {
    const user = userEvent.setup();
    const configuration = configurationForSkipPreset('balanced', true);
    const onConfigurationChange = vi.fn();
    render(
      <SkipPanel
        configuration={configuration}
        onConfigurationChange={onConfigurationChange}
        snapshot={{
          state: 'error',
          timeSavedSeconds: 20,
          message: 'Invalid timing stopped detection safely.',
        }}
      />,
    );

    expect(screen.getByText('Playback restored')).toBeInTheDocument();
    const disable = screen.getByRole('switch', {
      name: 'Disable pause compression',
    });
    expect(disable).toBeEnabled();
    await user.click(disable);
    expect(onConfigurationChange).toHaveBeenCalledWith({
      ...configuration,
      enabled: false,
    });
  });

  it('keeps unsupported states disabled and honest', () => {
    render(
      <SkipPanel
        configuration={configurationForSkipPreset('conservative', false)}
        onConfigurationChange={() => undefined}
        snapshot={{
          state: 'unsupported',
          timeSavedSeconds: 0,
          message: 'Live and ad states are never modified.',
        }}
      />,
    );

    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Live and ad states are never modified.')).toBeVisible();
  });
});
