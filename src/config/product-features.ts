import type { PanelTab } from '@/features/settings/settings';

export const PRODUCT_FEATURES = Object.freeze({
  smartSkip: true,
});

export const resolveInitialProductTab = (tab: PanelTab): PanelTab =>
  tab === 'smart-skip' && !PRODUCT_FEATURES.smartSkip ? 'transcript' : tab;
