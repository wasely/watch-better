import type {
  TranscriptDocument,
  TranscriptProvider,
  TranscriptSegment,
  TranscriptTrack,
} from '@/features/transcript/domain';
import { TranscriptProviderError } from '@/features/transcript/domain';

type JsonRecord = Record<string, unknown>;

interface CaptionSource {
  readonly track: TranscriptTrack;
  readonly baseUrl: string;
  readonly preferred: boolean;
}

interface VideoSource {
  readonly videoId: string;
  readonly title: string;
  readonly durationSeconds: number | null;
  readonly captions: readonly CaptionSource[];
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordAt = (value: unknown, ...keys: string[]): JsonRecord | null => {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
};

const stringAt = (value: unknown, key: string): string | null =>
  isRecord(value) && typeof value[key] === 'string' ? value[key] : null;

const numberFrom = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const labelFrom = (value: unknown, fallback: string): string => {
  if (!isRecord(value)) return fallback;
  if (typeof value.simpleText === 'string') return value.simpleText;
  if (Array.isArray(value.runs)) {
    const label = value.runs
      .map((run) => (isRecord(run) && typeof run.text === 'string' ? run.text : ''))
      .join('')
      .trim();
    if (label) return label;
  }
  return fallback;
};

/** Extracts a balanced JSON object assigned inside YouTube's inline bootstrap. */
export const extractYouTubePlayerResponse = (source: string): JsonRecord | null => {
  const keyIndex = source.indexOf('ytInitialPlayerResponse');
  if (keyIndex < 0) return null;
  const start = source.indexOf('{', keyIndex);
  if (start < 0) return null;

  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) {
      try {
        const parsed: unknown = JSON.parse(source.slice(start, index + 1));
        return isRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
  }
  return null;
};

const cleanCaptionText = (value: string): string =>
  value
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

interface RawCue {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly text: string;
}

const sentenceSegments = (
  cues: readonly RawCue[],
  trackId: string,
): readonly TranscriptSegment[] => {
  const output: TranscriptSegment[] = [];
  let pending: RawCue | null = null;

  const flush = () => {
    if (!pending) return;
    output.push({
      id: `${trackId}:${Math.round(pending.startSeconds * 1000)}:${output.length}`,
      ...pending,
    });
    pending = null;
  };

  for (const cue of [...cues].sort(
    (left, right) => left.startSeconds - right.startSeconds,
  )) {
    if (
      !cue.text ||
      !Number.isFinite(cue.startSeconds) ||
      !Number.isFinite(cue.endSeconds) ||
      cue.startSeconds < 0 ||
      cue.endSeconds <= cue.startSeconds
    )
      continue;
    if (
      pending &&
      cue.text === pending.text &&
      Math.abs(cue.startSeconds - pending.startSeconds) < 0.1
    )
      continue;

    const separated = pending && cue.startSeconds - pending.endSeconds > 1.5;
    if (
      pending &&
      !separated &&
      pending.text.length + cue.text.length < 180 &&
      pending.endSeconds - pending.startSeconds < 8 &&
      !/[.!?…]["')\]]?$/.test(pending.text)
    ) {
      pending = {
        startSeconds: pending.startSeconds,
        endSeconds: Math.max(pending.endSeconds, cue.endSeconds),
        text: cleanCaptionText(`${pending.text} ${cue.text}`),
      };
    } else {
      flush();
      pending = cue;
    }
  }
  flush();
  return output;
};

export const parseJson3Transcript = (
  payload: unknown,
  trackId: string,
): readonly TranscriptSegment[] => {
  if (!isRecord(payload) || !Array.isArray(payload.events)) return [];
  const cues: RawCue[] = [];
  for (const event of payload.events) {
    if (!isRecord(event) || !Array.isArray(event.segs)) continue;
    const startMs = numberFrom(event.tStartMs);
    const durationMs = numberFrom(event.dDurationMs);
    if (startMs === null || durationMs === null) continue;
    const text = cleanCaptionText(
      event.segs.map((segment) => stringAt(segment, 'utf8') ?? '').join(''),
    );
    if (!text || text === '\n') continue;
    cues.push({
      startSeconds: startMs / 1000,
      endSeconds: (startMs + Math.max(1, durationMs)) / 1000,
      text,
    });
  }
  return sentenceSegments(cues, trackId);
};

export const parseXmlTranscript = (
  source: string,
  trackId: string,
): readonly TranscriptSegment[] => {
  const xml = new DOMParser().parseFromString(source, 'text/xml');
  const cues = Array.from(xml.querySelectorAll('text')).flatMap((node) => {
    const start = numberFrom(node.getAttribute('start'));
    const duration = numberFrom(node.getAttribute('dur'));
    const text = cleanCaptionText(node.textContent ?? '');
    return start === null || duration === null || !text
      ? []
      : [
          {
            startSeconds: start,
            endSeconds: start + Math.max(0.001, duration),
            text,
          },
        ];
  });
  return sentenceSegments(cues, trackId);
};

const sourceFromResponse = (
  response: JsonRecord,
  requestedVideoId: string,
): VideoSource | null => {
  const details = recordAt(response, 'videoDetails');
  const renderer = recordAt(response, 'captions', 'playerCaptionsTracklistRenderer');
  const rawTracks = renderer?.captionTracks;
  if (!Array.isArray(rawTracks)) return null;
  const defaultIndex = numberFrom(renderer?.defaultCaptionTrackIndex);

  const captions = rawTracks.flatMap((rawTrack, index): CaptionSource[] => {
    if (!isRecord(rawTrack)) return [];
    const baseUrl = stringAt(rawTrack, 'baseUrl');
    const languageCode = stringAt(rawTrack, 'languageCode');
    if (!baseUrl || !languageCode) return [];
    const isAutomatic = stringAt(rawTrack, 'kind') === 'asr';
    const vssId = stringAt(rawTrack, 'vssId') ?? `${languageCode}-${index}`;
    return [
      {
        baseUrl,
        preferred: rawTrack.isDefault === true || defaultIndex === index,
        track: {
          id: encodeURIComponent(vssId),
          languageCode,
          languageLabel: labelFrom(rawTrack.name, languageCode),
          isAutomatic,
        },
      },
    ];
  });
  if (captions.length === 0) return null;
  const ordered = [...captions].sort(
    (left, right) =>
      Number(right.preferred) - Number(left.preferred) ||
      Number(Boolean(left.track.isAutomatic)) -
        Number(Boolean(right.track.isAutomatic)),
  );
  return {
    videoId: stringAt(details, 'videoId') ?? requestedVideoId,
    title: stringAt(details, 'title') ?? document.title.replace(/\s*-\s*YouTube$/, ''),
    durationSeconds: numberFrom(details?.lengthSeconds),
    captions: ordered,
  };
};

export class YouTubeTranscriptProvider implements TranscriptProvider {
  readonly #sources = new Map<string, VideoSource>();
  readonly #fetch: typeof fetch;

  public constructor(
    private readonly documentRef: Document = document,
    fetchImpl: typeof fetch = fetch,
  ) {
    const fetchOwner = documentRef.defaultView ?? globalThis;
    this.#fetch = (...args) => Reflect.apply(fetchImpl, fetchOwner, args);
  }

  public async listTracks(
    videoId: string,
    signal: AbortSignal,
  ): Promise<readonly TranscriptTrack[]> {
    const source = await this.#loadSource(videoId, signal);
    return source.captions.map(({ track }) => track);
  }

  public async load(
    request: { readonly videoId: string; readonly trackId: string | null },
    signal: AbortSignal,
  ): Promise<TranscriptDocument> {
    const source = await this.#loadSource(request.videoId, signal);
    const caption = request.trackId
      ? source.captions.find(({ track }) => track.id === request.trackId)
      : source.captions[0];
    if (!caption)
      throw new TranscriptProviderError(
        'unavailable',
        'The requested caption track is unavailable.',
      );

    const url = new URL(caption.baseUrl);
    url.searchParams.set('fmt', 'json3');
    const response = await this.#fetch(url, {
      credentials: 'include',
      signal,
    });
    if (!response.ok)
      throw new TranscriptProviderError(
        'extraction-failed',
        `YouTube returned caption error ${response.status}.`,
      );
    const body = await response.text();
    let segments: readonly TranscriptSegment[];
    try {
      const payload: unknown = JSON.parse(body);
      segments = parseJson3Transcript(payload, caption.track.id);
    } catch {
      segments = parseXmlTranscript(body, caption.track.id);
    }
    if (segments.length === 0)
      throw new TranscriptProviderError(
        'invalid-data',
        'YouTube returned an empty or malformed caption track.',
      );

    return {
      videoId: source.videoId,
      videoTitle: source.title,
      languageCode: caption.track.languageCode,
      languageLabel: caption.track.languageLabel,
      isAutomatic: caption.track.isAutomatic,
      durationSeconds: source.durationSeconds,
      segments,
    };
  }

