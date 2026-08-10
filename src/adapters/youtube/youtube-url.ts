export type YouTubePageKind = 'watch' | 'shorts' | 'unsupported';

export interface YouTubeVideoUrl {
  readonly kind: Exclude<YouTubePageKind, 'unsupported'>;
  readonly videoId: string;
}

/** Parses the two desktop YouTube surfaces that expose a single video. */
export const parseYouTubeVideoUrl = (url: string): YouTubeVideoUrl | null => {
  try {
    const parsed = new URL(url);
    if (parsed.pathname === '/watch') {
      const videoId = parsed.searchParams.get('v');
      return videoId ? { kind: 'watch', videoId } : null;
    }

    const shortsMatch = /^\/shorts\/([^/?#]+)$/.exec(parsed.pathname);
    return shortsMatch?.[1] ? { kind: 'shorts', videoId: shortsMatch[1] } : null;
  } catch {
    return null;
  }
};

export const isSupportedYouTubeVideoUrl = (url: string): boolean => {
  try {
    return (
      new URL(url).hostname === 'www.youtube.com' && parseYouTubeVideoUrl(url) !== null
    );
  } catch {
    return false;
  }
};
