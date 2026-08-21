import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SMART_SKIP_CONFIGURATION, type SmartSkipAnalysis } from './domain';
import { SmartSkipPanel } from './SmartSkipPanel';

const analysis: SmartSkipAnalysis = {
  schemaVersion: 1,
  videoId: 'video-1',
  trackId: 'en',
  transcriptFingerprint: '12345678',
  provider: 'gemini',
  strictness: 'balanced',
  categories: DEFAULT_SMART_SKIP_CONFIGURATION.categories,
  analyzedAt: 1,
  reviewRequired: false,
  intervals: [
    {
      id: 'cut-1',
      startSegmentIndex: 1,
      endSegmentIndex: 2,
      startSeconds: 10,
      endSeconds: 20,
      category: 'sponsor',
      reason: 'Paid promotion',
      confidence: 0.96,
      enabled: true,
    },
  ],
};

const engineSnapshot = {
  state: 'ready' as const,
  timeSavedSeconds: 8,
  lastSkipped: analysis.intervals[0] ?? null,
  message: 'Skipped Paid promotion.',
};

describe('SmartSkipPanel', () => {
  it('renders the cut map and exposes undo and per-cut controls', () => {
    const onUndo = vi.fn();
    const onIntervalEnabledChange = vi.fn();
    render(
      <SmartSkipPanel
        analysisState={{ kind: 'ready', analysis, cached: false }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={engineSnapshot}
        onIntervalEnabledChange={onIntervalEnabledChange}
        onUndo={onUndo}
        transcriptAvailable
      />,
    );
    expect(screen.getByRole('region', { name: 'Video cut map' })).toBeVisible();
    expect(screen.getByText('Paid promotion')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('checkbox', { name: /Disable Sponsors cut/i }));
    expect(onIntervalEnabledChange).toHaveBeenCalledWith('cut-1', false);
  });

  it('starts immediately without captions or an AI provider', () => {
    const onEnabledChange = vi.fn();
    const { rerender } = render(
      <SmartSkipPanel
        analysisState={{ kind: 'idle' }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={null}
        engineSnapshot={{
          state: 'disabled',
          timeSavedSeconds: 0,
          lastSkipped: null,
          message: 'Playback is unchanged.',
        }}
        onEnabledChange={onEnabledChange}
        transcriptAvailable={false}
      />,
    );
    expect(screen.getByText(/Waiting for captions/i)).toBeVisible();
    expect(screen.queryByText(/Gemini|ChatGPT/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Analyze/i })).toBeNull();
    fireEvent.click(screen.getByRole('switch'));
    expect(onEnabledChange).toHaveBeenCalledWith(true);

    rerender(
      <SmartSkipPanel
        analysisState={{ kind: 'ready', analysis, cached: false }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={{
          state: 'disabled',
          timeSavedSeconds: 0,
          lastSkipped: null,
          message: 'Playback is unchanged.',
        }}
        onEnabledChange={onEnabledChange}
        transcriptAvailable
      />,
    );
    expect(screen.getByText(/Deep scan queued/i)).toBeVisible();
  });

  it('distinguishes deeper middle cuts from instant cuts', () => {
    render(
      <SmartSkipPanel
        analysisState={{
          kind: 'ready',
          analysis: {
            ...analysis,
            intervals: [
              ...analysis.intervals,
              {
                ...analysis.intervals[0]!,
                id: 'deep-1',
                startSeconds: 45,
                endSeconds: 55,
                category: 'ramble',
                reason: 'Disposable off-topic anecdote',
                source: 'deep',
              },
            ],
          },
          cached: false,
        }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={engineSnapshot}
        refinementState={{ kind: 'complete', addedCuts: 1 }}
        transcriptAvailable
      />,
    );
    expect(screen.getByText('1 deeper cut found')).toBeVisible();
    expect(screen.getByText('Disposable off-topic anecdote')).toBeVisible();
    expect(screen.getAllByText('Deep').length).toBeGreaterThan(0);
    expect(screen.getByText('Middle')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Skip intensity' })).toHaveValue(
      'balanced',
    );
  });

  it('shows an empty success state', () => {
    render(
      <SmartSkipPanel
        analysisState={{
          kind: 'ready',
          analysis: { ...analysis, intervals: [] },
          cached: true,
        }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={{
          state: 'ready',
          timeSavedSeconds: 0,
          lastSkipped: null,
          message: '0 cuts ready.',
        }}
        transcriptAvailable
      />,
    );
    expect(screen.getByText('No safe cuts found')).toBeVisible();
  });

  it('exposes deep-scan progress without relying on animation or color', () => {
    render(
      <SmartSkipPanel
        analysisState={{ kind: 'ready', analysis, cached: false }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={engineSnapshot}
        refinementState={{ kind: 'analyzing', completed: 1, total: 4 }}
        transcriptAvailable
      />,
    );

    expect(
      screen.getByRole('progressbar', { name: 'Deep scan progress' }),
    ).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('1 of 4 sections')).toBeVisible();
  });
});
