import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChatGPTHandoffProvider } from '@/features/ask/chatgpt-handoff-provider';
import { podcastTranscript, tutorialTranscript } from '@/test/fixtures/transcripts';

import { AskPanel } from './AskPanel';

describe('AskPanel', () => {
  it('shows an honest unavailable state without transcript context', () => {
    render(<AskPanel transcript={null} />);

    expect(screen.getByText('Transcript context is required')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open ChatGPT' }),
    ).not.toBeInTheDocument();
  });

  it('starts empty and does not copy or open anything automatically', () => {
    const onCopy = vi.fn();
    const onOpenChatGPT = vi.fn();
    render(
      <AskPanel
        onCopy={onCopy}
        onOpenChatGPT={onOpenChatGPT}
        transcript={tutorialTranscript}
      />,
    );

    expect(screen.getByText(/Opening never transfers content/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open ChatGPT' })).toBeDisabled();
    expect(onCopy).not.toHaveBeenCalled();
    expect(onOpenChatGPT).not.toHaveBeenCalled();
  });

  it('applies suggested actions and their intended context', async () => {
    const user = userEvent.setup();
    render(<AskPanel currentTimeSeconds={144} transcript={tutorialTranscript} />);

    await user.click(screen.getByRole('button', { name: 'Explain this section' }));

    const question = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Question or task',
    });
    expect(question.value).toContain('Explain this section');
    expect(screen.getByRole('button', { name: 'Current section' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/around 2:24/)).toBeInTheDocument();
  });

  it('applies suggested actions from the compact picker', async () => {
    const user = userEvent.setup();
    render(<AskPanel transcript={tutorialTranscript} />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Suggested task' }),
      'action-items',
    );

    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Question or task',
      }).value,
    ).toContain('Extract concrete action items');
  });

  it('supports explicit selected transcript context', async () => {
    const user = userEvent.setup();
    const selected = new Set([
      tutorialTranscript.segments[2]?.id ?? '',
      tutorialTranscript.segments[3]?.id ?? '',
    ]);
    render(
      <AskPanel
        initialQuestion="Explain this evidence."
        selectedSegmentIds={selected}
        transcript={tutorialTranscript}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Selected (2)' }));

    expect(screen.getByText('Selection · 2 rows')).toBeInTheDocument();
    expect(screen.getByText(/2 included/)).toBeInTheDocument();
  });

  it('copies and opens only through separate explicit actions', async () => {
    const user = userEvent.setup();
    const copiedValues: string[] = [];
    const onCopy = vi.fn((text: string) => {
      copiedValues.push(text);
      return Promise.resolve();
    });
    const onOpenChatGPT = vi.fn(() => Promise.resolve());
    render(
      <AskPanel
        initialQuestion="List the key ideas."
        onCopy={onCopy}
        onOpenChatGPT={onOpenChatGPT}
        transcript={tutorialTranscript}
      />,
    );

    expect(onCopy).not.toHaveBeenCalled();
    expect(onOpenChatGPT).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(onCopy).toHaveBeenCalledOnce();
    expect(copiedValues[0]).toContain('TRANSCRIPT CONTEXT');
    expect(screen.getByText(/Prompt copied/)).toBeInTheDocument();
    expect(onOpenChatGPT).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Open ChatGPT' }));
    expect(onOpenChatGPT).toHaveBeenCalledOnce();
    expect(onOpenChatGPT).toHaveBeenCalledWith();
  });

  it('requires a fresh copy after the generated context changes', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn(() => Promise.resolve());
    const onOpenChatGPT = vi.fn(() => Promise.resolve());
    render(
      <AskPanel
        currentTimeSeconds={144}
        initialQuestion="Explain the evidence."
        onCopy={onCopy}
        onOpenChatGPT={onOpenChatGPT}
        transcript={tutorialTranscript}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Current section' }));
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open ChatGPT' }));
    expect(screen.getByText(/Nothing was copied or sent automatically/)).toBeVisible();
  });

  it('falls back to available context when a selected scope becomes empty', () => {
    const selected = new Set([tutorialTranscript.segments[0]?.id ?? '']);
    const { rerender } = render(
      <AskPanel
        initialQuestion="Explain this."
        initialScope="selection"
        selectedSegmentIds={selected}
        transcript={tutorialTranscript}
      />,
    );

    expect(screen.getByRole('button', { name: 'Selected (1)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    rerender(
      <AskPanel
        initialQuestion="Explain this."
        initialScope="selection"
        selectedSegmentIds={new Set()}
        transcript={tutorialTranscript}
      />,
    );

    expect(screen.getByRole('button', { name: 'Entire video' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('reports copy and open failures without implying success', async () => {
    const user = userEvent.setup();
    render(
      <AskPanel
        initialQuestion="List the evidence."
        onCopy={() => Promise.reject(new Error('clipboard denied'))}
        onOpenChatGPT={() => Promise.reject(new Error('tab blocked'))}
        transcript={tutorialTranscript}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(screen.getByText(/Could not copy the prompt/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open ChatGPT' }));
    expect(screen.getByText(/Could not open ChatGPT/)).toBeInTheDocument();
  });

  it('discloses bounded context for a long transcript', () => {
    render(
      <AskPanel
        initialQuestion="Summarize this video."
        provider={new ChatGPTHandoffProvider(4_000)}
        transcript={podcastTranscript}
      />,
    );

    expect(screen.getByText('Context trimmed')).toBeInTheDocument();
    expect(screen.getByText(/rows omitted/)).toBeInTheDocument();
    expect(screen.getByText(/included/)).toBeInTheDocument();
  });
});
