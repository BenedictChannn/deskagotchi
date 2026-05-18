# V2 PR Readiness

Use this as the PR prep checklist before opening or updating the V2 pull
request.

## PR Summary

Deskagotchi V2 is a desktop companion release centered on the transparent pet
overlay, built-in original pets, deterministic care simulation, package safety,
desktop recovery behavior, and packaged desktop distribution.

## User-Facing Scope

- Compact transparent pet overlay with drag, tray/menu recovery, and in-overlay
  care actions.
- Built-in original pet roster: Bao, Miso, Mochi, Peanut, and Puddles.
- Deterministic local care simulation with offline catch-up.
- Hatch/custom pet generation and custom pet loading/import/export remain deferred from
  the user-facing v0.1 app.
- Desktop app downloads should be published for Windows first. macOS downloads
  require separate macOS smoke evidence before publication.

## PR Links To Include

- Desktop app instructions: `docs/desktop-app.md`
- App icon source and regeneration notes: `docs/design/app-icon.md`
- V2 closeout evidence: `docs/qa/v2-closeout-report.md`
- Visual review notes: `docs/qa/v2-visual-review-notes.md`
- Manual acceptance runbook: `docs/qa/v2-manual-acceptance-runbook.md`

## Release Artifact Checklist

| Platform | Command | Expected artifact |
| --- | --- | --- |
| Windows | `pnpm run package:win` | `release/Deskagotchi Setup <version>.exe` |
| macOS | `pnpm run package:mac` on macOS | Local smoke artifacts only unless manually validated |

Attach the Windows installer to the v0.1 release after release smoke passes.
Attach macOS artifacts only when they have passed platform smoke testing. Keep
release notes explicit about unsigned or unnotarized builds.

The `Desktop Release Artifacts` workflow keeps release QA evidence in the
workflow run, uploads the Windows installer plus `.sha256` checksum as build
artifacts, and publishes only those download artifacts to a GitHub Release when
a matching `v*` tag is pushed.

## Validation Before PR

```powershell
pnpm run generate:icon
pnpm run check
pnpm run qa
$env:DESKAGOTCHI_IDLE_SECONDS='300'; pnpm run qa:desktop:idle
pnpm run qa:release
pnpm run qa:v2:closeout
```

`pnpm run qa:v2:closeout` is the release gate and requires passing manual
acceptance evidence. For PR-only automated evidence checks, use
`pnpm run qa:v2:automated-closeout`.

Run `pnpm run package:mac` and a manual macOS launch smoke on macOS before
publishing macOS downloads. The current automated desktop QA evidence is
Windows-based.

Publish the release-note draft at `docs/release-notes/v0.1.0.md` and keep the
public landing page at `site/index.html` aligned with the exact release
candidate. Avoid committing duplicate landing-page snapshots or generated
release-note HTML unless there is a specific review need.

## Suggested PR Body

```markdown
## Summary
- ship the Deskagotchi V2 desktop companion scope
- add Windows packaging metadata and app icon assets
- add a release workflow for Windows desktop downloads
- document desktop app download, install, usage, troubleshooting, and release artifact flow

## Validation
- pnpm run check
- pnpm run qa
- DESKAGOTCHI_IDLE_SECONDS=300 pnpm run qa:desktop:idle
- pnpm run qa:release
- pnpm run qa:v2:closeout

## Release Notes
- Windows installer: attach `Deskagotchi Setup <version>.exe`
- macOS: do not attach artifacts unless macOS smoke testing passes
- Unsigned builds may show SmartScreen or first-launch warnings
- Custom pets are not exposed in v0.1
```
