# Deskagotchi Desktop App

Deskagotchi is a local Electron desktop companion. It opens as a small
transparent pet overlay, keeps state on the user's machine, and exposes recovery
and settings actions through the tray/menu bar.

## Download

V2 releases should publish desktop downloads for both Windows and macOS from the
project's GitHub Releases page. The `Desktop Release Artifacts` GitHub Actions
workflow builds these files for manual runs and attaches them automatically when
a `v*` tag is pushed.

| Platform | Download | Use when |
| --- | --- | --- |
| Windows | `Deskagotchi Setup <version>.exe` | Normal Windows install. |
| Windows portable QA | `win-unpacked/Deskagotchi.exe` | Local package smoke testing only; prefer the installer for users. |
| macOS Apple silicon | `Deskagotchi <version> arm64.dmg` or the matching arm64 zip | Macs with Apple silicon. |
| macOS Intel | `Deskagotchi <version> x64.dmg` or the matching x64 zip | Intel Macs. |

If a platform asset is missing from a release, that platform has not been
published for that release yet.

## Install And Run On Windows

1. Download `Deskagotchi Setup <version>.exe`.
2. Run the installer and choose an install directory if prompted.
3. Launch Deskagotchi from the installer, Start menu, or desktop shortcut.
4. If Windows SmartScreen appears on an unsigned build, choose whether to trust
   the build source before continuing.

Deskagotchi opens as a compact transparent pet overlay. Use the tray icon to
show, hide, reset, feed, play, open settings, or quit.

## Install And Run On macOS

1. Download the build that matches the Mac architecture:
   - Apple silicon: arm64.
   - Intel: x64.
2. Open the `.dmg` and drag Deskagotchi to Applications, or unzip the matching
   `.zip` build.
3. Launch Deskagotchi from Applications.
4. If macOS blocks an unsigned or unnotarized local build, use Finder's Open
   action and only continue when the build source is trusted.

The macOS package is prepared for V2 distribution, but the strongest automated
desktop QA evidence is currently Windows-based. Run a manual macOS smoke before
publishing a macOS asset.

## Use The App

- Drag the visible pet to move it around the desktop.
- Use the tray/menu bar action to recover the pet if it is hidden or off-screen.
- Feed, play, clean, sleep, and health actions run in the compact overlay.
- Use Settings for always-on-top, startup, sound, reduced motion, low
  maintenance, and notifications.
- Use the pet selector to switch built-in pets.
- Import or export `.deskagotchi-pet` packages from the management panel.

Deskagotchi stores data locally in Electron's `userData` directory. The Settings
panel shows the resolved path. The main files are:

- `deskagotchi-save.json`
- `deskagotchi-save.backup.json`
- `custom-pets/`
- `exports/`

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Pet is hidden or off-screen | Use the tray/menu bar action to show or reset position. |
| App seems stuck after sleep/wake | Use the tray/menu bar action to show the pet, then open health/settings to confirm state refreshed. |
| You want a clean local state | Quit Deskagotchi, then remove the files in the app's `userData` directory. |
| Windows shows SmartScreen | Confirm the release source before choosing to run an unsigned build. |
| macOS blocks first launch | Use Finder's Open flow only if the release source is trusted. |

## Build From Source

Install dependencies:

```powershell
pnpm install --frozen-lockfile
```

Build the app bundle:

```powershell
pnpm run build
```

Build the Windows installer on Windows:

```powershell
pnpm run package:win
```

Build macOS DMG and zip artifacts on macOS:

```bash
pnpm install --frozen-lockfile
pnpm run package:mac
```

macOS builds should be created on macOS. Local V2 macOS builds are unsigned
unless a signing and notarization workflow is added.

## Release Publisher Checklist

1. Run the release validation for the platform being published.
2. Attach the Windows installer to the release.
3. Attach macOS arm64 and x64 DMG or zip artifacts when they have passed manual
   smoke testing.
4. Keep release notes honest about signing/notarization status and the current
   QA scope.
5. Link this document from the release notes so users know how to install,
   recover, and quit the app.

## GitHub Release Workflow

The release artifact workflow lives at
`.github/workflows/desktop-release-artifacts.yml`.

- Manual runs upload Windows and macOS artifacts to the workflow run.
- `v*` tag pushes build the same artifacts and publish them to the matching
  GitHub Release.
- The workflow regenerates icon outputs before packaging, so `build/icon-source.png`
  must stay committed.
