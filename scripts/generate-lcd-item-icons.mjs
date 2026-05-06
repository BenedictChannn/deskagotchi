import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const itemRoot = path.join(projectRoot, "resources", "items", "lcd-core");
const qaRoot = path.join(projectRoot, "docs", "qa");

const LOGICAL_SIZE = 24;
const SCALE = 2;
const CELL_SIZE = LOGICAL_SIZE * SCALE;
const COLUMNS = 6;

const colors = {
  transparent: [0, 0, 0, 0],
  lcdBg: hexToRgba("#dceca8"),
  lcdMid: hexToRgba("#7d9d58"),
  lcdInk: hexToRgba("#123716"),
  paperBg: hexToRgba("#f7f8e7")
};

const icons = [
  icon("bowl", "Bowl", "meal", 0, 0, "Food bowl"),
  icon("rice-ball", "Rice", "meal", 0, 1, "Rice ball"),
  icon("bread-plate", "Bread", "meal", 0, 2, "Bread on a plate"),
  icon("dumpling", "Dumpling", "meal", 0, 3, "Dumpling"),
  icon("biscuit", "Biscuit", "snack", 0, 4, "Square biscuit"),
  icon("candy", "Candy", "snack", 0, 5, "Wrapped candy"),
  icon("cake", "Cake", "snack", 1, 0, "Small cake slice"),
  icon("ball", "Ball", "toy", 1, 1, "Ball toy"),
  icon("rope", "Rope", "toy", 1, 2, "Rope toy"),
  icon("card", "Card", "toy", 1, 3, "Game card"),
  icon("chase-spark", "Chase", "toy", 1, 4, "Chase sparkle"),
  icon("capsule", "Capsule", "medicine", 1, 5, "Medicine capsule"),
  icon("bottle", "Bottle", "medicine", 2, 0, "Medicine bottle"),
  icon("bandage", "Bandage", "medicine", 2, 1, "Bandage"),
  icon("thermometer", "Thermo", "medicine", 2, 2, "Thermometer"),
  icon("sponge", "Sponge", "clean", 2, 3, "Cleaning sponge"),
  icon("broom", "Broom", "clean", 2, 4, "Broom"),
  icon("sparkle", "Sparkle", "clean", 2, 5, "Clean sparkle"),
  icon("mess", "Mess", "clean", 3, 0, "Mess marker"),
  icon("crescent", "Moon", "sleep", 3, 1, "Crescent moon"),
  icon("lamp", "Lamp", "sleep", 3, 2, "Bedside lamp"),
  icon("zzz", "Sleep", "sleep", 3, 3, "Sleep mark"),
  icon("heart", "Heart", "status", 3, 4, "Heart"),
  icon("meter", "Meter", "status", 3, 5, "Status meter"),
  icon("scale", "Scale", "status", 4, 0, "Weight scale"),
  icon("face", "Face", "status", 4, 1, "Pet face")
];

const items = [
  item("meal-kibble-bowl", "Kibble Bowl", "meal", "bowl", { hunger: 22, weight: 1 }),
  item("meal-rice-ball", "Rice Ball", "meal", "rice-ball", { hunger: 18, happiness: 2 }),
  item("meal-toast-plate", "Toast Plate", "meal", "bread-plate", { hunger: 16 }),
  item("meal-dumpling", "Dumpling", "meal", "dumpling", { hunger: 20, happiness: 1 }),
  item("snack-biscuit", "Biscuit", "snack", "biscuit", {
    happiness: 10,
    hunger: 4,
    weight: 1
  }),
  item("snack-candy", "Candy", "snack", "candy", {
    happiness: 13,
    health: -2,
    weight: 1
  }),
  item("snack-cake", "Cake", "snack", "cake", {
    happiness: 12,
    hunger: 6,
    health: -1,
    weight: 2
  }),
  item("toy-ball", "Ball", "toy", "ball", { happiness: 8, affection: 4, energy: -5 }),
  item("toy-rope", "Rope", "toy", "rope", { happiness: 7, affection: 4, energy: -4 }),
  item("toy-card", "Cards", "toy", "card", { happiness: 5, affection: 3 }),
  item("toy-chase", "Chase", "toy", "chase-spark", {
    happiness: 9,
    affection: 5,
    energy: -6
  }),
  item("medicine-capsule", "Capsule", "medicine", "capsule", { health: 25 }),
  item("medicine-bottle", "Tonic", "medicine", "bottle", { health: 18, energy: 5 }),
  item("clean-sponge", "Sponge", "clean", "sponge", { cleanliness: 28, health: 3 }),
  item("clean-broom", "Broom", "clean", "broom", { cleanliness: 22 }),
  item("sleep-moon", "Lights", "sleep", "crescent", { energy: 10 })
];

