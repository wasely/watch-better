import { browser } from 'wxt/browser';

import { CUTTHROUGH_OPENAI_MODEL } from '@/services/openai-chat';

export const CHAT_CONFIG_STORAGE_KEY = 'cutthrough:chat-config:v1';

export interface StoredChatConfig {
  readonly credential: string;
  readonly safetyIdentifier: string;
}

export interface ChatConfigStatus {
  readonly configured: boolean;
  readonly model: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface ChatConfigStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

export class ChatConfigRepository {
  public constructor(
    private readonly storage: ChatConfigStorageArea = browser.storage.local,
  ) {}

  public async status(): Promise<ChatConfigStatus> {
    const config = await this.load();
    return { configured: Boolean(config.credential), model: CUTTHROUGH_OPENAI_MODEL };
  }

  public async configure(suppliedApiKey: string): Promise<ChatConfigStatus> {
    const current = await this.load();
    const credential = suppliedApiKey.trim();
    const next: StoredChatConfig = {
      credential,
      safetyIdentifier: current.safetyIdentifier || crypto.randomUUID(),
    };
    await this.storage.set({ [CHAT_CONFIG_STORAGE_KEY]: next });
    return { configured: Boolean(next.credential), model: CUTTHROUGH_OPENAI_MODEL };
  }

  public async load(): Promise<StoredChatConfig> {
    const stored = await this.storage.get(CHAT_CONFIG_STORAGE_KEY);
    const value = stored[CHAT_CONFIG_STORAGE_KEY];
    if (!isRecord(value))
      return { credential: '', safetyIdentifier: crypto.randomUUID() };
    return {
      credential: typeof value.credential === 'string' ? value.credential.trim() : '',
      safetyIdentifier:
        typeof value.safetyIdentifier === 'string' && value.safetyIdentifier
          ? value.safetyIdentifier
          : crypto.randomUUID(),
    };
  }
}
