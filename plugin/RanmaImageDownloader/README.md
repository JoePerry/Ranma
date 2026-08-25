# Ranma OCTGN Image Downloader

This Deck Builder plugin follows OCTGN's familiar Image Downloader workflow while adding Ranma Card Game support.

## Player workflow

1. Install the Ranma `.o8g` and restart OCTGN.
2. Open the Deck Builder and choose **Plugins > Ranma Image Downloader**.
3. Select a Ranma set and choose **Update Selected Set**, or choose **Update All Sets**.

The window reports how many images from each set are installed. An update downloads the current copy of every available image in the selected set, so it can both install missing artwork and replace older artwork.

## Image source and local layout

The plugin is restricted to the Ranma game GUID `05ce00ff-544c-5fc1-81ca-387b109116d4`. It reads `https://raw.githubusercontent.com/JoePerry/Ranma/main/manifest.json` and uses the same convention locally and on GitHub:

`images/<set-guid>/<card-guid>.jpg`

Catalog checksums are verified before an image replaces the installed copy. Cards listed as pending remain visible in the set status and are not treated as download failures.

## Installation

Players install one Ranma `.o8g`. It contains the game and `def/Plugins/RanmaImageDownloader/RanmaImageDownloader.dll`, which OCTGN copies into its plugin directory during game installation. Card images remain on GitHub and are not bundled into the `.o8g`.

For manual testing, copy the DLL to OCTGN's `Data/Plugins/RanmaImageDownloader` folder, restart OCTGN, and use the Deck Builder workflow above.

## Build

This is a .NET Framework 4.8 class library built against OCTGN 3.4.428.0 by the repository workflow. For a local build, set `OCTGN_DIR` to the directory containing `Octgn.Core.dll` and `Octgn.DataNew.dll`, then run:

```bat
msbuild RanmaImageDownloader.csproj /p:Configuration=Release
```
