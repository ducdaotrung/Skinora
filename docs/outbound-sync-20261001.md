# Spinel outbound sync to theme-base/dev

Source: `2a3ecc9cc70da4908727bb683165cb8937a0d363`.
Target before merge: `cc0b710443b547d0c5d996be6383c46b7b8052f3`.

This is a normal merge preserving both histories. The main Spinel checkout and
both remotes' main branches are outside the sync scope.

## Conflict resolutions

### Product card CSS

Combine Spinel's media-only hover and keyboard focus behavior with theme-base's
renamed `--product-card-show-secondary-image` token. Preserve the target's
selected-variant image behavior: selected cards keep their primary variant
image visible and suppress the generic secondary image on hover and keyboard
focus. Both delegated swatch handlers and the bundle builder remain available.

### Homepage merchant configuration (27 textual conflict regions)

The parents describe different complete merchant homepages, with different
section/block identifiers, resources, copy, padding, and order. They are not
27 independent code changes. Resolving the textual fragments individually
would risk mixing unrelated block graphs and losing settings.

- `templates/index.json` retains all 16 target sections, every nested block and
  setting, and their existing order without modification.
- Append eight source sections whose section types do not already exist in the
  target: hello-world, scroll-reading-text, scrolling-cards,
  collections-with-background, icon-text-inline, featured-product,
  hotspot-full-width-carousel, and icon-text-cards. Preserve their complete
  source block/settings graphs; mark these additions disabled so the target's
  active merchant composition stays coherent. The template has 24 sections.
- `templates/index.spinel-sync.json` preserves the complete 18-section Spinel
  homepage, including its IDs, settings, disabled flags, and order. This retains
  the source's alternative content for section types shared with the target
  without duplicating heroes, product grids, press, and galleries on the default
  homepage. It is a separate alternate template, not an automatic replacement
  for the default homepage.

The two template graphs together preserve every section/settings graph from
both parents. A single naive union would contain 34 sections and exceed the
25-section JSON template limit. No target section or source setting is discarded.

Other files use Git's normal three-way merge. In particular, target-only bundle
builder files, renamed shared CSS tokens, and swatch behavior are retained.
Collection sort remains implemented; its incoming typography changes are kept.
The target's named theme settings presets are retained alongside the incoming
Spinel current settings.
The target preset's legacy `social_show_labels` value is retained as saved data;
the incoming per-block social display control replaces its global editor control.

## Validation

Read-only preservation assertions verify exact equality for all original target
homepage sections and the full Spinel alternate template, including order.
JSON/template structural checks, all Liquid schema JSON, JS syntax, Theme Check,
`git diff --check`, and the existing Node test suite are required before push.
The pre-existing social-links test assertion is updated to accept a render with
arguments while still requiring the shared social-links snippet.

Theme Editor and storefront runtime QA are NOT TESTED in this Git-only sync;
no Shopify theme upload or preview watcher is started.

References:
- https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates
- https://shopify.dev/docs/storefronts/themes/architecture/templates/alternate-templates
