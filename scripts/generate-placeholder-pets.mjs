import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateDeskdogLcdAssets } from "./generate-deskdog-lcd-assets.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const petsRoot = path.join(projectRoot, "resources", "pets");

const animations = [
  "idle",
  "happy",
  "sad",
  "hungry",
  "eating",
  "playing",
  "sleeping",
  "sick",
  "cleaning",
  "walking",
  "attention"
];

const commonAnimationManifest = animations.map((id, row) => ({
  id,
  row,
  frames: 4,
  frameWidth: 96,
  frameHeight: 96,
  fps: id === "sleeping" ? 2 : id === "walking" ? 8 : 6,
  loop: true,
  ...(id === "idle" ? {} : { fallback: "idle" })
}));

const pets = [
  {
    packageId: "deskcat",
    name: "Deskcat",
    description: "A tiny original cat-like desk companion with bright keyboard-patrol energy.",
    species: "Cat-like desk companion",
    personality: "Curious, alert, and fond of small desk rituals.",
    palette: ["#f7b267", "#f79d65", "#2f243a", "#fefae0"],
    playStyle: "chase",
    foods: ["fish biscuit", "warm rice"],
    dislikes: ["burnt toast"],
    body: "cat",
    growthStages: [
      stage("egg", "egg", "Egg", 0, 0, 100),
      stage("baby", "baby", "Baby Deskcat", 2, 0, 100),
      stage("child-calm", "child", "Calm Child", 8, 0, 59),
      stage("child-bright", "child", "Bright Child", 8, 60, 100),
      stage("teen-shy", "teen", "Shy Teen", 30, 0, 49),
      stage("teen-spry", "teen", "Spry Teen", 30, 50, 100),
      stage("adult-cozy", "adult", "Cozy Adult", 72, 0, 39),
      stage("adult-pal", "adult", "Desk Pal", 72, 40, 74),
      stage("adult-star", "adult", "Star Deskcat", 72, 75, 100)
    ]
  },
  {
    packageId: "deskduck",
    name: "Deskduck",
    description: "A small original duck-like companion with a determined little waddle.",
    species: "Duck-like desk companion",
    personality: "Cheerful, vocal, and secretly disciplined.",
    palette: ["#ffd166", "#f4a261", "#2a9d8f", "#073b4c"],
    playStyle: "rhythm",
    foods: ["seed mix", "tiny greens"],
    dislikes: ["dry crackers"],
    body: "duck",
    growthStages: basicGrowth("Deskduck")
  },
  {
    packageId: "deskblob",
    name: "Deskblob",
    description: "An abstract original blob companion that squishes into every mood.",
    species: "Abstract blob companion",
    personality: "Soft, calm, and surprisingly expressive.",
    palette: ["#9bdbd4", "#4ecdc4", "#24404a", "#f7fff7"],
    playStyle: "calm",
    foods: ["jelly cube", "dew drop"],
    dislikes: ["salt chip"],
    body: "blob",
    growthStages: basicGrowth("Deskblob")
  }
];

await mkdir(petsRoot, { recursive: true });

for (const pet of pets) {
  const packageRoot = path.join(petsRoot, pet.packageId);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(path.join(packageRoot, "pet.json"), `${JSON.stringify(toPackage(pet), null, 2)}\n`);
  await writeFile(path.join(packageRoot, "spritesheet.svg"), spriteSheetSvg(pet));
  await writeFile(path.join(packageRoot, "preview.svg"), singleFrameSvg(pet, "happy", 1, 192));
  await writeFile(path.join(packageRoot, "icon.svg"), singleFrameSvg(pet, "idle", 0, 96));
}

await generateDeskdogLcdAssets();

