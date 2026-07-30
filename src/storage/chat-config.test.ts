import { describe, expect, it, vi } from 'vitest';

import {
  CHAT_CONFIG_STORAGE_KEY,
  ChatConfigRepository,
  type ChatConfigStorageArea,
} from './chat-config';

class MemoryChatStorage implements ChatConfigStorageArea {
  public readonly values: Record<string, unknown> = {};

  public get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ [key]: this.values[key] });
  }

  public set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, values);
    return Promise.resolve();
  }
}

describe('ChatConfigRepository', () => {
  it('reports configuration without returning the stored API key', async () => {
    const storage = new MemoryChatStorage();
    const repository = new ChatConfigRepository(storage);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000000',
    );

    await expect(repository.configure('  sk-test  ')).resolves.toEqual({
      configured: true,
      model: 'gpt-5.6',
    });
    await expect(repository.status()).resolves.toEqual({
      configured: true,
      model: 'gpt-5.6',
    });
    expect(storage.values[CHAT_CONFIG_STORAGE_KEY]).toEqual({
      credential: 'sk-test',
      safetyIdentifier: '00000000-0000-4000-8000-000000000000',
    });
  });

  it('clears the key while preserving its anonymous safety identifier', async () => {
    const storage = new MemoryChatStorage();
    storage.values[CHAT_CONFIG_STORAGE_KEY] = {
      credential: 'sk-test',
      safetyIdentifier: 'stable-id',
    };
    const repository = new ChatConfigRepository(storage);

    await expect(repository.configure('')).resolves.toMatchObject({
      configured: false,
    });
    expect(storage.values[CHAT_CONFIG_STORAGE_KEY]).toEqual({
      credential: '',
      safetyIdentifier: 'stable-id',
    });
  });
});
