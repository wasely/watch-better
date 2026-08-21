import { browser } from 'wxt/browser';

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type WatchBetterSettings,
} from '@/features/settings/settings';

export const SETTINGS_STORAGE_KEY = 'watchbetter:settings:v3';
const LEGACY_SETTINGS_STORAGE_KEY = 'watchbetter:settings:v2';

export interface KeyValueStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export class SettingsRepository {
  readonly #area: KeyValueStorageArea;

  public constructor(area: KeyValueStorageArea = browser.storage.local) {
    this.#area = area;
  }

  public async load(): Promise<WatchBetterSettings> {
    const stored = await this.#area.get(SETTINGS_STORAGE_KEY);
    if (stored[SETTINGS_STORAGE_KEY] !== undefined)
      return normalizeSettings(stored[SETTINGS_STORAGE_KEY]);
    const legacy = await this.#area.get(LEGACY_SETTINGS_STORAGE_KEY);
    return normalizeSettings(legacy[LEGACY_SETTINGS_STORAGE_KEY]);
  }

  public async save(settings: WatchBetterSettings): Promise<WatchBetterSettings> {
    const normalized = normalizeSettings(settings);
    await this.#area.set({ [SETTINGS_STORAGE_KEY]: normalized });
    return normalized;
  }

  public async reset(): Promise<WatchBetterSettings> {
    await this.#area.remove(SETTINGS_STORAGE_KEY);
    await this.#area.remove(LEGACY_SETTINGS_STORAGE_KEY);
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

export class SettingsWriteCoordinator {
  readonly #repository: SettingsRepository;
  #queue: Promise<void> = Promise.resolve();

  public constructor(repository: SettingsRepository = new SettingsRepository()) {
    this.#repository = repository;
  }

  public load(): Promise<WatchBetterSettings> {
    return this.#queue.then(() => this.#repository.load());
  }

  public patch(changes: Partial<WatchBetterSettings>): Promise<WatchBetterSettings> {
    const operation = this.#queue.then(async () => {
      const current = await this.#repository.load();
      return this.#repository.save({ ...current, ...changes });
    });

    this.#queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
