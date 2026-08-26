export interface ExtensionMessageSender {
  readonly frameId?: number | undefined;
  readonly url?: string | undefined;
  readonly tab?:
    | {
        readonly id?: number | undefined;
        readonly url?: string | undefined;
      }
    | undefined;
}

const isYouTubeUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.youtube.com';
  } catch {
    return false;
  }
};

export const youtubeTopFrameTabId = (sender: ExtensionMessageSender): number | null =>
  sender.frameId === 0 &&
  typeof sender.tab?.id === 'number' &&
  isYouTubeUrl(sender.tab.url) &&
  isYouTubeUrl(sender.url)
    ? sender.tab.id
    : null;

export const isTrustedControlSender = (
  sender: ExtensionMessageSender,
  extensionBaseUrl: string,
): boolean => {
  if (youtubeTopFrameTabId(sender) !== null) return true;
  if (sender.tab) return false;
  try {
    const source = new URL(sender.url ?? '');
    const extension = new URL(extensionBaseUrl);
    return (
      source.protocol === extension.protocol && source.hostname === extension.hostname
    );
  } catch {
    return false;
  }
};
