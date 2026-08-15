import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DetachedVideoContext } from '@/features/detach/detached-video';

/**
 * Covers the mount/detach/navigation orchestration in youtube.content.tsx. The panel
 * itself is faked out so the assertions stay on the lifecycle: where hosts live, what
 * survives YouTube's SPA navigation, and that nothing ever opens a browser tab.
 */

const browserState = vi.hoisted(() => ({
  sendMessage: vi.fn(() => Promise.resolve({ ok: true, type: 'acknowledged' })),
  tabsCreate: vi.fn(),
  messageListeners: new Set<(message: unknown) => unknown>(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: browserState.sendMessage,
      onMessage: {
        addListener: (listener: (message: unknown) => unknown) =>
          browserState.messageListeners.add(listener),
        removeListener: (listener: (message: unknown) => unknown) =>
          browserState.messageListeners.delete(listener),
      },
    },
    tabs: { create: browserState.tabsCreate },
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}));

/** Captures the props the content script renders, without mounting the real panel. */
const rendered = vi.hoisted(() => ({
  onDetach: null as ((context: DetachedVideoContext) => void | Promise<void>) | null,
  onClose: null as (() => void) | null,
  onMinimizedChange: null as ((minimized: boolean) => void) | null,
  onToggleMaximized: null as (() => void) | null,
  minimized: false,
}));

vi.mock('@/app/WatchBetterRuntime', () => ({
  WatchBetterRuntime: (props: {
    presentation?: string;
    onDetach?: (context: DetachedVideoContext) => void | Promise<void>;
    onClose?: () => void;
    onVisibilityChange?: (visible: boolean) => void;
    minimized?: boolean;
    onMinimizedChange?: (minimized: boolean) => void;
    onToggleMaximized?: () => void;
  }) => {
    if (props.onDetach) rendered.onDetach = props.onDetach;
    if (props.onClose) rendered.onClose = props.onClose;
    if (props.onMinimizedChange) rendered.onMinimizedChange = props.onMinimizedChange;
    if (props.onToggleMaximized) rendered.onToggleMaximized = props.onToggleMaximized;
    if (props.presentation === 'floating')
      rendered.minimized = props.minimized ?? false;
    props.onVisibilityChange?.(true);
    return null;
  },
}));

interface FakeUi {
  shadowHost: HTMLElement;
  mounted: unknown;
  mount(): void;
  remove(): void;
}

const createdUis: FakeUi[] = [];

vi.mock('wxt/utils/content-script-ui/shadow-root', () => ({
  createShadowRootUi: vi.fn(
    (
      _ctx: unknown,
      options: {
        name: string;
        anchor: () => Element | null;
        onMount: (
          container: HTMLElement,
          shadow: ShadowRoot,
          host: HTMLElement,
        ) => unknown;
        onRemove: (mounted: unknown) => void;
      },
    ) => {
      const shadowHost = document.createElement(options.name);
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadow.append(container);
      const ui: FakeUi = {
        shadowHost,
        mounted: undefined,
        mount() {
          const anchor = options.anchor();
          if (!anchor) return;
          anchor.prepend(shadowHost);
          ui.mounted = options.onMount(container, shadow, shadowHost);
        },
        remove() {
          options.onRemove(ui.mounted);
          ui.mounted = undefined;
          shadowHost.remove();
        },
      };
      createdUis.push(ui);
      return Promise.resolve(ui);
    },
  ),
}));

const definition = vi.hoisted(() => ({
  main: null as ((ctx: unknown) => Promise<void>) | null,
}));

/** Reads through a call so the `= null` reset above does not narrow the type away. */
const takeMain = (): ((ctx: unknown) => Promise<void>) | null => definition.main;

vi.stubGlobal(
  'defineContentScript',
  (config: { main: (ctx: unknown) => Promise<void> }) => {
    definition.main = config.main;
    return config;
  },
);

const setUrl = (url: string) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL(url),
  });
};

/**
 * YouTube's SPA router swaps the markup inside its app root; it never resets
 * <body>, which is exactly why a detached card parented to <body> survives.
 */
const buildWatchPage = ({ reset = true }: { reset?: boolean } = {}) => {
  if (reset) document.body.innerHTML = '<ytd-app></ytd-app>';
  const app = document.querySelector('ytd-app') ?? document.body;
  app.innerHTML = `
    <ytd-watch-flexy>
      <div id="secondary"><div id="existing-rail-content"></div></div>
      <div id="below"></div>
    </ytd-watch-flexy>
    <video class="html5-main-video"></video>
  `;
};

const flush = async () => {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const detachedHosts = (): HTMLElement[] =>
  [...document.body.children].filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.tagName.toLowerCase() === 'watchbetter-panel',
  );

const context = (videoId: string): DetachedVideoContext => ({
  videoId,
  videoKind: 'watch',
  videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  videoTitle: `Video ${videoId}`,
  generation: 1,
  provider: 'chatgpt',
});

