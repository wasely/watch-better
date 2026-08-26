import { describe, expect, it, vi } from 'vitest';

import type { PlaybackSnapshot } from '@/adapters/youtube/playback-controller';

import type { DetachedVideoContext } from './detached-video';
import { DetachedPageController, DetachedPlaybackController } from './detached-video';

const context = (videoId: string): DetachedVideoContext => ({
  videoId,
  videoKind: 'watch',
  videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  videoTitle: `Video ${videoId}`,
  generation: 3,
  provider: 'gemini',
});

describe('detached video controllers', () => {
  it('pins every floating card to its own video snapshot', () => {
    const first = new DetachedPageController(context('first'));
    const second = new DetachedPageController(context('second'));

    expect(first.snapshot).toMatchObject({ videoId: 'first', generation: 3 });
    expect(second.snapshot.videoId).toBe('second');
    expect(first.snapshot.url).not.toBe(second.snapshot.url);
  });

  it('stays inert when this tab is not showing the card video', () => {
    const resolve = vi.fn(() => null);
    const playback = new DetachedPlaybackController(context('first'), resolve);

    playback.seek(42.9);

    expect(resolve).toHaveBeenCalledWith('first');
    expect(playback.snapshot.supported).toBe(false);
  });

  it('seeks the live player when this tab is showing the card video', () => {
    const live = {
      snapshot: {
        currentTimeSeconds: 5,
        durationSeconds: 100,
        playbackRate: 1,
        paused: false,
        adActive: false,
        supported: true,
      },
      seek: vi.fn(),
      subscribe: vi.fn((listener: (snapshot: PlaybackSnapshot) => void) => {
        listener(live.snapshot);
        return () => undefined;
      }),
      dispose: vi.fn(),
    };
    const playback = new DetachedPlaybackController(context('first'), () => live);

    playback.seek(42.9);

    expect(live.seek).toHaveBeenCalledWith(42.9);
    expect(playback.snapshot.supported).toBe(true);
  });

  it('never disposes the live player it borrowed', () => {
    const unsubscribe = vi.fn();
    const live = {
      snapshot: {
        currentTimeSeconds: 0,
        durationSeconds: null,
        playbackRate: 1,
        paused: true,
        adActive: false,
        supported: true,
      },
      seek: vi.fn(),
      subscribe: vi.fn(() => unsubscribe),
      dispose: vi.fn(),
    };
    const playback = new DetachedPlaybackController(context('first'), () => live);

    playback.dispose();

    expect(unsubscribe).toHaveBeenCalled();
    expect(live.dispose).not.toHaveBeenCalled();
  });

  it('goes inert again once the tab navigates away from the card video', () => {
    let onCardVideo = true;
    const live = {
      snapshot: {
        currentTimeSeconds: 12,
        durationSeconds: 100,
        playbackRate: 1,
        paused: false,
        adActive: false,
        supported: true,
      },
      seek: vi.fn(),
      subscribe: vi.fn((listener: (snapshot: PlaybackSnapshot) => void) => {
        listener(live.snapshot);
        return () => undefined;
      }),
      dispose: vi.fn(),
    };
    const playback = new DetachedPlaybackController(context('first'), () =>
      onCardVideo ? live : null,
    );
    expect(playback.snapshot.supported).toBe(true);

    onCardVideo = false;
    playback.refresh();
    playback.seek(30);

    expect(playback.snapshot.supported).toBe(false);
    expect(live.seek).not.toHaveBeenCalled();
  });
});
