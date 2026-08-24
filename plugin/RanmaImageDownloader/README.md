# Ranma OCTGN Image Downloader

A minimal OCTGN Deck Editor plugin that installs missing Ranma Card Game artwork from this repository's `manifest.json`.

## What it does

- Registers **Ranma Card Game - Download Missing Images** in the Deck Editor Plugins menu.
- Verifies the installed game GUID is `05ce00ff-544c-5fc1-81ca-387b109116d4`.
- Downloads the current manifest from the repository's `main` branch.
- Uses each manifest entry's set GUID and card GUID to write the image to OCTGN's normal set image directory.
- Skips images already installed.
- Validates SHA-256 when the manifest supplies it.
- Reports artwork intentionally listed as pending in the manifest.

## Build

This is a .NET Framework 4.8 class library, matching the current OCTGN/MTG image-downloader plugin architecture.

Set `OCTGN_DIR` to the directory containing `Octgn.Core.dll` and `Octgn.DataNew.dll`, then build:

```bat
set OCTGN_DIR=C:\Path\To\OCTGN
msbuild RanmaImageDownloader.csproj /p:Configuration=Release
```

The output is `bin\Release\RanmaImageDownloader.dll`.

## Install for testing

Copy `RanmaImageDownloader.dll` into OCTGN's plugin directory, restart OCTGN, open the Deck Editor, and choose:

**Plugins > Ranma Card Game - Download Missing Images**

This first version intentionally has one action: download anything missing. It does not overwrite existing artwork.
