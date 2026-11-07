import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { RuntimeStatus } from '@/messaging/messages';

import { PopupView } from './PopupView';

const readyStatus: RuntimeStatus = {
  enabled: true,
  supportedPage: true,
  panelMounted: false,
  version: '0.1.0',
};

const baseProps = {
  message: 'Ready on this video.',
  onSetEnabled: vi.fn(),
  onOpenSettings: vi.fn(),
};

describe('PopupView', () => {
  it('renders only the essential controls while loading', () => {
    render(<PopupView {...baseProps} message="Checking this tab…" status={null} />);

    expect(screen.getByText('Watch Better')).toBeInTheDocument();
    expect(screen.getByText('Checking this tab…')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeEnabled();
    expect(screen.queryByText(/v0\.1\.0/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/restore panel/i)).not.toBeInTheDocument();
  });

  it('routes enablement and settings actions', () => {
    const onSetEnabled = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <PopupView
        {...baseProps}
        onOpenSettings={onOpenSettings}
        onSetEnabled={onSetEnabled}
        status={readyStatus}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Turn Watch Better off' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

    expect(onSetEnabled).toHaveBeenCalledWith(false);
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('shows disabled status and enables the extension from one control', () => {
    const onSetEnabled = vi.fn();
    render(
      <PopupView
        {...baseProps}
        message="Turn it on to use Watch Better on videos."
        onSetEnabled={onSetEnabled}
        status={{ ...readyStatus, enabled: false }}
      />,
    );

    expect(screen.getByText('Disabled')).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Turn Watch Better on' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(onSetEnabled).toHaveBeenCalledWith(true);
  });

  it('disables controls while an action is busy', () => {
    render(<PopupView {...baseProps} busyAction="settings" status={readyStatus} />);

    expect(screen.getByRole('status')).toHaveTextContent('Working…');
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeDisabled();
  });

  it('reports status failures while keeping settings available', () => {
    render(
      <PopupView
        {...baseProps}
        error
        message="Could not read Watch Better status. Try again."
        status={null}
      />,
    );

    expect(
      screen.getByText('Could not read Watch Better status. Try again.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Watch Better status unavailable' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeEnabled();
  });
});
