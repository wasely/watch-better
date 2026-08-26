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
    history.replaceState({}, '', '/');
  });

  it('uses the video in the active Short instead of an off-screen reel', () => {
    history.replaceState({}, '', '/shorts/active-short');
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

  it('rebinds from a retained Short to the preferred watch-page video', async () => {
    history.replaceState({}, '', '/shorts/old-short');
    const oldReel = document.createElement('ytd-reel-video-renderer');
    oldReel.setAttribute('is-active', '');
    const oldVideo = videoElement(18);
    oldReel.append(oldVideo);
    document.body.append(oldReel);
    const controller = new HtmlVideoPlaybackController(document);
    expect(controller.snapshot.currentTimeSeconds).toBe(18);

    history.pushState({}, '', '/watch?v=new-watch');
    oldReel.removeAttribute('is-active');
    const watchPlayer = document.createElement('div');
    watchPlayer.id = 'movie_player';
    watchPlayer.className = 'html5-video-player';
    const watchVideo = videoElement(5, 200);
    watchPlayer.append(watchVideo);
    document.body.append(watchPlayer);
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.snapshot).toMatchObject({
      currentTimeSeconds: 5,
      durationSeconds: 200,
      videoId: 'new-watch',
    });
    controller.seek(12);
    expect(watchVideo.currentTime).toBe(12);
    expect(oldVideo.currentTime).toBe(18);
    controller.dispose();
  });

  it('scopes ad state to the active retained Shorts player', () => {
    history.replaceState({}, '', '/shorts/active-short');
    const inactiveReel = document.createElement('ytd-reel-video-renderer');
    const inactivePlayer = document.createElement('div');
    inactivePlayer.className = 'html5-video-player ad-showing';
    inactivePlayer.append(videoElement(4));
    inactiveReel.append(inactivePlayer);

    const activeReel = document.createElement('ytd-reel-video-renderer');
    activeReel.setAttribute('is-active', '');
    const activePlayer = document.createElement('div');
    activePlayer.className = 'html5-video-player';
    activePlayer.append(videoElement(18));
    activeReel.append(activePlayer);
    document.body.append(inactiveReel, activeReel);

    const controller = new HtmlVideoPlaybackController(document);
    expect(controller.snapshot.adActive).toBe(false);
    activePlayer.classList.add('ad-showing');
    expect(controller.snapshot.adActive).toBe(true);
    controller.dispose();
  });

  it('seeks, changes rate, and reconnects after video replacement', async () => {
    const first = videoElement(10);
    document.body.append(first);
    const controller = new HtmlVideoPlaybackController(document);
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.seek(30);
    expect(first.currentTime).toBe(30);
    expect(first.playbackRate).toBe(1);

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

  it('reads live video identity from the player before the page URL', () => {
    history.replaceState({}, '', '/watch?v=url-video');
    const player = document.createElement('div') as HTMLDivElement & {
      getVideoData: () => unknown;
    };
    player.className = 'html5-video-player';
    player.getVideoData = () => ({ video_id: 'player-video' });
    player.append(videoElement(4));
    document.body.append(player);

    const controller = new HtmlVideoPlaybackController(document);
    expect(controller.snapshot.videoId).toBe('player-video');
    player.getVideoData = () => ({ video_id: 'replacement-video' });
    expect(controller.snapshot.videoId).toBe('replacement-video');
    controller.dispose();
  });

  it('uses the active Short link when no player API is exposed', () => {
    history.replaceState({}, '', '/shorts/url-short');
    const reel = document.createElement('ytd-reel-video-renderer');
    reel.setAttribute('is-active', '');
    const link = document.createElement('a');
    link.href = '/shorts/active-short';
    const video = videoElement(4);
    reel.append(link, video);
    document.body.append(reel);

    const controller = new HtmlVideoPlaybackController(document);
    expect(controller.snapshot.videoId).toBe('active-short');
    controller.dispose();
  });
});
