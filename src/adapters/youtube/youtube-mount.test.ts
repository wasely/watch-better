import { describe, expect, it } from 'vitest';

import {
  isYouTubeWatchUrl,
  placeYouTubePanelFirst,
  resolveYouTubeMountTarget,
} from './youtube-mount';

describe('YouTube mount selection', () => {
  it('accepts watch URLs and Shorts with a video id', () => {
    expect(isYouTubeWatchUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isYouTubeWatchUrl('https://www.youtube.com/shorts/abc')).toBe(true);
    expect(isYouTubeWatchUrl('https://www.youtube.com/watch')).toBe(false);
    expect(isYouTubeWatchUrl('https://www.youtube.com/results?v=abc')).toBe(false);
  });

  it('always uses the bounded dock instead of Shorts page-wide details', () => {
    document.body.innerHTML = `
      <ytd-shorts>
        <div id="shorts-container">
          <ytd-reel-video-renderer is-active>
            <div id="details"><div id="short-title">Short title</div></div>
          </ytd-reel-video-renderer>
        </div>
      </ytd-shorts>`;

    expect(
      resolveYouTubeMountTarget(document, 'https://www.youtube.com/shorts/abc'),
    ).toBe(document.body);
    expect(document.querySelector('#short-title')).toHaveTextContent('Short title');
    expect(document.querySelector('#shorts-container')).not.toBe(document.body);
  });

  it('uses the body as the Shorts dock target when no reel is rendered yet', () => {
    document.body.innerHTML = '<div id="shorts-player"></div>';

    expect(
      resolveYouTubeMountTarget(document, 'https://www.youtube.com/shorts/abc'),
    ).toBe(document.body);
  });

  it('prefers the right rail and preserves existing neighbors', () => {
    document.body.innerHTML = `
      <ytd-watch-flexy>
        <div id="secondary"><div id="secondary-inner"><div id="vidiq">Neighbor</div></div></div>
        <div id="below"></div>
      </ytd-watch-flexy>`;
    const target = resolveYouTubeMountTarget(
      document,
      'https://www.youtube.com/watch?v=abc',
    );
    expect(target).toHaveAttribute('id', 'secondary');
    expect(document.querySelector('#vidiq')).toHaveTextContent('Neighbor');
  });

  it('uses the below-player fallback in theater mode', () => {
    document.body.innerHTML = `
      <ytd-watch-flexy theater>
        <div id="secondary-inner"></div>
        <div id="below"></div>
      </ytd-watch-flexy>`;
    expect(
      resolveYouTubeMountTarget(document, 'https://www.youtube.com/watch?v=abc'),
    ).toHaveAttribute('id', 'below');
  });

  it('reclaims the first slot after another extension inserts ahead of it', () => {
    const target = document.createElement('div');
    const panel = document.createElement('watchbetter-panel');
    const vidiq = document.createElement('div');
    target.append(panel);
    target.prepend(vidiq);

    placeYouTubePanelFirst(target, panel);

    expect(target.firstElementChild).toBe(panel);
    expect(target.lastElementChild).toBe(vidiq);
  });
});
