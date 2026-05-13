import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "build");
const sourcePath = path.join(outputDir, "icon-source.png");
const pngPath = path.join(outputDir, "icon.png");
const icoPath = path.join(outputDir, "icon.ico");
const icnsPath = path.join(outputDir, "icon.icns");

const PYTHON_ICON_SCRIPT = String.raw`
from io import BytesIO
import struct
import sys

try:
    from PIL import Image
except Exception as exc:
    raise SystemExit(f"Pillow is required: {exc}")

source_path, png_path, ico_path, icns_path = sys.argv[1:5]

source = Image.open(source_path).convert("RGBA")

def alpha_bbox(image):
    alpha = image.getchannel("A")
    return alpha.getbbox() or (0, 0, image.width, image.height)

def fitted_icon(size):
    bbox = alpha_bbox(source)
    cropped = source.crop(bbox)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    max_side = int(size * 0.86)
    cropped.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    x = (size - cropped.width) // 2
    y = (size - cropped.height) // 2
    canvas.alpha_composite(cropped, (x, y))
    return canvas

def png_bytes(image):
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()

def write_icns(path):
    chunks = []
    for code, size in [
        (b"icp4", 16),
        (b"icp5", 32),
        (b"icp6", 64),
        (b"ic07", 128),
        (b"ic08", 256),
        (b"ic09", 512),
        (b"ic10", 1024),
    ]:
        data = png_bytes(fitted_icon(size))
        chunks.append(code + struct.pack(">I", len(data) + 8) + data)
    body = b"".join(chunks)
    with open(path, "wb") as handle:
        handle.write(b"icns" + struct.pack(">I", len(body) + 8) + body)

icon_1024 = fitted_icon(1024)
icon_1024.save(png_path, format="PNG", optimize=True)

icon_256 = fitted_icon(256)
icon_256.save(
    ico_path,
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
write_icns(icns_path)

for generated_path in [png_path, ico_path, icns_path]:
    print(f"Wrote {generated_path}")
`;

if (!existsSync(sourcePath)) {
  throw new Error(
    `Missing ${path.relative(projectRoot, sourcePath)}. Generate or restore the icon source before running this script.`
  );
}

await mkdir(outputDir, { recursive: true });

const python = resolvePython();
const result = spawnSync(
  python.command,
  [...python.args, "-c", PYTHON_ICON_SCRIPT, sourcePath, pngPath, icoPath, icnsPath],
  {
    cwd: projectRoot,
    stdio: "inherit"
  }
);

if (result.status !== 0) {
  throw new Error(
    "Icon generation failed. Install Pillow for the active Python runtime with `python -m pip install pillow`."
  );
}

function resolvePython() {
  const candidates = [
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
    { command: "python3", args: [] }
  ];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.args, "-c", "import sys; print(sys.version)"], {
      encoding: "utf8"
    });
    if (probe.status === 0) {
      return candidate;
    }
  }

  throw new Error("Python 3 is required to regenerate app icons from build/icon-source.png.");
}
