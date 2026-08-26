import { describe, expect, it } from 'vitest';

import { applyYouTubePanelHostLayout } from './youtube-panel-layout';

describe('YouTube panel host layout', () => {
  it('keeps the current Shorts fallback bounded as a fixed right dock', () => {
    const host = document.createElement('watchbetter-panel');

    applyYouTubePanelHostLayout(
      host,
      document.body,
      'https://www.youtube.com/shorts/example',
      document,
    );

    expect(host.dataset.watchbetterShortsDock).toBe('true');
    expect(host.style.display).toBe('block');
    expect(host.style.position).toBe('fixed');
    expect(host.style.top).toContain('9dvh');
    expect(host.style.right).toBe('16px');
    expect(host.style.width).toContain('420px');
    expect(host.style.width).toContain('100vw');
    expect(host.style.maxHeight).toContain('100dvh');
    expect(host.style.getPropertyValue('--watchbetter-player-height')).toContain(
      '100dvh',
    );
    expect(host.style.zIndex).toBe('2147483000');
    expect(host.style.getPropertyPriority('position')).toBe('important');
    expect(host.style.getPropertyPriority('display')).toBe('important');
    expect(host.style.getPropertyPriority('width')).toBe('important');
  });

  it('resets to normal-flow sizing when the panel returns to a watch page', () => {
    const host = document.createElement('watchbetter-panel');
    const rail = document.createElement('div');
    applyYouTubePanelHostLayout(
      host,
      document.body,
      'https://www.youtube.com/shorts/example',
      document,
    );

    applyYouTubePanelHostLayout(
      host,
      rail,
      'https://www.youtube.com/watch?v=example',
      document,
    );

    expect(host.dataset.watchbetterShortsDock).toBeUndefined();
    expect(host.style.display).toBe('');
    expect(host.style.position).toBe('');
    expect(host.style.maxHeight).toBe('');
    expect(host.style.getPropertyValue('--watchbetter-player-height')).toBe('');
    expect(host.style.width).toBe('100%');
    expect(host.style.marginBottom).toBe('12px');
  });

  it('excludes the injected panel from YouTube page scroll anchoring', () => {
    const host = document.createElement('watchbetter-panel');
    const rail = document.createElement('div');

    applyYouTubePanelHostLayout(
      host,
      rail,
      'https://www.youtube.com/watch?v=example',
      document,
    );

    expect(host.style.overflowAnchor).toBe('none');
    expect(host.style.getPropertyPriority('overflow-anchor')).toBe('important');
  });
});
