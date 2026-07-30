import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readyTranscriptState } from '@/test/fixtures/transcripts';

import { CutThroughApp } from './CutThroughApp';

describe('CutThroughApp foundation shell', () => {
  it('renders readiness and switches primary tabs', () => {
    render(
      <CutThroughApp transcript={{ state: readyTranscriptState(), onCopy: vi.fn() }} />,
    );

    expect(screen.getByText('Transcript ready')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));

    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Embedded ChatGPT')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Jump Cut' }));
    expect(screen.getByRole('tab', { name: 'Jump Cut' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Jump cutter')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('supports arrow-key navigation between tabs', async () => {
    const user = userEvent.setup();
    render(<CutThroughApp transcript={{ state: readyTranscriptState() }} />);

    const transcriptTab = screen.getByRole('tab', { name: 'Transcript' });
    transcriptTab.focus();
    await user.keyboard('{ArrowRight}');

    const askTab = screen.getByRole('tab', { name: 'Ask' });
    expect(askTab).toHaveAttribute('aria-selected', 'true');
    expect(askTab).toHaveFocus();
  });

  it('keeps tab targets mounted and preserves transcript state', () => {
    render(
      <CutThroughApp transcript={{ state: readyTranscriptState(), onCopy: vi.fn() }} />,
    );

    for (const name of ['Transcript', 'Ask', 'Jump Cut']) {
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
    fireEvent.click(screen.getByRole('button', { name: 'Collapse CutThrough' }));
    fireEvent.click(screen.getByRole('button', { name: /Expand CutThrough/ }));

    expect(screen.getByPlaceholderText('Search transcript')).toHaveValue('evidence');
  });

  it('supports controlled tab state and reports requested changes', () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <CutThroughApp activeTab="ask" onTabChange={onTabChange} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Jump Cut' }));
    expect(onTabChange).toHaveBeenCalledWith('skip');
    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    rerender(<CutThroughApp activeTab="skip" onTabChange={onTabChange} />);
    expect(screen.getByRole('tab', { name: 'Jump Cut' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('supports controlled collapse state and reports expansion', () => {
    const onCollapsedChange = vi.fn();
    const { rerender } = render(
      <CutThroughApp collapsed onCollapsedChange={onCollapsedChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Expand CutThrough/ }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    rerender(<CutThroughApp collapsed={false} onCollapsedChange={onCollapsedChange} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('collapses to and restores from the icon launcher', async () => {
    const user = userEvent.setup();
    render(<CutThroughApp />);

    await user.click(screen.getByRole('button', { name: 'Collapse CutThrough' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    const launcher = screen.getByRole('button', { name: /Expand CutThrough/ });
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
    render(<CutThroughApp onOpenSettings={onOpenSettings} />);

    await user.click(screen.getByRole('button', { name: 'Open CutThrough settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
