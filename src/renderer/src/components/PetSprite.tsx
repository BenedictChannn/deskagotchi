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
  onClick
}: PetSpriteProps): React.JSX.Element {
  const animation = useMemo(
    () => selectAnimation(snapshot),
    [snapshot]
  );
  const [frame, setFrame] = useState(0);
  const reducedMotion = snapshot.save.settings.reducedMotion;
  const scale = size / animation.frameWidth;
  const visibleFrame = frame % animation.frames;

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
      aria-label={`${snapshot.activeState.nickname} is ${snapshot.activeState.mood}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url("${snapshot.activePackage.assetUrls.spritesheet}")`,
        backgroundSize: `${animation.frameWidth * 4 * scale}px auto`,
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
  return (
    findAnimation(snapshot, requestedAnimation) ??
    findAnimation(snapshot, AnimationId.Idle) ??
    snapshot.activePackage.petPackage.animations[0]
  );
}

/**
 * Find an animation entry with an idle fallback.
 *
 * @param snapshot - Current Deskagotchi runtime snapshot.
 * @param animationId - Requested animation identifier.
 * @returns The requested animation, the idle animation, or undefined when neither exists.
 */
function findAnimation(
  snapshot: DeskagotchiSnapshot,
  animationId: AnimationId
): AnimationManifestEntry | undefined {
  const animation = snapshot.activePackage.petPackage.animations.find(
    (candidate) => candidate.id === animationId
  );
  if (animation !== undefined) {
    return animation;
  }
  const fallback = snapshot.activePackage.petPackage.animations.find(
    (candidate) => candidate.id === AnimationId.Idle
  );
  return fallback;
}
