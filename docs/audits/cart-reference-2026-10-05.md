# Cart reference audit — 2026-10-05

Reference: Shopify Theme Editor, theme 166302089264, `/cart` (Updated copy of Elvara). Development: theme 144448127024, `spinel-theme/codex/spinel-chieutt-dev`, unpublished. Worktree: `codex/spinel-chieutt-dev`; origin `omnisecom/spinel-theme`. Existing Collection list and Gift card changes preserved. No commit, push, live-theme upload, or theme-base synchronization.

## Intended behavior observed before implementation

Desktop uses a wide content column and a narrower summary column. Mobile stacks summary after the cart lines. Content owns the cart title/count, free-shipping progress and cart lines; Summary owns the native order summary, collapsible order note, and shipping estimator. Cart lines show product image/title, unit price, variant, quick edit, quantity and remove. Summary has a discount form, allocated discounts, subtotal, estimated total, checkout, tax/shipping notice, and payment methods. Quick edit changes an existing line's variant and quantity rather than adding an unrelated duplicate. A separate Recommended products section follows the cart.

Reference fixture: three Ondine products, quantities 1 each, unit prices 1280/1280/1150 USD; subtotal 3710, CODE10 discount 371, estimated total 3339. Shipping threshold 100 USD is reached. The reference is read-only: no changes saved.

## Section/block and settings inventory

| Owner | Reference/default contract | Spinel implementation |
| --- | --- | --- |
| Cart section | Page width; dividers off; desktop/mobile gap 50/30; scheme 1; padding 70/90; custom mobile 40/60 | Cart-only allow-list; same values; canonical width labels; optional background override; independent mobile padding |
| Content (static) | Gap 32/32; count on; Heading 2 visual size, H1 semantic tag | `_cart-content`; visual `xl` independent from HTML Tag; custom size available |
| Free shipping progress | Left; large body text; text color; padding 0/0; amount range | Threshold and pending/success messages; alignment/size/color; padding and mobile overrides; native progress |
| Cart items | Dividers on; vendor off; quick edit on; quick-edit media/quantity on, badges off; gap 24/24; padding 4/4 | Stable cart line keys; shared Price/Image/Badge/Icon tokens; shared popup/bottom-sheet Quick edit; conditional controls scoped to Quick edit |
| Summary (static) | Gap 16/12 | `_cart-summary`; fixed order summary and optional order tools |
| Order summary (static) | Gap 16/16; discount on; secondary Apply; notice/accelerated/payment on; payment width 38; original case; medium padding; border 0; XS shadow; inherited scheme | Native checkout; Shopify Liquid totals/discount allocation; same defaults and appearance controls |
| Order note / Shipping estimator | Chevron; accent font; large; normal tracking; original case; medium padding; border 0; XS shadow; inherited scheme | Shared accordion; corresponding typography/icon/surface controls; native note and shipping forms |
| Recommended products | Heading "You May Also Like"; related source; max 8; carousel; 4 desktop/2 mobile; gap 4; outside secondary chevrons on hover; desktop progress pagination top 50, width 260; section gap 32/24, padding 0/90 and mobile 0/50 | Shared Heading/Product list/Product Card/Swiper; cart first product supplies native recommendation context; explicit fallback product picker |

Static slots use literal IDs and are absent from dynamic block_order. Add block menus inside Content and Summary only offer their rendered component types. The root static composition has no addable duplicate slots. Shopify Theme Blocks cannot enforce per-child cardinality; repeated optional blocks are deliberately allowed and follow the existing platform limit. No generic `@theme` expansion was added. Existing shared kernels own fonts, schemes, buttons, forms, icons, card presentation and carousel behavior.

Shopify rejected `visible_if` on Collection and Product list resource settings. Those pickers remain visible; runtime source selection still respects the opt-in recommendations toggle. This platform exception is documented instead of leaving an invalid schema.

## Implementation and state behavior

`cart-page.js` uses the shared cart drawer controller's mutation/discount API. Page HTML is refreshed via Shopify Section Rendering, retaining focus and open disclosures. Concurrent cart clicks are locked, stale refreshes are discarded, rejected quantity edits restore the displayed quantity, and failures are announced. Invalid discount codes restore previously applied codes. Variant replacement preserves quantity, properties and selling plan: add succeeds before the old line is removed; if removal fails, only the newly added quantity is rolled back, including when it merged with an existing matching line. The existing drawer/badges update from the same server cart.

Liquid remains responsible for unit prices, line discounts, subtotal, allocated cart discounts, tax notices and total. Checkout remains a native cart POST; no checkout/order/payment action was executed. Quantity inputs retain a native no-JavaScript update fallback, and removal links retain Shopify's native cart-change URL. Empty carts show translated empty copy and Continue shopping.

Shared icon registry now includes pencil-square and lock-closed; native inspection found and corrected their previous generic-arrow fallback.

## Validation and native QA

