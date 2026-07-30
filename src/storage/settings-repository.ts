import { browser } from 'wxt/browser';

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type CutThroughSettings,
} from '@/features/settings/settings';

export const SETTINGS_STORAGE_KEY = 'cutthrough:settings';

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

  public async load(): Promise<CutThroughSettings> {
    const stored = await this.#area.get(SETTINGS_STORAGE_KEY);
    return normalizeSettings(stored[SETTINGS_STORAGE_KEY]);
  }

  public async save(settings: CutThroughSettings): Promise<CutThroughSettings> {
    const normalized = normalizeSettings(settings);
    await this.#area.set({ [SETTINGS_STORAGE_KEY]: normalized });
    return normalized;
  }

  public async reset(): Promise<CutThroughSettings> {
    await this.#area.remove(SETTINGS_STORAGE_KEY);
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

export class SettingsWriteCoordinator {
  readonly #repository: SettingsRepository;
  #queue: Promise<void> = Promise.resolve();

  public constructor(repository: SettingsRepository = new SettingsRepository()) {
    this.#repository = repository;
  }

  public load(): Promise<CutThroughSettings> {
    return this.#queue.then(() => this.#repository.load());
  }

  public patch(changes: Partial<CutThroughSettings>): Promise<CutThroughSettings> {
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
