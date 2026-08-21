import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '@/features/settings/settings';

import {
  SETTINGS_STORAGE_KEY,
  SettingsRepository,
  SettingsWriteCoordinator,
  type KeyValueStorageArea,
} from './settings-repository';

class MemoryStorageArea implements KeyValueStorageArea {
  public readonly values: Record<string, unknown> = {};

  public get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ [key]: this.values[key] });
  }

  public set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, values);
    return Promise.resolve();
  }

  public remove(key: string): Promise<void> {
    delete this.values[key];
    return Promise.resolve();
  }
}

describe('SettingsRepository', () => {
  it('loads defaults when storage is empty', async () => {
    const repository = new SettingsRepository(new MemoryStorageArea());
    await expect(repository.load()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips validated settings', async () => {
    const storage = new MemoryStorageArea();
    const repository = new SettingsRepository(storage);
    const saved = await repository.save({
      ...DEFAULT_SETTINGS,
      defaultTab: 'ask',
      panelCollapsed: true,
    });

    expect(storage.values[SETTINGS_STORAGE_KEY]).toEqual(saved);
    await expect(repository.load()).resolves.toEqual(saved);
  });

  it('serializes patches against the latest stored value', async () => {
    const storage = new MemoryStorageArea();
    const repository = new SettingsRepository(storage);
    const coordinator = new SettingsWriteCoordinator(repository);
    await repository.save({
      ...DEFAULT_SETTINGS,
      extensionEnabled: true,
      defaultTab: 'ask',
    });

    const [disabled, changedTab] = await Promise.all([
      coordinator.patch({ extensionEnabled: false }),
      coordinator.patch({ defaultTab: 'smart-skip' }),
    ]);

    expect(disabled).toMatchObject({ extensionEnabled: false, defaultTab: 'ask' });
    expect(changedTab).toMatchObject({
      extensionEnabled: false,
      defaultTab: 'smart-skip',
    });
    await expect(coordinator.load()).resolves.toEqual(changedTab);
  });

  it('removes persisted values on reset', async () => {
    const storage = new MemoryStorageArea();
    const repository = new SettingsRepository(storage);
    await repository.save({ ...DEFAULT_SETTINGS, extensionEnabled: false });

    await expect(repository.reset()).resolves.toEqual(DEFAULT_SETTINGS);
    expect(storage.values).not.toHaveProperty(SETTINGS_STORAGE_KEY);
  });
});