- PASS: 10 targeted tests (5 Cart mutation/state/error tests and 5 recommendations source/fallback/resource tests).
- PASS: changed JavaScript syntax and `git diff --check`.
- PASS: Theme Check, 0 errors / 34 existing warnings. No new Cart warnings. Upload-time parser/schema errors were corrected and successful scoped uploads verified.
- PASS: 7 existing drawer mutation/loading tests. Two existing Quick Add/Quick View VM fixtures fail because their fixture evaluates a current ES-module import as a classic script; neither module was changed in this task.
- PASS: native development Cart renders real cart data, unit prices, applied CODE10 in the standalone cart context, subtotal/total, payment methods, order disclosures and Quick edit controls.
- PASS: native shared Quick edit popup opens with product media/variant/quantity, receives focus, and closes with Escape. Mutation submit was not executed.
- PASS: Theme Editor recognizes static Content/Summary/Order summary and dynamic components; controls/defaults present. Media toggle hid cart media before controls were reconciled to their reference Quick edit scope; quantity toggle produced 0 visible controls with 3 native hidden quantity fields before the same scope correction. Final Quick edit defaults verified in native popup. Settings restored without Save; final Editor Save disabled.
- PASS: desktop and 375px mobile preview; mobile document width 375, no horizontal overflow, stacked summary. Main layout responsive CSS uses Spinel 768/1150 breakpoints. Exhaustive 767/768/1149/1150 visual checks: NOT TESTED.
- PASS (parent native QA): related recommendations render 8 real products in the exact reference order/prices. Complementary with no Search & Discovery data produces 8 deliberate editor skeletons. Navigation Next changes translation by -305px and Previous enables. Mobile renders 2 slides at 169.5px with 4px gap, section gap 24 and bottom padding 50. Restored related/on-hover/desktop defaults without Save. Final grid metadata correctly identifies real recommendations rather than placeholder collection content.
- NOT TESTED: live quantity/remove/add/variant/discount/note mutations, inventory failures, empty-cart transition, shipping quote response and accelerated checkout interactions. Automatic approval review rejected changing the current non-trivial shopping cart without specific human authorization. No workaround attempted; approval requested by the parent chat. Current cart state was preserved.
- NOT TESTED: every appearance/typography control individually in native Editor. All settings have Liquid/CSS consumers and native defaults were inspected; representative rendering/lifecycle checks completed.
- PASS: development-only scoped `--nodelete` uploads; remote original Cart template was read into `/private/tmp/spinel-cart-remote` and contained only the previous main section with empty settings. No merchant configuration overwrote an unrelated section.
- PASS: port 9292 has no listener; no preview watcher was started or left running.

Proof: `/private/tmp/cart-dev-final.jpg`, `/private/tmp/cart-dev-mobile.jpg`; parent matching-three-item editor proof `/private/tmp/cart-dev-parent-final.png`.

Overall: PASS WITH FOLLOW-UPS. Implementation and development upload are complete; native mutation QA awaits explicit cart-edit authorization. Required base synchronization is identified for shared cart API, registered icons, and product-list explicit resource support; no cross-repository change is authorized or performed.

Official recommendation API: https://shopify.dev/docs/api/ajax/reference/product-recommendations

## Follow-up: Cart shadow scheme audit and correction

Reference inspected read-only: Theme settings → Colors → Scheme 1 → Shadow is `#1C1B1A`. Its CSS converts this into `rgba(28 27 26 / 0.1)`; Order summary, Order note and Estimate shipping all compute `rgba(28, 27, 26, 0.1) 0px 1px 5px 0px`. Reference size rules are XS `0 1px 5px`, SM `0 2px 10px`, MD `0 4px 20px`, spread 0. No reference changes were saved.

Intended behavior/ownership: the global color scheme owns Shadow color and alpha; each Cart panel selects None/XS/SM/MD geometry and either inherits the section scheme or explicitly selects a scheme. This is decorative, has no cart state interaction, and uses the same token on desktop/mobile. Existing settings/schema remain the contract.

Root cause: Spinel's existing alpha-enabled Shadow token is `#1c1b1a1a`, already approximately 10% opacity. `cart-surface-style.liquid` additionally mixed it at 8% with transparent, producing effective alpha `0.00815686` (approximately 0.8%). This made all three panels almost invisible. The shared Cart surface snippet now consumes `var(--shadow-color)` directly and matches reference XS/SM/MD geometry. No global scheme value was changed.

