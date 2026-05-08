import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(projectRoot, "resources", "pets", "deskdog");
const qaRoot = path.join(projectRoot, "docs", "qa");

const FRAME_LOGICAL_SIZE = 32;
const FRAME_SCALE = 3;
const FRAME_SIZE = FRAME_LOGICAL_SIZE * FRAME_SCALE;
const ICON_SCALE = 2;
const PREVIEW_SCALE = 6;

const colors = {
  transparent: [0, 0, 0, 0],
  lcdBg: hexToRgba("#dceca8"),
  lcdMid: hexToRgba("#7d9d58"),
  lcdInk: hexToRgba("#123716"),
  paperBg: hexToRgba("#f7f8e7")
};

const animations = [
  { id: "idle", fps: 5 },
  { id: "happy", fps: 7 },
  { id: "sad", fps: 4 },
  { id: "hungry", fps: 5 },
  { id: "eating", fps: 6 },
  { id: "playing", fps: 7 },
  { id: "sleeping", fps: 2 },
  { id: "sick", fps: 5 },
  { id: "cleaning", fps: 6 },
  { id: "walking", fps: 8 },
  { id: "attention", fps: 6 }
];

/**
 * Generate the production Deskbit Dog monochrome LCD package assets.
 *
 * @returns A promise that resolves after all assets and the manifest are written.
 */
export async function generateDeskdogLcdAssets() {
  await mkdir(packageRoot, { recursive: true });
  await mkdir(qaRoot, { recursive: true });

  const atlas = createCanvas(FRAME_SIZE * 4, FRAME_SIZE * animations.length);
  for (const [row, animation] of animations.entries()) {
    for (let frame = 0; frame < 4; frame += 1) {
      const frameCanvas = renderFrame(animation.id, frame, FRAME_SCALE);
      blit(frameCanvas, atlas, frame * FRAME_SIZE, row * FRAME_SIZE);
    }
  }

  const preview = renderFrame("happy", 1, PREVIEW_SCALE);
  const icon = renderFrame("idle", 0, ICON_SCALE);
  const contactSheet = renderContactSheet();

  await writeFile(path.join(packageRoot, "spritesheet.png"), encodePng(atlas));
  await writeFile(path.join(packageRoot, "preview.png"), encodePng(preview));
  await writeFile(path.join(packageRoot, "icon.png"), encodePng(icon));
  await writeFile(
    path.join(qaRoot, "deskdog-lcd-contact-sheet.png"),
    encodePng(contactSheet)
  );
  await writeFile(
    path.join(packageRoot, "pet.json"),
    `${JSON.stringify(createPetManifest(), null, 2)}\n`
  );
}

function createPetManifest() {
  return {
    schemaVersion: 1,
    packageId: "deskdog",
    packageVersion: "0.1.0",
    minAppVersion: "0.1.0",
    name: "Deskbit Dog",
    description:
      "A tiny retro-LCD dog companion with true monochrome sprite animation rows.",
    source: "built-in",
    species: "Dog-like desk companion",
    personality: "Loyal, playful, and snack-motivated.",
    createdAt: "2026-05-05T00:00:00.000Z",
    assetVersion: "0.1.0",
    assets: {
      spritesheet: "spritesheet.png",
      preview: "preview.png",
      icon: "icon.png"
    },
    animations: animations.map((animation, row) => ({
      id: animation.id,
      row,
      frames: 4,
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,
      fps: animation.fps,
      loop: true,
      ...(animation.id === "idle" ? {} : { fallback: "idle" })
    })),
    growthStages: [
      stage("egg", "egg", "Egg", 0),
      stage("baby", "baby", "Baby Deskbit Dog", 2),
      stage("child", "child", "Child Deskbit Dog", 8),
      stage("teen", "teen", "Teen Deskbit Dog", 30),
      stage("adult", "adult", "Adult Deskbit Dog", 72)
    ],
    preferredFoods: ["kibble bowl", "chicken bite", "rice ball", "steamed bun", "apple slice"],
    dislikedFoods: ["candy"],
    foodPreferences: {
      sharedFoodIds: ["meal-rice-ball", "meal-steamed-bun", "snack-biscuit"],
      likedFoodIds: ["snack-apple-slice"],
      favoriteFoodIds: ["meal-kibble-bowl", "meal-chicken-bite"],
      dislikedFoodIds: ["snack-candy"],
      eatingAnchor: { x: 0.58, y: 0.6, size: 22 }
    },
    favoritePlayStyle: "chase",
    careModifiers: {
      hungerDecayMultiplier: 1,
      happinessDecayMultiplier: 1.1,
      energyDecayMultiplier: 1,
      cleanlinessDecayMultiplier: 1,
      affectionGainMultiplier: 1
    },
    colorPalette: ["#dceca8", "#7d9d58", "#123716", "#f7f8e7"],
    author: "Deskagotchi",
    license: "Original Deskagotchi retro-LCD pixel asset",
    capabilities: ["mvp-animation", "growth-v1", "retro-lcd", "pixel-poc"],
    validationStatus: "passed",
    assetHash: "deskdog-lcd-v1",
    generation: {
      mode: "manual",
      prompt:
        "Dependency-free generated LCD pixel dog based on the approved Deskagotchi mockup direction."
    }
  };
}

