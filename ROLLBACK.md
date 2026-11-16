# Rolling back

The site is a handful of static files on GitHub Pages. Going back to a release means putting that release's `index.html`
and `sw.js` back at the root of the repository; nothing else about the site or anyone's saved games changes.

## Before every release: tag what is live

On GitHub: **Releases > Draft a new release > Choose a tag**, type the version that is live now (for the 1.6.0 release
that is `v1.5.0`), target `main`, publish. Do this *before* uploading the new files, so the tag points at the live commit.
Tag the new release the same way once it is up (`v1.6.0`). A tag is a named, permanent copy of every file at that moment;
any of them can be browsed and downloaded from the Tags page.

For 1.5.0 there is also a copy inside the repository, so no tag is needed to go back to it: `legacy/release-1.5.0/`
holds the exact `index.html`, `sw.js`, `manifest.webmanifest` and icons the site served (commit `382dc2e`,
14 November 2026, `index.html` md5 `16c61cc2578c20470a57ba1287de53b9`).

## To put 1.5.0 back

1. Take `legacy/release-1.5.0/index.html` and `legacy/release-1.5.0/sw.js`.
2. In that `sw.js`, change the one line `const VERSION = 'sm91-v1.5.0';` to a name no phone has seen before, for example
   `const VERSION = 'sm91-v1.5.0-r1';`. The service worker on an installed phone only refreshes its offline copy when
   `sw.js` changes; re-using the old name would leave some phones showing the newer game until their next online visit.
3. Upload both over the root `index.html` and `sw.js` (**Add file > Upload files**, drag, commit). GitHub Pages serves
   them within a minute or two.
4. Open the site, pull to refresh once, and check the title screen says "Version 1.5.0".

Saved games: both releases use save format 4 and the game never clears or rewrites storage on a version change, so a
game saved under 1.6.0 opens in 1.5.0 and vice versa (`tools/save-compat.js` checks the forward direction before each
release; the reverse was checked by hand for 1.6.0). The What's new flag will show once; that is all.

## To go back to any other tagged release

Open the tag on GitHub (Tags > the version > Browse files), download `index.html` and `sw.js` from it, bump `VERSION`
in `sw.js` as above, upload both over the root files, commit.

## What a rollback does not touch

`worker/` (the ladder's Cloudflare worker) is deployed separately and has not changed since 1.1.1. The icons and manifest
are the same in every release so far. Nothing in a rollback can delete or alter a player's saves: they live in the
browser's storage on their own phone, keyed by name, and only the player can delete them.
