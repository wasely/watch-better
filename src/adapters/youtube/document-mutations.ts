interface SharedDocumentObserver {
  readonly listeners: Set<() => void>;
  readonly observer: MutationObserver;
}

const shared = new WeakMap<Document, SharedDocumentObserver>();

/**
 * YouTube mutates its DOM thousands of times a minute and Chrome allocates a record
 * batch for every registered observer. One observer fanning out to every consumer keeps
 * that cost flat no matter how many panels and detached cards are alive.
 */
export const observeDocumentMutations = (
  documentRef: Document,
  listener: () => void,
): (() => void) => {
  let entry = shared.get(documentRef);
  if (!entry) {
    const listeners = new Set<() => void>();
    const observer = new MutationObserver(() => {
      for (const notify of listeners) notify();
    });
    observer.observe(documentRef.documentElement, {
      attributeFilter: ['theater', 'is-active'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    entry = { listeners, observer };
    shared.set(documentRef, entry);
  }

  entry.listeners.add(listener);
  return () => {
    const current = shared.get(documentRef);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    current.observer.disconnect();
    shared.delete(documentRef);
  };
};