/**
 * Generate the monochrome LCD item icon atlas and manifest.
 *
 * @returns A promise that resolves when atlas, manifest, and QA preview are written.
 */
export async function generateLcdItemIcons() {
  await mkdir(itemRoot, { recursive: true });
  await mkdir(qaRoot, { recursive: true });

  const rows = Math.max(...icons.map((entry) => entry.row)) + 1;
  const atlas = createCanvas(COLUMNS * CELL_SIZE, rows * CELL_SIZE);
  for (const entry of icons) {
    const iconCanvas = renderIcon(entry.id);
    blit(iconCanvas, atlas, entry.column * CELL_SIZE, entry.row * CELL_SIZE);
  }

  const contactSheet = createCanvas(
    4 + COLUMNS * (CELL_SIZE + 4),
    4 + rows * (CELL_SIZE + 4)
  );
  fillRect(contactSheet, colors.paperBg, 0, 0, contactSheet.width, contactSheet.height);
  for (const entry of icons) {
    const x = 4 + entry.column * (CELL_SIZE + 4);
    const y = 4 + entry.row * (CELL_SIZE + 4);
    fillRect(contactSheet, colors.lcdBg, x, y, CELL_SIZE, CELL_SIZE);
    blit(renderIcon(entry.id), contactSheet, x, y);
  }

  await writeFile(path.join(itemRoot, "items.png"), encodePng(atlas));
  await writeFile(
    path.join(itemRoot, "items.json"),
    `${JSON.stringify(createManifest(), null, 2)}\n`
  );
  await writeFile(
    path.join(qaRoot, "lcd-item-icons-contact-sheet.png"),
    encodePng(contactSheet)
  );
}

function createManifest() {
  return {
    schemaVersion: 1,
    itemSetId: "lcd-core",
    name: "Deskagotchi LCD Core Items",
    description: "Original monochrome LCD item icons for MVP care interactions.",
    assetVersion: "0.1.0",
    atlas: "items.png",
    cellWidth: CELL_SIZE,
    cellHeight: CELL_SIZE,
    columns: COLUMNS,
    palette: ["#dceca8", "#7d9d58", "#123716", "#f7f8e7"],
    icons,
    items
  };
}

function icon(id, label, category, row, column, alt) {
  return { id, label, category, row, column, alt };
}

function item(id, label, category, iconId, effects) {
  return {
    id,
    label,
    category,
    iconId,
    availability: "always",
    effects
  };
}

function renderIcon(id) {
  const canvas = createCanvas(CELL_SIZE, CELL_SIZE);
  const draw = (color, x, y, width, height = 1) => {
    fillRect(canvas, color, x * SCALE, y * SCALE, width * SCALE, height * SCALE);
  };

  switch (id) {
    case "bowl":
      bowl(draw);
      break;
    case "rice-ball":
      riceBall(draw);
      break;
    case "bread-plate":
      breadPlate(draw);
      break;
    case "dumpling":
      dumpling(draw);
      break;
    case "biscuit":
      biscuit(draw);
      break;
    case "candy":
      candy(draw);
      break;
    case "cake":
      cake(draw);
      break;
    case "ball":
      ball(draw);
      break;
    case "rope":
      rope(draw);
      break;
    case "card":
      card(draw);
      break;
    case "chase-spark":
      chaseSpark(draw);
      break;
    case "capsule":
      capsule(draw);
      break;
    case "bottle":
      bottle(draw);
      break;
    case "bandage":
      bandage(draw);
      break;
    case "thermometer":
      thermometer(draw);
      break;
    case "sponge":
      sponge(draw);
      break;
    case "broom":
      broom(draw);
      break;
    case "sparkle":
      sparkle(draw, 9, 7);
      sparkle(draw, 14, 14);
      break;
    case "mess":
      mess(draw);
      break;
    case "crescent":
      crescent(draw);
      break;
    case "lamp":
      lamp(draw);
      break;
    case "zzz":
      zzz(draw);
      break;
    case "heart":
      heart(draw);
      break;
    case "meter":
      meter(draw);
      break;
    case "scale":
      scale(draw);
      break;
    case "face":
      face(draw);
      break;
    default:
      sparkle(draw, 10, 10);
      break;
  }

  return canvas;
}

function bowl(draw) {
  draw(colors.lcdInk, 5, 14, 14, 2);
  draw(colors.lcdInk, 6, 16, 12, 2);
  draw(colors.lcdInk, 8, 18, 8, 2);
  draw(colors.lcdBg, 7, 13, 10, 1);
  draw(colors.lcdMid, 8, 12, 2, 1);
  draw(colors.lcdMid, 12, 12, 2, 1);
}

