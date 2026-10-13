# Marquee and Accordion rebuild

Source: https://github.com/mynhle2003/theme-base/tree/theme/elara-theme
Pinned commit: b433d15675da4df0a363558d07ef32f0eb367541 (2026-10-08).

## Contract

- Role/placement: reusable content theme blocks in existing compatible sections and groups; existing section type is rebuilt in place; no new resource context or page assignment.
- Ownership: parents own internal flow, gaps, appearance and responsive size; content belongs to child blocks; typography/color primitives use this repository's Foundation tokens. Section owns its container and external spacing.
- Marquee slots: nine private compact child types, plus existing `marquee-item` for compatibility. New presets use private children; stored Item trees retain IDs/order/content without migration. Group children use the source's theme/app composition.
- Accordion slots: `faq_item` rows; row accepts theme/app content, including existing `faq_answer_text`. Existing inline answers, answer-size settings and editor empty placeholders remain supported.
- Runtime: source Marquee loop with measured pixel speed, safe clones, hover/focus and Inspector pause, optional eased parallax, resize/content synchronization, reduced motion, scoped cleanup/reinitialization. Accordion reuses unchanged shared native-details controller and its editor lifecycle.
- Responsive: single DOM tree; parent alignment and mobile gaps/padding/width; intrinsic marquee child sizing. Legacy Item groups keep their prior intrinsic/transparent behavior.
- Accessibility: native summary keyboard behavior, shared focus/expanded state, reduced motion, clones hidden from assistive technology and excluded from storefront interaction; localized clipboard status.
- Dependencies: add compact image ratio presets and tracking snippet; map source scheme classes to local `color-scheme scheme-*` contract; merge only required `marquee` locale keys.

## Acceptance and limits

Validate all new/changed Liquid/schema and JavaScript, existing FAQ rendering/disclosure tests, zero-value/mobile controls, source picker composition, and existing template/preset compatibility. Run Theme Check and `git diff --check`. Config settings and templates remain untouched. No commit, push, upload, or watcher requested.

Runtime Theme Editor and storefront QA requires a confirmed store/theme preview. The first CLI check reported `layouthub-template-v2` development theme `192119800107`; later checks reported `omnise-theme-base` development theme `139628773461`. Both differ from README's Spinel configuration. No upload is performed. The workflow Google Doc was unavailable; local architecture and source contracts supply the implementation guidance.

## Section follow-up requested in the same task

Replace the old “Scrolling Text Images” implementation at the existing
`text-marquee-custom` type with the source “Text marquee (custom)” section. Reusing
the type preserves the About us section ID, order, settings and its Marquee Item
trees. Delete `scrolling-text-star-separator.liquid`; no local JSON template or
section group references it. The new section keeps source layout, gaps, appearance,
responsive padding and compact-child presets. Remove the Size header and Height
setting plus all fill-height Liquid/classes/CSS. Remove the vertical Position
control whose only supported context was fill height; horizontal Position remains.
Natural height is unconditional. The compact Marquee Group also has no Size or
Height settings, matching this branch's source implementation.


## Final validation

- PASS: 15 tests in `tests/elara-blocks.test.cjs`, `tests/faq-item.test.cjs` and `tests/accordion-details.test.cjs` cover Liquid controls/zero values, dependencies, syntax, saved template/preset compatibility, natural section height and shared disclosure behavior.
- PASS: temporary Playwright fixture using actual Foundation, section/block CSS and shared runtime: 22 assertions at 1200px and 375px. Seam coverage, constant 60px/s at 1x, hidden/inert clones, no horizontal overflow, Enter/Space and expanded state, unload/reload/idempotency and reduced-motion cleanup all pass; no browser errors.
- FIX: source reduced-motion CSS had lower specificity than direction selectors after runtime cleanup. Explicit forward/backward selectors now ensure animation is fully disabled.
- PASS: final Shopify Theme Check, zero errors; 42 warnings elsewhere in the repository; zero offenses in changed Liquid files.
- PASS: `git diff --check`; configuration and template files untouched.
- LIMIT: fixture coverage is not live Shopify Theme Editor QA. No store upload, live add/remove/reorder/save check, visual parity claim, commit or push.
