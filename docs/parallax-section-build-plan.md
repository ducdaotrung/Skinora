# Parallax section package

Source: the Stroken branch of `lh-template-demo`, including its uncommitted
Parallax and Editorial text implementation. Target baseline: `1e15831` on
`shopify-theme-base/dev`. This package does not modify homepage configuration,
theme settings, store resources, image files, or other template sections.

## Section contract

- Role and placement: an editorial content section, addable on index, page,
  product, and collection JSON templates.
- Context: merchant-selected child content; no inferred product or collection.
- Ownership: Theme Settings own page width/margins, typography, schemes, and
  radius tokens. The section owns spacing and column composition. Items own
  their surface and child flow. Shared blocks own images, text, and actions.
- Slots: one static Header plus up to 24 composable Parallax items. The preset
  contains six images in left/center/right columns and uses Rounded image
  corners. Group remains available inside each item.
- Runtime: `lh-parallax` packs staggered columns and progressively enhances
  scroll motion. Mobile retains a horizontal scroll/snap layout. Disconnect
  clears listeners/observers; editor item selection exposes the selected item.
- Accessibility: content is rendered in Liquid; links retain native keyboard
  behavior, and reduced motion keeps content fully readable.

## Files and existing dependencies

- `sections/parallax.liquid`
- `blocks/parallax-item.liquid`
- `assets/section-parallax.css`
- `assets/section-parallax.js`
- `blocks/editorial-text.liquid`
- `assets/editorial-text.js`
- `tests/editorial-text.test.cjs`

The target already supplies Header, Group, Image, the other allowed Theme
Blocks, `size-style`, `layout-flow-style`, `media-background`, shared placeholder
classes, and foundation tokens. These existing files are reused without copying
Stroken-specific foundation changes.

## Editorial text extension

The existing block IDs and typography/width/padding settings remain compatible.
`[img1]` through `[img5]` insert their corresponding image setting. Each slot
supports visibility, desktop/mobile width, a link, and a new-tab toggle.
Disabled or missing images are omitted on the storefront; Theme Editor uses
the shared `image placeholder-image` / `image__placeholder` treatment.

Scroll settings precede the image groups. The block owns reveal enablement,
Slow/Medium/Fast speed, and start opacity (30% by default). Its custom element
handles connect/disconnect, attribute changes, editor selection, and reduced
motion. The Border group controls inline-image corner radius using global
radius presets or the existing 0–40px custom-radius contract.

## Validation

- Theme Check: zero errors. Editorial text has the known
  `ExcessiveSettingsCount` warning (53 value settings), reflecting the five
  explicitly requested fixed image slots plus the existing block controls.
- JavaScript syntax and `git diff --check`: PASS.
- Preset block references and saved option values: PASS against target schemas.
- Three new Liquid rendering tests: PASS (all five/repeated markers, blank and
  disabled slots, shared editor placeholders, escaped links/new tabs,
  responsive widths, and custom-radius bounds).
- Full Node suite: 73/75 PASS. The same two Quick Add tests also fail in the
  unmodified target baseline (70/72 PASS): their VM harness attempts to execute
  a module containing an `import` as a classic script. No additional failures.
- Source local browser QA: inline widths 200px desktop / 100px mobile, no
  overflow at 375px, and disabling reveal restores readable text and images.
- Target Theme Editor add/remove/reorder/save/reload, store rendering,
  reduced-motion interaction, and duplicated-section motion: NOT TESTED in
  this Git-only transfer. No theme upload or preview watcher is started.
