import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { tutorialTranscript } from '@/test/fixtures/transcripts';

import {
  AskPanel,
  type AskPanelProps,
  type ChatTurnRequest,
  type ChatTurnResult,
} from './AskPanel';

const readyStatuses = {
  chatgpt: { provider: 'chatgpt' as const, state: 'ready' as const },
  gemini: { provider: 'gemini' as const, state: 'ready' as const },
};

describe('AskPanel', () => {
  it('never sends when opened or when providers switch', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>();
    render(
      <AskPanel
        onSendWebChat={onSend}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    expect(onSend).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Gemini/ }));
    await user.click(screen.getByRole('button', { name: /ChatGPT/ }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows the provider site without duplicating its composer', () => {
    render(<AskPanel providerStatuses={readyStatuses} transcript={null} />);

    expect(screen.getByTitle('ChatGPT embedded chat')).toHaveAttribute(
      'src',
      expect.stringMatching(/^https:\/\/chatgpt\.com\/#watchbetter-frame=chatgpt%3A/),
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
    const onPrepareWebChat = vi.fn<NonNullable<AskPanelProps['onPrepareWebChat']>>(() =>
      Promise.resolve(),
    );
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
      expect.stringMatching(
        /^https:\/\/gemini\.google\.com\/app#watchbetter-frame=gemini%3A/,
      ),
    );
    await waitFor(() =>
      expect(onPrepareWebChat).toHaveBeenCalledWith('gemini', expect.any(String)),
    );

    await user.click(screen.getByRole('button', { name: /ChatGPT/ }));
    expect(screen.getByTitle('ChatGPT embedded chat')).toBe(chatGptFrame);
    expect(
      onPrepareWebChat.mock.calls.filter(([provider]) => provider === 'chatgpt'),
    ).toHaveLength(1);
  });

  it('sends the provider frame transcript context exactly once per request', async () => {
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
        sendRequestId={1}
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
    expect(screen.getByText('Transcript sent to ChatGPT.')).toBeVisible();
    expect(screen.queryByText('Transcript loaded.')).not.toBeInTheDocument();
  });

  it('uses selected transcript rows when explicitly sent', async () => {
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
        sendRequestId={1}
        providerStatuses={readyStatuses}
        selectedSegmentIds={selected}
        transcript={tutorialTranscript}
      />,
    );

    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
    expect(onSend.mock.calls[0]?.[0].message).toContain('Selected transcript rows');
  });

  it('shows waiting and sends only after the exact provider frame is ready', async () => {
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
        sendRequestId={1}
        providerStatuses={{
          chatgpt: { provider: 'chatgpt', state: 'loading' },
        }}
        transcript={tutorialTranscript}
      />,
    );

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('Waiting for ChatGPT…')).toBeVisible();
    rerender(
      <AskPanel
        onSendWebChat={onSend}
        sendRequestId={1}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );
    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
  });

  it('reports sign-in and send errors without an implicit retry', async () => {
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockRejectedValue(new Error('Provider rejected the transfer.'));
    const { rerender } = render(
      <AskPanel
        onSendWebChat={onSend}
        providerStatuses={{
          chatgpt: { provider: 'chatgpt', state: 'sign-in-required' },
        }}
        sendRequestId={1}
        transcript={tutorialTranscript}
      />,
    );

    expect(screen.getByText('Sign in to ChatGPT before sending.')).toBeVisible();
    expect(onSend).not.toHaveBeenCalled();

    rerender(
      <AskPanel
        onSendWebChat={onSend}
        providerStatuses={readyStatuses}
        sendRequestId={1}
        transcript={tutorialTranscript}
      />,
    );
    expect(await screen.findByText('Provider rejected the transfer.')).toBeVisible();
    expect(onSend).toHaveBeenCalledOnce();
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
