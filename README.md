# Ranma Card Game OCTGN

OCTGN game definition, releases, and hosted card-image manifests for the Ranma Card Game project.

## Install

Download [the latest Ranma OCTGN installer](https://github.com/JoePerry/Ranma/raw/refs/heads/main/downloads/Ranma-Card-Game-latest.o8g), open the downloaded `.o8g`, and restart OCTGN after installation.

Current version: `0.2.1.0`

Card images are maintained separately through `manifest.json`. The current host contains 117 images and records five pending cards for later incremental updates.

## Image downloader plugin

Source for the Deck Editor image downloader is in `plugin/RanmaImageDownloader`. It reads `manifest.json`, downloads only missing artwork into OCTGN's set image directories, and verifies SHA-256 checksums.

See `plugin/RanmaImageDownloader/README.md` for build and testing instructions.