function stage(id, lifeStage, label, minAgeHours) {
  return {
    id,
    stage: lifeStage,
    label,
    minAgeHours,
    careScoreMin: 0,
    careScoreMax: 100,
    animationSet: animations.map((animation) => animation.id)
  };
}

function renderContactSheet() {
  const padding = 4;
  const sheet = createCanvas(
    padding + 4 * (FRAME_SIZE + padding),
    padding + animations.length * (FRAME_SIZE + padding)
  );
  fillRect(sheet, colors.paperBg, 0, 0, sheet.width, sheet.height);

  for (const [row, animation] of animations.entries()) {
    for (let frame = 0; frame < 4; frame += 1) {
      const x = padding + frame * (FRAME_SIZE + padding);
      const y = padding + row * (FRAME_SIZE + padding);
      fillRect(sheet, colors.lcdBg, x, y, FRAME_SIZE, FRAME_SIZE);
      const frameCanvas = renderFrame(animation.id, frame, FRAME_SCALE);
      blit(frameCanvas, sheet, x, y);
    }
  }

  return sheet;
}

function renderFrame(animation, frame, scale) {
  const canvas = createCanvas(FRAME_LOGICAL_SIZE * scale, FRAME_LOGICAL_SIZE * scale);
  const draw = (color, x, y, width, height = 1) => {
    fillRect(
      canvas,
      color,
      x * scale,
      y * scale,
      width * scale,
      height * scale
    );
  };

  if (animation === "sleeping") {
    drawSleepingDog(draw, frame);
    return canvas;
  }

  const bob = ["happy", "playing"].includes(animation)
    ? [0, -3, 0, -2][frame]
    : animation === "walking"
      ? [0, -2, 0, -2][frame]
      : animation === "sick"
        ? [0, 1, 0, 1][frame]
        : animation === "sad"
          ? 2
          : 0;
  const wobble = animation === "sick" ? [-1, 1, -1, 1][frame] : 0;
  const tail = tailState(animation, frame);
  const face = faceState(animation, frame);
  const legs = legState(animation, frame);

  drawDogBody(draw, wobble, bob, tail, legs, face, animation, frame);
  drawAnimationProp(draw, animation, frame, wobble, bob);
  return canvas;
}

