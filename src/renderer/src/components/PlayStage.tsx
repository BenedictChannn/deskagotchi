import { useEffect, useRef, useState } from "react";

import type { DeskagotchiSnapshot } from "@shared/ipc";

import { ItemIcon } from "./ItemIcon";
import { PetSprite } from "./PetSprite";

const BALL_SIZE = 24;
const PET_SIZE = 64;
const CATCH_DISTANCE = 28;

interface Point {
  x: number;
  y: number;
}

interface StageBounds {
  width: number;
  height: number;
}

interface BallState extends Point {
  vx: number;
  vy: number;
  dragging: boolean;
}

interface PlayStageProps {
  snapshot: DeskagotchiSnapshot;
  onReward: () => void;
  onClose: () => void;
}

/**
 * Render the transient ball mini-game across the transparent monitor overlay.
 *
 * @param props - Snapshot, reward callback, and close callback.
 * @returns A screen-sized play surface with a draggable ball and chasing pet.
 */
export function PlayStage({
  snapshot,
  onReward,
  onClose
}: PlayStageProps): React.JSX.Element {
  const stageRef = useRef<HTMLElement>(null);
  const lastFrameAt = useRef<number>();
  const nextRewardAt = useRef(0);
  const initializedStage = useRef(false);
  const initialBall = {
    x: 150,
    y: 42,
    vx: 1.2,
    vy: 0,
    dragging: false
  };
  const ballRef = useRef<BallState>(initialBall);
  const pointerRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    lastAt: number;
  }>();
  const [ball, setBall] = useState<BallState>(initialBall);
  const [pet, setPet] = useState<Point>({ x: 68, y: 122 });
  const [catchCount, setCatchCount] = useState(0);

  useEffect(() => {
    void window.deskagotchi.recordQaEvent({
      event: "play:active",
      source: "renderer",
      windowRole: "play-overlay"
    });
  }, []);

  useEffect(() => {
    let animationFrame = 0;

    const tick = (now: number): void => {
      const previous = lastFrameAt.current ?? now;
      const delta = Math.min(2, Math.max(0.5, (now - previous) / 16.67));
      lastFrameAt.current = now;
      const bounds = getStageBounds(stageRef.current);
      const currentBall = ballRef.current;
      let nextBall = currentBall;

      if (!initializedStage.current) {
        initializedStage.current = true;
        nextBall = createInitialBall(bounds);
        ballRef.current = nextBall;
        setBall(nextBall);
        setPet(createInitialPet(bounds));
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      if (!currentBall.dragging) {
        let nextX = currentBall.x + currentBall.vx * delta;
        let nextY = currentBall.y + currentBall.vy * delta;
        let nextVx = currentBall.vx * 0.995;
        let nextVy = currentBall.vy + 0.42 * delta;
        const maxX = bounds.width - BALL_SIZE;
        const maxY = bounds.height - BALL_SIZE;

        if (nextX < 0 || nextX > maxX) {
          nextX = clamp(nextX, 0, maxX);
          nextVx *= -0.68;
        }
        if (nextY > maxY) {
          nextY = maxY;
          nextVy *= -0.62;
          nextVx *= 0.92;
        }

        nextBall = {
          ...currentBall,
          x: nextX,
          y: nextY,
          vx: nextVx,
          vy: nextVy
        };
        ballRef.current = nextBall;
        setBall(nextBall);
      }

      setPet((currentPet) => {
        const target = {
          x: nextBall.x + BALL_SIZE / 2 - PET_SIZE / 2,
          y: nextBall.y + BALL_SIZE / 2 - PET_SIZE / 2
        };
        const nextPet = stepToward(currentPet, target, 1.9 * delta);
        const distance = distanceBetween(
          { x: nextPet.x + PET_SIZE / 2, y: nextPet.y + PET_SIZE / 2 },
          { x: nextBall.x + BALL_SIZE / 2, y: nextBall.y + BALL_SIZE / 2 }
        );

        if (
          !nextBall.dragging &&
          distance < CATCH_DISTANCE &&
          now >= nextRewardAt.current
        ) {
          nextRewardAt.current = now + 2200;
          setCatchCount((current) => current + 1);
          onReward();
          const resetBall = {
            ...nextBall,
            x: clamp(nextBall.x + 26, 0, bounds.width - BALL_SIZE),
            y: 18,
            vx: -1.4,
            vy: -3.2,
            dragging: false
          };
          ballRef.current = resetBall;
          setBall(resetBall);
        }

        return {
          x: clamp(nextPet.x, 0, bounds.width - PET_SIZE),
          y: clamp(nextPet.y, 0, bounds.height - PET_SIZE)
        };
      });

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [onReward]);

  const startBallDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      lastAt: event.timeStamp
    };
    const nextBall = { ...ballRef.current, dragging: true, vx: 0, vy: 0 };
    ballRef.current = nextBall;
    setBall(nextBall);
  };

  const moveBallDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const pointer = pointerRef.current;
    if (pointer === undefined || pointer.pointerId !== event.pointerId) {
      return;
    }

    const bounds = getStageBounds(stageRef.current);
    const deltaX = event.clientX - pointer.lastX;
    const deltaY = event.clientY - pointer.lastY;
    const deltaTime = Math.max(1, event.timeStamp - pointer.lastAt);
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.lastAt = event.timeStamp;

    const currentBall = ballRef.current;
    const nextBall = {
      ...currentBall,
      x: clamp(currentBall.x + deltaX, 0, bounds.width - BALL_SIZE),
      y: clamp(currentBall.y + deltaY, 0, bounds.height - BALL_SIZE),
      vx: (deltaX / deltaTime) * 16.67,
      vy: (deltaY / deltaTime) * 16.67,
      dragging: true
    };
    ballRef.current = nextBall;
    setBall(nextBall);
  };

  const finishBallDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const pointer = pointerRef.current;
    if (pointer === undefined || pointer.pointerId !== event.pointerId) {
      return;
    }

    pointerRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const nextBall = { ...ballRef.current, dragging: false };
    ballRef.current = nextBall;
    setBall(nextBall);
  };

  return (
    <section
      ref={stageRef}
      className="overlay-play-stage"
      aria-label="Ball play"
      data-testid="overlay-play-stage"
    >
      <button
        className="overlay-play-close"
        type="button"
        onClick={onClose}
        aria-label="Close play"
        data-testid="overlay-play-close"
      >
        X
      </button>
      <div
        className="overlay-play-pet"
        style={{ transform: `translate(${pet.x}px, ${pet.y}px)` }}
      >
        <PetSprite snapshot={snapshot} size={PET_SIZE} />
      </div>
      <button
        className="overlay-play-ball"
        type="button"
        style={{ transform: `translate(${ball.x}px, ${ball.y}px)` }}
        onPointerDown={startBallDrag}
        onPointerMove={moveBallDrag}
        onPointerUp={finishBallDrag}
        onPointerCancel={finishBallDrag}
        aria-label="Drag ball"
        data-testid="overlay-play-ball"
      >
        <ItemIcon iconId="ball" size={BALL_SIZE} />
      </button>
      <div className="overlay-play-score" aria-live="polite">
        x{catchCount}
      </div>
    </section>
  );
}

function getStageBounds(stage: HTMLElement | null): StageBounds {
  const rect = stage?.getBoundingClientRect();
  return {
    width: Math.max(180, rect?.width ?? 220),
    height: Math.max(180, rect?.height ?? 220)
  };
}

function createInitialBall(bounds: StageBounds): BallState {
  return {
    x: clamp(bounds.width * 0.58, 20, bounds.width - BALL_SIZE - 20),
    y: clamp(bounds.height * 0.24, 20, bounds.height - BALL_SIZE - 20),
    vx: 1.2,
    vy: 0,
    dragging: false
  };
}

function createInitialPet(bounds: StageBounds): Point {
  return {
    x: clamp(bounds.width * 0.45, 0, bounds.width - PET_SIZE),
    y: clamp(bounds.height * 0.72, 0, bounds.height - PET_SIZE)
  };
}

function stepToward(current: Point, target: Point, amount: number): Point {
  const deltaX = target.x - current.x;
  const deltaY = target.y - current.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= amount || distance === 0) {
    return target;
  }

  return {
    x: current.x + (deltaX / distance) * amount,
    y: current.y + (deltaY / distance) * amount
  };
}

function distanceBetween(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
