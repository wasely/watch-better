import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CutThroughApp } from '@/app/CutThroughApp';
import { OptionsView } from '@/entrypoints/options/OptionsView';
import { PopupView } from '@/entrypoints/popup/PopupView';
import { DEFAULT_SETTINGS } from '@/features/settings/settings';
import { readyTranscriptState } from '@/test/fixtures/transcripts';

const audit = async (view: ReactElement) => {
  const { container, unmount } = render(view);
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
  unmount();

  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap((node) => node.target),
    })),
  ).toEqual([]);
};

describe('fixture accessibility', () => {
  it('audits the expanded and collapsed panel shell', async () => {
    await audit(
      <CutThroughApp
        onOpenSettings={vi.fn()}
        transcript={{ state: readyTranscriptState() }}
      />,
    );
    await audit(
      <CutThroughApp collapsed transcript={{ state: readyTranscriptState() }} />,
    );
  });

  it('audits the constrained popup', async () => {
    await audit(
      <PopupView
        message="Watch page detected. Restore the panel if it is hidden."
        onOpenSettings={vi.fn()}
        onRestorePanel={vi.fn()}
        onSetEnabled={vi.fn()}
        status={{
          enabled: true,
          supportedPage: true,
          panelMounted: false,
          version: '0.1.0',
        }}
      />,
    );
  });

  it('audits the settings surface', async () => {
    await audit(
      <OptionsView
        onChange={vi.fn()}
        settings={DEFAULT_SETTINGS}
        status="Settings loaded"
      />,
    );
  });
});
