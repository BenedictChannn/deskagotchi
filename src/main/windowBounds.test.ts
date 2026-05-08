import { ensureVisibleBounds, selectDisplay, type DisplayBounds } from "./windowBounds";

describe("window bounds helpers", () => {
  const primary: DisplayBounds = {
    id: "primary",
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }
  };
  const right: DisplayBounds = {
    id: "right",
    workArea: { x: 1920, y: 0, width: 1280, height: 1024 }
  };
  const left: DisplayBounds = {
    id: "left",
    workArea: { x: -1440, y: 0, width: 1440, height: 900 }
  };
  const stacked: DisplayBounds = {
    id: "stacked",
    workArea: { x: 0, y: -900, width: 1600, height: 900 }
  };

  it("clamps oversized or offscreen bounds onto the fallback display", () => {
    const bounds = ensureVisibleBounds(
      { x: 5000, y: 5000, width: 900, height: 20 },
      [primary],
      primary
    );

    expect(bounds).toEqual({ x: 1408, y: 944, width: 512, height: 96 });
  });

  it("uses pointer position to allow dragging across a right-side monitor", () => {
    const bounds = ensureVisibleBounds(
      { x: 1684, y: 300, width: 240, height: 240 },
      [primary, right],
      primary,
      { x: 1940, y: 420 }
    );

    expect(bounds.x).toBe(1920);
    expect(selectDisplay(bounds, [primary, right], primary).id).toBe("right");
  });

  it("uses pointer position to allow dragging onto negative-coordinate monitors", () => {
    const bounds = ensureVisibleBounds(
      { x: -20, y: 260, width: 240, height: 240 },
      [left, primary],
      primary,
      { x: -28, y: 380 }
    );

    expect(bounds.x).toBe(-240);
    expect(selectDisplay(bounds, [left, primary], primary).id).toBe("left");
  });

  it("restores saved bounds to the display containing the window center", () => {
    const display = selectDisplay(
      { x: 3100, y: 740, width: 240, height: 240 },
      [primary, right],
      primary
    );

    expect(display.id).toBe("right");
  });

  it("supports displays stacked above the primary display", () => {
    const bounds = ensureVisibleBounds(
      { x: 480, y: -80, width: 240, height: 240 },
      [stacked, primary],
      primary,
      { x: 540, y: -20 }
    );

    expect(bounds.y).toBe(-240);
    expect(selectDisplay(bounds, [stacked, primary], primary).id).toBe("stacked");
  });
});