- PASS: scoped `--nodelete` upload of only `snippets/cart-surface-style.liquid` to theme 144448127024. CLI identity/list verification confirmed exact development name and unpublished role; live theme untouched.
- PASS: fresh standalone development preview computes the exact reference XS shadow on all three panels, with the existing scheme token `#1c1b1a1a`.
- PASS: native Theme Editor Order note None → `none`, SM → `rgba(28,27,26,0.1) 0px 2px 10px 0px`, MD → `rgba(28,27,26,0.1) 0px 4px 20px 0px`, restored XS. Explicit Scheme 1 and inherited scheme both compute the correct XS shadow. Restored inherited scheme without Save; final Save disabled.
- PASS: regression test asserts the alpha-enabled global Shadow token is consumed without a second transparency layer by the shared surface used by all three panels. Existing 10 Cart/recommendations tests also pass (11 total).
- PASS: Theme Check 0 errors / 34 existing warnings; `git diff --check`.
- PASS: no cart quantity, line, variant, discount, note or checkout mutations. Reload of the editor was rejected by automatic approval review due to an unsaved-session restoration notice; that state was preserved. Fresh standalone preview supplied post-upload proof, and reversible appearance checks completed/restored in the current editor without reload or Save.
- PASS: port 9292 has no listener; no watcher started.

Proof: `/private/tmp/cart-shadow-dev-final.jpg` (standalone desktop preview). Narrow shadow scope is complete. Existing cart mutation QA limitations above remain unchanged. The shared Cart surface snippet and its alpha ownership contract should accompany any explicitly requested future Cart sync to `theme-base/dev`; no cross-repository sync was performed. Other existing components also mix `--shadow-color` with transparent; those are outside this Cart correction and require a separate scoped audit before changes.

## Follow-up: Cart disclosure height and icon correction

Intended behavior: Order note and Estimate shipping independently expand/collapse from their native summaries, including Enter/Space activation. Closed cards retain their configured surface padding and border. Chevron rotates 180° and Plus rotates 45° with the intended state; Minus remains the merchant-selected static glyph. Motion uses shared tokens and respects reduced motion. Theme Editor replacement and cart Section Rendering must initialize the shared disclosure lifecycle and preserve the declared open state.

Native reproduction before correction: untouched closed Estimate shipping measured 67px (27px summary + 40px surface padding), while Order note settled at 40px after closing and clipped its heading against the panel bottom. Its chevron always computed `transform: none`.

Root causes and implementation:

- Shared `accordion-details.js` retained completed Web Animations with `fill: both`, so their height/opacity continued overriding cleared inline styles. Completion now cancels those effects before returning to natural layout.
- Closing measured only the summary and omitted details padding/borders. Opening used scrollHeight, which omitted borders. Both directions now measure the natural border box and convert to CSS height for border-box/content-box callers; interrupted animations use the same conversion.
- Cart summaries lacked an icon-state consumer. Both existing blocks now wrap the shared Heroicon with a Cart-local state class. Scoped CSS observes `data-accordion-state` so chevron/plus respond at the start of either transition, including reversal. No schema IDs, defaults, settings, surface tokens or shadow geometry changed.
- Cart Section Rendering now cleans up old accordion controllers and initializes replacement markup after restoring both native and declared open state.

Validation:

- PASS: 17 targeted tests total, including 5 new shared disclosure regression tests (padded border-box/content-box geometry, completed-effect cleanup, rapid open-close-open/stale finishes, reduced motion and Editor select/deselect/reinitialize, desktop mobile-only expansion) and a new cart refresh lifecycle/state test.
- PASS: JavaScript syntax; `git diff --check`; Theme Check 0 errors / 34 existing warnings.
- PASS: scoped `--nodelete` upload of only `assets/accordion-details.js`, `assets/cart-page.js`, `assets/cart-page.css`, `blocks/cart-order-note.liquid`, `blocks/cart-shipping-estimator.liquid` to verified unpublished development theme 144448127024. No live-theme upload.
- PASS: native standalone desktop both closed panels settle at 67px after open/close and repeated double clicks. Order note opens at 224px; Estimate shipping opens at 420px. Both open chevrons compute a 180° matrix, both closed icons compute `none`. Enter closes Order note and Space closes Estimate shipping.
- PASS: native 375px mobile both expand (224px/408px), chevrons rotate, and both close at 67px. Document width remains 375px. Temporary viewport override reset.
- PASS: current native Theme Editor shipping Icon Chevron → Plus triggers replacement markup and initializes the open disclosure; Plus computes a 45° matrix. With inspector temporarily disabled, closing restores a 67px panel and `transform: none`; reopening works. Restored Chevron and original enabled inspector without Save; final Save disabled. User session restoration state was preserved, no Editor reload.
- PASS: no cart quantity, line, variant, discount, note, shipping-submit or checkout mutations. Port 9292 has no listener; no watcher started.
- NOT TESTED: native cart mutation-driven Section Rendering (existing authorization limitation); its cleanup/replacement/open-state initialization is covered by the new isolated regression test. Shared non-Cart accordion visual QA was not expanded; border-box/content-box and mobile-only behavior have regression coverage.

Proof: `/private/tmp/cart-disclosure-dev-closed.jpg`, `/private/tmp/cart-disclosure-dev-mobile-open.jpg`.

Focused disclosure correction: PASS. Future expressly requested Cart/base sync should include the shared accordion completion/height fix along with Cart-local icon/lifecycle integration; no cross-repository sync, Git commit or push performed.
