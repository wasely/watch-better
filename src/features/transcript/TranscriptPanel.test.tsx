import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  englishTrack,
  podcastTranscript,
  readyTranscriptState,
  spanishTrack,
  tutorialTranscript,
} from '@/test/fixtures/transcripts';

import { TranscriptPanel } from './TranscriptPanel';

describe('TranscriptPanel', () => {
  it('renders explicit non-ready states and recovery actions', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(<TranscriptPanel state={{ kind: 'loading' }} />);
    expect(screen.getByText('Loading transcript')).toBeInTheDocument();

    rerender(<TranscriptPanel onRetry={onRetry} state={{ kind: 'unavailable' }} />);
    expect(screen.getByText('No transcript available')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<TranscriptPanel state={{ kind: 'disabled' }} />);
    expect(screen.getByText('Transcript loading is off')).toBeInTheDocument();

    rerender(
      <TranscriptPanel
        onRetry={onRetry}
        state={{ kind: 'error', message: 'Caption request timed out.' }}
      />,
    );
    expect(screen.getByText('Caption request timed out.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('renders tracks, active state, and seek controls', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    const onTrackChange = vi.fn();
    const state = readyTranscriptState(tutorialTranscript, [
      englishTrack,
      spanishTrack,
    ]);
    const active = tutorialTranscript.segments[2];
    if (!active) throw new Error('Fixture segment missing.');

    render(
      <TranscriptPanel
        activeSegmentId={active.id}
        onSeek={onSeek}
        onTrackChange={onTrackChange}
        state={state}
      />,
    );

    expect(screen.getByRole('list')).toHaveAccessibleName(
      `Transcript for ${tutorialTranscript.videoTitle}`,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(
      tutorialTranscript.segments.length,
    );
    const language = screen.getByRole('combobox', { name: 'Transcript language' });
    expect(language).toHaveValue(englishTrack.id);
    expect(screen.getByRole('listitem', { current: true })).toHaveAttribute(
      'data-segment-id',
      active.id,
    );

    await user.selectOptions(language, spanishTrack.id);
    expect(onTrackChange).toHaveBeenCalledWith(spanishTrack.id);
    await user.click(screen.getByRole('button', { name: 'Seek to 0:24' }));
    expect(onSeek).toHaveBeenCalledWith(active);
  });

  it('keeps auto-follow scrolling inside the transcript list', () => {
    const active = tutorialTranscript.segments[4];
    if (!active) throw new Error('Fixture segment missing.');

    const { container, rerender } = render(
      <TranscriptPanel state={readyTranscriptState()} />,
    );
    const list = container.querySelector<HTMLElement>('.ct-transcript__list');
    const row = container.querySelector<HTMLElement>(
      `[data-segment-id="${active.id}"]`,
    );
    if (!list || !row) throw new Error('Transcript elements missing.');

    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 240 },
      scrollHeight: { configurable: true, value: 1_200 },
    });
    Object.defineProperties(row, {
      offsetHeight: { configurable: true, value: 48 },
      offsetTop: { configurable: true, value: 560 },
    });
    const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      list.scrollTop = top ?? 0;
    });
    Object.defineProperty(list, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });

    rerender(
      <TranscriptPanel activeSegmentId={active.id} state={readyTranscriptState()} />,
    );

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', top: 464 });
    expect(list.scrollTop).toBe(464);
  });

  it('moves row focus with transcript arrow keys', () => {
    render(<TranscriptPanel state={readyTranscriptState()} />);
    const rowButtons = Array.from(
      document.querySelectorAll<HTMLElement>('[data-segment-seek]'),
    );
    const first = rowButtons[0];
    const second = rowButtons[1];
    if (!first || !second) throw new Error('Fixture row buttons missing.');

    first.focus();
    const secondFocus = vi.spyOn(second, 'focus');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(secondFocus).toHaveBeenCalledWith({ preventScroll: true });
    expect(second).toHaveFocus();
  });

  it('searches literally and navigates between results', async () => {
    const user = userEvent.setup();
    render(<TranscriptPanel state={readyTranscriptState()} />);

    const input = screen.getByRole('searchbox', { name: 'Search transcript' });
    await user.type(input, 'evidence');

    expect(screen.queryByRole('button', { name: 'Following' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Resume follow' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/1\/\d+/)).toBeInTheDocument();
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(1);

    await user.click(
      screen.getByRole('button', { name: 'Next transcript search result' }),
    );
    expect(screen.getByText(/2\/\d+/)).toBeInTheDocument();
  });

  it('selects ranges and copies the approved timestamped format', async () => {
    const copiedValues: string[] = [];
    const onCopy = vi.fn((text: string) => {
      copiedValues.push(text);
      return Promise.resolve();
    });
    const onSendToAI = vi.fn();
    const { container } = render(
      <TranscriptPanel
        onSendToAI={onSendToAI}
        onCopy={onCopy}
        state={readyTranscriptState()}
      />,
    );

    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('.ct-row-select input'),
    );
    const first = checkboxes[1];
    const fourth = checkboxes[4];
    if (!first || !fourth) throw new Error('Fixture checkboxes missing.');

    fireEvent.click(first);
    const selectionCount = container.querySelector('.ct-selection-bar strong');
    expect(selectionCount).toHaveTextContent('1');
    fireEvent.mouseDown(fourth, { shiftKey: true });
    fireEvent.click(fourth, { shiftKey: true });

    expect(selectionCount).toHaveTextContent('4');
    const actions = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.ct-selection-action'),
    );
    const copy = actions[0];
    const ask = actions[1];
    if (!copy || !ask) throw new Error('Selection actions missing.');
    fireEvent.click(copy);

    expect(onCopy).toHaveBeenCalledOnce();
    const copied = copiedValues[0] ?? '';
    expect(copied).toContain(tutorialTranscript.videoTitle);
    expect(copied).toContain('0:12 —');
    expect(copied).toContain('0:48 —');
    await waitFor(() =>
      expect(container.querySelector('.ct-transcript__feedback')).toHaveTextContent(
        '4 segments copied.',
      ),
    );

    fireEvent.click(ask);
    expect(onSendToAI.mock.calls[0]?.[0]).toHaveProperty('size', 4);
  });

  it('copies the full transcript from the toolbar', async () => {
    const copiedValues: string[] = [];
    render(
      <TranscriptPanel
        onCopy={(text) => {
          copiedValues.push(text);
          return Promise.resolve();
        }}
        state={readyTranscriptState()}
      />,
    );

    const firstText = tutorialTranscript.segments[0]?.text;
    const finalText = tutorialTranscript.segments.at(-1)?.text;
    if (!firstText || !finalText) throw new Error('Caption fixture is incomplete.');

    fireEvent.click(screen.getByRole('button', { name: 'Copy transcript' }));

    await waitFor(() => expect(copiedValues).toHaveLength(1));
    expect(copiedValues[0]).toContain(tutorialTranscript.videoTitle);
    expect(copiedValues[0]).toContain(
      `https://www.youtube.com/watch?v=${tutorialTranscript.videoId}`,
    );
    expect(copiedValues[0]).toContain(firstText);
    expect(copiedValues[0]).toContain(finalText);
    expect(
      screen.getByText('Full transcript copied to clipboard.'),
    ).toBeInTheDocument();
  });

  it('keeps copy separate and sends the full transcript only from Send to AI', async () => {
    const onCopy = vi.fn(() => Promise.resolve());
    const onSendToAI = vi.fn();
    render(
      <TranscriptPanel
        onCopy={onCopy}
        onSendToAI={onSendToAI}
        state={readyTranscriptState()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy transcript' }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledOnce());
    expect(onSendToAI).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Send to AI' }));
    expect(onSendToAI).toHaveBeenCalledOnce();
    expect(onSendToAI.mock.calls[0]?.[0]).toHaveProperty('size', 0);
  });

  it('keeps the two-hour fixture searchable and rendered as one accessible list', () => {
    render(<TranscriptPanel state={readyTranscriptState(podcastTranscript)} />);

    const list = screen.getByRole('list');
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(720);
    const search = document.querySelector<HTMLInputElement>('#ct-transcript-search');
    if (!search) throw new Error('Transcript search input missing.');
    fireEvent.change(search, { target: { value: 'segment 720' } });
    expect(document.querySelector('.ct-search__count')).toHaveTextContent('1/1');
  }, 10_000);
});