  public clear(videoId?: string): void {
    if (videoId) this.#sources.delete(videoId);
    else this.#sources.clear();
  }

  async #loadSource(videoId: string, signal: AbortSignal): Promise<VideoSource> {
    const cached = this.#sources.get(videoId);
    if (cached) return cached;
    if (signal.aborted) throw signal.reason;

    let source: VideoSource | null = null;
    let metadataFound = false;
    const currentId = new URL(this.documentRef.location.href).searchParams.get('v');
    if (currentId === videoId) {
      for (const script of this.documentRef.scripts) {
        const response = extractYouTubePlayerResponse(script.textContent ?? '');
        metadataFound ||= Boolean(response);
        const candidate = response ? sourceFromResponse(response, videoId) : null;
        if (candidate?.videoId === videoId) {
          source = candidate;
          break;
        }
      }
    }

    if (!source) {
      const response = await this.#fetch(
        `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        { credentials: 'include', signal },
      );
      if (!response.ok)
        throw new TranscriptProviderError(
          'extraction-failed',
          `YouTube returned page error ${response.status}.`,
        );
      const playerResponse = extractYouTubePlayerResponse(await response.text());
      metadataFound ||= Boolean(playerResponse);
      source = playerResponse ? sourceFromResponse(playerResponse, videoId) : null;
    }
    if (!source)
      throw new TranscriptProviderError(
        metadataFound ? 'unavailable' : 'extraction-failed',
        metadataFound
          ? 'This video has no available caption tracks.'
          : 'Could not read YouTube caption metadata.',
      );
    this.#sources.set(videoId, source);
    return source;
  }
}