function riceBall(draw) {
  draw(colors.lcdInk, 10, 5, 4, 1);
  draw(colors.lcdInk, 8, 6, 8, 2);
  draw(colors.lcdInk, 7, 8, 10, 7);
  draw(colors.lcdInk, 8, 15, 8, 2);
  draw(colors.lcdBg, 9, 7, 6, 8);
  draw(colors.lcdMid, 11, 11, 2, 2);
}

function breadPlate(draw) {
  draw(colors.lcdInk, 6, 15, 13, 2);
  draw(colors.lcdMid, 8, 14, 9, 1);
  draw(colors.lcdInk, 7, 8, 5, 7);
  draw(colors.lcdInk, 12, 7, 5, 8);
  draw(colors.lcdBg, 8, 9, 3, 5);
  draw(colors.lcdBg, 13, 9, 3, 5);
}

function dumpling(draw) {
  draw(colors.lcdInk, 6, 12, 12, 5);
  draw(colors.lcdInk, 8, 9, 8, 3);
  draw(colors.lcdBg, 7, 13, 10, 3);
  draw(colors.lcdMid, 9, 10, 1, 2);
  draw(colors.lcdMid, 12, 10, 1, 2);
  draw(colors.lcdMid, 15, 11, 1, 1);
}

function biscuit(draw) {
  draw(colors.lcdInk, 7, 7, 10, 10);
  draw(colors.lcdBg, 8, 8, 8, 8);
  draw(colors.lcdInk, 10, 10, 1, 1);
  draw(colors.lcdInk, 14, 10, 1, 1);
  draw(colors.lcdInk, 12, 13, 1, 1);
}

function candy(draw) {
  draw(colors.lcdInk, 4, 10, 4, 4);
  draw(colors.lcdInk, 16, 10, 4, 4);
  draw(colors.lcdInk, 8, 8, 8, 8);
  draw(colors.lcdBg, 9, 9, 6, 6);
  draw(colors.lcdMid, 11, 9, 2, 6);
}

function cake(draw) {
  draw(colors.lcdInk, 6, 9, 12, 9);
  draw(colors.lcdBg, 7, 10, 10, 3);
  draw(colors.lcdMid, 7, 14, 10, 3);
  draw(colors.lcdInk, 10, 6, 1, 3);
  draw(colors.lcdInk, 14, 6, 1, 3);
}

function ball(draw) {
  draw(colors.lcdInk, 8, 6, 8, 2);
  draw(colors.lcdInk, 6, 8, 12, 8);
  draw(colors.lcdInk, 8, 16, 8, 2);
  draw(colors.lcdBg, 8, 8, 8, 8);
  draw(colors.lcdMid, 11, 8, 2, 8);
  draw(colors.lcdMid, 8, 11, 8, 2);
}

function rope(draw) {
  draw(colors.lcdInk, 5, 9, 4, 4);
  draw(colors.lcdInk, 15, 9, 4, 4);
  draw(colors.lcdInk, 8, 11, 8, 2);
  draw(colors.lcdMid, 9, 9, 2, 2);
  draw(colors.lcdMid, 13, 13, 2, 2);
}

function card(draw) {
  draw(colors.lcdInk, 7, 5, 10, 14);
  draw(colors.lcdBg, 8, 6, 8, 12);
  draw(colors.lcdInk, 10, 9, 4, 1);
  draw(colors.lcdInk, 10, 12, 4, 1);
  draw(colors.lcdMid, 12, 15, 2, 1);
}

function chaseSpark(draw) {
  sparkle(draw, 6, 6);
  draw(colors.lcdInk, 13, 11, 4, 2);
  draw(colors.lcdInk, 15, 9, 2, 6);
  draw(colors.lcdMid, 18, 12, 2, 1);
}

function capsule(draw) {
  draw(colors.lcdInk, 6, 10, 12, 5);
  draw(colors.lcdBg, 7, 11, 5, 3);
  draw(colors.lcdMid, 13, 11, 4, 3);
  draw(colors.lcdInk, 12, 10, 1, 5);
}

function bottle(draw) {
  draw(colors.lcdInk, 9, 5, 6, 3);
  draw(colors.lcdInk, 8, 8, 8, 11);
  draw(colors.lcdBg, 9, 10, 6, 7);
  draw(colors.lcdInk, 11, 12, 2, 3);
  draw(colors.lcdInk, 10, 13, 4, 1);
}

function bandage(draw) {
  draw(colors.lcdInk, 5, 9, 14, 6);
  draw(colors.lcdBg, 6, 10, 12, 4);
  draw(colors.lcdInk, 11, 9, 2, 6);
  draw(colors.lcdMid, 8, 11, 1, 1);
  draw(colors.lcdMid, 15, 12, 1, 1);
}

