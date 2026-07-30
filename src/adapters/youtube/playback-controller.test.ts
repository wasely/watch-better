import { describe, expect, it, vi } from 'vitest';

import { HtmlVideoPlaybackController } from './playback-controller';

const videoElement = (time: number, duration = 100) => {
  const video = document.createElement('video');
  video.className = 'html5-main-video';
  Object.defineProperty(video, 'duration', { configurable: true, value: duration });
  Object.defineProperty(video, 'paused', { configurable: true, value: false });
  video.currentTime = time;
  return video;
};

describe('HtmlVideoPlaybackController', () => {
  it('seeks, changes rate, and reconnects after video replacement', async () => {
    const first = videoElement(10);
    document.body.append(first);
    const controller = new HtmlVideoPlaybackController(document);
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.seek(30);
    controller.setPlaybackRate(2);
    expect(first.currentTime).toBe(30);
    expect(first.playbackRate).toBe(2);

    const second = videoElement(5, 200);
    first.replaceWith(second);
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.snapshot).toMatchObject({
      currentTimeSeconds: 5,
      durationSeconds: 200,
      supported: true,
    });

    first.dispatchEvent(new Event('timeupdate'));
    expect(controller.snapshot.currentTimeSeconds).toBe(5);
    expect(listener).toHaveBeenCalled();
    controller.dispose();
  });
});
