# Bastion Pocket

Habits, Puzzles, Languages and Notes as an installable web app. No server: data lives in the phone's browser storage (IndexedDB). Android: browser menu, Install app. iPhone: Safari, Share, Add to Home Screen.

## Develop
Node 22: `npm install`, `npx nuxi dev`, `npx nuxi generate` (output in `.output/public`).
On the pve host (no node) use `scripts/build.sh`, which builds inside CT 104 and fills `dist/`.

## Deploy (Cloudflare Pages)
Connect this repo to Cloudflare Pages: build command `npx nuxi generate`, output directory `.output/public`, Node 22. `public/_redirects` sends unknown paths to the SPA shell, `public/_headers` keeps the service worker uncached.

## Add-ons
Each add-on keeps its UI from the main Bastion repo and replaces its server routes with browser code in `app/local/<addon>.ts` (`defineLocal` + IndexedDB `kv`). AI, TTS server and other server-only features are left out. Backup and restore: /backup.
