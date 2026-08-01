import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@/features/settings/settings';
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
    expect(screen.queryByRole('heading', { name: 'Jump Cut' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'AI sessions and privacy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/stores no API keys, cookies, analytics/),
    ).toBeInTheDocument();
    expect(screen.getByText('Settings loaded')).toBeInTheDocument();
  });

  it('emits focused patches for panel and transcript changes', () => {
    const onChange = vi.fn();
    render(
      <OptionsView
        onChange={onChange}
        settings={DEFAULT_SETTINGS}
        status="Settings loaded"
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /^Default tab/ }), {
      target: { value: 'ask' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ defaultTab: 'ask' });

    fireEvent.click(screen.getByRole('checkbox', { name: /^Follow playback/ }));
    expect(onChange).toHaveBeenLastCalledWith({ autoFollowTranscript: false });
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

  it('opens official AI web sessions without collecting API keys', () => {
    const onOpenWebChat = vi.fn();
    render(
      <OptionsView
        onChange={() => undefined}
        onOpenWebChat={onOpenWebChat}
        settings={DEFAULT_SETTINGS}
        status="Settings loaded"
      />,
    );

    expect(screen.queryByLabelText(/API key/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open ChatGPT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Gemini' }));
    expect(onOpenWebChat).toHaveBeenNthCalledWith(1, 'chatgpt');
    expect(onOpenWebChat).toHaveBeenNthCalledWith(2, 'gemini');
  });
});
