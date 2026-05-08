import { findLcdItemIcon, lcdItemIconSet } from "../itemIconAssets";

/** Props for rendering one cell from the LCD item icon atlas. */
interface ItemIconProps {
  /** Icon id from `resources/items/lcd-core/items.json`. */
  iconId: string;
  /** Rendered CSS pixel size. */
  size?: number;
}

/**
 * Render one pixel icon from the shared LCD atlas.
 *
 * @param props - Icon id and optional rendered size.
 * @returns A decorative span using atlas background positioning.
 */
export function ItemIcon({
  iconId,
  size = 18
}: ItemIconProps): React.JSX.Element {
  const icon = findLcdItemIcon(iconId);
  if (icon === undefined) {
    return (
      <span
        className="item-icon item-icon--missing"
        aria-hidden="true"
        style={{ width: size, height: size }}
      />
    );
  }

  const scale = size / lcdItemIconSet.manifest.cellWidth;
  return (
    <span
      className="item-icon"
      data-icon-id={iconId}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: `url("${lcdItemIconSet.atlasUrl}")`,
        backgroundSize: `${lcdItemIconSet.manifest.columns * size}px auto`,
        backgroundPosition: `${-icon.column * lcdItemIconSet.manifest.cellWidth * scale}px ${-icon.row * lcdItemIconSet.manifest.cellHeight * scale}px`
      }}
    />
  );
}
