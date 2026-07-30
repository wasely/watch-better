import { describe, expect, it, vi } from 'vitest';

import {
  extractInnertubeApiKey,
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

  it('extracts the public Innertube API key', () => {
    expect(
      extractInnertubeApiKey('ytcfg.set({"INNERTUBE_API_KEY":"public-key"});'),
    ).toBe('public-key');
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

  it('invokes browser fetch with its Window receiver', async () => {
    history.replaceState({}, '', '/watch?v=video-2');
    const script = document.createElement('script');
    script.textContent = `var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: { videoId: 'video-2', title: 'Bound fetch' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=video-2&lang=en',
              languageCode: 'en',
              name: { simpleText: 'English' },
              vssId: '.en',
            },
          ],
        },
      },
    })};`;
    document.head.append(script);
    const receivers: unknown[] = [];
    const receiverSensitiveFetch = function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            events: [
              {
                tStartMs: 0,
                dDurationMs: 1_000,
                segs: [{ utf8: 'Bound fetch works.' }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    } as typeof fetch;
    const provider = new YouTubeTranscriptProvider(document, receiverSensitiveFetch);
    const signal = new AbortController().signal;

    const tracks = await provider.listTracks('video-2', signal);
    await provider.load({ videoId: 'video-2', trackId: tracks[0]?.id ?? null }, signal);

    expect(receivers).toEqual([window]);
  });

  it('falls back to Android player captions when the web track is empty', async () => {
    history.replaceState({}, '', '/watch?v=video-3');
    const script = document.createElement('script');
    script.textContent = `var ytcfg = { set: function () {} }; ytcfg.set({"INNERTUBE_API_KEY":"public-key"}); var ytInitialPlayerResponse = ${JSON.stringify(
      {
        videoDetails: { videoId: 'video-3', title: 'Fallback video' },
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                baseUrl: 'https://www.youtube.com/api/timedtext?client=web',
                languageCode: 'en',
                name: { simpleText: 'English' },
                vssId: 'a.en',
                kind: 'asr',
              },
            ],
          },
        },
      },
    )};`;
    document.head.append(script);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            videoDetails: { videoId: 'video-3', title: 'Fallback video' },
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl: 'https://www.youtube.com/api/timedtext?client=android',
                    languageCode: 'en',
                    name: { simpleText: 'English' },
                    vssId: 'a.en',
                    kind: 'asr',
                  },
                ],
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          '<?xml version="1.0"?><transcript><text start="1" dur="2">Fallback works.</text></transcript>',
          { status: 200 },
        ),
      );
    const provider = new YouTubeTranscriptProvider(document, fetchMock);
    const signal = new AbortController().signal;

    const tracks = await provider.listTracks('video-3', signal);
    const transcript = await provider.load(
      { videoId: 'video-3', trackId: tracks[0]?.id ?? null },
      signal,
    );

    expect(transcript.segments[0]?.text).toBe('Fallback works.');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/youtubei/v1/player');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('client=android');
  });
});
