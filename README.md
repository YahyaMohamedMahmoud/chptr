# CHPTR — Coming Soon

Run `node js/server.cjs` and open http://127.0.0.1:4173/.
For static hosting, upload index.html and the images/, css/, and js/ folders.

- images/: all 112 runtime raster assets, WebP, each below 200,000 bytes.
- css/style.css: scene, curtains, paper and responsive styles.
- js/main.js: scene timeline and startup coordination.
- js/horse-animation.js: canvas renderer and image loader.
- js/horse-anchors.js: original pose registration coordinates.
- js/preloader.js: writing and curtain opening sequence.
- js/gsap.min.js: bundled animation library.
- js/server.cjs: optional local preview server with ETag revalidation.
- index.html: page and original inline vector wordmark. SVG stays vector to preserve its edges.

Horse frames 048–153 retain the existing playback dimensions. Exterior gray cutout residue around the lower legs is removed through alpha only; the gold body is not repainted. Frames 034–047 were never played and are omitted.

The loader fetches and decodes all required poses behind the curtains, with at most three image loads at once. The scene starts immediately after the curtains finish. A missing image is retried once; a failed load or 60-second loading deadline reveals the final composition rather than playing an incomplete sequence. Slow first visits can therefore spend longer behind the curtains. No network buffering pauses occur during horse playback. Decoded frame canvases are released after the static horse takes over.

All 106 animation frames use lossless WebP: decoded visible pixels match the cleaned PNGs exactly. The background (quality 83) and full-resolution final horse (quality 94) use lossy WebP to meet the size cap without resizing. Alpha is preserved exactly after cutout cleanup. Google Cinzel 500 is the only remote font; the brand wordmark is inline SVG.

Validation: local asset references, sizes, alpha channels, JavaScript syntax, and a simulated slow/failed image-loader test. Browser visual and real-network performance verification still need a permitted browser session; these checks are not a Lighthouse score.

Image payload: 19,658,968 bytes across 112 files; largest file 198,548 bytes. Removed source folders and duplicate assets were sent to the Windows Recycle Bin for recovery.

Opening: the curtain and paper are visible in CSS before JavaScript runs; the scene stays hidden until the curtain-opening cue. JavaScript-disabled visitors receive a static scene via css/no-script.css.