function drawDogBody(draw, offsetX, offsetY, tail, legs, face, animation, frame) {
  const x = offsetX;
  const y = offsetY;
  const isHappyPose = animation === "happy" || animation === "cleaning";
  const isPlayingPose = animation === "playing";
  const isEatingPose = animation === "hungry" || animation === "eating";
  const headDrop = animation === "sad" || animation === "sick" ? 2 : isEatingPose ? 1 : 0;
  const earBounce = isHappyPose && frame % 2 === 1 ? -1 : 0;
  const headY = y + headDrop;
  const bodyY = y + (isPlayingPose ? [0, -1, 0, 1][frame] : 0);

  draw(colors.lcdInk, x + 11, bodyY + 16, 9, 1);
  draw(colors.lcdInk, x + 9, bodyY + 17, 13, 8);
  draw(colors.lcdInk, x + 11, bodyY + 25, 9, 2);
  draw(colors.lcdMid, x + 10, bodyY + 18, 11, 6);
  draw(colors.lcdMid, x + 12, bodyY + 25, 7, 1);

  if (tail === "up") {
    draw(colors.lcdInk, x + 22, bodyY + 16, 3, 2);
    draw(colors.lcdInk, x + 24, bodyY + 13, 2, 4);
    draw(colors.lcdInk, x + 26, bodyY + 12, 2, 2);
    draw(colors.lcdMid, x + 23, bodyY + 16, 1, 1);
  } else if (tail === "down") {
    draw(colors.lcdInk, x + 22, bodyY + 21, 3, 2);
    draw(colors.lcdInk, x + 24, bodyY + 23, 2, 2);
  } else {
    draw(colors.lcdInk, x + 22, bodyY + 18, 5, 2);
    draw(colors.lcdMid, x + 23, bodyY + 18, 2, 1);
  }

  if (isHappyPose) {
    drawRaisedPaw(draw, x + 6, bodyY + 15, "left");
    drawRaisedPaw(draw, x + 22, bodyY + 15, "right");
  } else if (legs === "walk-a") {
    drawLeg(draw, x + 8, bodyY + 24, 3, "back");
    drawLeg(draw, x + 18, bodyY + 24, 5, "front");
  } else if (legs === "walk-b") {
    drawLeg(draw, x + 9, bodyY + 24, 5, "front");
    drawLeg(draw, x + 17, bodyY + 24, 3, "back");
  } else {
    drawLeg(draw, x + 9, bodyY + 24, 4, "still");
    drawLeg(draw, x + 18, bodyY + 24, 4, "still");
  }

  draw(colors.lcdInk, x + 11, headY + 4, 7, 1);
  draw(colors.lcdInk, x + 9, headY + 5, 11, 2);
  draw(colors.lcdInk, x + 8, headY + 7, 13, 8);
  draw(colors.lcdInk, x + 9, headY + 15, 11, 3);
  draw(colors.lcdMid, x + 10, headY + 6, 9, 10);
  draw(colors.lcdBg, x + 11, headY + 8, 7, 5);

  draw(colors.lcdInk, x + 4, headY + 7 + earBounce, 5, 8);
  draw(colors.lcdInk, x + 5, headY + 15 + earBounce, 3, 3);
  draw(colors.lcdMid, x + 5, headY + 8 + earBounce, 3, 7);
  draw(colors.lcdInk, x + 21, headY + 7 + earBounce, 5, 8);
  draw(colors.lcdInk, x + 22, headY + 15 + earBounce, 3, 3);
  draw(colors.lcdMid, x + 22, headY + 8 + earBounce, 3, 7);

  drawFace(draw, x, headY, face);
}

function drawLeg(draw, x, y, height, gait) {
  draw(colors.lcdInk, x, y, 3, height);
  draw(colors.lcdMid, x + 1, y, 1, Math.max(1, height - 1));
  if (gait === "front") {
    draw(colors.lcdInk, x + 2, y + height - 1, 2, 1);
  } else if (gait === "back") {
    draw(colors.lcdInk, x - 1, y + height - 1, 2, 1);
  }
}

function drawRaisedPaw(draw, x, y, side) {
  const pawX = side === "left" ? x : x + 1;
  draw(colors.lcdInk, pawX, y, 3, 7);
  draw(colors.lcdMid, pawX + 1, y + 1, 1, 5);
  draw(colors.lcdInk, pawX - (side === "left" ? 1 : 0), y + 6, 4, 2);
}

