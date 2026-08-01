import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { podcastTranscript, readyTranscriptState } from '@/test/fixtures/transcripts';

import { WatchBetterApp } from './WatchBetterApp';

describe('WatchBetterApp foundation shell', () => {
  it('renders readiness and switches primary tabs', () => {
    render(
      <WatchBetterApp
        transcript={{ state: readyTranscriptState(), onCopy: vi.fn() }}
      />,
    );

    expect(screen.getByText('Watch Better')).toBeInTheDocument();
    expect(screen.queryByText('Transcript ready')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));

    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTitle('ChatGPT embedded chat')).toBeInTheDocument();

    expect(screen.queryByRole('tab', { name: 'Jump Cut' })).not.toBeInTheDocument();
  });

  it('supports arrow-key navigation between tabs', async () => {
    const user = userEvent.setup();
    render(<WatchBetterApp transcript={{ state: readyTranscriptState() }} />);

    const transcriptTab = screen.getByRole('tab', { name: 'Transcript' });
    transcriptTab.focus();
    await user.keyboard('{ArrowRight}');

    const askTab = screen.getByRole('tab', { name: 'Ask' });
    expect(askTab).toHaveAttribute('aria-selected', 'true');
    expect(askTab).toHaveFocus();
  });

  it('keeps tab targets mounted and preserves transcript state', () => {
    render(
      <WatchBetterApp
        transcript={{ state: readyTranscriptState(), onCopy: vi.fn() }}
      />,
    );

    for (const name of ['Transcript', 'Ask']) {
      const targetId = screen.getByRole('tab', { name }).getAttribute('aria-controls');
      expect(targetId).not.toBeNull();
      expect(document.getElementById(targetId ?? '')).toHaveAttribute(
        'role',
        'tabpanel',
      );
    }

    const search = screen.getByPlaceholderText('Search transcript');
    fireEvent.change(search, { target: { value: 'evidence' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse WatchBetter' }));
    fireEvent.click(screen.getByRole('button', { name: /Expand WatchBetter/ }));

    expect(screen.getByPlaceholderText('Search transcript')).toHaveValue('evidence');
  });

  it('keeps the AI frame mounted when the YouTube video changes', () => {
    const { rerender } = render(
      <WatchBetterApp
        activeTab="ask"
        transcript={{ state: readyTranscriptState(), onCopy: vi.fn() }}
      />,
    );
    const frame = screen.getByTitle('ChatGPT embedded chat');

    rerender(
      <WatchBetterApp
        activeTab="ask"
        transcript={{
          state: readyTranscriptState(podcastTranscript),
          onCopy: vi.fn(),
        }}
      />,
    );

    expect(screen.getByTitle('ChatGPT embedded chat')).toBe(frame);
  });

  it('supports controlled tab state and reports requested changes', () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <WatchBetterApp activeTab="ask" onTabChange={onTabChange} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(onTabChange).toHaveBeenCalledWith('transcript');
    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    rerender(<WatchBetterApp activeTab="skip" onTabChange={onTabChange} />);
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('tab', { name: 'Jump Cut' })).not.toBeInTheDocument();
  });

  it('ignores activation of the selected tab', () => {
    const onTabChange = vi.fn();
    render(<WatchBetterApp activeTab="ask" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('supports controlled collapse state and reports expansion', () => {
    const onCollapsedChange = vi.fn();
    const { rerender } = render(
      <WatchBetterApp collapsed onCollapsedChange={onCollapsedChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Expand WatchBetter/ }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    rerender(
      <WatchBetterApp collapsed={false} onCollapsedChange={onCollapsedChange} />,
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('collapses to and restores from the icon launcher', async () => {
    const user = userEvent.setup();
    render(<WatchBetterApp />);

    await user.click(screen.getByRole('button', { name: 'Collapse WatchBetter' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    const launcher = screen.getByRole('button', { name: /Expand WatchBetter/ });
    await waitFor(() => expect(launcher).toHaveFocus());

    await user.click(launcher);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveFocus(),
    );
  });

  it('routes settings through the provided callback', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(<WatchBetterApp onOpenSettings={onOpenSettings} />);

    await user.click(screen.getByRole('button', { name: 'Open WatchBetter settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
