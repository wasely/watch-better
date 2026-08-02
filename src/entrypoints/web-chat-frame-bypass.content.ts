export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://gemini.google.com/*'],
  allFrames: true,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    if (!/^#watchbetter-frame=[a-zA-Z0-9._:%-]+$/.test(location.hash)) return;
    const embedded = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    if (!embedded) return;

    const defineWindowValue = (property: string, value: unknown) => {
      try {
        Object.defineProperty(window, property, {
          configurable: true,
          get: () => value,
        });
      } catch {
        // Provider may expose a non-configurable browser property.
      }
    };

    defineWindowValue('top', window);
    defineWindowValue('parent', window);
    defineWindowValue('frameElement', null);
    try {
      Object.defineProperty(document, 'referrer', {
        configurable: true,
        get: () => '',
      });
    } catch {
      // Referrer masking is best effort; embedding still works without it.
    }
  },
});
