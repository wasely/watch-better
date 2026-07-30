import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { tutorialTranscript } from '@/test/fixtures/transcripts';

import { AskPanel, type ChatTurnRequest, type ChatTurnResult } from './AskPanel';

describe('AskPanel', () => {
  it('shows an honest unavailable state without transcript context', () => {
    render(<AskPanel transcript={null} />);
    expect(screen.getByText('Transcript context is required')).toBeInTheDocument();
  });

  it('requires explicit local API configuration', async () => {
    const user = userEvent.setup();
    const onConfigure = vi.fn();
    render(
      <AskPanel onConfigureChatGPT={onConfigure} transcript={tutorialTranscript} />,
    );

    expect(screen.getByText('Connect OpenAI to chat here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(onConfigure).toHaveBeenCalledOnce();
  });

  it('applies suggested questions and context', async () => {
    const user = userEvent.setup();
    render(
      <AskPanel
        chatConfigured
        currentTimeSeconds={144}
        transcript={tutorialTranscript}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Explain this section' }));
    expect(screen.getByDisplayValue(/Explain this section/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Current section' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('sends bounded transcript context once and chains later turns', async () => {
    const user = userEvent.setup();
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValueOnce({
        text: 'First answer [00:12]',
        responseId: 'resp_first',
        model: 'gpt-5.6-sol',
      })
      .mockResolvedValueOnce({
        text: 'Second answer',
        responseId: 'resp_second',
        model: 'gpt-5.6-sol',
      });
    render(
      <AskPanel
        chatConfigured
        onSendChatGPT={onSend}
        transcript={tutorialTranscript}
      />,
    );

    await user.type(
      screen.getByLabelText('Ask about this video'),
      'What is the thesis?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('First answer [00:12]');
    expect(onSend.mock.calls[0]?.[0]).toMatchObject({ previousResponseId: null });
    expect(onSend.mock.calls[0]?.[0].message).toContain('TRANSCRIPT CONTEXT');

    await user.type(screen.getByLabelText('Ask about this video'), 'What evidence?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Second answer');
    expect(onSend.mock.calls[1]?.[0]).toEqual({
      message: 'What evidence?',
      previousResponseId: 'resp_first',
    });
  });

  it('primes ChatGPT from the transcript Ask action', async () => {
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValue({
        text: 'Transcript loaded. Ask away.',
        responseId: 'resp_prime',
        model: 'gpt-5.6-sol',
      });
    render(
      <AskPanel
        chatConfigured
        onSendChatGPT={onSend}
        primeRequestId={1}
        transcript={tutorialTranscript}
      />,
    );

    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
    expect(onSend.mock.calls[0]?.[0].message).toContain('TRANSCRIPT CONTEXT');
    expect(
      screen.getByText('Use this transcript and get ready for questions.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Transcript loaded. Ask away.')).toBeVisible();
  });

  it('supports selected transcript context', async () => {
    const user = userEvent.setup();
    const selected = new Set([
      tutorialTranscript.segments[2]?.id ?? '',
      tutorialTranscript.segments[3]?.id ?? '',
    ]);
    render(
      <AskPanel
        chatConfigured
        selectedSegmentIds={selected}
        transcript={tutorialTranscript}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Selected (2)' }));
    expect(screen.getByText('2 selected rows')).toBeInTheDocument();
  });

  it('shows API failures in the conversation', async () => {
    const user = userEvent.setup();
    render(
      <AskPanel
        chatConfigured
        onSendChatGPT={() => Promise.reject(new Error('Invalid API key.'))}
        transcript={tutorialTranscript}
      />,
    );

    await user.type(screen.getByLabelText('Ask about this video'), 'Summarize.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Invalid API key.')).toBeVisible();
    expect(screen.getByText('Message failed')).toBeVisible();
  });
});
