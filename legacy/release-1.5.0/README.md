# Release 1.5.0, as deployed

The exact files GitHub Pages served as version 1.5.0 (commit `382dc2ed4392093cc2bcae77f3948d86e5b1b052`, "Improve matchday
graphics", 14 November 2026): `index.html` (5,382,581 bytes, md5 `16c61cc2578c20470a57ba1287de53b9`), `sw.js` (cache
`sm91-v1.5.0`), `manifest.webmanifest` and the two icons. The matching engine is `legacy/engine.v150.js`.

They are here for two reasons: `tools/save-compat.js` plays games on this release and resumes them on the current build to
prove that saved games survive an update; and `ROLLBACK.md` at the repository root uses them to put 1.5.0 back on the site
without any git archaeology.
