import { useEffect, useMemo, useState } from "react";

import type { AnimationManifestEntry } from "@shared/domain";
import { AnimationId } from "@shared/domain";
import type { DeskagotchiSnapshot } from "@shared/ipc";
import { moodToAnimation } from "@shared/simulation";

/** Props for rendering a package spritesheet frame as a pet sprite. */
interface PetSpriteProps {
  /** Snapshot containing the active pet package, save settings, and mood. */
  snapshot: DeskagotchiSnapshot;
  /** CSS pixel size for the square sprite button. */
  size: number;
  /** Whether the sprite should use interactive button styling. */
  interactive?: boolean;
  /** Optional click handler used by overlay and panel controls. */
  onClick?: () => void;
  /** Optional pointer-down handler used by the desktop overlay drag controller. */
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
}

/**
 * Render the active pet animation frame from its spritesheet.
 *
 * @param props - Sprite snapshot, dimensions, and optional interaction behavior.
 * @returns A button element displaying the current pet frame.
 */
export function PetSprite({
  snapshot,
  size,
  interactive = false,
  onClick,
  onPointerDown
}: PetSpriteProps): React.JSX.Element {
  const animation = useMemo(
    () => selectAnimation(snapshot),
    [snapshot]
  );
  const [frame, setFrame] = useState(0);
  const reducedMotion = snapshot.save.settings.reducedMotion;
  const scale = size / animation.frameWidth;
  const visibleFrame = frame % animation.frames;
  const sheetColumns = Math.max(
    ...snapshot.activePackage.petPackage.animations.map(
      (manifestEntry) => manifestEntry.frames
    )
  );
  const backgroundWidth = animation.frameWidth * sheetColumns * scale;

  useEffect(() => {
    if (reducedMotion || animation.frames <= 1) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setFrame((currentFrame) => (currentFrame + 1) % animation.frames);
    }, 1000 / animation.fps);
    return () => window.clearInterval(interval);
  }, [animation.fps, animation.frames, animation.id, reducedMotion]);

  return (
    <button
      type="button"
      className={interactive ? "pet-sprite pet-sprite--button" : "pet-sprite"}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={`${snapshot.activeState.nickname} is ${snapshot.activeState.mood}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url("${snapshot.activePackage.assetUrls.spritesheet}")`,
        backgroundSize: `${backgroundWidth}px auto`,
        backgroundPosition: `${-visibleFrame * animation.frameWidth * scale}px ${-animation.row * animation.frameHeight * scale}px`
      }}
    />
  );
}

/**
 * Select the most appropriate animation for the active pet mood.
 *
 * @param snapshot - Current Deskagotchi runtime snapshot.
 * @returns The mood animation, idle fallback, or first manifest entry.
 */
function selectAnimation(snapshot: DeskagotchiSnapshot): AnimationManifestEntry {
  const requestedAnimation = moodToAnimation(snapshot.activeState.mood);
  const animations = animationsForActiveGrowthStage(snapshot);
  const requestedEntry = findAnimation(animations, requestedAnimation);
  if (requestedEntry !== undefined) {
    return requestedEntry;
  }

  const packageRequestedEntry = findAnimation(
    snapshot.activePackage.petPackage.animations,
    requestedAnimation
  );
  if (packageRequestedEntry?.fallback !== undefined) {
    const fallbackEntry = findAnimation(animations, packageRequestedEntry.fallback);
    if (fallbackEntry !== undefined) {
      return fallbackEntry;
    }
  }

  return (
    findAnimation(animations, AnimationId.Idle) ??
    animations[0] ??
    snapshot.activePackage.petPackage.animations[0]
  );
}

/**
 * Select the animation entries available for the active growth stage.
 *
 * @param snapshot - Current Deskagotchi runtime snapshot.
 * @returns The active growth-stage animation entries, or the full manifest when unavailable.
 */
function animationsForActiveGrowthStage(
  snapshot: DeskagotchiSnapshot
): AnimationManifestEntry[] {
  const allAnimations = snapshot.activePackage.petPackage.animations;
  const activeGrowthStage = snapshot.activePackage.petPackage.growthStages.find(
    (growthStage) => growthStage.id === snapshot.activeState.growthStageId
  );
  if (activeGrowthStage === undefined) {
    return allAnimations;
  }

  const scopedAnimations = activeGrowthStage.animationSet
    .map((animationId) => findAnimation(allAnimations, animationId))
    .filter(isAnimationEntry);

  return scopedAnimations.length > 0 ? scopedAnimations : allAnimations;
}

/**
 * Find an animation entry.
 *
 * @param animations - Candidate animation entries to search.
 * @param animationId - Requested animation identifier.
 * @returns The requested animation, or undefined when it is unavailable.
 */
function findAnimation(
  animations: AnimationManifestEntry[],
  animationId: AnimationId
): AnimationManifestEntry | undefined {
  return animations.find(
    (candidate) => candidate.id === animationId
  );
}

/**
 * Narrow optional animation lookups for growth-stage filtering.
 *
 * @param animation - Optional manifest entry from a lookup.
 * @returns True when the lookup produced an animation entry.
 */
function isAnimationEntry(
  animation: AnimationManifestEntry | undefined
): animation is AnimationManifestEntry {
  return animation !== undefined;
}
