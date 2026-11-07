import { describe, expect, it } from 'vitest';

import {
  clampFloatingPosition,
  clampFloatingSize,
  floatingSize,
  initialFloatingPosition,
  maximizedFloatingRect,
  resizeFloatingRect,
  MIN_FLOATING_SIZE,
} from './floating-position';

describe('floating card geometry', () => {
  it('cascades cards while keeping them inside the viewport', () => {
    const size = floatingSize(1_440, 1_000);
    const first = initialFloatingPosition(0, size, 1_440, 1_000);
    const second = initialFloatingPosition(1, size, 1_440, 1_000);

    expect(second.left).toBeLessThan(first.left);
    expect(second.top).toBeGreaterThan(first.top);
  });

  it('opens as a reading column rather than a near-fullscreen sheet', () => {
    const size = floatingSize(1_440, 1_000);

    expect(size.width).toBeLessThan(1_440 * 0.4);
    expect(size.height).toBeLessThan(1_000 * 0.75);
    expect(size.width).toBeGreaterThanOrEqual(MIN_FLOATING_SIZE.width);
  });

  it('opens large enough to read the AI answer without manual resizing', () => {
    expect(floatingSize(2_048, 1_152)).toEqual({
      width: 560,
      height: 760,
    });
  });

  it('never shrinks below a usable size or grows past the viewport', () => {
    expect(clampFloatingSize({ width: 10, height: 10 }, 1_400, 900)).toEqual(
      MIN_FLOATING_SIZE,
    );
    expect(clampFloatingSize({ width: 9_000, height: 9_000 }, 1_400, 900)).toEqual({
      width: 1_368,
      height: 868,
    });
  });

  it('clamps dragged cards at every viewport edge', () => {
    expect(
      clampFloatingPosition(
        { left: -200, top: 9_000 },
        { width: 400, height: 500 },
        900,
        800,
      ),
    ).toEqual({ left: 16, top: 284 });
  });

  it('grows from the dragged edge and keeps the opposite edge anchored', () => {
    const start = { left: 400, top: 200, width: 400, height: 400 };

    const east = resizeFloatingRect(start, 'e', 120, 0, 1_400, 900);
    expect(east).toEqual({ ...start, width: 520 });

    const west = resizeFloatingRect(start, 'w', -120, 0, 1_400, 900);
    expect(west.left).toBe(280);
    expect(west.left + west.width).toBe(start.left + start.width);

    const north = resizeFloatingRect(start, 'n', -100, -100, 1_400, 900);
    expect(north.top).toBe(100);
    expect(north.top + north.height).toBe(start.top + start.height);
  });

  it('refuses to invert a card through itself', () => {
    const start = { left: 400, top: 200, width: 400, height: 400 };
    const collapsed = resizeFloatingRect(start, 'nw', 9_000, 9_000, 1_400, 900);

    expect(collapsed.width).toBe(MIN_FLOATING_SIZE.width);
    expect(collapsed.height).toBe(MIN_FLOATING_SIZE.height);
    expect(collapsed.left + collapsed.width).toBe(start.left + start.width);
    expect(collapsed.top + collapsed.height).toBe(start.top + start.height);
  });

  it('maximizes to the viewport minus a consistent gap', () => {
    expect(maximizedFloatingRect(1_400, 900)).toEqual({
      left: 16,
      top: 16,
      width: 1_368,
      height: 868,
    });
  });
});
