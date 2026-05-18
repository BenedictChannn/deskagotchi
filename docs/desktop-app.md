# Deskagotchi Desktop App

Deskagotchi is a local Electron desktop companion. It opens as a small
transparent pet overlay, keeps state on the user's machine, and exposes recovery
and settings actions through the tray/menu bar.

## Download

v0.1 releases should use GitHub Pages for the public landing page and GitHub
Releases for the Windows installer. The landing page source lives in
`site/index.html`; the installer should stay attached to the matching GitHub
Release instead of being hosted from the website.

The `Desktop Release Artifacts` GitHub Actions workflow builds the Windows
installer for manual runs and attaches it automatically when a matching `v*` tag
is pushed after release smoke passes. Tagged releases attach only the Windows
installer and its `.sha256` checksum file to the public GitHub Release.

| Platform | Download | Use when |
| --- | --- | --- |
| Windows | `Deskagotchi Setup <version>.exe` | Normal Windows install. |
| Windows portable QA | `win-unpacked/Deskagotchi.exe` | Local package smoke testing only; prefer the installer for users. |
| macOS | Not published for v0.1 unless a real macOS smoke pass is completed. | Local development/testing only. |

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

## macOS Status

macOS packaging can still be built locally on macOS, but v0.1 should not publish
macOS downloads unless a real Mac smoke pass covers first launch, app bundle
behavior, and unsigned or unnotarized first-run warnings.

## Use The App

- Drag the visible pet to move it around the desktop.
- Use the tray/menu bar action to recover the pet if it is hidden or off-screen.
- Feed, play, clean, sleep, and health actions run in the compact overlay.
- Use Settings for always-on-top, startup, sound, reduced motion, low
  maintenance, and notifications.
- Use the pet selector to switch built-in pets.
- Custom pet import/export is not exposed in v0.1.

Deskagotchi stores data locally in Electron's `userData` directory. The Settings
panel shows the resolved path. The main files are:

- `deskagotchi-save.json`
- `deskagotchi-save.backup.json`
- reserved internal package directories, if created by older development builds

Deskagotchi v0.1 does not require an account, analytics, remote telemetry in
normal use, or remote sync. Normal pet state stays in the local `userData`
directory. QA harnesses can write local event logs only when explicit QA mode is
enabled.

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

macOS builds should be created on macOS. Local v0.1 macOS builds are unsigned
unless a signing and notarization workflow is added. Do not attach macOS assets
to a v0.1 public release without manual macOS smoke evidence.

## Release Publisher Checklist

1. Run the release validation for the platform being published.
2. Update `site/index.html` and the release notes so page claims match the exact
   release candidate.
3. Attach the Windows installer to the GitHub Release.
4. Attach macOS artifacts only when they have passed manual macOS smoke testing.
5. Keep release notes honest about signing/notarization status and the current
   QA scope.
6. Link this document from the release notes so users know how to install,
   recover, and quit the app.

## GitHub Release Workflow

The release artifact workflow lives at
`.github/workflows/desktop-release-artifacts.yml`.

- Manual runs upload the Windows installer and release QA evidence to the
  workflow run.
- Matching `v*` tag pushes build the Windows installer, generate a SHA256
  checksum, and publish only those release assets to the matching GitHub
  Release.
- The tag name must match `package.json` version, for example `v0.1.0`.

## GitHub Pages Workflow

The public landing page workflow lives at `.github/workflows/github-pages.yml`.

- It deploys the static site from `site/`.
- It runs on manual dispatch and on `main` pushes that touch `site/**` or the
  Pages workflow.
- The repository's Pages settings must use GitHub Actions as the source before
  the first public deploy.
- The download CTA should link to the GitHub Release asset or release page, not
  to a checked-in installer.
