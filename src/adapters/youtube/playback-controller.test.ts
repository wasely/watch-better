import { afterEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('uses the video in the active Short instead of an off-screen reel', () => {
    const inactiveShort = document.createElement('ytd-reel-video-renderer');
    const inactiveVideo = videoElement(4);
    inactiveShort.append(inactiveVideo);
    const activeShort = document.createElement('ytd-reel-video-renderer');
    activeShort.setAttribute('is-active', '');
    const activeVideo = videoElement(18);
    activeShort.append(activeVideo);
    document.body.append(inactiveShort, activeShort);

    expect(
      document.querySelector(
        'ytd-reel-video-renderer[is-active] video.html5-main-video',
      ),
    ).toBe(activeVideo);

    const controller = new HtmlVideoPlaybackController(document);

    expect(controller.snapshot.currentTimeSeconds).toBe(18);
    controller.seek(24);
    expect(activeVideo.currentTime).toBe(24);
    expect(inactiveVideo.currentTime).toBe(4);
    controller.dispose();
  });

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
