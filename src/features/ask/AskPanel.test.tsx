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
  it('shows the provider site without duplicating its composer', () => {
    render(<AskPanel providerStatuses={readyStatuses} transcript={null} />);

    expect(screen.getByTitle('ChatGPT embedded chat')).toHaveAttribute(
      'src',
      'https://chatgpt.com/',
    );
    expect(screen.queryByLabelText('Ask about this video')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New chat' })).not.toBeInTheDocument();
  });

  it('opens the selected provider in a full tab', async () => {
    const user = userEvent.setup();
    const onOpenWebChat = vi.fn();
    render(
      <AskPanel
        onOpenWebChat={onOpenWebChat}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open ChatGPT in full tab' }));
    expect(onOpenWebChat).toHaveBeenCalledWith('chatgpt');
  });

  it('shows full-tab failures without adding more controls', async () => {
    const user = userEvent.setup();
    render(
      <AskPanel
        onOpenWebChat={() => Promise.reject(new Error('Tab opening failed.'))}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open ChatGPT in full tab' }));
    expect(await screen.findByText('Tab opening failed.')).toBeVisible();
  });

  it('switches provider frames and binds each prepared session', async () => {
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
    expect(screen.getByTitle('Gemini embedded chat')).toHaveAttribute(
      'src',
      'https://gemini.google.com/app',
    );
    await waitFor(() =>
      expect(onPrepareWebChat).toHaveBeenCalledWith('gemini', expect.any(String)),
    );
  });

  it('primes the provider frame with transcript context once', async () => {
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValue({
        text: 'Transcript loaded.',
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
    expect(onSend.mock.calls[0]?.[0]).toMatchObject({
      provider: 'chatgpt',
      newConversation: true,
    });
    expect(onSend.mock.calls[0]?.[0].message).toContain('TRANSCRIPT CONTEXT');
    expect(screen.queryByText('Transcript loaded.')).not.toBeInTheDocument();
  });

  it('uses selected transcript rows when priming', async () => {
    const selected = new Set([
      tutorialTranscript.segments[2]?.id ?? '',
      tutorialTranscript.segments[3]?.id ?? '',
    ]);
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValue({
        text: 'Ready.',
        responseId: 'web_chatgpt_selected',
        provider: 'chatgpt',
      });
    render(
      <AskPanel
        onSendWebChat={onSend}
        primeRequestId={1}
        providerStatuses={readyStatuses}
        selectedSegmentIds={selected}
        transcript={tutorialTranscript}
      />,
    );

    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
    expect(onSend.mock.calls[0]?.[0].message).toContain('Selected transcript rows');
  });

  it('waits for the exact provider frame before priming', async () => {
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValue({
        text: 'Ready.',
        responseId: 'web_chatgpt_wait',
        provider: 'chatgpt',
      });
    const { rerender } = render(
      <AskPanel
        onSendWebChat={onSend}
        primeRequestId={1}
        providerStatuses={{
          chatgpt: { provider: 'chatgpt', state: 'loading' },
        }}
        transcript={tutorialTranscript}
      />,
    );

    expect(onSend).not.toHaveBeenCalled();
    rerender(
      <AskPanel
        onSendWebChat={onSend}
        primeRequestId={1}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );
    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
  });

  it('keeps frame preparation errors inside the frame area', async () => {
    render(
      <AskPanel
        onPrepareWebChat={() => Promise.reject(new Error('Binding failed.'))}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    expect(await screen.findByText('ChatGPT frame unavailable')).toBeVisible();
    expect(screen.getByText('Binding failed.')).toBeVisible();
  });
});
