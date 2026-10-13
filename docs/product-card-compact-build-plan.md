# Product card: Compact

Source: https://github.com/mynhle2003/theme-base/tree/theme/elara-theme
Pinned revision: `440f1d234b8d4aa05f8c356aefd1efa1686905cf`.
Source file: `blocks/product-card-compact.liquid`.
License: source `LICENSE.md` contains the Shopify interoperability license, also retained in this repository's `LICENSE.md`.

## Block contract

- Public leaf theme block, preset `Product card: Compact`, category `Products`. Add through existing compatible `@theme` slots, such as Group; no nested blocks, new section, template assignment or preset insertion.
- The product picker owns resource context. Missing products render only an editor placeholder; sold-out products disable the action. Shared title, price and button snippets own typography, localization, money and button presentation.
- Parent owns placement and outer composition. This card owns thumbnail width/ratio, its internal horizontal layout, optional boxed/overlay appearance, card width cap and padding. Uses Foundation body, background, border, radius and shadow tokens.
- One responsive DOM tree. Source setting IDs/defaults are retained. The redundant Gap header is merged into Content, leaving 40 schema entries with all functional controls intact. Mobile gap controls remain independent of desktop defaults.
- Available default-variant products use the existing cart-add form and delegated cart drawer handler; multiple variants use the existing quick-add overlay with a product-page link fallback. Required selling plans link directly to the product page because the shared picker has no plan selection contract.
- Root carries `block.shopify_attributes`. There is no new JavaScript, listener, observer or per-instance initialization; the shared runtime handles editor replacement and delegated actions.

## Fixes and optimizations

- Balanced thumbnail markup for both resource and placeholder states; escaped product URLs, titles and inventory attributes.
- Reuses the shared ratio resolver instead of the source's long switch; retains local handling for 9:16 and 5:4.
- Lazy thumbnail images use merchant desktop/mobile widths in `sizes`, responsive candidates up to 360px, and image-tag dimensions. The source's fixed 100px sizing is removed.
- Default style values fall back to CSS; zero values and active mobile padding overrides remain supported.
- Corrects the source's unavailable `--text-color` token to Foundation `--body-color`; border-box sizing preserves width caps.

## Validation

- Shopify Theme Check: zero errors and zero warnings in this block; six existing warnings elsewhere in the repository.
- Temporary Liquid fixture: 26 assertions for default variant, multi-variant, sold-out, required selling plan, editor/storefront empty state, escaping, image sizing/ratios, zero values and independent mobile settings. Uses actual shared snippets with Shopify filter stubs.
- Existing related tests: 14 passing in overlay-product-modules, product-card-animation and product-controls.
- Browser fixture using actual Foundation and block CSS: seven content/layout states at 375px and 1280px; no horizontal overflow; thumbnails resolve to 50px mobile / 70px desktop (120px custom), actions remain 44px.
- Fixture QA does not confirm a live Shopify cart transaction or Theme Editor save/reload. No template/settings mutation or theme upload was performed. Code and this block contract are delivered together; test fixtures stay outside the repository and are excluded from commits.
