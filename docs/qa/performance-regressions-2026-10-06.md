# Performance regression fixes — 2026-10-06

Scope: shared overlay shell and slideshow artwork. The section remains the owner of height presets; the slide maps those presets into the shared image renderer. No merchant schema, global typography, heading, padding, or saved settings change.

- Overlay geometry, stacking, hidden state, panel background and body shrinking now arrive in critical.css. Motion and decoration remain deferred. The existing controller retains focus, close and scroll-lock behavior.
- Mobile fallback and separate mobile artwork use responsive width candidates for adapt/full-screen frames instead of a single 1200px source.
- The five supported fixed mobile presets map to their existing 32/44/56/68/82rem heights. Centered panoramas receive CDN crops; merchant focal points stay uncropped. Density candidates stop at the available source height, up to 3x.

Validation:

- Full Node test suite: 167/167 pass. Caller-level Liquid coverage renders all seven actual schema options, with and without mobile art; checks preload/source parity, crop dimensions against CSS, default height, focal-point exclusion and low-resolution density limits.
- Shopify Theme Check: 0 errors, 39 pre-existing warnings. The skill's standalone validator could not run because its theme-check-common dependency is absent; installed Theme Check completed successfully.
- Native Chrome, actual shared CSS/controller with decoration CSS delayed: desktop drawer fixed, panel top 30/bottom 1058 within viewport 1088; phone bottom sheet top 490.8/bottom 844, width 390. Close control received focus and page scroll was locked. Desktop Escape restored opener focus and page scrolling. Deferred CSS then applied normally.
- Native Chrome mobile fallback: viewport 390, DPR 1, currentSrc width 750 (previous regression forced 1200).
- DPR 3 native check: NOT TESTED; device-emulation tool stalled and was interrupted. Responsive 3x and source-resolution bounds are verified in rendering tests.
- Upload: only assets/critical.css, assets/component-overlay.css, blocks/slideshow-slide.liquid and snippets/slideshow-image.liquid to unpublished development theme 144448127024. No templates or settings uploaded. Full Theme Editor lifecycle and live development-storefront interaction were not repeated; the schema is unchanged.
- No cross-repository interface divergence is intended: both authorized development branches receive the same fixes.
