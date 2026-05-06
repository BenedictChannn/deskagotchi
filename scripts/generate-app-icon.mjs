import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "build");
const outputPath = path.join(outputDir, "icon.ico");
const size = 256;
const logicalSize = 64;

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, createIcon());

function createIcon() {
  const dib = createDib();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(0, 6);
  header.writeUInt8(0, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(dib.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, dib]);
}

function createDib() {
  const xorBytes = size * size * 4;
  const andStride = Math.ceil(size / 32) * 4;
  const andBytes = andStride * size;
  const dib = Buffer.alloc(40 + xorBytes + andBytes);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(0, 16);
  dib.writeUInt32LE(xorBytes + andBytes, 20);
  dib.writeInt32LE(2835, 24);
  dib.writeInt32LE(2835, 28);
  dib.writeUInt32LE(0, 32);
  dib.writeUInt32LE(0, 36);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = pixelAt(x, y);
      const bottomUpY = size - 1 - y;
      const offset = 40 + (bottomUpY * size + x) * 4;
      dib.writeUInt8(color.b, offset);
      dib.writeUInt8(color.g, offset + 1);
      dib.writeUInt8(color.r, offset + 2);
      dib.writeUInt8(color.a, offset + 3);
    }
  }

  return dib;
}

function pixelAt(x, y) {
  const logicalX = (x / size) * logicalSize;
  const logicalY = (y / size) * logicalSize;
  const cx = 32;
  const cy = 35;
  const dx = logicalX - cx;
  const dy = logicalY - cy;
  const inBody = dx * dx / (23 * 23) + dy * dy / (21 * 21) <= 1;
  const inLeftEar = pointInTriangle(logicalX, logicalY, [15, 24], [22, 7], [31, 25]);
  const inRightEar = pointInTriangle(logicalX, logicalY, [33, 25], [44, 7], [50, 24]);
  const inOutline =
    dx * dx / (26 * 26) + dy * dy / (24 * 24) <= 1 ||
    pointInTriangle(logicalX, logicalY, [12, 25], [21, 3], [33, 27]) ||
    pointInTriangle(logicalX, logicalY, [31, 27], [45, 3], [53, 25]);
  const inEye =
    distanceSquared(logicalX, logicalY, 25, 32) <= 9 ||
    distanceSquared(logicalX, logicalY, 39, 32) <= 9;
  const inMouth =
    logicalY >= 43 &&
    logicalY <= 46 &&
    Math.abs(logicalX - 32) <= 8 &&
    Math.abs(logicalY - (45 - Math.abs(logicalX - 32) * 0.18)) < 1.4;

  if (inEye || inMouth) {
    return rgba(47, 36, 58, 255);
  }
  if (inBody || inLeftEar || inRightEar) {
    return rgba(247, 178, 103, 255);
  }
  if (inOutline) {
    return rgba(47, 36, 58, 255);
  }
  return rgba(0, 0, 0, 0);
}

function pointInTriangle(x, y, a, b, c) {
  const area = triangleArea(a, b, c);
  const areaA = triangleArea([x, y], b, c);
  const areaB = triangleArea(a, [x, y], c);
  const areaC = triangleArea(a, b, [x, y]);
  return Math.abs(area - (areaA + areaB + areaC)) < 0.3;
}

function triangleArea(a, b, c) {
  return Math.abs((a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) / 2);
}

function distanceSquared(x, y, cx, cy) {
  return (x - cx) * (x - cx) + (y - cy) * (y - cy);
}

function rgba(r, g, b, a) {
  return { r, g, b, a };
}
