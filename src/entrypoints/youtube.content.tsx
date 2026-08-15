import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';

import { parseYouTubeVideoUrl } from '@/adapters/youtube/youtube-url';

import {
  HtmlVideoPlaybackController,
  type PlaybackController,
} from '@/adapters/youtube/playback-controller';
import { createYouTubePlayerSizeSync } from '@/adapters/youtube/player-sizing';
import { applyYouTubePanelHostLayout } from '@/adapters/youtube/youtube-panel-layout';
import {
  isYouTubeTheaterMode,
  placeYouTubePanelFirst,
  resolveYouTubeMountTarget,
} from '@/adapters/youtube/youtube-mount';
import {
  BrowserYouTubePageController,
  type YouTubePageController,
} from '@/adapters/youtube/youtube-page-controller';
import { YouTubeTranscriptProvider } from '@/adapters/youtube/youtube-transcript-provider';
import {
  WatchBetterRuntime,
  type WatchBetterRuntimeControls,
} from '@/app/WatchBetterRuntime';
import {
  DetachedPageController,
  DetachedPlaybackController,
  type DetachedVideoContext,
} from '@/features/detach/detached-video';
import {
  clampFloatingPosition,
  clampFloatingSize,
  floatingSize,
  initialFloatingPosition,
  maximizedFloatingRect,
  resizeFloatingRect,
  MINIMIZED_FLOATING_HEIGHT,
  type FloatingRect,
  type ResizeEdge,
} from '@/features/detach/floating-position';
import { isExtensionRequest, type ExtensionResponse } from '@/messaging/messages';

const currentMountTarget = (): Element | null =>
  resolveYouTubeMountTarget(document, location.href);

