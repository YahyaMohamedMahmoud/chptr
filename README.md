# CHPTR — Coming Soon

Run `node js/server.cjs` and open http://127.0.0.1:4173/.
For static hosting, upload index.html and the images/, css/, and js/ folders.

- images/: all 112 runtime raster assets, WebP; the whole folder is about 3.6 MB.
- css/style.css: scene, curtains, paper and responsive styles.
- js/main.js: scene timeline and startup coordination.
- js/horse-animation.js: canvas renderer and image loader.
- js/horse-anchors.js: original pose registration coordinates.
- js/preloader.js: writing and curtain opening sequence.
- js/gsap.min.js: bundled animation library.
- js/server.cjs: optional local preview server with ETag revalidation.
- index.html: page and original inline vector wordmark. SVG stays vector to preserve its edges.

Horse frames 048–153 retain the existing playback dimensions. Exterior gray cutout residue around the lower legs is removed through alpha only; the gold body is not repainted. Frames 034–047 were never played and are omitted.

The loader fetches and decodes the poses behind the curtains in play order, six at a time. The curtains open once every frame is decoded, or earlier when the whole gallop is in and the measured download rate shows the remaining jump poses will arrive before they are played. A missing image is retried once; a failed load or 25-second loading deadline reveals the final composition rather than playing an incomplete sequence. No network buffering pauses occur during horse playback. Decoded frame canvases are released after the static horse takes over.

All 106 animation frames are lossy WebP (quality 78, lossless alpha) stored at 75% of the previous size (sourceScale .375 in CONFIG), about 28 KB each instead of 185 KB. The background (quality 76) and full-resolution final horse (quality 86) are lossy WebP. Alpha edges are preserved exactly. Google Cinzel 500 is the only remote font; the brand wordmark is inline SVG.

Validation: local asset references, sizes, alpha channels, JavaScript syntax, and a simulated slow/failed image-loader test. Browser visual and real-network performance verification still need a permitted browser session; these checks are not a Lighthouse score.

Image payload: about 3.6 MB across 112 files (was 19.7 MB); largest file 157,778 bytes. The Cinzel stylesheet loads without blocking the first paint. Removed source folders and duplicate assets were sent to the Windows Recycle Bin for recovery.

Opening: the curtain and paper are visible in CSS before JavaScript runs; the scene stays hidden until the curtain-opening cue. JavaScript-disabled visitors receive a static scene via css/no-script.css.
