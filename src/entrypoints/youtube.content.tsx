import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';

import { HtmlVideoPlaybackController } from '@/adapters/youtube/playback-controller';
import {
  isYouTubeTheaterMode,
  placeYouTubePanelFirst,
  resolveYouTubeMountTarget,
} from '@/adapters/youtube/youtube-mount';
import { BrowserYouTubePageController } from '@/adapters/youtube/youtube-page-controller';
import { YouTubeTranscriptProvider } from '@/adapters/youtube/youtube-transcript-provider';
import {
  CutThroughRuntime,
  type CutThroughRuntimeControls,
} from '@/app/CutThroughRuntime';
import { isExtensionRequest, type ExtensionResponse } from '@/messaging/messages';

const currentMountTarget = (): Element | null =>
  resolveYouTubeMountTarget(document, location.href);

const isTheaterMode = (): boolean => isYouTubeTheaterMode(document);

interface MountedRuntime {
  readonly root: Root;
  readonly pageController: BrowserYouTubePageController;
  readonly playback: HtmlVideoPlaybackController;
  readonly transcriptProvider: YouTubeTranscriptProvider;
}

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let controls: CutThroughRuntimeControls | null = null;
    let runtimeVisible = false;
    let mounted: MountedRuntime | null = null;
    let scheduled = false;
    let lastTheaterMode = isTheaterMode();

    const renderRuntime = () => {
      if (!mounted) return;
      mounted.root.render(
        <StrictMode>
          <CutThroughRuntime
            onControls={(next) => {
              controls = next;
            }}
            onVisibilityChange={(visible) => {
              runtimeVisible = visible;
              syncHostVisibility();
            }}
            pageController={mounted.pageController}
            playback={mounted.playback}
            theaterMode={isTheaterMode()}
            transcriptProvider={mounted.transcriptProvider}
          />
        </StrictMode>,
      );
    };

    const syncHostVisibility = () => {
      const fullscreen = Boolean(document.fullscreenElement);
      ui.shadowHost.style.display = runtimeVisible && !fullscreen ? 'block' : 'none';
    };

    const ui = await createShadowRootUi<MountedRuntime>(ctx, {
      name: 'cutthrough-panel',
      position: 'inline',
      anchor: currentMountTarget,
      append: 'first',
      isolateEvents: true,
      onMount(container, _shadow, host) {
        host.dataset.cutthroughRoot = 'true';
        host.style.width = '100%';
        host.style.marginBottom = '12px';
        const runtime: MountedRuntime = {
          root: createRoot(container),
          pageController: new BrowserYouTubePageController(window),
          playback: new HtmlVideoPlaybackController(document),
          transcriptProvider: new YouTubeTranscriptProvider(document, fetch),
        };
        mounted = runtime;
        lastTheaterMode = isTheaterMode();
        renderRuntime();
        return runtime;
      },
      onRemove(runtime) {
        controls = null;
        runtimeVisible = false;
        runtime?.root.unmount();
        runtime?.playback.dispose();
        runtime?.pageController.dispose();
        mounted = null;
      },
    });

    const syncMount = () => {
      scheduled = false;
      const target = currentMountTarget();
      if (!target) {
        if (ui.shadowHost.isConnected) ui.remove();
        return;
      }
      if (!ui.shadowHost.isConnected) ui.mount();
      else placeYouTubePanelFirst(target, ui.shadowHost);
      const theaterMode = isTheaterMode();
      if (mounted && theaterMode !== lastTheaterMode) {
        lastTheaterMode = theaterMode;
        renderRuntime();
      }
      syncHostVisibility();
    };

    const scheduleSync = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(syncMount);
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['theater'],
      childList: true,
      subtree: true,
    });
    for (const event of ['yt-navigate-finish', 'yt-page-data-updated'])
      document.addEventListener(event, scheduleSync);
    document.addEventListener('fullscreenchange', scheduleSync);

    // Content scripts receive tab-targeted messages from the background worker.
    const onMessage = async (
      message: unknown,
    ): Promise<ExtensionResponse | undefined> => {
      if (!isExtensionRequest(message)) return undefined;
      if (message.type === 'panel:get-status')
        return {
          ok: true,
          type: 'panel:status',
          mounted: Boolean(
            ui.shadowHost.isConnected && runtimeVisible && controls?.isMounted(),
          ),
        };
      if (message.type === 'panel:restore') {
        if (!controls)
          return {
            ok: false,
            type: 'error',
            message: 'CutThrough is still loading on this page.',
          };
        try {
          await controls.restore();
          scheduleSync();
          return { ok: true, type: 'acknowledged' };
        } catch (error) {
          return {
            ok: false,
            type: 'error',
            message:
              error instanceof Error ? error.message : 'Could not restore panel.',
          };
        }
      }
      return undefined;
    };
    // WebExtension listeners intentionally return a promise response.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    browser.runtime.onMessage.addListener(onMessage);

    scheduleSync();
    ctx.onInvalidated(() => {
      observer.disconnect();
      for (const event of ['yt-navigate-finish', 'yt-page-data-updated'])
        document.removeEventListener(event, scheduleSync);
      document.removeEventListener('fullscreenchange', scheduleSync);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      browser.runtime.onMessage.removeListener(onMessage);
      if (ui.shadowHost.isConnected) ui.remove();
    });
  },
});
