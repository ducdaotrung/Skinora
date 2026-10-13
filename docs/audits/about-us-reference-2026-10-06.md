# About Us reference audit and implementation

Reference: Shopify trial theme 166302089264, `pages/about-us?view=about-us`.
Development target: unpublished `144448127024`, `spinel-theme/codex/spinel-chieutt-dev`.

## Behavior and composition contract (before implementation)

- A page template tells the brand story: Our Story hero → philosophy → three alternating media/text chapters separated by dividers → ethical/lifetime marquee → journal → four service promises.
- One H1 belongs to the hero; chapter and journal headings use H2, journal cards H3. The philosophy is editorial prose rather than a second H1.
- Desktop has two-column philosophy and alternating story columns; mobile stacks images before story content. Services use four desktop, two tablet and one mobile column.
- Hero uses full width, medium desktop/small mobile height and bottom-left/centered content. No parallax or sticky content is required.
- Media and blog source are empty in the supplied reference. Preserve useful editable placeholders and picker ownership; do not invent brand photographs, articles, or purchase links.
- Use existing Spinel Hero, Custom section, Grid, Header, Image, Heading, Text, Eyebrow, Marquee and Blog posts contracts. JSON owns composition and merchant copy. Existing kernels own typography, images, schemes, focus, responsive bands and editor lifecycle.
- Story grids remain reorderable/duplicable Theme Blocks; Image's existing image-first-mobile setting supplies the mobile order. Journal Header, View all and Blog list/card use the existing fixed static IDs, excluded from block_order.
- Blank links remain non-actionable; real journal cards derive links, dates and authors from the selected blog. Marquee inherits existing reduced-motion handling.
- Deploy `templates/page.about-us.json` and the existing Hero section with its allow-list extended from `index` to `index, page`. This explicit scope supports the new verified page composition; no shared rendering, JavaScript or global setting change is needed.

## Reference findings

- P1: Reference `about-us` template reports **Assigned to 0 pages**. Preview works with `?view=about-us`; assigning the page globally would also affect live-theme routing, so deployment preserves the page's current assignment.
- P2: Hero and all story images are unselected; journal renders placeholder titles/date/author and disabled Read more links. These are configuration gaps, not real brand content.
- P2: Reference service/policy claims are copied as merchant-editable content and require the merchant's factual review before a live promotion.
- Reference theme architecture is not copied; current Spinel blocks and tokens are authoritative.

## Validation

- PASS: Shopify accepted the final two-file development upload with no errors. Hero remote source was identical to local before its one-line placement change. Existing remote Blog posts mobile styling differs from local and was preserved.
- PASS: schema/value/allow-list/order audit across 67 section/block nodes. Eleven sections are below template capacity; static journal slots are excluded from block_order.
- PASS: final Shopify Theme Check: zero errors and 34 pre-existing warnings; no About Us offenses. `git diff --check` passes.
- PASS: development Theme Editor loads the About Us template and all content; Draft target and Assigned to 0 pages are visible. Hero, Custom section, Grid and Image controls/selection inspected. Image-first mobile and square ratio correctly selected; Hero desktop Medium → Small re-render changed height 820px → 660px, then undo restored Medium. Save disabled after restoration; reload keeps the deployed template.
- PASS: direct development storefront, one H1, story H2 and journal H3; journal Next advances active slide to 2/6. Blank cards have no misleading actionable links. Console error logs empty in editor/storefront.
- PASS: widths 375, 767, 768, 1149, 1150px have no horizontal document overflow. Story/philosophy grid 2 → 1 columns; service grid 4 → 2 → 1. Mobile image ordering confirmed via computed order and actual bounding positions.
- NOT TESTED: exhaustive editing of every existing kernel setting, real selected media/blog datasets, keyboard/reduced-motion emulation, and full add/remove/reorder/duplicate lifecycle. No new kernel behavior was introduced. A duplicate smoke attempt was inconclusive; it was undone and the editor returned to Save disabled.
- PASS: no preview watcher started; port 9292 has no listener. No Git push, live publish, page assignment, or cross-repository sync performed.

## Handoff and synchronization

Overall: PASS WITH FOLLOW-UPS for development review. Media and blog resource selection remain empty exactly as the reference; the merchant can fill these in Theme Editor. Typography uses existing Spinel global settings rather than importing the trial theme fonts. The page's global template assignment remains unchanged; use the explicit development preview URL.

Preview: https://spinel-theme.myshopify.com/pages/about-us?view=about-us&preview_theme_id=144448127024
Editor: https://admin.shopify.com/store/spinel-theme/themes/144448127024/editor?previewPath=%2Fpages%2Fabout-us%3Fview%3Dabout-us

Shared-base candidate: Hero page eligibility (`sections/hero.liquid`) only. No shared rendering tokens/components changed; the About Us composition and brand copy belong to Spinel. Cross-repository synchronization requires a separate expressly directed request.

## Development template instance adjustments (2026-10-06)

- `commitments` (Scrolling Text Images) uses `scheme-3`.
- `service_promises` (final Custom section) uses `scheme-2` and the instance-only name `Icon with text (custom)`; the shared section schema name remains unchanged.
- PASS: instance values are set only in `templates/page.about-us.json`; the section's reusable schema is untouched.
- PASS: narrow upload to unpublished dev theme `144448127024` succeeded. Theme Editor preview shows `Scrolling Text Images` with Scheme 3 selected and final section named `Icon with text (custom)` with Scheme 2 selected; storefront preview renders the final icon-and-text row. Save is disabled, confirming no editor-side changes were made.
