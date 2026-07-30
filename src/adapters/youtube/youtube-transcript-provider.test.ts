import { describe, expect, it, vi } from 'vitest';

import {
  extractYouTubePlayerResponse,
  parseJson3Transcript,
  YouTubeTranscriptProvider,
} from './youtube-transcript-provider';

describe('YouTubeTranscriptProvider', () => {
  it('extracts balanced bootstrap JSON', () => {
    expect(
      extractYouTubePlayerResponse(
        'var ytInitialPlayerResponse = {"videoDetails":{"title":"A } title"}}; next();',
      ),
    ).toEqual({ videoDetails: { title: 'A } title' } });
  });

  it('normalizes json3 cues into stable sentence rows', () => {
    const rows = parseJson3Transcript(
      {
        events: [
          { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Hello' }] },
          { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: 'world.' }] },
          { tStartMs: 4000, dDurationMs: 1200, segs: [{ utf8: 'Next idea.' }] },
        ],
      },
      'en',
    );
    expect(rows).toEqual([
      {
        id: 'en:0:0',
        startSeconds: 0,
        endSeconds: 2,
        text: 'Hello world.',
      },
      {
        id: 'en:4000:1',
        startSeconds: 4,
        endSeconds: 5.2,
        text: 'Next idea.',
      },
    ]);
  });

  it('loads the preferred real caption URL without fabricating content', async () => {
    history.replaceState({}, '', '/watch?v=video-1');
    const script = document.createElement('script');
    script.textContent = `var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: { videoId: 'video-1', title: 'Useful video', lengthSeconds: '90' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=video-1&lang=en',
              languageCode: 'en',
              name: { simpleText: 'English' },
              vssId: '.en',
            },
          ],
        },
      },
    })};`;
    document.head.append(script);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          events: [
            { tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: 'Evidence.' }] },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new YouTubeTranscriptProvider(document, fetchMock);
    const controller = new AbortController();

    const tracks = await provider.listTracks('video-1', controller.signal);
    const transcript = await provider.load(
      { videoId: 'video-1', trackId: tracks[0]?.id ?? null },
      controller.signal,
    );

    expect(tracks[0]).toMatchObject({ languageCode: 'en', isAutomatic: false });
    expect(transcript).toMatchObject({
      videoId: 'video-1',
      videoTitle: 'Useful video',
      durationSeconds: 90,
    });
    expect(transcript.segments[0]?.text).toBe('Evidence.');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('fmt=json3');
  });
});