function drawFace(draw, x, y, face) {
  if (face === "blink") {
    draw(colors.lcdInk, x + 11, y + 11, 2, 1);
    draw(colors.lcdInk, x + 17, y + 11, 2, 1);
    draw(colors.lcdInk, x + 14, y + 13, 3, 2);
    draw(colors.lcdInk, x + 14, y + 16, 3, 1);
    return;
  }
  if (face === "happy") {
    draw(colors.lcdInk, x + 11, y + 10, 2, 2);
    draw(colors.lcdInk, x + 17, y + 10, 2, 2);
    draw(colors.lcdInk, x + 14, y + 13, 3, 2);
    draw(colors.lcdInk, x + 13, y + 16, 5, 1);
    draw(colors.lcdBg, x + 15, y + 14, 1, 1);
    return;
  }
  if (face === "sad") {
    draw(colors.lcdInk, x + 11, y + 11, 2, 1);
    draw(colors.lcdInk, x + 17, y + 11, 2, 1);
    draw(colors.lcdInk, x + 14, y + 13, 3, 2);
    draw(colors.lcdInk, x + 13, y + 16, 5, 1);
    draw(colors.lcdInk, x + 13, y + 15, 1, 1);
    draw(colors.lcdInk, x + 17, y + 15, 1, 1);
    return;
  }
  if (face === "open") {
    draw(colors.lcdInk, x + 11, y + 10, 2, 2);
    draw(colors.lcdInk, x + 17, y + 10, 2, 2);
    draw(colors.lcdInk, x + 14, y + 13, 3, 2);
    draw(colors.lcdInk, x + 14, y + 16, 3, 2);
    return;
  }

  draw(colors.lcdInk, x + 11, y + 10, 2, 2);
  draw(colors.lcdInk, x + 17, y + 10, 2, 2);
  draw(colors.lcdInk, x + 14, y + 13, 3, 2);
  draw(colors.lcdInk, x + 14, y + 16, 3, 1);
}

function drawAnimationProp(draw, animation, frame, offsetX, offsetY) {
  const x = offsetX;
  const y = offsetY;
  if (animation === "hungry" || animation === "eating") {
    drawBowl(draw, x + 23, y + 23, animation === "eating" ? frame : 0);
  }
  if (animation === "playing") {
    const ball = [
      [24, 23],
      [25, 20],
      [23, 22],
      [26, 23]
    ][frame];
    draw(colors.lcdInk, ball[0], ball[1], 3, 3);
    draw(colors.lcdBg, ball[0] + 1, ball[1] + 1, 1, 1);
  }
  if (animation === "sick") {
    draw(colors.lcdInk, x + 11, y + 4, 8, 2);
    draw(colors.lcdBg, x + 12, y + 4, 6, 1);
    draw(colors.lcdInk, x + 24, y + 8, 2, 2);
    draw(colors.lcdInk, x + 25, y + 10, 2, 2);
  }
  if (animation === "cleaning") {
    const sparkX = [3, 4, 5, 4][frame];
    drawSparkle(draw, sparkX, 6);
    draw(colors.lcdInk, 24, 21, 4, 2);
    draw(colors.lcdBg, 25, 20, 2, 1);
    draw(colors.lcdBg, 26, 23, 1, 1);
  }
  if (animation === "attention") {
    draw(colors.lcdInk, x + 14, y + 2, 2, 4);
    draw(colors.lcdInk, x + 14, y + 7, 2, 2);
  }
}

