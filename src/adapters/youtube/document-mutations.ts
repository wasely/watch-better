interface SharedDocumentObserver {
  readonly priorityListeners: Set<() => void>;
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
  priority = false,
): (() => void) => {
  let entry = shared.get(documentRef);
  if (!entry) {
    const priorityListeners = new Set<() => void>();
    const listeners = new Set<() => void>();
    const observer = new MutationObserver(() => {
      // Invalidate SPA identity before playback reconnects to a newly active Short.
      for (const notify of priorityListeners) notify();
      for (const notify of listeners) notify();
    });
    observer.observe(documentRef.documentElement, {
      attributeFilter: ['theater', 'is-active'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    entry = { priorityListeners, listeners, observer };
    shared.set(documentRef, entry);
  }

  const target = priority ? entry.priorityListeners : entry.listeners;
  target.add(listener);
  return () => {
    const current = shared.get(documentRef);
    if (!current) return;
    current.priorityListeners.delete(listener);
    current.listeners.delete(listener);
    if (current.priorityListeners.size > 0 || current.listeners.size > 0) return;
    current.observer.disconnect();
    shared.delete(documentRef);
  };
};
