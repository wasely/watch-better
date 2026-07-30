import type {
  TranscriptDocument,
  TranscriptSegment,
  TranscriptSegmentId,
} from '@/features/transcript/domain';

export const formatTimestamp = (seconds: number): string => {
  const wholeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainder
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

const normalizedSearchText = (value: string): string =>
  value.normalize('NFKC').toLocaleLowerCase();

export const findTranscriptMatches = (
  segments: readonly TranscriptSegment[],
  query: string,
): readonly number[] => {
  const normalizedQuery = normalizedSearchText(query.trim());
  if (!normalizedQuery) return [];

  const matches: number[] = [];
  segments.forEach((segment, index) => {
    if (normalizedSearchText(segment.text).includes(normalizedQuery))
      matches.push(index);
  });
  return matches;
};

export const formatTranscriptForClipboard = (
  document: TranscriptDocument,
  selectedIds?: ReadonlySet<TranscriptSegmentId>,
): string => {
  const segments = selectedIds
    ? document.segments.filter((segment) => selectedIds.has(segment.id))
    : document.segments;
  const header = `${document.videoTitle}\nhttps://www.youtube.com/watch?v=${encodeURIComponent(
    document.videoId,
  )}`;
  const rows = segments.map(
    (segment) => `${formatTimestamp(segment.startSeconds)} — ${segment.text.trim()}`,
  );

  return [header, '', ...rows].join('\n');
};

export const findActiveSegmentIndex = (
  segments: readonly TranscriptSegment[],
  currentTimeSeconds: number,
): number => {
  let low = 0;
  let high = segments.length - 1;
  let candidate = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const segment = segments[middle];
    if (!segment) break;

    if (segment.startSeconds <= currentTimeSeconds) {
      candidate = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (candidate < 0) return -1;
  const segment = segments[candidate];
  return segment && currentTimeSeconds < segment.endSeconds ? candidate : -1;
};
