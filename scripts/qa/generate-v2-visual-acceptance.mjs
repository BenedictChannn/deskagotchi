import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const PETS_ROOT = path.join(ROOT_DIR, "resources", "pets");
const ITEMS_MANIFEST = path.join(ROOT_DIR, "resources", "items", "lcd-core", "items.json");
const OUTPUT_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-visual-acceptance.html");

function main() {
  const pets = loadBuiltInPets();
  const items = JSON.parse(fs.readFileSync(ITEMS_MANIFEST, "utf8"));
  fs.writeFileSync(OUTPUT_PATH, renderPage(pets, items), "utf8");
  console.log(`Visual acceptance page: ${OUTPUT_PATH}`);
}

function loadBuiltInPets() {
  return fs
    .readdirSync(PETS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const packageDir = path.join(PETS_ROOT, entry.name);
      const manifest = JSON.parse(
        fs.readFileSync(path.join(packageDir, "pet.json"), "utf8")
      );
      return {
        id: entry.name,
        manifest
      };
    })
    .filter(({ manifest }) => manifest.source === "built-in")
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

function renderPage(pets, itemManifest) {
  const petCards = pets.map(renderPetCard).join("\n");
  const mealCount = itemManifest.items.filter((item) => item.category === "meal").length;
  const snackCount = itemManifest.items.filter((item) => item.category === "snack").length;
  const toyCount = itemManifest.items.filter((item) => item.category === "toy").length;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Deskagotchi V2 Visual Acceptance</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #f7f8e7;
        --lcd: #dceca8;
        --ink: #123716;
        --mid: #668649;
        --line: rgba(18, 55, 22, 0.3);
        --white: #fffef2;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      }

      main {
        width: min(1280px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 24px 0 44px;
      }

      header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        align-items: end;
        border-bottom: 2px solid var(--line);
        padding-bottom: 18px;
      }

      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 24px; }
      h2 { font-size: 18px; }
      h3 { font-size: 14px; }

      a {
        color: var(--ink);
        text-decoration-thickness: 2px;
      }

      .summary {
        max-width: 760px;
        margin-top: 8px;
        color: rgba(18, 55, 22, 0.76);
        font-size: 13px;
        line-height: 1.5;
      }

      .stamp {
        border: 2px solid var(--ink);
        background: var(--lcd);
        padding: 8px 10px;
        font-size: 12px;
        text-align: right;
      }

      .section {
        margin-top: 24px;
        padding-top: 18px;
        border-top: 2px solid var(--line);
      }

      .acceptance-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
      }

      .check {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 8px;
        border: 2px solid var(--line);
        background: var(--white);
        padding: 10px;
        min-height: 58px;
      }

      .check input {
        width: 16px;
        height: 16px;
        accent-color: var(--ink);
      }

      .check span {
        font-size: 12px;
        line-height: 1.35;
      }

      .pet-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 14px;
      }

      .pet-card,
      .food-review {
        border: 2px solid var(--ink);
        background: var(--lcd);
        padding: 12px;
      }

      .pet-header {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 12px;
        align-items: center;
      }

      .preview {
        width: 72px;
        height: 72px;
        image-rendering: pixelated;
        border: 2px solid var(--line);
        background: var(--paper);
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .chip {
        border: 1px solid var(--mid);
        background: var(--white);
        padding: 3px 6px;
        font-size: 11px;
      }

      .contact {
        display: block;
        width: 100%;
        max-height: 520px;
        object-fit: contain;
        margin-top: 12px;
        border: 2px solid var(--line);
        background: var(--paper);
        image-rendering: pixelated;
      }

      .pet-notes {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 10px;
        font-size: 12px;
        line-height: 1.4;
      }

      .food-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 14px;
      }

      .food-review img {
        display: block;
        width: 100%;
        max-height: 420px;
        object-fit: contain;
        margin-top: 10px;
        border: 2px solid var(--line);
        background: var(--paper);
        image-rendering: pixelated;
      }

      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
        font-size: 12px;
      }

      @media (max-width: 900px) {
        header,
        .acceptance-grid,
        .pet-grid,
        .food-grid,
        .pet-notes {
          grid-template-columns: 1fr;
        }

        .stamp { text-align: left; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Deskagotchi V2 Visual Acceptance</h1>
          <p class="summary">
            Use this page for the final manual review of built-in pets, animation
            consistency, and LCD food/icon recognizability. The checkboxes are
            intentionally local review aids; record final acceptance in the V2 audit.
          </p>
        </div>
        <div class="stamp">
          ${pets.length} pets<br />
          ${mealCount} meals / ${snackCount} snacks / ${toyCount} toys
        </div>
      </header>

      <section class="section">
        <h2>Manual Acceptance Criteria</h2>
        <div class="acceptance-grid">
          ${[
            "Every pet reads as its intended animal at overlay size.",
            "Animation rows have visible expression or motion changes.",
            "Frame size and anchor shifts are not distracting.",
            "Food icons are roughly identifiable without labels.",
            "Eating cues match the selected item well enough to notice.",
            "Overall LCD style is cohesive across pets and food."
          ]
            .map((label) => `<label class="check"><input type="checkbox" /><span>${label}</span></label>`)
            .join("\n          ")}
        </div>
      </section>

      <section class="section">
        <h2>Pet Review</h2>
        <div class="links">
          <a href="./pet-animation-gallery.html">Animated pet gallery</a>
          <a href="./v2-completion-audit.md">V2 completion audit</a>
        </div>
        <div class="pet-grid">
          ${petCards}
        </div>
      </section>

      <section class="section">
        <h2>Food And Item Review</h2>
        <div class="food-grid">
          <article class="food-review">
            <h3>Food icons only</h3>
            <p class="summary">Focused sheet for meal and snack recognizability.</p>
            <img src="./lcd-food-icons-contact-sheet.png" alt="LCD food icon contact sheet" />
          </article>
          <article class="food-review">
            <h3>Full item atlas</h3>
            <p class="summary">Full care item set, including food, play, medicine, sleep, and settings icons.</p>
            <img src="./lcd-item-icons-contact-sheet.png" alt="LCD item icon contact sheet" />
          </article>
        </div>
      </section>
    </main>
  </body>
</html>
`;
}

function renderPetCard({ id, manifest }) {
  const animationIds = manifest.animations.map((animation) => animation.id).join(", ");
  const preferredFoods = manifest.preferredFoods.join(", ");
  const speciesFoods = [
    ...(manifest.foodPreferences?.speciesMealIds ?? []),
    ...(manifest.foodPreferences?.speciesSnackIds ?? [])
  ].join(", ");

  return `<article class="pet-card">
            <div class="pet-header">
              <img class="preview" src="../../resources/pets/${id}/preview.png" alt="${manifest.name} preview" />
              <div>
                <h3>${manifest.name}</h3>
                <div class="chips">
                  <span class="chip">${manifest.species}</span>
                  <span class="chip">${manifest.personality}</span>
                </div>
              </div>
            </div>
            <img class="contact" src="./${id}-contact-sheet.png" alt="${manifest.name} animation contact sheet" />
            <div class="pet-notes">
              <div><strong>Preferred foods</strong><br />${preferredFoods}</div>
              <div><strong>Species food ids</strong><br />${speciesFoods}</div>
              <div><strong>Animations</strong><br />${animationIds}</div>
              <div><strong>Palette</strong><br />${manifest.colorPalette.join(", ")}</div>
            </div>
          </article>`;
}

main();
