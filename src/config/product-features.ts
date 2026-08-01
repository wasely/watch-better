import type { PanelTab } from '@/features/settings/settings';

export const PRODUCT_FEATURES = Object.freeze({
  jumpCut: false,
});

export const resolveInitialProductTab = (tab: PanelTab): PanelTab =>
  tab === 'skip' && !PRODUCT_FEATURES.jumpCut ? 'transcript' : tab;
