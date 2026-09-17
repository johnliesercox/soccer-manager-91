# Soccer Manager '91

A phone-first football management game in the spirit of the 1991 Amiga originals. One HTML file plus a manifest, a service worker and two icons.

## Put it online with GitHub Pages (about ten minutes)

1. Create a free GitHub account if you don't have one, then create a new repository called `soccer-manager-91`. Tick "Add a README" so it isn't empty.
2. On the repository page click **Add file > Upload files** and drag in every file from this folder: `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` (and this README if you like). Click **Commit changes**.
3. Go to **Settings > Pages**. Under "Build and deployment" set Source to **Deploy from a branch**, Branch to **main** and folder to **/ (root)**. Save.
4. Wait a minute, refresh the Pages settings, and the URL appears: `https://<your-username>.github.io/soccer-manager-91/`.

Open that on your phone. In Safari tap Share > **Add to Home Screen**; in Chrome on Android use the menu > **Add to Home screen** (or the install banner). It then opens full screen, works offline, and saves live in the browser on that phone.

## Updating the game

Upload the new `index.html` over the old one (same steps as 2) and commit. Players get the new version the next time they open it online; their saves carry over because the game migrates old save formats.

If you want offline visitors to pick up an update immediately, also change the `VERSION` string at the top of `sw.js`.

## Feedback link

In `index.html`, near the top of the script, set `const FEEDBACK_URL = '';` to a Google Form link and a "Send feedback" button appears on the title screen.

## Notes

* Saves are stored in the browser on that phone (localStorage). Clearing site data clears them. The in-game Saves screen keeps up to eight named copies.
* Club and competition names are the real 1991 ones. If the game ever grows beyond a hobby release, swap them for fictional ones; the rename screen already exists for this.