describe('youtube content script lifecycle', () => {
  beforeEach(async () => {
    // The shared setup's beforeAll stubs requestAnimationFrame to run synchronously,
    // which turns this script's mutation-driven resync into unbounded recursion.
    // Restore browser-like async framing.
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback) =>
        setTimeout(() => callback(0), 0) as unknown as number,
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    createdUis.length = 0;
    rendered.onDetach = null;
    rendered.onMinimizedChange = null;
    rendered.onToggleMaximized = null;
    rendered.minimized = false;
    rendered.onClose = null;
    browserState.tabsCreate.mockClear();
    setUrl('https://www.youtube.com/watch?v=first');
    buildWatchPage();
    // jsdom has no moveBefore; the real code needs it to relocate the host without
    // tearing down the embedded provider iframe.
    (
      document.body as unknown as {
        moveBefore: (node: Node, child: Node | null) => void;
      }
    ).moveBefore = (node: Node) => {
      document.body.append(node);
    };
    definition.main = null;
    vi.resetModules();
    await import('@/entrypoints/youtube.content');
    const main = takeMain();
    expect(main).not.toBeNull();
    await main?.({ onInvalidated: vi.fn(), addEventListener: vi.fn() });
    await flush();
  });

  it('mounts the panel first inside the YouTube rail', () => {
    const secondary = document.querySelector('#secondary');
    expect(secondary?.firstElementChild?.tagName.toLowerCase()).toBe(
      'watchbetter-panel',
    );
    expect(secondary?.querySelector('#existing-rail-content')).not.toBeNull();
  });

  it('moves a detached card onto the body and re-mounts a fresh panel', async () => {
    expect(rendered.onDetach).not.toBeNull();
    await rendered.onDetach?.(context('first'));
    await flush();

    const floating = detachedHosts();
    expect(floating).toHaveLength(1);
    expect(floating[0]?.dataset.watchbetterFloating).toBe('true');
    expect(floating[0]?.style.position).toBe('fixed');
    const mountContainer = floating[0]?.shadowRoot?.firstElementChild as
      HTMLElement | undefined;
    expect(mountContainer?.style.height).toBe('100%');
    expect(mountContainer?.style.minHeight).toBe('0px');

    const secondary = document.querySelector('#secondary');
    expect(secondary?.firstElementChild?.tagName.toLowerCase()).toBe(
      'watchbetter-panel',
    );
    expect(browserState.tabsCreate).not.toHaveBeenCalled();
  });

  it('keeps the detached card when YouTube navigates to another video', async () => {
    await rendered.onDetach?.(context('first'));
    await flush();
    const card = detachedHosts()[0];
    const positionBefore = [card?.style.left, card?.style.top];

    setUrl('https://www.youtube.com/watch?v=second');
    buildWatchPage({ reset: false });
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await flush();

    expect(card?.isConnected).toBe(true);
    expect(card?.parentElement).toBe(document.body);
    expect([card?.style.left, card?.style.top]).toEqual(positionBefore);
    expect(browserState.tabsCreate).not.toHaveBeenCalled();
  });

  it('supports several independent cards and closes just one', async () => {
    await rendered.onDetach?.(context('first'));
    await flush();
    await rendered.onDetach?.(context('second'));
    await flush();
    expect(detachedHosts()).toHaveLength(2);

    rendered.onClose?.();
    await flush();

    expect(detachedHosts()).toHaveLength(1);
    expect(browserState.tabsCreate).not.toHaveBeenCalled();
  });

  it('opens as a reading column, not a near-fullscreen sheet', async () => {
    await rendered.onDetach?.(context('first'));
    await flush();
    const card = detachedHosts()[0];

    expect(Number.parseInt(card?.style.width ?? '0', 10)).toBeLessThan(
      window.innerWidth * 0.4,
    );
    expect(Number.parseInt(card?.style.height ?? '0', 10)).toBeLessThan(
      window.innerHeight * 0.75,
    );
  });

  it('exposes eight resize handles inside the card shadow root', async () => {
    await rendered.onDetach?.(context('first'));
    await flush();
    const card = detachedHosts()[0];
    const edges = [
      ...(card?.shadowRoot?.querySelectorAll('[data-watchbetter-resize-edge]') ?? []),
    ].map((handle) => (handle as HTMLElement).dataset.watchbetterResizeEdge);

    expect(edges.sort()).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']);
  });

  it('minimizes to its title bar and restores to the same size', async () => {
    await rendered.onDetach?.(context('first'));
    await flush();
    const card = detachedHosts()[0];
    const fullHeight = card?.style.height;

    rendered.onMinimizedChange?.(true);
    await flush();
    expect(rendered.minimized).toBe(true);
    expect(card?.style.height).toBe('52px');
    // Handles are hidden so the title bar cannot be resized into nothing.
    const handles = card?.shadowRoot?.querySelector(
      '[data-watchbetter-resize-handles]',
    );
    expect((handles as HTMLElement | null)?.style.display).toBe('none');

    rendered.onMinimizedChange?.(false);
    await flush();
    expect(rendered.minimized).toBe(false);
    expect(card?.style.height).toBe(fullHeight);
  });

  it('maximizes to the viewport and restores the previous rect', async () => {
    await rendered.onDetach?.(context('first'));
    await flush();
    const card = detachedHosts()[0];
    const before = [
      card?.style.left,
      card?.style.top,
      card?.style.width,
      card?.style.height,
    ];

    rendered.onToggleMaximized?.();
    await flush();
    expect(card?.style.left).toBe('16px');
    expect(card?.style.width).toBe(`${window.innerWidth - 32}px`);

    rendered.onToggleMaximized?.();
    await flush();
    expect([
      card?.style.left,
      card?.style.top,
      card?.style.width,
      card?.style.height,
    ]).toEqual(before);
  });

  it('keeps a user resize when the viewport changes', async () => {
    await rendered.onDetach?.(context('first'));
    await flush();
    const card = detachedHosts()[0];
    const width = card?.style.width;

    window.dispatchEvent(new Event('resize'));
    await flush();

    expect(card?.style.width).toBe(width);
  });
});
