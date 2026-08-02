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
  message: 'Watch page detected.',
  onSetEnabled: vi.fn(),
  onRestorePanel: vi.fn(),
  onOpenSettings: vi.fn(),
};

describe('PopupView', () => {
  it('renders a constrained loading state with actions disabled', () => {
    render(<PopupView {...baseProps} status={null} />);

    expect(screen.getByText('Checking this tab')).toBeInTheDocument();
    expect(screen.getByText('Extension status')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: /Restore panel/ })).toBeDisabled();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
  });

  it('routes supported-page actions explicitly', () => {
    const onSetEnabled = vi.fn();
    const onRestorePanel = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <PopupView
        {...baseProps}
        onOpenSettings={onOpenSettings}
        onRestorePanel={onRestorePanel}
        onSetEnabled={onSetEnabled}
        status={readyStatus}
      />,
    );

    expect(screen.getByText('Watch page ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Extension enabled' }));
    fireEvent.click(screen.getByRole('button', { name: /Restore panel/ }));
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }));

    expect(onSetEnabled).toHaveBeenCalledWith(false);
    expect(onRestorePanel).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('prevents invalid restore actions and reports mounted state', () => {
    const { rerender } = render(
      <PopupView {...baseProps} status={{ ...readyStatus, supportedPage: false }} />,
    );

    expect(screen.getByText('Unsupported page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore panel/ })).toBeDisabled();

    rerender(
      <PopupView {...baseProps} status={{ ...readyStatus, panelMounted: true }} />,
    );
    expect(
      screen.getByText('Panel visible', { selector: '.ct-popup-status strong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Panel visible/ })).toBeDisabled();
  });

  it('shows disabled and busy states without implying success', () => {
    const { rerender } = render(
      <PopupView {...baseProps} status={{ ...readyStatus, enabled: false }} />,
    );

    expect(screen.getByText('Watch Better is disabled')).toBeInTheDocument();
    expect(screen.getByText('Extension disabled')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Extension disabled' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    rerender(<PopupView {...baseProps} busyAction="settings" status={readyStatus} />);
    expect(screen.getByRole('status')).toHaveTextContent('Working…');
    expect(screen.getByRole('button', { name: /Settings/ })).toBeDisabled();
  });

  it('renders status failures honestly while keeping settings available', () => {
    render(
      <PopupView
        {...baseProps}
        error
        message="Could not read Watch Better status. Try again."
        status={null}
      />,
    );

    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.getByText('Enablement could not be read')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settings/ })).toBeEnabled();
  });
});
