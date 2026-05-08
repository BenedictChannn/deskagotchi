/** Pure geometry helpers for native pet-window bounds. */

export interface WindowRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayBounds {
  id: string;
  workArea: WindowRectangle;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

const MIN_WINDOW_SIZE = 96;
const MAX_WINDOW_SIZE = 512;

/**
 * Clamp an overlay rectangle onto the best display work area.
 *
 * @param bounds - Desired window bounds.
 * @param displays - Available display work areas.
 * @param fallbackDisplay - Display to use when no display contains/intersects the target.
 * @param selectionPoint - Optional pointer/center point used to choose the target display.
 * @returns Bounds with sane size limits and a visible origin.
 */
export function ensureVisibleBounds(
  bounds: WindowRectangle,
  displays: DisplayBounds[],
  fallbackDisplay: DisplayBounds,
  selectionPoint?: ScreenPoint
): WindowRectangle {
  const targetDisplay = selectDisplay(bounds, displays, fallbackDisplay, selectionPoint);
  const workArea = targetDisplay.workArea;
  const width = Math.min(Math.max(bounds.width, MIN_WINDOW_SIZE), MAX_WINDOW_SIZE);
  const height = Math.min(Math.max(bounds.height, MIN_WINDOW_SIZE), MAX_WINDOW_SIZE);
  const x = clamp(bounds.x, workArea.x, workArea.x + workArea.width - width);
  const y = clamp(bounds.y, workArea.y, workArea.y + workArea.height - height);

  return { x, y, width, height };
}

/**
 * Choose the display that should own a moved/restored window.
 *
 * @param bounds - Desired window bounds.
 * @param displays - Available display work areas.
 * @param fallbackDisplay - Display to use when no display matches.
 * @param selectionPoint - Optional pointer/center point used to choose the target display.
 * @returns The best matching display.
 */
export function selectDisplay(
  bounds: WindowRectangle,
  displays: DisplayBounds[],
  fallbackDisplay: DisplayBounds,
  selectionPoint?: ScreenPoint
): DisplayBounds {
  if (selectionPoint !== undefined) {
    const displayForPoint = displays.find((display) =>
      pointInsideRect(selectionPoint, display.workArea)
    );
    if (displayForPoint !== undefined) {
      return displayForPoint;
    }
  }

  const center = centerOf(bounds);
  const displayForCenter = displays.find((display) =>
    pointInsideRect(center, display.workArea)
  );
  if (displayForCenter !== undefined) {
    return displayForCenter;
  }

  const intersectingDisplays = displays
    .map((display) => ({
      display,
      area: intersectionArea(display.workArea, bounds)
    }))
    .filter((candidate) => candidate.area > 0)
    .sort((left, right) => right.area - left.area);

  return intersectingDisplays[0]?.display ?? fallbackDisplay;
}

/**
 * Find the center of a rectangle.
 *
 * @param rect - Rectangle to inspect.
 * @returns The rectangle center point.
 */
export function centerOf(rect: WindowRectangle): ScreenPoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function pointInsideRect(point: ScreenPoint, rect: WindowRectangle): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

function intersectionArea(first: WindowRectangle, second: WindowRectangle): number {
  const width = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x)
  );
  const height = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y)
  );
  return width * height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