function toPackage(pet) {
  return {
    schemaVersion: 1,
    packageId: pet.packageId,
    packageVersion: "0.1.0",
    minAppVersion: "0.1.0",
    name: pet.name,
    description: pet.description,
    source: "built-in",
    species: pet.species,
    personality: pet.personality,
    createdAt: "2026-05-05T00:00:00.000Z",
    assetVersion: "0.1.0",
    assets: {
      spritesheet: "spritesheet.svg",
      preview: "preview.svg",
      icon: "icon.svg"
    },
    animations: commonAnimationManifest,
    growthStages: pet.growthStages,
    preferredFoods: pet.foods,
    dislikedFoods: pet.dislikes,
    favoritePlayStyle: pet.playStyle,
    careModifiers: {
      hungerDecayMultiplier: pet.body === "blob" ? 0.85 : 1,
      happinessDecayMultiplier: pet.body === "dog" ? 1.1 : 1,
      energyDecayMultiplier: pet.body === "duck" ? 0.95 : 1,
      cleanlinessDecayMultiplier: pet.body === "blob" ? 0.75 : 1,
      affectionGainMultiplier: pet.body === "cat" ? 1.15 : 1
    },
    colorPalette: pet.palette,
    author: "Deskagotchi",
    license: "Original Deskagotchi placeholder asset",
    capabilities: ["mvp-animation", "growth-v1", "placeholder-art"],
    validationStatus: "passed",
    assetHash: `${pet.packageId}-placeholder-v1`,
    generation: {
      mode: "local-placeholder"
    }
  };
}

function basicGrowth(name) {
  return [
    stage("egg", "egg", "Egg", 0, 0, 100),
    stage("baby", "baby", `Baby ${name}`, 2, 0, 100),
    stage("child", "child", `Child ${name}`, 8, 0, 100),
    stage("teen", "teen", `Teen ${name}`, 30, 0, 100),
    stage("adult", "adult", `Adult ${name}`, 72, 0, 100)
  ];
}

function stage(id, lifeStage, label, minAgeHours, careScoreMin, careScoreMax) {
  return {
    id,
    stage: lifeStage,
    label,
    minAgeHours,
    careScoreMin,
    careScoreMax,
    animationSet: animations
  };
}