function thermometer(draw) {
  draw(colors.lcdInk, 11, 5, 3, 10);
  draw(colors.lcdInk, 9, 14, 7, 5);
  draw(colors.lcdBg, 12, 6, 1, 8);
  draw(colors.lcdMid, 11, 15, 3, 2);
}

function sponge(draw) {
  draw(colors.lcdInk, 6, 8, 12, 8);
  draw(colors.lcdBg, 7, 9, 10, 6);
  draw(colors.lcdMid, 9, 10, 2, 1);
  draw(colors.lcdMid, 13, 12, 2, 1);
  draw(colors.lcdInk, 8, 17, 8, 1);
}

function broom(draw) {
  draw(colors.lcdInk, 13, 4, 2, 10);
  draw(colors.lcdInk, 8, 14, 10, 5);
  draw(colors.lcdMid, 9, 15, 8, 3);
  draw(colors.lcdInk, 10, 18, 1, 2);
  draw(colors.lcdInk, 14, 18, 1, 2);
}

function mess(draw) {
  draw(colors.lcdInk, 7, 14, 3, 3);
  draw(colors.lcdInk, 12, 13, 4, 4);
  draw(colors.lcdInk, 17, 15, 2, 2);
  draw(colors.lcdMid, 9, 10, 2, 2);
  draw(colors.lcdMid, 15, 8, 1, 2);
}

function crescent(draw) {
  draw(colors.lcdInk, 10, 5, 6, 2);
  draw(colors.lcdInk, 8, 7, 6, 3);
  draw(colors.lcdInk, 7, 10, 6, 5);
  draw(colors.lcdInk, 8, 15, 6, 3);
  draw(colors.lcdInk, 10, 18, 6, 1);
  draw(colors.transparent, 13, 7, 3, 11);
}

function lamp(draw) {
  draw(colors.lcdInk, 8, 7, 8, 5);
  draw(colors.lcdBg, 9, 8, 6, 3);
  draw(colors.lcdInk, 11, 12, 2, 5);
  draw(colors.lcdInk, 8, 17, 8, 2);
}

function zzz(draw) {
  draw(colors.lcdInk, 5, 7, 5, 1);
  draw(colors.lcdInk, 8, 8, 1, 1);
  draw(colors.lcdInk, 7, 9, 1, 1);
  draw(colors.lcdInk, 5, 10, 5, 1);
  draw(colors.lcdInk, 12, 11, 6, 1);
  draw(colors.lcdInk, 16, 12, 1, 1);
  draw(colors.lcdInk, 14, 13, 1, 1);
  draw(colors.lcdInk, 12, 14, 6, 1);
}

function heart(draw) {
  draw(colors.lcdInk, 7, 8, 4, 3);
  draw(colors.lcdInk, 13, 8, 4, 3);
  draw(colors.lcdInk, 6, 11, 12, 3);
  draw(colors.lcdInk, 8, 14, 8, 2);
  draw(colors.lcdInk, 10, 16, 4, 2);
  draw(colors.lcdBg, 8, 10, 2, 1);
}

function meter(draw) {
  draw(colors.lcdInk, 5, 8, 14, 8);
  draw(colors.lcdBg, 6, 9, 12, 6);
  draw(colors.lcdMid, 7, 13, 4, 1);
  draw(colors.lcdInk, 12, 12, 4, 2);
  draw(colors.lcdInk, 17, 9, 1, 6);
}

function scale(draw) {
  draw(colors.lcdInk, 6, 8, 12, 10);
  draw(colors.lcdBg, 7, 9, 10, 8);
  draw(colors.lcdInk, 10, 11, 4, 1);
  draw(colors.lcdInk, 12, 12, 1, 3);
  draw(colors.lcdMid, 8, 16, 8, 1);
}

function face(draw) {
  draw(colors.lcdInk, 8, 6, 8, 2);
  draw(colors.lcdInk, 6, 8, 12, 8);
  draw(colors.lcdInk, 8, 16, 8, 2);
  draw(colors.lcdBg, 8, 8, 8, 8);
  draw(colors.lcdInk, 10, 11, 1, 1);
  draw(colors.lcdInk, 14, 11, 1, 1);
  draw(colors.lcdInk, 11, 14, 3, 1);
}

function sparkle(draw, x, y) {
  draw(colors.lcdInk, x + 2, y, 1, 5);
  draw(colors.lcdInk, x, y + 2, 5, 1);
  draw(colors.lcdBg, x + 2, y + 2, 1, 1);
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
  await generateLcdItemIcons();
}
