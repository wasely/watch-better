import { fireEvent, render, screen, within } from '@testing-library/react';
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

    rerender(<TranscriptPanel state={{ kind: 'unavailable' }} />);
    expect(screen.getByText('No transcript available')).toBeInTheDocument();

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
    expect(onRetry).toHaveBeenCalledOnce();
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

  it('moves row focus with transcript arrow keys', () => {
    render(<TranscriptPanel state={readyTranscriptState()} />);
    const rowButtons = Array.from(
      document.querySelectorAll<HTMLElement>('[data-segment-seek]'),
    );
    const first = rowButtons[0];
    const second = rowButtons[1];
    if (!first || !second) throw new Error('Fixture row buttons missing.');

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
  });

  it('searches literally and navigates between results', async () => {
    const user = userEvent.setup();
    render(<TranscriptPanel state={readyTranscriptState()} />);

    const input = screen.getByRole('searchbox', { name: 'Search transcript' });
    await user.type(input, 'evidence');

    expect(screen.getByRole('button', { name: 'Resume follow' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText(/1\/\d+/)).toBeInTheDocument();
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(1);

    await user.click(
      screen.getByRole('button', { name: 'Next transcript search result' }),
    );
    expect(screen.getByText(/2\/\d+/)).toBeInTheDocument();
  });

  it('selects ranges and copies the approved timestamped format', async () => {
    const user = userEvent.setup();
    const copiedValues: string[] = [];
    const onCopy = vi.fn((text: string) => {
      copiedValues.push(text);
      return Promise.resolve();
    });
    const onAskSelection = vi.fn();
    const onOpenSelectionInChatGPT = vi.fn();
    render(
      <TranscriptPanel
        onAskSelection={onAskSelection}
        onCopy={onCopy}
        onOpenSelectionInChatGPT={onOpenSelectionInChatGPT}
        state={readyTranscriptState()}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox', {
      name: /Select transcript segment/,
    });
    const first = checkboxes[1];
    const fourth = checkboxes[4];
    if (!first || !fourth) throw new Error('Fixture checkboxes missing.');

    await user.click(first);
    expect(
      screen.getByText('1', { selector: '.ct-selection-bar strong' }),
    ).toBeVisible();
    fireEvent.mouseDown(fourth, { shiftKey: true });
    fireEvent.click(fourth, { shiftKey: true });

    expect(document.querySelector('.ct-selection-bar strong')).toHaveTextContent('4');
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(onCopy).toHaveBeenCalledOnce();
    const copied = copiedValues[0] ?? '';
    expect(copied).toContain(tutorialTranscript.videoTitle);
    expect(copied).toContain('0:12 —');
    expect(copied).toContain('0:48 —');
    expect(screen.getByText('4 segments copied.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(
      screen.getByRole('button', { name: 'Open selected transcript in ChatGPT' }),
    );
    expect(onAskSelection.mock.calls[0]?.[0]).toHaveProperty('size', 4);
    expect(onOpenSelectionInChatGPT.mock.calls[0]?.[0]).toHaveProperty('size', 4);
  });

  it('copies the full transcript from its explicit action', async () => {
    const user = userEvent.setup();
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

    const finalText = tutorialTranscript.segments.at(-1)?.text;
    if (!finalText) throw new Error('Final fixture segment missing.');
    await user.click(screen.getByRole('button', { name: 'Copy full transcript' }));
    expect(copiedValues[0]).toContain(finalText);
    expect(screen.getByText('Full transcript copied.')).toBeInTheDocument();
  });

  it('suspends and explicitly resumes playback following', async () => {
    const user = userEvent.setup();
    const onFollowChange = vi.fn();
    const active = tutorialTranscript.segments[3];
    if (!active) throw new Error('Fixture segment missing.');
    render(
      <TranscriptPanel
        activeSegmentId={active.id}
        onFollowChange={onFollowChange}
        state={readyTranscriptState()}
      />,
    );

    const list = screen.getByRole('list');
    fireEvent.wheel(list);
    expect(screen.getByRole('button', { name: 'Resume follow' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Resume follow' }));
    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(onFollowChange).toHaveBeenLastCalledWith(true);
  });

  it('keeps the two-hour fixture searchable and rendered as one accessible list', async () => {
    const user = userEvent.setup();
    render(<TranscriptPanel state={readyTranscriptState(podcastTranscript)} />);

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(720);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search transcript' }),
      'segment 720',
    );
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });
});
