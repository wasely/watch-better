import { useCallback, useEffect, useRef, useState } from 'react';

import { WEB_CHAT_PROVIDERS, type WebChatProviderId } from '@/services/web-chat';

import './SmartSkipRefinementFrame.css';

export interface SmartSkipRefinementFrameProps {
  readonly provider: WebChatProviderId;
  readonly onSessionChange: (provider: WebChatProviderId, sessionId: string) => void;
  readonly onPrepare: (provider: WebChatProviderId, sessionId: string) => Promise<void>;
  readonly onReset?: (provider: WebChatProviderId, sessionId: string) => Promise<void>;
}

const createFrameSessionId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function SmartSkipRefinementFrame({
  provider,
  onSessionChange,
  onPrepare,
  onReset,
}: SmartSkipRefinementFrameProps) {
  const definition = WEB_CHAT_PROVIDERS[provider];
  const [sessionId] = useState(
    () => `smart-skip:${provider}:${createFrameSessionId()}`,
  );
  const [prepared, setPrepared] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bindingTimersRef = useRef<readonly number[]>([]);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onSessionChange(provider, sessionId);
  }, [onSessionChange, provider, sessionId]);

  useEffect(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      const prepare = async () => {
        for (let attempt = 0; attempt < 3 && !disposed; attempt += 1) {
          try {
            await onPrepare(provider, sessionId);
            if (!disposed) setPrepared(true);
            return;
          } catch {
            if (attempt < 2)
              await new Promise<void>((resolve) =>
                window.setTimeout(resolve, 400 * 2 ** attempt),
              );
          }
        }
      };
      void prepare();
    });
    return () => {
      disposed = true;
      for (const timer of bindingTimersRef.current) window.clearTimeout(timer);
      if (onReset)
        resetTimerRef.current = window.setTimeout(() => {
          resetTimerRef.current = null;
          void onReset(provider, sessionId).catch(() => undefined);
        }, 0);
    };
  }, [onPrepare, onReset, provider, sessionId]);

  const bindFrame = useCallback(() => {
    for (const timer of bindingTimersRef.current) window.clearTimeout(timer);
    const postBinding = () => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'watchbetter:webchat-frame-binding',
          provider,
          sessionId,
        },
        new URL(definition.url).origin,
      );
    };
    postBinding();
    bindingTimersRef.current = [100, 500, 1_500].map((delay) =>
      window.setTimeout(postBinding, delay),
    );
  }, [definition.url, provider, sessionId]);

  return prepared ? (
    <iframe
      aria-hidden="true"
      className="ct-smart-skip-refinement-frame"
      onLoad={bindFrame}
      ref={iframeRef}
      referrerPolicy="no-referrer"
      src={`${definition.url}#watchbetter-frame=${encodeURIComponent(sessionId)}`}
      tabIndex={-1}
      title={`${definition.displayName} Smart Skip analysis`}
    />
  ) : null;
}
