import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';

import { CutThroughApp } from '@/app/CutThroughApp';

const isWatchPage = (): boolean =>
  location.pathname === '/watch' && new URL(location.href).searchParams.has('v');

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    if (!isWatchPage()) return;

    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'cutthrough-panel',
      position: 'inline',
      anchor: () => document.querySelector('#secondary-inner'),
      append: 'first',
      isolateEvents: true,
      onMount(container, _shadow, host) {
        host.dataset.cutthroughRoot = 'true';
        host.style.display = 'block';
        host.style.width = '100%';
        host.style.marginBottom = '12px';

        const root = createRoot(container);
        root.render(
          <StrictMode>
            <CutThroughApp />
          </StrictMode>,
        );
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.autoMount();
    ctx.onInvalidated(() => ui.remove());
  },
});
