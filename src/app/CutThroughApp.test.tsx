import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readyTranscriptState } from '@/test/fixtures/transcripts';

import { CutThroughApp } from './CutThroughApp';

describe('CutThroughApp foundation shell', () => {
  it('renders readiness and switches primary tabs', async () => {
    const user = userEvent.setup();
    render(
      <CutThroughApp transcript={{ state: readyTranscriptState(), onCopy: vi.fn() }} />,
    );

    expect(screen.getByText('Transcript ready')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('tab', { name: 'Ask' }));

    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Suggested actions')).toBeInTheDocument();
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

  it('collapses to and restores from the icon launcher', async () => {
    const user = userEvent.setup();
    render(<CutThroughApp />);

    await user.click(screen.getByRole('button', { name: 'Collapse CutThrough' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand CutThrough' }));
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('routes settings through the provided callback', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(<CutThroughApp onOpenSettings={onOpenSettings} />);

    await user.click(screen.getByRole('button', { name: 'Open CutThrough settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
