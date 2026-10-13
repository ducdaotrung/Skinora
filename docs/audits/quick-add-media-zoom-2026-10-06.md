# Quick add media zoom — 2026-10-06

Scope: shared ProductMediaGallery pointer handling for the desktop Quick add image strip. Existing product-media and product-media-lightbox markup, native dialog, Swiper, image zoom, focus restoration, and merchant zoom settings are reused. No schema, translations, layout, breakpoint, media loading, or cross-repository synchronization changes were made.

## Reproduced defect and change

The gallery swipe guard treated movement of at least 4px as a drag, while the Quick add strip accepted clicks until 6px. A complete pointerdown/move/up/click sequence with 4px, 5px, or 5.9px movement therefore suppressed the image click without dragging the strip. A new regression test failed before the fix at 4px. Both handlers now share the strip's 6px threshold. Other gallery modes and lightbox pan retain their existing 4px threshold.

## Validation

- PASS: 9 targeted pointer and pagination tests. Includes full pointer sequences through both controllers, activation of the clicked image, and genuine swipe suppression.
- PASS: JavaScript module syntax and git diff --check.
- PASS: Shopify Theme Check, 0 errors / 34 existing warnings.
- PASS: upload only assets/product-media.js with --nodelete to theme 144448127024, spinel-theme/codex/spinel-chieutt-dev, verified unpublished. No Git push or base sync.
- PASS: native Chrome local fixture using the real shared gallery, Swiper and overlay scripts: dynamic insertion; image 2 and image 3 open matching lightbox slides; close restores focus to the clicked image; repeated removal/insertion and reopening work; high resolution image click activates lightbox zoom (scale 1.6447); no console errors. Proof: /tmp/quickadd-zoom-local-fixture.png (local fixture, not deployed storefront).
- NOT TESTED: actual development storefront and Theme Editor runtime; the permitted browser storefront is password-protected. Existing unsaved editor state was preserved. The reproduced pointer-jitter defect does not establish that every possible cause of the reported deployed symptom is resolved.
- NOT TESTED: mobile native QA, multiple real products/variant changes, and video/model interactions. These paths were not changed.

Shared component and setting coverage audit: PASS WITH FOLLOW-UPS because actual storefront/Theme Editor QA remains unavailable. No new setting or lifecycle ownership was introduced. A separate nested overlay Escape handling concern was observed during source review and left outside this focused change.

Cleanup: no Shopify preview watcher was started. Temporary fixture server stopped; ports 9292 and 9293 have no listener at handoff. No cart or customer state was changed.

## Deployed storefront follow-up — 2026-10-06

The user's authenticated Chrome development preview reproduced the remaining defect: pointer clicks on Aurelia Laurel Collar's Quick add strip did not open the viewer, while Enter on the same image opened the correct native lightbox. Markup had `data-zoom="open_lightbox"` and a complete lightbox. The CDN's current JavaScript included the earlier pointer fix, but the actual loaded gallery resource was the unversioned relative import `product-media.js` from Quick add. This lets a browser retain an older gallery module after theme uploads; custom-element registration cannot replace the first loaded definition.

Quick add and Quick view now pass the Shopify-versioned `product-media.js | asset_url` from their overlay markup into the existing lazy feature loader. Both entry points use the same versioned module so the first overlay opened registers the current shared gallery. Other product modules and the shared gallery behavior are unchanged. No schema or merchant setting changed. Existing open pages require a normal reload to acquire the new loader/markup; user cache was not cleared.

Validation of this follow-up:

- PASS: actual deployed desktop pointer click on Collar image 2 opens its native lightbox at 2/5; pointer click on the full image enables zoom (`is-zoomed`, scale 2.41546).
- PASS: closing returns focus to View media 2; pointer click on image 3 opens 3/5; closing/reopening Quick add and clicking image 1 opens 1/5.
- PASS: actual deployed 390×844 viewport image click opens the native lightbox. Temporary viewport override reset afterward.
- PASS: asset inventory after reload shows `product-media.js?v=98961424724439777631791267214`, where the failing preview loaded the unversioned URL.
- PASS: 2 loader regression tests, existing 9 media pointer/pagination tests, both loader module syntax checks, and diff whitespace.
- PASS: Theme Check 0 errors / 34 existing warnings; scoped upload of only assets/quick-add.js, assets/quick-view.js, sections/quick-add.liquid, sections/quick-view.liquid to verified unpublished development theme 144448127024.
- PASS: no browser console errors during deployed verification.
- NOT TESTED: Theme Editor's existing iframe reload, Quick view as the first overlay after navigation, video/model media, and real touch-device gestures. No schema changes require editor-setting migration.

Proof files (deployed storefront): `/tmp/quickadd-collar-lightbox-deployed.jpg`, `/tmp/quickadd-collar-zoom-deployed.jpg`, `/tmp/quickadd-collar-mobile-lightbox.jpg`.

Working development preview is retained in Chrome with Collar's native lightbox visible: https://spinel-theme.myshopify.com/collections/aurelia?preview_theme_id=144448127024 . No cart/customer mutation, Git commit/push, or base synchronization was performed. No watcher was started; port 9292 has no listener.
