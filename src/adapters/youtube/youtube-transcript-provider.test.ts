import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  extractInnertubeApiKey,
  extractYouTubePlayerResponse,
  parseJson3Transcript,
  YouTubeTranscriptProvider,
} from './youtube-transcript-provider';

afterEach(() => {
  for (const script of document.scripts) script.remove();
});

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
            { tStartMs: 89_500, dDurationMs: 5_000, segs: [{ utf8: 'Tail.' }] },
            { tStartMs: 91_000, dDurationMs: 1_000, segs: [{ utf8: 'Past end.' }] },
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
    expect(transcript.segments).toHaveLength(2);
    expect(transcript.segments[1]).toMatchObject({
      text: 'Tail.',
      startSeconds: 89.5,
      endSeconds: 90,
    });
    expect(transcript.speechRanges?.at(-1)?.endSeconds).toBe(90);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('fmt=json3');
  });

  it('exposes YouTube English translation captions for a non-English video', async () => {
    history.replaceState({}, '', '/watch?v=arabic-video');
    const script = document.createElement('script');
    script.textContent = `var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        videoId: 'arabic-video',
        title: 'Arabic source video',
        lengthSeconds: '60',
      },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=arabic-video&lang=ar',
              languageCode: 'ar',
              name: { simpleText: 'Arabic' },
              vssId: '.ar',
            },
          ],
          translationLanguages: [
            { languageCode: 'en', languageName: { simpleText: 'English' } },
          ],
        },
      },
    })};`;
    document.head.append(script);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          events: [
            {
              tStartMs: 0,
              dDurationMs: 1_000,
              segs: [{ utf8: 'English translated caption.' }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new YouTubeTranscriptProvider(document, fetchMock);
    const signal = new AbortController().signal;

    const tracks = await provider.listTracks('arabic-video', signal);
    const englishTrack = tracks.find((candidate) => candidate.languageCode === 'en');
    expect(englishTrack).toMatchObject({
      languageCode: 'en',
      languageLabel: 'English (translated)',
    });

    const transcript = await provider.load(
      { videoId: 'arabic-video', trackId: englishTrack?.id ?? null },
      signal,
    );
    expect(transcript.languageCode).toBe('en');
    expect(transcript.segments[0]?.text).toBe('English translated caption.');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('tlang=en');
  });

  it('loads caption metadata directly from the active Short', async () => {
    history.replaceState({}, '', '/shorts/short-1');
    const script = document.createElement('script');
    script.textContent = `var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: {
        videoId: 'short-1',
        title: 'Captioned Short',
        lengthSeconds: '28',
      },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=short-1&lang=en',
              languageCode: 'en',
              name: { simpleText: 'English (automatic)' },
              vssId: 'a.en',
              kind: 'asr',
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
            {
              tStartMs: 0,
              dDurationMs: 1_200,
              segs: [{ utf8: 'Short captions work.' }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new YouTubeTranscriptProvider(document, fetchMock);
    const signal = new AbortController().signal;

    const tracks = await provider.listTracks('short-1', signal);
    const transcript = await provider.load(
      { videoId: 'short-1', trackId: tracks[0]?.id ?? null },
      signal,
    );

    expect(transcript).toMatchObject({
      videoId: 'short-1',
      videoTitle: 'Captioned Short',
      durationSeconds: 28,
    });
    expect(transcript.segments[0]?.text).toBe('Short captions work.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/timedtext');
  });

  it('asks the player API for Short captions missing from page metadata', async () => {
    history.replaceState({}, '', '/shorts/short-2');
    const script = document.createElement('script');
    script.textContent = `var ytcfg = { set: function () {} }; ytcfg.set({"INNERTUBE_API_KEY":"public-key"}); var ytInitialPlayerResponse = ${JSON.stringify(
      {
        videoDetails: { videoId: 'short-2', title: 'Sparse Short' },
      },
    )};`;
    document.head.append(script);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            videoDetails: {
              videoId: 'short-2',
              title: 'Recovered Short',
              lengthSeconds: '19',
            },
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl:
                      'https://www.youtube.com/api/timedtext?v=short-2&lang=en&client=android',
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
          JSON.stringify({
            events: [
              {
                tStartMs: 500,
                dDurationMs: 1_000,
                segs: [{ utf8: 'Recovered captions.' }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const provider = new YouTubeTranscriptProvider(document, fetchMock);
    const signal = new AbortController().signal;

    const tracks = await provider.listTracks('short-2', signal);
    const transcript = await provider.load(
      { videoId: 'short-2', trackId: tracks[0]?.id ?? null },
      signal,
    );

    expect(transcript.segments[0]?.text).toBe('Recovered captions.');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/youtubei/v1/player');
    const playerRequest = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const playerPayload: unknown =
      typeof playerRequest?.body === 'string' ? JSON.parse(playerRequest.body) : null;
    expect(playerPayload).toMatchObject({
      videoId: 'short-2',
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/api/timedtext');
  });

  it('falls back to watch metadata when the Short player request fails', async () => {
    history.replaceState({}, '', '/shorts/short-3');
    const script = document.createElement('script');
    script.textContent =
      'var ytcfg = { set: function () {} }; ytcfg.set({"INNERTUBE_API_KEY":"public-key"});';
    document.head.append(script);
    const watchBootstrap = `var ytInitialPlayerResponse = ${JSON.stringify({
      videoDetails: { videoId: 'short-3', title: 'Watch fallback Short' },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: 'https://www.youtube.com/api/timedtext?v=short-3&lang=en',
              languageCode: 'en',
              name: { simpleText: 'English' },
              vssId: '.en',
            },
          ],
        },
      },
    })};`;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('player request failed'))
      .mockResolvedValueOnce(new Response(watchBootstrap, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            events: [
              {
                tStartMs: 0,
                dDurationMs: 1_000,
                segs: [{ utf8: 'Watch fallback works.' }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const provider = new YouTubeTranscriptProvider(document, fetchMock);
    const signal = new AbortController().signal;

    const tracks = await provider.listTracks('short-3', signal);
    const transcript = await provider.load(
      { videoId: 'short-3', trackId: tracks[0]?.id ?? null },
      signal,
    );

    expect(transcript.segments[0]?.text).toBe('Watch fallback works.');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/watch?v=short-3');
  });

  it('recovers Short captions through a player key found on the watch page', async () => {
    history.replaceState({}, '', '/shorts/short-4');
    const sparseWatchBootstrap = `var ytcfg = { set: function () {} }; ytcfg.set({"INNERTUBE_API_KEY":"watch-key"}); var ytInitialPlayerResponse = ${JSON.stringify(
      {
        videoDetails: { videoId: 'short-4', title: 'Sparse watch page' },
      },
    )};`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(sparseWatchBootstrap, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            videoDetails: { videoId: 'short-4', title: 'API Short' },
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl:
                      'https://www.youtube.com/api/timedtext?v=short-4&lang=es&client=android',
                    languageCode: 'es',
                    name: { simpleText: 'Spanish (automatic)' },
                    vssId: 'a.es',
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
          JSON.stringify({
            events: [
              {
                tStartMs: 250,
                dDurationMs: 1_000,
                segs: [{ utf8: 'Subtítulos recuperados.' }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const provider = new YouTubeTranscriptProvider(document, fetchMock);
    const signal = new AbortController().signal;

    const tracks = await provider.listTracks('short-4', signal);
    const transcript = await provider.load(
      { videoId: 'short-4', trackId: tracks[0]?.id ?? null },
      signal,
    );

    expect(tracks[0]).toMatchObject({ languageCode: 'es', isAutomatic: true });
    expect(transcript.segments[0]?.text).toBe('Subtítulos recuperados.');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/watch?v=short-4');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/youtubei/v1/player');
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
