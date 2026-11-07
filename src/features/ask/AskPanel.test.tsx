import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { podcastTranscript, tutorialTranscript } from '@/test/fixtures/transcripts';

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
    const picker = screen.getByRole('group', { name: 'AI provider' });
    expect(
      within(picker)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Google Gemini', 'Codex']);
    await user.click(within(picker).getByRole('button', { name: 'Codex' }));
    await user.click(within(picker).getByRole('button', { name: 'Google Gemini' }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows the provider site without duplicating its composer', () => {
    render(<AskPanel providerStatuses={readyStatuses} transcript={null} />);

    const frame = screen.getByTitle('Gemini embedded chat');
    expect(frame).toHaveAttribute(
      'src',
      expect.stringMatching(
        /^https:\/\/gemini\.google\.com\/app#watchbetter-frame=gemini%3A/,
      ),
    );
    expect(frame).not.toHaveAttribute('allow');
    expect(screen.queryByLabelText('Ask about this video')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New chat' })).not.toBeInTheDocument();
  });

  it('keeps controlled provider selection stable', async () => {
    const user = userEvent.setup();
    const onProviderChange = vi.fn();
    render(
      <AskPanel
        onProviderChange={onProviderChange}
        providerStatuses={readyStatuses}
        selectedProvider="gemini"
        transcript={null}
      />,
    );

    expect(screen.getByRole('button', { name: 'Google Gemini' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Codex' }));
    expect(onProviderChange).toHaveBeenCalledWith('chatgpt');
    expect(screen.getByRole('button', { name: 'Google Gemini' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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

    await user.click(screen.getByRole('button', { name: 'Open Gemini in full tab' }));
    expect(onOpenWebChat).toHaveBeenCalledWith('gemini');
  });

  it('opens a focused AI view without remounting the active provider frame', async () => {
    const user = userEvent.setup();
    const onFocusedChange = vi.fn();
    const { rerender } = render(
      <AskPanel
        onFocusedChange={onFocusedChange}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    const frame = screen.getByTitle('Gemini embedded chat');
    await user.click(screen.getByRole('button', { name: 'Focus AI view' }));
    expect(onFocusedChange).toHaveBeenCalledWith(true);

    rerender(
      <AskPanel
        focused
        onFocusedChange={onFocusedChange}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );
    expect(screen.getByText('Preparing your workspace…')).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFocusedChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByTitle('Gemini embedded chat')).toBe(frame);
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

    await user.click(screen.getByRole('button', { name: 'Open Gemini in full tab' }));
    expect(await screen.findByText('Tab opening failed.')).toBeVisible();
  });

  it('embeds each supported provider once', async () => {
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
      expect(onPrepareWebChat).toHaveBeenCalledWith('gemini', expect.any(String)),
    );
    expect(onPrepareWebChat).not.toHaveBeenCalledWith('chatgpt', expect.any(String));
    await user.click(screen.getByRole('button', { name: 'Codex' }));
    await waitFor(() =>
      expect(onPrepareWebChat).toHaveBeenCalledWith('chatgpt', expect.any(String)),
    );
    const chatGptFrame = await screen.findByTitle<HTMLIFrameElement>(
      'ChatGPT embedded chat',
    );
    expect(screen.getByTitle('Gemini embedded chat')).toHaveAttribute(
      'src',
      expect.stringMatching(
        /^https:\/\/gemini\.google\.com\/app#watchbetter-frame=gemini%3A/,
      ),
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

    await user.click(screen.getByRole('button', { name: 'Google Gemini' }));
    expect(screen.getByTitle('Gemini embedded chat')).toHaveAttribute(
      'src',
      expect.stringMatching(
        /^https:\/\/gemini\.google\.com\/app#watchbetter-frame=gemini%3A/,
      ),
    );
    expect(
      onPrepareWebChat.mock.calls.filter(([provider]) => provider === 'gemini'),
    ).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Codex' }));
    expect(screen.getByTitle('ChatGPT embedded chat')).toBe(chatGptFrame);
    expect(
      onPrepareWebChat.mock.calls.filter(([provider]) => provider === 'chatgpt'),
    ).toHaveLength(1);
  });

  it('submits the entire video context when Ask is visible', async () => {
    const onPrime = vi
      .fn<NonNullable<AskPanelProps['onPrimeWebChat']>>()
      .mockResolvedValue(undefined);
    const onSend = vi.fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>();
    render(
      <AskPanel
        onPrimeWebChat={onPrime}
        onSendWebChat={onSend}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    await waitFor(() => expect(onPrime).toHaveBeenCalledOnce());
    expect(onPrime.mock.calls[0]?.[0]).toMatchObject({
      provider: 'gemini',
      newConversation: true,
    });
    expect(onPrime.mock.calls[0]?.[0].message).toContain('TRANSCRIPT CONTEXT');
    expect(onPrime.mock.calls[0]?.[0].message).toContain('Reply only READY');
    expect(onPrime.mock.calls[0]?.[0].message).toContain(
      'Do not summarize it or answer any question yet',
    );
    expect(onSend).not.toHaveBeenCalled();
    expect(await screen.findByText('Video context ready in Gemini.')).toBeVisible();
  });

  it('answers Quick Learn directly without uploading the thumbnail', async () => {
    const onPrime = vi
      .fn<NonNullable<AskPanelProps['onPrimeWebChat']>>()
      .mockResolvedValue(undefined);
    let finishAnswer!: (result: ChatTurnResult) => void;
    const onSend = vi.fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>(
      () =>
        new Promise((resolve) => {
          finishAnswer = resolve;
        }),
    );

    render(
      <AskPanel
        onPrimeWebChat={onPrime}
        onSendWebChat={onSend}
        providerStatuses={readyStatuses}
        quickLearn={{
          thumbnailUrl: 'https://i.ytimg.com/vi/tutorial/hqdefault.jpg',
        }}
        transcript={tutorialTranscript}
      />,
    );

    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
    expect(onPrime).not.toHaveBeenCalled();
    expect(onSend.mock.calls[0]?.[0]).toMatchObject({
      provider: 'gemini',
      newConversation: true,
    });
    expect(onSend.mock.calls[0]?.[0]).not.toHaveProperty('imageUrl');
    expect(onSend.mock.calls[0]?.[0].message).toContain('TRANSCRIPT CONTEXT');
    expect(onSend.mock.calls[0]?.[0].message).toMatch(
      /exactly one short paragraph.*no more than 80 words/i,
    );
    expect(onSend.mock.calls[0]?.[0].message).toMatch(/first sentence.*direct answer/i);
    expect(onSend.mock.calls[0]?.[0].message).not.toContain('Reply only READY');
    expect(
      await screen.findByText('Answering the video’s click question in Gemini…'),
    ).toBeVisible();
    finishAnswer({
      text: '',
      responseId: 'quick-learn-answer',
      provider: 'gemini',
    });
    expect(await screen.findByText('Quick answer sent to Gemini.')).toBeVisible();
  });

  it('keeps the Quick Learn video identifiable while Gemini loads', () => {
    render(
      <AskPanel
        providerStatuses={{
          gemini: { provider: 'gemini', state: 'not-open' },
        }}
        quickLearn={{
          thumbnailUrl: 'https://i.ytimg.com/vi/tutorial/hqdefault.jpg',
        }}
        transcript={tutorialTranscript}
      />,
    );

    const identity = screen.getByRole('region', {
      name: `Quick Learn video: ${tutorialTranscript.videoTitle}`,
    });
    expect(within(identity).getByText(tutorialTranscript.videoTitle)).toBeVisible();
    expect(
      within(identity).getByRole('img', {
        name: `Thumbnail for ${tutorialTranscript.videoTitle}`,
      }),
    ).toHaveAttribute('src', 'https://i.ytimg.com/vi/tutorial/hqdefault.jpg');
    expect(screen.getByText('Loading Gemini…')).toBeVisible();
  });

  it('shows a local fallback when the Quick Learn thumbnail cannot load', () => {
    const { container } = render(
      <AskPanel
        providerStatuses={readyStatuses}
        quickLearn={{ thumbnailUrl: 'https://i.ytimg.com/vi/missing/hqdefault.jpg' }}
        transcript={tutorialTranscript}
      />,
    );

    fireEvent.error(
      screen.getByRole('img', {
        name: `Thumbnail for ${tutorialTranscript.videoTitle}`,
      }),
    );

    expect(
      screen.queryByRole('img', {
        name: `Thumbnail for ${tutorialTranscript.videoTitle}`,
      }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.ct-quick-learn-context__fallback')).toBeVisible();
  });

  it('loads the normal full transcript context for the first Quick Learn answer', async () => {
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValue({
        text: '',
        responseId: 'full-context-quick-learn-answer',
        provider: 'gemini',
      });

    render(
      <AskPanel
        onSendWebChat={onSend}
        providerStatuses={readyStatuses}
        quickLearn={{}}
        transcript={podcastTranscript}
      />,
    );

    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
    const message = onSend.mock.calls[0]?.[0].message ?? '';
    expect(message.length).toBeGreaterThan(18_000);
    expect(message.length).toBeLessThan(24_000);
    expect(message).toContain('CONTEXT LIMITATION');
    expect(message).toContain('[0:00]');
    expect(message).toMatch(/\[1:5\d:\d{2}\]/);
  });

  it('shares and focuses video context only after Ask becomes visible', async () => {
    const onPrime = vi
      .fn<NonNullable<AskPanelProps['onPrimeWebChat']>>()
      .mockResolvedValue(undefined);
    const onFocus = vi
      .fn<NonNullable<AskPanelProps['onFocusWebChat']>>()
      .mockResolvedValue(undefined);
    const view = render(
      <AskPanel
        onFocusWebChat={onFocus}
        onPrimeWebChat={onPrime}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
        visible={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTitle('Gemini embedded chat')).toBeInTheDocument(),
    );
    expect(onPrime).not.toHaveBeenCalled();
    expect(onFocus).not.toHaveBeenCalled();
    view.rerender(
      <AskPanel
        onFocusWebChat={onFocus}
        onPrimeWebChat={onPrime}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
        visible
      />,
    );

    await waitFor(() => expect(onPrime).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(onFocus).toHaveBeenCalledWith('gemini', expect.any(String)),
    );
  });

  it('re-primes a revisited video after another context replaced it', async () => {
    const onPrime = vi
      .fn<NonNullable<AskPanelProps['onPrimeWebChat']>>()
      .mockResolvedValue(undefined);
    const secondTranscript = {
      ...tutorialTranscript,
      videoId: 'second-video',
      videoTitle: 'Second video',
    };
    const view = render(
      <AskPanel
        onPrimeWebChat={onPrime}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
        visible
      />,
    );

    await waitFor(() => expect(onPrime).toHaveBeenCalledTimes(1));
    view.rerender(
      <AskPanel
        onPrimeWebChat={onPrime}
        providerStatuses={readyStatuses}
        transcript={secondTranscript}
        visible
      />,
    );
    await waitFor(() => expect(onPrime).toHaveBeenCalledTimes(2));
    view.rerender(
      <AskPanel
        onPrimeWebChat={onPrime}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
        visible
      />,
    );

    await waitFor(() => expect(onPrime).toHaveBeenCalledTimes(3));
  });

  it('does not auto-prime over an explicit transcript send', async () => {
    const onPrime = vi
      .fn<NonNullable<AskPanelProps['onPrimeWebChat']>>()
      .mockResolvedValue(undefined);
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValue({
        text: '',
        responseId: 'explicit-context',
        provider: 'gemini',
      });
    render(
      <AskPanel
        onPrimeWebChat={onPrime}
        onSendWebChat={onSend}
        providerStatuses={readyStatuses}
        sendRequestId={1}
        transcript={tutorialTranscript}
        visible
      />,
    );

    await waitFor(() => expect(onSend).toHaveBeenCalledOnce());
    await waitFor(() => expect(onPrime).not.toHaveBeenCalled());
  });

  it('sends the provider frame transcript context exactly once per request', async () => {
    const onSend = vi
      .fn<(request: ChatTurnRequest) => Promise<ChatTurnResult>>()
      .mockResolvedValue({
        text: 'Transcript loaded.',
        responseId: 'web_chatgpt_prime',
        provider: 'gemini',
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
      provider: 'gemini',
      newConversation: true,
    });
    expect(onSend.mock.calls[0]?.[0].message).toContain('TRANSCRIPT CONTEXT');
    expect(screen.getByText('Video context ready in Gemini.')).toBeVisible();
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
        provider: 'gemini',
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
        provider: 'gemini',
      });
    const { rerender } = render(
      <AskPanel
        onSendWebChat={onSend}
        sendRequestId={1}
        providerStatuses={{
          gemini: { provider: 'gemini', state: 'loading' },
        }}
        transcript={tutorialTranscript}
      />,
    );

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('Waiting for Gemini…')).toBeVisible();
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
          gemini: { provider: 'gemini', state: 'sign-in-required' },
        }}
        sendRequestId={1}
        transcript={tutorialTranscript}
      />,
    );

    expect(screen.getByText('Sign in to Gemini before sending.')).toBeVisible();
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

  it('does not load the unused provider in the background', () => {
    render(
      <AskPanel providerStatuses={readyStatuses} transcript={tutorialTranscript} />,
    );

    expect(screen.getByTitle('Gemini embedded chat')).toBeInTheDocument();
    expect(screen.queryByTitle('ChatGPT embedded chat')).not.toBeInTheDocument();
  });

  it('keeps frame preparation errors inside the frame area', async () => {
    render(
      <AskPanel
        onPrepareWebChat={() => Promise.reject(new Error('Binding failed.'))}
        providerStatuses={readyStatuses}
        transcript={tutorialTranscript}
      />,
    );

    expect(await screen.findByText('Gemini frame unavailable')).toBeVisible();
    expect(screen.getAllByText('Binding failed.')[0]).toBeVisible();
  });

  it('resets only its exact provider sessions when unmounted', async () => {
    const user = userEvent.setup();
    const onResetWebChat = vi.fn<NonNullable<AskPanelProps['onResetWebChat']>>();
    const view = render(
      <AskPanel onResetWebChat={onResetWebChat} transcript={tutorialTranscript} />,
    );
    await user.click(screen.getByRole('button', { name: 'Codex' }));
    const chatGptSource = screen
      .getByTitle('ChatGPT embedded chat')
      .getAttribute('src');
    const geminiSource = screen.getByTitle('Gemini embedded chat').getAttribute('src');
    const sessionFrom = (source: string | null) =>
      decodeURIComponent(source?.split('watchbetter-frame=')[1] ?? '');

    view.unmount();

    await waitFor(() => expect(onResetWebChat).toHaveBeenCalledTimes(2));
    expect(onResetWebChat).toHaveBeenCalledWith('chatgpt', sessionFrom(chatGptSource));
    expect(onResetWebChat).toHaveBeenCalledWith('gemini', sessionFrom(geminiSource));
  });
});