function drawSleepingDog(draw, frame) {
  const breathe = frame % 2;
  draw(colors.lcdInk, 7, 17 + breathe, 19, 8);
  draw(colors.lcdMid, 8, 18 + breathe, 17, 6);
  draw(colors.lcdInk, 6, 13 + breathe, 10, 8);
  draw(colors.lcdMid, 7, 14 + breathe, 8, 6);
  draw(colors.lcdInk, 4, 15 + breathe, 3, 5);
  draw(colors.lcdInk, 12, 16 + breathe, 2, 1);
  draw(colors.lcdInk, 16, 16 + breathe, 2, 1);
  draw(colors.lcdInk, 18, 24 + breathe, 5, 2);
  draw(colors.lcdInk, 24, 16 + breathe, 4, 2);
  const moonX = [23, 24, 25, 24][frame];
  draw(colors.lcdInk, moonX, 7, 3, 1);
  draw(colors.lcdInk, moonX + 1, 8, 2, 1);
  draw(colors.lcdInk, moonX + 2, 9, 1, 1);
}

function drawBowl(draw, x, y, biteFrame) {
  draw(colors.lcdInk, x, y, 6, 2);
  draw(colors.lcdInk, x + 1, y + 2, 4, 1);
  draw(colors.lcdBg, x + 1, y, Math.max(0, 4 - biteFrame), 1);
}

function drawSparkle(draw, x, y) {
  draw(colors.lcdInk, x + 2, y, 1, 5);
  draw(colors.lcdInk, x, y + 2, 5, 1);
  draw(colors.lcdBg, x + 2, y + 2, 1, 1);
}

function tailState(animation, frame) {
  if (animation === "sad" || animation === "sick") {
    return "down";
  }
  if (animation === "happy" || animation === "playing" || animation === "walking") {
    return ["up", "mid", "up", "mid"][frame];
  }
  return ["mid", "up", "mid", "down"][frame];
}

function faceState(animation, frame) {
  if (animation === "idle" && frame === 2) {
    return "blink";
  }
  if (animation === "happy" || animation === "playing" || animation === "cleaning") {
    return "happy";
  }
  if (animation === "sad" || animation === "sick") {
    return "sad";
  }
  if (animation === "hungry" || animation === "eating" || animation === "attention") {
    return "open";
  }
  return "neutral";
}

function legState(animation, frame) {
  if (animation !== "walking" && animation !== "playing") {
    return "still";
  }
  return frame % 2 === 0 ? "walk-a" : "walk-b";
}

function createCanvas(width, height) {
  return {
    width,
    height,
    pixels: new Uint8Array(width * height * 4)
  };
}

function fillRect(canvas, rgba, x, y, width, height) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(canvas.width, Math.ceil(x + width));
  const endY = Math.min(canvas.height, Math.ceil(y + height));

  for (let pixelY = startY; pixelY < endY; pixelY += 1) {
    for (let pixelX = startX; pixelX < endX; pixelX += 1) {
      const index = (pixelY * canvas.width + pixelX) * 4;
      canvas.pixels[index] = rgba[0];
      canvas.pixels[index + 1] = rgba[1];
      canvas.pixels[index + 2] = rgba[2];
      canvas.pixels[index + 3] = rgba[3];
    }
  }
}

function blit(source, target, offsetX, offsetY) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;
      const alpha = source.pixels[sourceIndex + 3];
      if (alpha === 0) {
        continue;
      }
      const targetIndex = ((offsetY + y) * target.width + offsetX + x) * 4;
      target.pixels[targetIndex] = source.pixels[sourceIndex];
      target.pixels[targetIndex + 1] = source.pixels[sourceIndex + 1];
      target.pixels[targetIndex + 2] = source.pixels[sourceIndex + 2];
      target.pixels[targetIndex + 3] = alpha;
    }
  }
}

function encodePng(canvas) {
  const scanlineLength = canvas.width * 4 + 1;
  const raw = Buffer.alloc(scanlineLength * canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    const rowOffset = y * scanlineLength;
    raw[rowOffset] = 0;
    Buffer.from(
      canvas.pixels.buffer,
      y * canvas.width * 4,
      canvas.width * 4
    ).copy(raw, rowOffset + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.concat([
      uint32(canvas.width),
      uint32(canvas.height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(crcInput))
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let current = index;
  for (let bit = 0; bit < 8; bit += 1) {
    current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  }
  return current >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function hexToRgba(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateDeskdogLcdAssets();
}
