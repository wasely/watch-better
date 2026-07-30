import { describe, expect, it } from 'vitest';

import {
  isYouTubeWatchUrl,
  placeYouTubePanelFirst,
  resolveYouTubeMountTarget,
} from './youtube-mount';

describe('YouTube mount selection', () => {
  it('accepts only watch URLs with a video id', () => {
    expect(isYouTubeWatchUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isYouTubeWatchUrl('https://www.youtube.com/watch')).toBe(false);
    expect(isYouTubeWatchUrl('https://www.youtube.com/results?v=abc')).toBe(false);
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
    const panel = document.createElement('cutthrough-panel');
    const vidiq = document.createElement('div');
    target.append(panel);
    target.prepend(vidiq);

    placeYouTubePanelFirst(target, panel);

    expect(target.firstElementChild).toBe(panel);
    expect(target.lastElementChild).toBe(vidiq);
  });
});
