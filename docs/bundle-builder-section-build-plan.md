# Product bundles layout contract

Confirmed layout (2026-10-14): desktop uses the global theme container and proportional banner/content columns (about 32% / 68%) with a 12px gap. The design measurements were observed in a 1410px container and are not fixed widths. Right column contains dynamic Header blocks with shared Heading and Text children, products carousel, and Add all CTA. Mobile order is header, banner, carousel, CTA. Carousel shows three items by default on desktop and two items with next-slide preview on mobile.

Section owns the shell, banner, color scheme, and padding. Header, Heading, and Text own their existing global typography, alignment, width, spacing, and mobile controls. Shared Header blocks remain dynamic. Product list owns the product/collection source, product cards, variants, grid, and carousel. Routine button owns CTA label/style/alignment. Bundle runtime adds every displayed product's currently chosen variant using its minimum quantity rule. CTA is disabled for empty sources, unavailable variants, and during submission. Shopify's cart/checkout determines final discounts.

Bundle summary is omitted from rendering and presets. Per-card Add to bundle actions are omitted. Default composition is three product cards, dropdown variant selection, and a centered Add Full Routine button. Existing summary files are retained for other consumers. No saved template or settings JSON was changed.

Latest saved dev theme #156415066304 was retrieved into a separate snapshot before this revision. Its homepage has no bundle-builder instance.

```yaml
qa:
  contract: pass
  schema_and_ranges: pass
  liquid_focused_theme_check: pass
  javascript_syntax: pass
  diff_hygiene: pass
  responsive_static_review: pass
  accessibility_static_review: pass
  storefront_and_cart_runtime: blocked
  theme_editor_lifecycle: blocked
limitations:
  - Runtime and visual checks require a configured section instance in the development preview; current saved homepage has none.
  - Focused Theme Check omits missing external asset/snippet/translation/block-target checks because the fixture contains only changed blocks and section plus global schema.
```

## Product list settings correction

Bundle Product list now uses the shared Product list layout controls: Grid/Carousel (default Carousel), optional mobile layout, desktop/mobile columns, desktop next-slide preview, and desktop/mobile product gap. Existing desktop_columns, mobile_columns, gap_horizontal, and gap_horizontal_mobile IDs are retained for saved settings. Product gap applies to both rows and columns in Grid and to Swiper spacing in Carousel. Both real and placeholder cards emit swiper-slide when either breakpoint uses Carousel; this corrects the previously ignored gap and column count. Shared product-collection-grid rendering remains the owner of dimensions and Swiper configuration. Focused Theme Check, schema/range audit, JavaScript syntax, and diff checks pass; storefront/editor runtime remains unverified.

## Carousel controls

Product list now exposes mobile next-slide preview, desktop/mobile navigation visibility, shared navigation position/style/icon/hover behavior, desktop/mobile pagination visibility, progress bar/bullets, pagination spacing/width, autoplay/delay/pause-on-hover, and loop. Preview supports two mobile items plus the next-item preview on bundle carousels. Loop and desktop fractional preview are opted in only for bundle carousel roots. Shared carousel lifecycle and reduced-motion/autoplay keyboard-focus behavior are retained. Focused static validation is recorded; browser/editor/cart runtime remains unverified.

## Settings parity correction

Navigation, Pagination and Autoplay groups now exactly reuse the shared Product list schema: identical order, labels, options, defaults, ranges and visible_if rules. Pagination uses one Show pagination toggle for both desktop and mobile; navigation uses Show navigation on desktop as in the reference. Bundle mobile next-slide preview remains in the Layout group, and Loop remains after Autoplay. Removed the added mobile-only navigation/pagination controls. Schema equality comparison against blocks/product-list.liquid and the focused Theme Check both passed.

## Image controls

Section settings use Image and Layout groups. Image includes the existing image source ID, shared image ratio options (auto/square/portrait/landscape/wide/custom), custom ratio width/height, shared corner-radius presets plus custom pixels, and optional mobile ratio overrides. Layout contains Section width and Alignment. Ratios reuse image-ratio-value and radius presets reuse theme tokens. Fixed ratios crop via object-fit cover; mobile inherits desktop unless customization is enabled.

Mobile image customization now uses Customize for mobile and controls both ratio and border radius. Disabled customization inherits desktop ratio/radius; custom radius supports 0px on mobile.

Layout includes Column gap (0–100px, default 12px), wired to the desktop banner/content grid. Existing desktop content gap and mobile stacked spacing retain their separate controls.

Column gap correction: desktop and optional mobile values are emitted directly on the banner/content grid. Inline column-gap consumes the responsive current-gap variable; mobile row-gap uses the same mobile value for stacked regions. Mobile inherits desktop until Customize mobile column gap is enabled, including explicit 0px. Snapshot now contains a saved homepage bundle instance; saved JSON was preserved. Runtime verification of this change remains pending.
