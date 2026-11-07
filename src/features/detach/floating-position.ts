export interface FloatingSize {
  readonly width: number;
  readonly height: number;
}

export interface FloatingPosition {
  readonly left: number;
  readonly top: number;
}

const EDGE_GAP = 16;

/** Smallest usable card: header, tab row, and a few transcript rows. */
export const MIN_FLOATING_SIZE: FloatingSize = { width: 300, height: 220 };

/** Height of the card when minimized to its title bar. */
export const MINIMIZED_FLOATING_HEIGHT = 52;

const clampBetween = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

/** Keeps a resized card usable and fully on screen. */
export const clampFloatingSize = (
  size: FloatingSize,
  viewportWidth: number,
  viewportHeight: number,
): FloatingSize => ({
  width: clampBetween(
    size.width,
    MIN_FLOATING_SIZE.width,
    viewportWidth - EDGE_GAP * 2,
  ),
  height: clampBetween(
    size.height,
    MIN_FLOATING_SIZE.height,
    viewportHeight - EDGE_GAP * 2,
  ),
});

/** A card opens as a roomy reading column, not a near-fullscreen sheet. */
export const floatingSize = (
  viewportWidth: number,
  viewportHeight: number,
): FloatingSize =>
  clampFloatingSize(
    {
      width: Math.round(Math.min(560, viewportWidth * 0.39)),
      height: Math.round(Math.min(760, viewportHeight * 0.74)),
    },
    viewportWidth,
    viewportHeight,
  );

/** Fills the viewport without hiding the page behind it entirely. */
export const maximizedFloatingRect = (
  viewportWidth: number,
  viewportHeight: number,
): FloatingSize & FloatingPosition => ({
  left: EDGE_GAP,
  top: EDGE_GAP,
  width: Math.max(MIN_FLOATING_SIZE.width, viewportWidth - EDGE_GAP * 2),
  height: Math.max(MIN_FLOATING_SIZE.height, viewportHeight - EDGE_GAP * 2),
});

export const clampFloatingPosition = (
  position: FloatingPosition,
  size: FloatingSize,
  viewportWidth: number,
  viewportHeight: number,
): FloatingPosition => ({
  left: Math.min(
    Math.max(EDGE_GAP, position.left),
    Math.max(EDGE_GAP, viewportWidth - size.width - EDGE_GAP),
  ),
  top: Math.min(
    Math.max(EDGE_GAP, position.top),
    Math.max(EDGE_GAP, viewportHeight - size.height - EDGE_GAP),
  ),
});

export type FloatingRect = FloatingPosition & FloatingSize;

/** Which edges a resize drag is moving. */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * Applies a resize drag. Dragging a top or left edge moves the opposite corner's
 * anchor, so the far edges stay put and the card never inverts through itself.
 */
export const resizeFloatingRect = (
  start: FloatingRect,
  edge: ResizeEdge,
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  viewportHeight: number,
): FloatingRect => {
  let { left, top, width, height } = start;

  if (edge.includes('e')) width = start.width + deltaX;
  if (edge.includes('s')) height = start.height + deltaY;
  if (edge.includes('w')) {
    const right = start.left + start.width;
    left = Math.min(start.left + deltaX, right - MIN_FLOATING_SIZE.width);
    width = right - left;
  }
  if (edge.includes('n')) {
    const bottom = start.top + start.height;
    top = Math.min(start.top + deltaY, bottom - MIN_FLOATING_SIZE.height);
    height = bottom - top;
  }

  const size = clampFloatingSize({ width, height }, viewportWidth, viewportHeight);
  // Re-anchor after clamping so a west/north drag does not drift the far edge.
  if (edge.includes('w')) left = start.left + start.width - size.width;
  if (edge.includes('n')) top = start.top + start.height - size.height;

  return {
    ...size,
    ...clampFloatingPosition({ left, top }, size, viewportWidth, viewportHeight),
  };
};

export const initialFloatingPosition = (
  index: number,
  size: FloatingSize,
  viewportWidth: number,
  viewportHeight: number,
): FloatingPosition => {
  const offset = (index % 8) * 28;
  return clampFloatingPosition(
    {
      left: viewportWidth - size.width - 32 - offset,
      top: 72 + offset,
    },
    size,
    viewportWidth,
    viewportHeight,
  );
};
