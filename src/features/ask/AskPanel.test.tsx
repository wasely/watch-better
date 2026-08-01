import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { tutorialTranscript } from '@/test/fixtures/transcripts';

import { AskPanel, type ChatTurnRequest, type ChatTurnResult } from './AskPanel';

const readyStatuses = {
  chatgpt: { provider: 'chatgpt' as const, state: 'ready' as const },
  gemini: { provider: 'gemini' as const, state: 'ready' as const },
};

describe('AskPanel', () => {
  it('shows an honest unavailable state without transcript context', () => {
    render(<AskPanel transcript={null} />);
    expect(screen.getByText('Transcript context is required')).toBeInTheDocument();
  });

  it('connects through the selected provider website', async () => {
    const user = userEvent.setup();
    const onOpenWebChat = vi.fn();
    render(<AskPanel onOpenWebChat={onOpenWebChat} transcript={tutorialTranscript} />);

    expect(screen.getByText('Connect ChatGPT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByTitle('ChatGPT embedded chat')).toHaveAttribute(
      'src',
      'https://chatgpt.com/',
    );
    await user.click(screen.getByRole('button', { name: 'Open sign-in tab' }));
    expect(onOpenWebChat).toHaveBeenCalledWith('chatgpt');
  });

  it('switches between ChatGPT and Gemini sessions', async () => {
    const user = userEvent.setup();
    const onPrepareWebChat = vi.fn(() => Promise.resolve());
    render(
      <AskPanel
        onPrepareWebChat={onPrepareWebChat}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    await waitFor(() =>
      expect(onPrepareWebChat).toHaveBeenCalledWith('chatgpt', expect.any(String)),
    );
    const chatGptFrame = await screen.findByTitle<HTMLIFrameElement>(
      'ChatGPT embedded chat',
    );
    const frameWindow = chatGptFrame.contentWindow;
    if (!frameWindow) throw new Error('Expected an iframe window.');
    const postMessage = vi.spyOn(frameWindow, 'postMessage');
    fireEvent.load(chatGptFrame);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'watchbetter:webchat-frame-binding',
        provider: 'chatgpt',
      }),
      'https://chatgpt.com',
    );

    await user.click(screen.getByRole('button', { name: /Gemini/ }));
    expect(screen.getByText('Gemini embedded')).toBeInTheDocument();
    expect(screen.getByTitle('Gemini embedded chat')).toHaveAttribute(
      'src',
      'https://gemini.google.com/app',
    );
    await waitFor(() =>
      expect(onPrepareWebChat).toHaveBeenCalledWith('gemini', expect.any(String)),
    );

    const callsBeforeNewChat = onPrepareWebChat.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    await waitFor(() =>
      expect(onPrepareWebChat.mock.calls.length).toBeGreaterThan(callsBeforeNewChat),
    );
  });

  it('applies suggested questions and context', async () => {
    const user = userEvent.setup();
    render(
      <AskPanel
        currentTimeSeconds={144}
        providerStatuses={readyStatuses}
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
        responseId: 'web_chatgpt_first',
        provider: 'chatgpt',
      })
      .mockResolvedValueOnce({
        text: 'Second answer',
        responseId: 'web_chatgpt_second',
        provider: 'chatgpt',
      });
    render(
      <AskPanel
        onSendWebChat={onSend}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    await user.type(
      screen.getByLabelText('Ask about this video'),
      'What is the thesis?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('First answer [00:12]');
    expect(onSend.mock.calls[0]?.[0]).toMatchObject({
      provider: 'chatgpt',
      newConversation: true,
    });
    expect(onSend.mock.calls[0]?.[0].message).toContain('TRANSCRIPT CONTEXT');

    await user.type(screen.getByLabelText('Ask about this video'), 'What evidence?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Second answer');
    expect(onSend.mock.calls[1]?.[0]).toEqual({
      provider: 'chatgpt',
      message: 'What evidence?',
      newConversation: false,
    });
  });

  it('primes the selected provider from the transcript Ask action', async () => {
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValue({
        text: 'Transcript loaded. Ask away.',
        responseId: 'web_chatgpt_prime',
        provider: 'chatgpt',
      });
    render(
      <AskPanel
        onSendWebChat={onSend}
        primeRequestId={1}
        providerStatuses={readyStatuses}
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
        providerStatuses={readyStatuses}
        selectedSegmentIds={selected}
        transcript={tutorialTranscript}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Selected (2)' }));
    expect(screen.getByText('2 selected rows')).toBeInTheDocument();
  });

  it('shows provider failures in the conversation', async () => {
    const user = userEvent.setup();
    render(
      <AskPanel
        onSendWebChat={() => Promise.reject(new Error('ChatGPT sign-in required.'))}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    await user.type(screen.getByLabelText('Ask about this video'), 'Summarize.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('ChatGPT sign-in required.')).toBeVisible();
    expect(screen.getByText('Message failed')).toBeVisible();
  });
});