function spriteSheetSvg(pet) {
  const frames = [];
  for (const [row, animation] of animations.entries()) {
    for (let column = 0; column < 4; column += 1) {
      frames.push(`<g transform="translate(${column * 96} ${row * 96})">${petMarkup(pet, animation, column)}</g>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="1056" viewBox="0 0 384 1056">${defs()}${frames.join("")}</svg>\n`;
}

function singleFrameSvg(pet, animation, frame, size) {
  const scale = size / 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="scale(${scale})">${defs()}${petMarkup(pet, animation, frame)}</g></svg>\n`;
}

function defs() {
  return `<defs><filter id="soft"><feDropShadow dx="0" dy="1" stdDeviation="0.2" flood-color="#000000" flood-opacity="0.18"/></filter></defs>`;
}

function petMarkup(pet, animation, frame) {
  const [primary, secondary, outline, highlight] = pet.palette;
  const bob = animation === "sleeping" ? 0 : Math.sin(frame * Math.PI / 2) * 2;
  const squash = animation === "happy" || animation === "playing" ? 2 : 0;
  const sadTilt = animation === "sad" || animation === "sick" ? -2 : 0;
  const mouth = animation === "happy" || animation === "eating" || animation === "playing" ? "M39 57 Q48 64 57 57" : "M42 60 Q48 57 54 60";
  const eye = animation === "sleeping" ? "M34 43 Q39 40 44 43" : `<circle cx="39" cy="43" r="3.2" fill="${outline}"/>`;
  const rightEye = animation === "sleeping" ? "M53 43 Q58 40 63 43" : `<circle cx="58" cy="43" r="3.2" fill="${outline}"/>`;
  const accessory = animation === "attention" ? `<path d="M72 19 L78 10 L80 22 Z" fill="${secondary}" stroke="${outline}" stroke-width="2"/>` : "";
  const moodItem = animation === "eating" ? `<circle cx="70" cy="67" r="6" fill="${highlight}" stroke="${outline}" stroke-width="2"/>` : "";
  const sickMark = animation === "sick" ? `<rect x="30" y="26" width="36" height="8" rx="4" fill="${highlight}" stroke="${outline}" stroke-width="2"/><circle cx="39" cy="30" r="1.4" fill="${secondary}"/><circle cx="48" cy="30" r="1.4" fill="${secondary}"/><circle cx="57" cy="30" r="1.4" fill="${secondary}"/>` : "";
  const cleanSparkle = animation === "cleaning" ? `<path d="M24 26 L27 34 L35 37 L27 40 L24 48 L21 40 L13 37 L21 34 Z" fill="${highlight}" stroke="${outline}" stroke-width="1.5"/>` : "";
  const base = bodyMarkup(pet.body, primary, secondary, outline, highlight, bob, squash, sadTilt);

  return `<g filter="url(#soft)">${base}<g transform="translate(0 ${bob + sadTilt})">${typeof eye === "string" && eye.startsWith("<") ? eye : `<path d="${eye}" fill="none" stroke="${outline}" stroke-width="2" stroke-linecap="round"/>`}${typeof rightEye === "string" && rightEye.startsWith("<") ? rightEye : `<path d="${rightEye}" fill="none" stroke="${outline}" stroke-width="2" stroke-linecap="round"/>`}<path d="${mouth}" fill="none" stroke="${outline}" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="29" cy="52" rx="4" ry="2.5" fill="${secondary}" opacity="0.6"/><ellipse cx="67" cy="52" rx="4" ry="2.5" fill="${secondary}" opacity="0.6"/></g>${accessory}${moodItem}${sickMark}${cleanSparkle}</g>`;
}

function bodyMarkup(body, primary, secondary, outline, highlight, bob, squash, sadTilt) {
  if (body === "cat") {
    return `<g transform="translate(0 ${bob + sadTilt})"><path d="M27 37 L31 21 L43 33 L55 33 L67 21 L69 38" fill="${primary}" stroke="${outline}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="48" cy="${50 + squash}" rx="28" ry="${24 - squash}" fill="${primary}" stroke="${outline}" stroke-width="4"/><path d="M31 76 Q48 84 65 76" fill="${secondary}" stroke="${outline}" stroke-width="4" stroke-linecap="round"/><path d="M22 61 Q11 52 20 43" fill="none" stroke="${outline}" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="51" r="3" fill="${highlight}"/></g>`;
  }
  if (body === "dog") {
    return `<g transform="translate(0 ${bob + sadTilt})"><ellipse cx="48" cy="${51 + squash}" rx="29" ry="${23 - squash}" fill="${primary}" stroke="${outline}" stroke-width="4"/><ellipse cx="25" cy="37" rx="8" ry="15" fill="${secondary}" stroke="${outline}" stroke-width="4" transform="rotate(-24 25 37)"/><ellipse cx="71" cy="37" rx="8" ry="15" fill="${secondary}" stroke="${outline}" stroke-width="4" transform="rotate(24 71 37)"/><ellipse cx="48" cy="55" rx="9" ry="7" fill="${highlight}" stroke="${outline}" stroke-width="3"/><path d="M68 67 Q82 64 75 53" fill="none" stroke="${outline}" stroke-width="4" stroke-linecap="round"/></g>`;
  }
  if (body === "duck") {
    return `<g transform="translate(0 ${bob + sadTilt})"><ellipse cx="48" cy="${52 + squash}" rx="27" ry="${24 - squash}" fill="${primary}" stroke="${outline}" stroke-width="4"/><path d="M39 54 Q48 49 57 54 Q48 62 39 54 Z" fill="${secondary}" stroke="${outline}" stroke-width="3"/><path d="M31 74 Q48 83 65 74" fill="${secondary}" stroke="${outline}" stroke-width="4" stroke-linecap="round"/><path d="M24 56 Q12 51 18 43" fill="${highlight}" stroke="${outline}" stroke-width="3"/></g>`;
  }
  return `<g transform="translate(0 ${bob + sadTilt})"><path d="M22 55 C22 31 39 25 49 31 C60 20 76 34 75 55 C74 78 57 82 48 76 C38 84 22 77 22 55 Z" fill="${primary}" stroke="${outline}" stroke-width="4" stroke-linejoin="round"/><path d="M30 68 Q48 78 66 68" fill="${secondary}" stroke="${outline}" stroke-width="4" stroke-linecap="round"/><ellipse cx="48" cy="54" rx="14" ry="10" fill="${highlight}" opacity="0.25"/></g>`;
}
