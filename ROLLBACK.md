# Rolling back

(19 November 2026: release 1.7.1, the hair fix, is approved on the branch `milestone-0-hair` and, by John's decision, not deployed; the tag `v1.7.0` now exists at `cde3c8f`, the live commit. If it is published, the version to put back is 1.7.0, from `legacy/release-1.7.0/`, by the steps below with that folder and number; saves are format 4 in both, and `tools/save-compat.js` was run in both directions between them.)

(State on the evening of 18 November 2026: the live site is 1.7.0, `main` at `fe24d6c`. The tag `v1.6.0` exists at `97a0748`; the tag `v1.7.0` is John's to create once he has checked the live site. Nothing below has had to be used. The version to put back, if it ever has to be, is 1.6.0, exactly as described here.)

The site is a handful of static files on GitHub Pages. Going back to a release means putting that release's `index.html`
and `sw.js` back at the root of the repository; nothing else about the site or anyone's saved games changes.

## Before every release: tag what is live

On GitHub: **Releases > Draft a new release > Choose a tag**, type the version that is live now (for the 1.7.0 release
that is `v1.6.0`), target `main`, publish. Do this *before* uploading the new files, so the tag points at the live commit.
Tag the new release the same way once it is up (`v1.7.0`). A tag is a named, permanent copy of every file at that moment;
any of them can be browsed and downloaded from the Tags page.

For the last three releases there is also a copy inside the repository, so no tag is needed to go back to any of them:

* `legacy/release-1.7.0/` holds the exact `index.html`, `sw.js`, `manifest.webmanifest` and icons the site served as
  1.7.0 (commit `cde3c8f` on `main`, 18 November 2026, `index.html` md5 `7976271030be0bb85d7fd7cf38b11f8d`).
* `legacy/release-1.6.0/` holds the exact `index.html`, `sw.js`, `manifest.webmanifest` and icons the site served as
  1.6.0 (commit `97a0748`, 16 November 2026, `index.html` md5 `7321f34080031caf23f96212644ed046`).
* `legacy/release-1.5.0/` holds the same for 1.5.0 (commit `382dc2e`, 14 November 2026, `index.html` md5
  `16c61cc2578c20470a57ba1287de53b9`).

## To put 1.6.0 back (or 1.5.0: the same steps with its folder and number)

1. Take `legacy/release-1.6.0/index.html` and `legacy/release-1.6.0/sw.js`.
2. In that `sw.js`, change the one line `const VERSION = 'sm91-v1.6.0';` to a name no phone has seen before, for example
   `const VERSION = 'sm91-v1.6.0-r1';`. The service worker on an installed phone only refreshes its offline copy when
   `sw.js` changes; re-using the old name would leave some phones showing the newer game until their next online visit.
3. Upload both over the root `index.html` and `sw.js` (**Add file > Upload files**, drag, commit). GitHub Pages serves
   them within a minute or two.
4. Open the site, pull to refresh once, and check the title screen says "Version 1.6.0".

Saved games: 1.5.0, 1.6.0 and 1.7.0 all use save format 4 and the game never clears or rewrites storage on a version
change, so a game saved under a newer one opens in an older one and vice versa (`tools/save-compat.js` checks the forward
direction before each release; the reverse was checked for 1.6.0 to 1.5.0 by hand and for 1.7.0 to 1.6.0 by running the
tool with its two folders swapped). The What's new flag will show once; that is all.

## To go back to any other tagged release

Open the tag on GitHub (Tags > the version > Browse files), download `index.html` and `sw.js` from it, bump `VERSION`
in `sw.js` as above, upload both over the root files, commit.

## What a rollback does not touch

`worker/` (the ladder's Cloudflare worker) is deployed separately and has not changed since 1.1.1. The icons are the
same in every release so far. The manifest changed once, in 1.7.0, and only in its two colours (the splash screen and bar
of an installed copy went from blue to navy); to put those back as well, upload `legacy/release-1.6.0/manifest.webmanifest`
over the root one. It is cosmetic and nothing depends on it. Nothing in a rollback can delete or alter a player's saves: they live in the
browser's storage on their own phone, keyed by name, and only the player can delete them.
