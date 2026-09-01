# Unified OCTGN Cloudflare feed

This new Worker serves one public NuGet V2/OData feed for **Ranma Card Game** and **Epic Battles Online**. A private R2 bucket named `octgn-game-data` stores packages, manifests, card images, image packs, and future game data.

The existing MyGet feeds, Google/Dropbox files, and `epic-battles-online-octgn-feed` Worker are intentionally left untouched as backups.

## Public routes

- `/` — OCTGN/NuGet V2 feed URL
- `/Packages` — package catalog containing both games
- `/Packages(Id='...',Version='...')/$value` — R2-backed package download
- `/assets/ranma/...` — Ranma manifests, resources, and images
- `/assets/epic-battles-online/...` — Epic Battles manifests, resources, and images

## R2 layout

```text
packages/ranma/
packages/epic-battles-online/
games/ranma/manifest.json
games/ranma/images/<set-guid>/<card-guid>.jpg
games/ranma/resources/cardback.jpg
games/epic-battles-online/manifest.json
games/epic-battles-online/images/<set-guid>/<card-guid>.jpg
games/epic-battles-online/resources/cardback.jpg
```

## Test

```powershell
npm test
```

## Deploy

R2 must be activated first. Create `octgn-game-data`, upload the release payload, then deploy this Worker. The intended feed URL is:

```text
https://octgn-multi-game-feed.awesome-mole.workers.dev/
```
