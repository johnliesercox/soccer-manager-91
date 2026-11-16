# Release 1.6.0, as deployed

The exact files GitHub Pages served as version 1.6.0 (commit `97a0748ba74355e065b1bf71f5f1b19580d70af2`, "Release 1.6.0:
painted matchday (Option E), modelled goals, dead balls and locomotion", 16 November 2026): `index.html` (7,076,625 bytes,
md5 `7321f34080031caf23f96212644ed046`), `sw.js` (cache `sm91-v1.6.0`), `manifest.webmanifest` and the two icons. The
engine is the one in the repository root at that commit; it has not changed since.

They are here for two reasons: `tools/save-compat.js` plays games on this release and resumes them on the current build to
prove that saved games survive an update; and `ROLLBACK.md` at the repository root uses them to put 1.6.0 back on the site
without any git archaeology.
