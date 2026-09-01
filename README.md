# Ranma Card Game OCTGN

OCTGN game definition, releases, and hosted card-image manifests for the Ranma Card Game project.

## Install

Add `https://octgn-multi-game-feed.awesome-mole.workers.dev/` as an OCTGN game feed, choose **Ranma Card Game**, and install it. The same feed also offers Epic Battles Online.

Current version: `0.2.5.0`

Card images are maintained separately through `manifest.json`. The current host contains 117 images and records five pending cards for later incremental updates.

## Image downloader plugin

Source for the Deck Builder image downloader is in `plugin/RanmaImageDownloader`. It appears as **Plugins > Ranma Image Downloader** so it does not collide with OCTGN's existing generic downloader, while preserving the familiar set list and **Update Selected Set** / **Update All Sets** workflow. Updates read `manifest.json`, use the existing set-GUID/card-GUID image directories, and verify SHA-256 checksums.

There is one player-facing package and one shared feed URL. The Ranma package installs the game definition and its downloader together; players do not download or place a separate DLL. Card artwork is hosted in Cloudflare R2 and is downloaded only when the player chooses an update action. The previous GitHub and MyGet locations remain available as backups.

See `plugin/RanmaImageDownloader/README.md` for build and testing instructions.
