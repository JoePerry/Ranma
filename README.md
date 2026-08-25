# Ranma Card Game OCTGN

OCTGN game definition, releases, and hosted card-image manifests for the Ranma Card Game project.

## Install

Download [the latest Ranma OCTGN installer](https://github.com/JoePerry/Ranma/raw/refs/heads/main/downloads/Ranma-Card-Game-latest.o8g), open the downloaded `.o8g`, and restart OCTGN after installation.

Current version: `0.2.1.0`

Card images are maintained separately through `manifest.json`. The current host contains 117 images and records five pending cards for later incremental updates.

## Image downloader plugin

Source for the Deck Builder image downloader is in `plugin/RanmaImageDownloader`. It appears as **Plugins > Ranma Image Downloader** so it does not collide with OCTGN's existing generic downloader, while preserving the familiar set list and **Update Selected Set** / **Update All Sets** workflow. Updates read `manifest.json`, use the existing set-GUID/card-GUID image directories, and verify SHA-256 checksums.

The `.o8g` stays lightweight: only the plugin DLL is installed with the game. Card artwork remains hosted on GitHub and is downloaded only when the player chooses an update action.

See `plugin/RanmaImageDownloader/README.md` for build and testing instructions.
