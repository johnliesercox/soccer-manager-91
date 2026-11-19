# Release 1.7.0, as deployed

The exact files GitHub Pages served as version 1.7.0 (commit `cde3c8f68ac9415b17f552ec64941c61fec02d89` on `main`,
"1.7.0 is published: record the release in the documents", 18 November 2026; the game file itself was built at `8078a95`):
`index.html` (7,171,278 bytes, md5 `7976271030be0bb85d7fd7cf38b11f8d`), `sw.js` (cache `sm91-v1.7.0`, md5
`9d698e8d052096b1dcbcefc90a4c5aff`), `manifest.webmanifest` (md5 `544fc28982b88987ac67c443fec92959`) and the two icons.
The engine is the one in the repository root at that commit; it has not changed since.

They are here for two reasons: `tools/save-compat.js` plays games on this release and resumes them on the current build to
prove that saved games survive an update; and `ROLLBACK.md` at the repository root uses them to put 1.7.0 back on the site
without any git archaeology.
