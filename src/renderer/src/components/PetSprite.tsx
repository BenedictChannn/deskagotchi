import { useEffect, useMemo, useState } from "react";

import type { AnimationManifestEntry } from "@shared/domain";
import { AnimationId } from "@shared/domain";
import type { DeskagotchiSnapshot } from "@shared/ipc";
import { moodToAnimation } from "@shared/simulation";

interface PetSpriteProps {
  snapshot: DeskagotchiSnapshot;
  size: number;
  interactive?: boolean;
  onClick?: () => void;
}

export function PetSprite({
  snapshot,
  size,
  interactive = false,
  onClick
}: PetSpriteProps): React.JSX.Element {
  const animation = useMemo(
    () => selectAnimation(snapshot),
    [snapshot.activePackage.petPackage.animations, snapshot.activeState.mood]
  );
  const [frame, setFrame] = useState(0);
  const reducedMotion = snapshot.save.settings.reducedMotion;
  const scale = size / animation.frameWidth;

  useEffect(() => {
    setFrame(0);
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
        backgroundPosition: `${-frame * animation.frameWidth * scale}px ${-animation.row * animation.frameHeight * scale}px`
      }}
    />
  );
}

function selectAnimation(snapshot: DeskagotchiSnapshot): AnimationManifestEntry {
  const requestedAnimation = moodToAnimation(snapshot.activeState.mood);
  return (
    findAnimation(snapshot, requestedAnimation) ??
    findAnimation(snapshot, AnimationId.Idle) ??
    snapshot.activePackage.petPackage.animations[0]
  );
}

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
