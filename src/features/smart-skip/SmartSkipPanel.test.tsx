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
  basePlaybackRate: 1,
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
    expect(screen.getByRole('region', { name: 'Video action map' })).toBeVisible();
    expect(screen.getByText('Paid promotion')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('checkbox', { name: /Disable Sponsors jump/i }));
    expect(onIntervalEnabledChange).toHaveBeenCalledWith('cut-1', false);
  });

  it('shows safety-held actions on the map and allows preview seeking', () => {
    const onSeek = vi.fn();
    render(
      <SmartSkipPanel
        analysisState={{
          kind: 'ready',
          analysis: {
            ...analysis,
            reviewRequired: true,
            intervals: [{ ...analysis.intervals[0]!, enabled: false }],
          },
          cached: false,
        }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={engineSnapshot}
        onSeek={onSeek}
        transcriptAvailable
      />,
    );

    expect(screen.getByText('Held')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Held jump Sponsors at 0:10' }));
    expect(onSeek).toHaveBeenCalledWith(10);
    expect(screen.getByText(/Safety limit reached/i)).toBeVisible();
  });

  it('reports when Smart Skip is unavailable without captions', () => {
    const onEnabledChange = vi.fn();
    const { rerender } = render(
      <SmartSkipPanel
        analysisState={{ kind: 'idle' }}
        configuration={{ ...DEFAULT_SMART_SKIP_CONFIGURATION, autoSkip: false }}
        durationSeconds={null}
        engineSnapshot={{
          state: 'disabled',
          timeSavedSeconds: 0,
          lastSkipped: null,
          basePlaybackRate: 1,
          message: 'Playback is unchanged.',
        }}
        onEnabledChange={onEnabledChange}
        transcriptAvailable={false}
      />,
    );
    expect(screen.getByText(/Waiting for captions/i)).toBeVisible();
    expect(screen.queryByText(/Gemini|ChatGPT/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Analyze/i })).toBeNull();
    const smartSkipSwitch = screen.getByRole('switch');
    expect(smartSkipSwitch).toBeDisabled();
    expect(smartSkipSwitch).toHaveTextContent('Needs captions');
    fireEvent.click(smartSkipSwitch);
    expect(onEnabledChange).not.toHaveBeenCalled();

    rerender(
      <SmartSkipPanel
        analysisState={{ kind: 'ready', analysis, cached: false }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={{
          state: 'disabled',
          timeSavedSeconds: 0,
          lastSkipped: null,
          basePlaybackRate: 1,
          message: 'Playback is unchanged.',
        }}
        onEnabledChange={onEnabledChange}
        transcriptAvailable
      />,
    );
    expect(screen.getByText(/Optional deep scan/i)).toBeVisible();
  });

  it('requires an explicit action before sharing captions for deep analysis', () => {
    const onRefinementRequest = vi.fn();
    render(
      <SmartSkipPanel
        analysisState={{ kind: 'ready', analysis, cached: false }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={engineSnapshot}
        onRefinementRequest={onRefinementRequest}
        refinementRequested={false}
        transcriptAvailable
      />,
    );

    expect(
      screen.getByText(
        /Sends bounded caption chunks to Gemini only when you start it/i,
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Start deep scan' }));
    expect(onRefinementRequest).toHaveBeenCalledOnce();
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
    expect(screen.getByText('1 deeper jump found')).toBeVisible();
    expect(screen.getByText('Disposable off-topic anecdote')).toBeVisible();
    expect(screen.getAllByText('Deep').length).toBeGreaterThan(0);
    expect(screen.getByText('Middle')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Strict' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows only jumps and states that YouTube speed is unchanged', () => {
    render(
      <SmartSkipPanel
        analysisState={{
          kind: 'ready',
          analysis: {
            ...analysis,
            intervals: analysis.intervals,
          },
          cached: false,
        }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={engineSnapshot}
        transcriptAvailable
      />,
    );

    expect(screen.getByText('YouTube speed · 1×')).toBeVisible();
    expect(screen.getByText('Never changed')).toBeVisible();
    expect(screen.getByText('10s')).toBeVisible();
    expect(screen.queryByText(/pause boost|speed up/i)).toBeNull();
    expect(screen.queryByText('Brief pause')).toBeNull();
  });

  it('uses the user speed only for wall-clock skip estimates', () => {
    render(
      <SmartSkipPanel
        analysisState={{ kind: 'ready', analysis, cached: false }}
        configuration={DEFAULT_SMART_SKIP_CONFIGURATION}
        durationSeconds={100}
        engineSnapshot={{ ...engineSnapshot, basePlaybackRate: 2 }}
        transcriptAvailable
      />,
    );

    expect(screen.getByText('YouTube speed · 2×')).toBeVisible();
    expect(screen.getByText('Never changed')).toBeVisible();
    expect(screen.getByText('5s')).toBeVisible();
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
          basePlaybackRate: 1,
          message: '0 jumps ready.',
        }}
        transcriptAvailable
      />,
    );
    expect(screen.getByText('No safe jumps found')).toBeVisible();
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
