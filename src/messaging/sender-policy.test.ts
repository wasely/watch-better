import { describe, expect, it } from 'vitest';

import { isTrustedControlSender, youtubeTopFrameTabId } from './sender-policy';

const extensionOrigin = 'chrome-extension://watchbetter';

describe('extension message sender policy', () => {
  it('accepts only the top frame of a YouTube tab for panel control', () => {
    const topFrame = {
      frameId: 0,
      url: 'https://www.youtube.com/watch?v=video',
      tab: { id: 7, url: 'https://www.youtube.com/watch?v=video' },
    };

    expect(youtubeTopFrameTabId(topFrame)).toBe(7);
    expect(youtubeTopFrameTabId({ ...topFrame, frameId: 4 })).toBeNull();
    expect(
      youtubeTopFrameTabId({
        ...topFrame,
        url: 'https://gemini.google.com/app',
        frameId: 4,
      }),
    ).toBeNull();
  });

  it('allows extension pages but rejects provider frames as control senders', () => {
    expect(
      isTrustedControlSender(
        { frameId: 0, url: `${extensionOrigin}/popup.html` },
        extensionOrigin,
      ),
    ).toBe(true);
    expect(
      isTrustedControlSender(
        {
          frameId: 2,
          url: 'https://gemini.google.com/app',
          tab: { id: 7, url: 'https://www.youtube.com/watch?v=video' },
        },
        extensionOrigin,
      ),
    ).toBe(false);
  });
});