const isTheaterMode = (): boolean => isYouTubeTheaterMode(document);

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    interface FloatingControls {
      setMinimized(next: boolean): void;
      toggleMaximized(): void;
    }
    interface MountedRuntime {
      readonly root: Root;
      readonly shadow: ShadowRoot;
      pageController: YouTubePageController;
      playback: PlaybackController;
      readonly transcriptProvider: YouTubeTranscriptProvider;
      controls: WatchBetterRuntimeControls | null;
      visible: boolean;
      presentation: 'panel' | 'floating';
      theaterMode: boolean;
      videoTitle?: string;
      minimized: boolean;
      floatingControls: FloatingControls | null;
      playerSizeSync: ReturnType<typeof createYouTubePlayerSizeSync> | null;
      floatingCleanup?: () => void;
    }
    type RuntimeUi = Awaited<ReturnType<typeof createShadowRootUi<MountedRuntime>>>;

    let activeUi: RuntimeUi | null = null;
    let creatingActiveUi: Promise<RuntimeUi> | null = null;
    let scheduled = false;
    let floatingIndex = 0;
    let topZIndex = 2_147_483_000;
    /** Detached cards live on <body> and must never be re-anchored or removed by syncMount. */
    const detachedUis = new Set<RuntimeUi>();
    const MAX_UI_CREATION_ATTEMPTS = 5;
    let uiCreationFailures = 0;

    const isDetached = (ui: RuntimeUi): boolean => detachedUis.has(ui);

    /** The live player, but only while this tab is showing the card's own video. */
    const resolveLiveVideo = (videoId: string): PlaybackController | null => {
      if (parseYouTubeVideoUrl(location.href)?.videoId !== videoId) return null;
      const panel = activeUi?.mounted;
      return panel && panel.presentation === 'panel' ? panel.playback : null;
    };

    const syncHostVisibility = (ui: RuntimeUi, runtime: MountedRuntime) => {
      const fullscreen = Boolean(document.fullscreenElement);
      const visible =
        runtime.visible && (runtime.presentation === 'floating' || !fullscreen);
      ui.shadowHost.style.display = visible ? 'block' : 'none';
    };

    const renderRuntime = (ui: RuntimeUi, runtime: MountedRuntime) => {
      runtime.root.render(
        <StrictMode>
          <WatchBetterRuntime
            onAskFocusChange={(focused) => {
              ui.shadowHost.toggleAttribute('data-watchbetter-focus', focused);
            }}
            {...(runtime.presentation === 'panel'
              ? {
                  onControls: (next: WatchBetterRuntimeControls | null) => {
                    runtime.controls = next;
                  },
                  onDetach: (context: DetachedVideoContext) =>
                    detachRuntime(ui, runtime, context),
                }
              : {
                  onClose: () => ui.remove(),
                  minimized: runtime.minimized,
                  onMinimizedChange: (next: boolean) =>
                    runtime.floatingControls?.setMinimized(next),
                  onToggleMaximized: () => runtime.floatingControls?.toggleMaximized(),
                  ...(runtime.videoTitle ? { videoTitle: runtime.videoTitle } : {}),
                })}
            onVisibilityChange={(visible) => {
              runtime.visible = visible;
              syncHostVisibility(ui, runtime);
            }}
            pageController={runtime.pageController}
            playback={runtime.playback}
            presentation={runtime.presentation}
            theaterMode={runtime.presentation === 'panel' && runtime.theaterMode}
            transcriptProvider={runtime.transcriptProvider}
          />
        </StrictMode>,
      );
    };

    const RESIZE_EDGES: readonly ResizeEdge[] = [
      'n',
      's',
      'e',
      'w',
      'ne',
      'nw',
      'se',
      'sw',
    ];
    const HANDLE_THICKNESS = 8;
    const HANDLE_CORNER = 16;

    const handleStyle = (edge: ResizeEdge): string => {
      const corner = `${HANDLE_CORNER}px`;
      const thickness = `${HANDLE_THICKNESS}px`;
      const base = 'position:absolute;pointer-events:auto;touch-action:none;';
      switch (edge) {
        case 'n':
          return `${base}top:0;left:${corner};right:${corner};height:${thickness};cursor:ns-resize;`;
        case 's':
          return `${base}bottom:0;left:${corner};right:${corner};height:${thickness};cursor:ns-resize;`;
        case 'w':
          return `${base}left:0;top:${corner};bottom:${corner};width:${thickness};cursor:ew-resize;`;
        case 'e':
          return `${base}right:0;top:${corner};bottom:${corner};width:${thickness};cursor:ew-resize;`;
        case 'nw':
          return `${base}top:0;left:0;width:${corner};height:${corner};cursor:nwse-resize;`;
        case 'se':
          return `${base}bottom:0;right:0;width:${corner};height:${corner};cursor:nwse-resize;`;
        case 'ne':
          return `${base}top:0;right:0;width:${corner};height:${corner};cursor:nesw-resize;`;
        case 'sw':
          return `${base}bottom:0;left:0;width:${corner};height:${corner};cursor:nesw-resize;`;
      }
    };

    /** Gives a detached card real window behaviour: move, resize, minimize, maximize. */
    const makeFloating = (ui: RuntimeUi, runtime: MountedRuntime): FloatingControls => {
      const host = ui.shadowHost;
      const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
      const size = floatingSize(window.innerWidth, window.innerHeight);
      let rect: FloatingRect = {
        ...size,
        ...initialFloatingPosition(
          floatingIndex++,
          size,
          window.innerWidth,
          window.innerHeight,
        ),
      };
      /** Rect to return to when un-maximizing. */
      let restoreRect: FloatingRect | null = null;
      let gesture:
        | {
            readonly kind: 'move';
            readonly pointerId: number;
            readonly offsetX: number;
            readonly offsetY: number;
          }
        | {
            readonly kind: 'resize';
            readonly pointerId: number;
            readonly edge: ResizeEdge;
            readonly startRect: FloatingRect;
            readonly startX: number;
            readonly startY: number;
          }
        | undefined;

      const bringToFront = () => {
        topZIndex += 1;
        host.style.setProperty('z-index', String(topZIndex), 'important');
      };

      const applyRect = () => {
        const height = runtime.minimized ? MINIMIZED_FLOATING_HEIGHT : rect.height;
        host.style.setProperty('left', `${rect.left}px`, 'important');
        host.style.setProperty('top', `${rect.top}px`, 'important');
        host.style.setProperty('width', `${rect.width}px`, 'important');
        host.style.setProperty('height', `${height}px`, 'important');
      };

      const handles = document.createElement('div');
      handles.dataset.watchbetterResizeHandles = 'true';
      handles.style.cssText =
        'position:absolute;inset:0;pointer-events:none;z-index:2147483647;';
      for (const edge of RESIZE_EDGES) {
        const handle = document.createElement('div');
        handle.dataset.watchbetterResizeEdge = edge;
        handle.style.cssText = handleStyle(edge);
        handle.addEventListener('pointerdown', (event: PointerEvent) => {
          if (event.button !== 0 || runtime.minimized) return;
          bringToFront();
          gesture = {
            kind: 'resize',
            pointerId: event.pointerId,
            edge,
            startRect: rect,
            startX: event.clientX,
            startY: event.clientY,
          };
          handle.setPointerCapture?.(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
        });
        handles.append(handle);
      }
      runtime.shadow.append(handles);

      const setHandlesVisible = (visible: boolean) => {
        handles.style.display = visible ? '' : 'none';
      };

      const isDraggableTarget = (event: PointerEvent): boolean => {
        const path = event.composedPath();
        const overHeader = path.some(
          (target) =>
            target instanceof HTMLElement && target.classList.contains('ct-header'),
        );
        const overControl = path.some(
          (target) =>
            target instanceof HTMLElement &&
            ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName),
        );
        return overHeader && !overControl;
      };

      const onPointerDown = (event: PointerEvent) => {
        bringToFront();
        if (event.button !== 0 || !isDraggableTarget(event)) return;
        const bounds = host.getBoundingClientRect();
        gesture = {
          kind: 'move',
          pointerId: event.pointerId,
          offsetX: event.clientX - bounds.left,
          offsetY: event.clientY - bounds.top,
        };
        host.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      };

      const onDoubleClick = (event: MouseEvent) => {
        const path = event.composedPath();
        const overHeader = path.some(
          (target) =>
            target instanceof HTMLElement && target.classList.contains('ct-header'),
        );
        const overControl = path.some(
          (target) => target instanceof HTMLElement && target.tagName === 'BUTTON',
        );
        if (!overHeader || overControl) return;
        controls.toggleMaximized();
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const { width: viewportWidth, height: viewportHeight } = viewport();
        if (gesture.kind === 'move') {
          const height = runtime.minimized ? MINIMIZED_FLOATING_HEIGHT : rect.height;
          rect = {
            ...rect,
            ...clampFloatingPosition(
              {
                left: event.clientX - gesture.offsetX,
                top: event.clientY - gesture.offsetY,
              },
              { width: rect.width, height },
              viewportWidth,
              viewportHeight,
            ),
          };
        } else {
          rect = resizeFloatingRect(
            gesture.startRect,
            gesture.edge,
            event.clientX - gesture.startX,
            event.clientY - gesture.startY,
            viewportWidth,
            viewportHeight,
          );
          // A manual resize means the card is no longer "maximized".
          restoreRect = null;
        }
        applyRect();
      };

      const onPointerUp = (event: PointerEvent) => {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        gesture = undefined;
        host.releasePointerCapture?.(event.pointerId);
      };

      /** Keep the card on screen after a viewport change without discarding its size. */
      const onViewportResize = () => {
        const { width: viewportWidth, height: viewportHeight } = viewport();
        if (restoreRect) {
          rect = maximizedFloatingRect(viewportWidth, viewportHeight);
        } else {
          const size = clampFloatingSize(rect, viewportWidth, viewportHeight);
          rect = {
            ...size,
            ...clampFloatingPosition(rect, size, viewportWidth, viewportHeight),
          };
        }
        applyRect();
      };

      const controls: FloatingControls = {
        setMinimized(next) {
          if (runtime.minimized === next) return;
          runtime.minimized = next;
          setHandlesVisible(!next);
          const { width: viewportWidth, height: viewportHeight } = viewport();
          rect = {
            ...rect,
            ...clampFloatingPosition(
              rect,
              {
                width: rect.width,
                height: next ? MINIMIZED_FLOATING_HEIGHT : rect.height,
              },
              viewportWidth,
              viewportHeight,
            ),
          };
          applyRect();
          renderRuntime(ui, runtime);
        },
        toggleMaximized() {
          const { width: viewportWidth, height: viewportHeight } = viewport();
          if (restoreRect) {
            rect = {
              ...clampFloatingSize(restoreRect, viewportWidth, viewportHeight),
              ...clampFloatingPosition(
                restoreRect,
                restoreRect,
                viewportWidth,
                viewportHeight,
              ),
            };
            restoreRect = null;
          } else {
            restoreRect = rect;
            rect = maximizedFloatingRect(viewportWidth, viewportHeight);
          }
          if (runtime.minimized) {
            runtime.minimized = false;
            setHandlesVisible(true);
            renderRuntime(ui, runtime);
          }
          applyRect();
        },
      };

      delete host.dataset.watchbetterShortsDock;
      host.dataset.watchbetterFloating = 'true';
      host.style.removeProperty('display');
      host.style.removeProperty('right');
      host.style.setProperty('position', 'fixed', 'important');
      host.style.setProperty('margin', '0', 'important');
      host.style.setProperty('max-width', 'calc(100vw - 32px)', 'important');
      host.style.setProperty('max-height', 'calc(100vh - 32px)', 'important');
      host.style.setProperty('min-width', '0', 'important');
      host.style.setProperty('pointer-events', 'auto', 'important');
      bringToFront();
      applyRect();
      host.addEventListener('pointerdown', onPointerDown);
      host.addEventListener('dblclick', onDoubleClick);
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onPointerUp, true);
      window.addEventListener('resize', onViewportResize);

      runtime.floatingCleanup = () => {
        handles.remove();
        host.removeEventListener('pointerdown', onPointerDown);
        host.removeEventListener('dblclick', onDoubleClick);
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', onPointerUp, true);
        window.removeEventListener('pointercancel', onPointerUp, true);
        window.removeEventListener('resize', onViewportResize);
      };

      return controls;
    };

    const createRuntimeUi = async (): Promise<RuntimeUi> => {
      const ui = await createShadowRootUi<MountedRuntime>(ctx, {
        name: 'watchbetter-panel',
        position: 'inline',
        anchor: currentMountTarget,
        append: 'first',
        inheritStyles: true,
        isolateEvents: true,
        onMount(container, shadow, host) {
          // Floating cards give the host an explicit height. Carry it through WXT's
          // inner mount container so the panel body and embedded AI frame can use the
          // same full-height layout they have in the YouTube sidebar.
          container.style.height = '100%';
          container.style.minHeight = '0';
          host.dataset.watchbetterRoot = 'true';
          host.style.width = '100%';
          host.style.marginBottom = '12px';
          const target = currentMountTarget();
          if (target)
            applyYouTubePanelHostLayout(host, target, location.href, document);
          const playerSizeSync = createYouTubePlayerSizeSync(document, host);
          playerSizeSync.sync();
          const runtime: MountedRuntime = {
            root: createRoot(container),
            shadow,
            pageController: new BrowserYouTubePageController(window),
            playback: new HtmlVideoPlaybackController(document),
            transcriptProvider: new YouTubeTranscriptProvider(document, fetch),
            controls: null,
            visible: false,
            presentation: 'panel',
            theaterMode: isTheaterMode(),
            minimized: false,
            floatingControls: null,
            playerSizeSync,
          };
          renderRuntime(ui, runtime);
          return runtime;
        },
        onRemove(runtime) {
          ui.shadowHost.removeAttribute('data-watchbetter-focus');
          detachedUis.delete(ui);
          runtime?.floatingCleanup?.();
          runtime?.root.unmount();
          runtime?.playback.dispose();
          runtime?.pageController.dispose();
          runtime?.playerSizeSync?.dispose();
          if (activeUi === ui) activeUi = null;
        },
      });
      return ui;
    };

    /**
     * Creating the shadow-root UI fetches the web-accessible stylesheet, which can fail
     * transiently. A swallowed rejection here used to leave the panel permanently
     * unmounted, so retry with backoff and report the reason instead of failing silent.
     */
    const ensureActiveUi = async (): Promise<RuntimeUi | null> => {
      if (activeUi) return activeUi;
      if (!creatingActiveUi) creatingActiveUi = createRuntimeUi();
      try {
        activeUi = await creatingActiveUi;
        uiCreationFailures = 0;
        return activeUi;
      } catch (error) {
        uiCreationFailures += 1;
        console.warn(
          `[watchbetter] could not create the panel (attempt ${uiCreationFailures})`,
          error,
        );
        if (uiCreationFailures <= MAX_UI_CREATION_ATTEMPTS)
          window.setTimeout(scheduleSync, uiCreationFailures * 500);
        return null;
      } finally {
        creatingActiveUi = null;
      }
    };

    async function detachRuntime(
      ui: RuntimeUi,
      runtime: MountedRuntime,
      context: DetachedVideoContext,
    ): Promise<void> {
      if (activeUi !== ui || runtime.presentation !== 'panel') return;
      const body = document.body as HTMLBodyElement & {
        moveBefore?: (node: Node, child: Node | null) => void;
      };
      if (typeof body.moveBefore !== 'function')
        throw new Error('State-preserving detach requires Chrome 133 or newer.');

      const previousPageController = runtime.pageController;
      const previousPlayback = runtime.playback;
      runtime.playerSizeSync?.dispose();
      runtime.playerSizeSync = null;
      // Flip presentation first so resolveLiveVideo cannot bind to the controller
      // this detach is about to dispose.
      runtime.presentation = 'floating';
      detachedUis.add(ui);
      runtime.pageController = new DetachedPageController(context);
      const detachedPlayback = new DetachedPlaybackController(
        context,
        resolveLiveVideo,
      );
      runtime.playback = detachedPlayback;
      runtime.videoTitle = context.videoTitle;
      runtime.controls = null;

      flushSync(() => renderRuntime(ui, runtime));
      previousPageController.dispose();
      previousPlayback.dispose();
      runtime.floatingControls = makeFloating(ui, runtime);
      body.moveBefore(ui.shadowHost, null);
      syncHostVisibility(ui, runtime);

      activeUi = null;
      await ensureActiveUi();
      // The replacement panel now owns the live player, so re-resolve against it.
      detachedPlayback.refresh();
      scheduleSync();
    }

    const syncMount = () => {
      scheduled = false;
      // Detached cards are independent of the page's mount target: they keep their
      // own video, position and size while the viewer browses on to other videos.
      for (const detached of detachedUis) {
        const playback = detached.mounted?.playback;
        if (playback instanceof DetachedPlaybackController) playback.refresh();
      }

      const ui = activeUi;
      if (!ui) {
        void ensureActiveUi().then((next) => {
          if (next) scheduleSync();
        });
        return;
      }
      const target = currentMountTarget();
      if (!target) {
        if (ui.shadowHost.isConnected) ui.remove();
        return;
      }
      if (isDetached(ui)) return;
      if (!ui.shadowHost.isConnected) ui.mount();
      else {
        placeYouTubePanelFirst(target, ui.shadowHost);
        applyYouTubePanelHostLayout(ui.shadowHost, target, location.href, document);
      }
      const runtime = ui.mounted;
      if (!runtime) return;
      runtime.playerSizeSync?.sync();
      const theaterMode = isTheaterMode();
      if (runtime.theaterMode !== theaterMode) {
        runtime.theaterMode = theaterMode;
        renderRuntime(ui, runtime);
      }
      syncHostVisibility(ui, runtime);
    };

    function scheduleSync() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(syncMount);
    }

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

    const onMessage = async (
      message: unknown,
    ): Promise<ExtensionResponse | undefined> => {
      if (!isExtensionRequest(message)) return undefined;
      const ui = activeUi;
      const runtime = ui?.mounted;
      if (message.type === 'panel:get-status')
        return {
          ok: true,
          type: 'panel:status',
          mounted: Boolean(
            ui?.shadowHost.isConnected &&
            runtime?.visible &&
            runtime.controls?.isMounted(),
          ),
        };
      if (message.type === 'panel:restore') {
        if (!runtime?.controls)
          return {
            ok: false,
            type: 'error',
            message: 'Watch Better is still loading on this page.',
          };
        try {
          await runtime.controls.restore();
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

    await ensureActiveUi();
    scheduleSync();
    ctx.onInvalidated(() => {
      observer.disconnect();
      for (const event of ['yt-navigate-finish', 'yt-page-data-updated'])
        document.removeEventListener(event, scheduleSync);
      document.removeEventListener('fullscreenchange', scheduleSync);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      browser.runtime.onMessage.removeListener(onMessage);
    });
  },
});
