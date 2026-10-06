# Bundle builder section build plan

```yaml
section_type: commerce
role: "Let a customer select products and quantities into a bundle, track progress toward merchant-configured discount tiers, and add the selected variants to cart together."
placement: "Dynamic section on the home page template; merchants can add, remove, and reorder it."
context: "The private Bundle Product List block supplies eligible products through its selected products or collection; selected products take precedence over the collection."
data_sources:
  - "Bundle Product List product_list setting, then collection.products as fallback."
  - "Shopify variant JSON for option selection, availability, quantity rules, and prices."
  - "Bundle Summary discount goal settings for progress copy and thresholds. Shopify Discounts remains authoritative for checkout pricing."
section_settings:
  - "section_width: page_width | full_width; default page_width."
  - "color_scheme: Theme Settings color scheme; default scheme-1."
  - "padding_top / padding_bottom: 0..100 px; default 40."
  - "customize_mobile_padding and optional mobile top/bottom padding; default off/24."
allowed_blocks:
  section:
    - "header: the only merchant-addable block type; repeatable shared Header blocks with Heading and Text children."
    - "_bundle-product-list: fixed static private product source, responsive grid, variant selection, and item action."
    - "_bundle-summary: fixed static private selection summary, progress tiers, appearance, and add-to-cart action."
  max_blocks: 50
  app_blocks: "Not allowed; this fixed commerce composition owns bundle state and cart submission."
preset_tree:
  - "Header with Heading and Text."
  - "Bundle Product List with collection unset, product list unset, and nine-product maximum."
  - "Bundle Summary with three-item percentage-off goal, optional tiers two and three disabled, quantity selector enabled."
shell_responsibilities:
  - "Section owns width, base color scheme, overall vertical spacing, and desktop/mobile composition."
  - "Product List owns source precedence, collection/product selection, columns, gaps, and per-card variant/add action."
  - "Summary owns selection state presentation, progress goals, color schemes, card appearance, and cart CTA."
reuse_decisions:
  reused_components:
    - "blocks/header.liquid, blocks/heading.liquid, and blocks/text.liquid."
    - "snippets/product-card.liquid for the shared product media, title, badges, and price."
    - "snippets/product-collection-grid.liquid for the responsive grid shell."
    - "snippets/variant-picker.liquid and assets/variant-picker.js for variant options, with bundle-scoped presentation overrides sourced from Product cards > Swatches and bundle-specific URL/section-sync controls."
    - "snippets/theme-button.liquid for all bundle actions."
  new_theme_blocks:
    - "blocks/_bundle-product-list.liquid."
    - "blocks/_bundle-summary.liquid."
  new_runtime:
    - "assets/bundle-builder.js, scoped to each section instance and reinitialized through Shopify Theme Editor section lifecycle events."
runtime_responsibilities:
  - "Keep selection state per section instance; synchronize selected variant and quantity against the shared variant picker and Shopify quantity rules without changing the product page URL or main product picker."
  - "Keep the responsive desktop and mobile option controls for each product synchronized through the shared variant:change event; dropdown controls represent complete variants, while button controls reuse the shared option groups."
  - "Keep sold-out variants visible with a diagonal strike and accessible sold-out status; unavailable combinations remain disabled and visually distinct. Disable Add to bundle when the currently selected variant is sold out."
  - "Display the next threshold or unlocked message from configured item-count or purchase-amount goals."
  - "Submit selected variant IDs and quantities together to the locale-aware Shopify Ajax Cart API."
  - "Let Shopify's matching automatic discount configuration calculate the final discount in cart/checkout; the section does not calculate or submit discount amounts."
  - "Open the existing cart drawer after a successful add, with a cart-page fallback."
responsive_responsibilities:
  - "Header spans the layout. Product grid and summary sit side-by-side on desktop; on mobile the product grid precedes the summary."
  - "Grid columns and gaps are configurable independently for desktop and mobile. Summary supports a distinct mobile color scheme, spacing, and padding."
  - "Product options use separate mobile and desktop control wrappers. When desktop uses buttons, the mobile picker follows its button-or-dropdown setting; desktop dropdown mode remains a dropdown at both breakpoints."
  - "Product cards > Swatches controls the bundle option swatch type, selected style, dimensions, and ratio. Its compact swatch limit and position do not hide or reorder the actual variant options."
  - "All variant controls, quantity actions, selection status, and errors remain keyboard accessible and scoped to the section."
empty_and_missing_states:
  - "No source or no eligible products: show product-card placeholders with disabled Add to bundle buttons in Theme Editor and no blank card grid on the storefront."
  - "No selection: progress shows the first configured goal and the cart CTA is disabled."
  - "Unavailable selected variant or failed cart request: show an accessible error and keep the current selection available to adjust."
  - "No enabled discount goal: show the selection summary without progress messaging."
consumers_reviewed:
  - "Shared variant picker defaults remain unchanged when no type override is passed."
  - "Existing product card output is reused without changing its global quick-add, quick-view, or swatch behavior."
acceptance_checklist:
  - "The section appears as Bundle builder on the home page template; merchants can add Header blocks only, and each Header renders above the fixed Product list and Bundle summary blocks."
  - "Product list selection overrides the collection, and both feed the shared responsive grid."
  - "Each product card renders mobile and desktop variant controls under one bundle-card__options wrapper; changing either control updates the other control and the bundle's current variant."
  - "Product cards > Swatches appearance settings apply to option swatches without changing their saved values or applying the compact swatch limit to the full variant picker."
  - "Sold-out options use the diagonal strike treatment, retain accessible status text, and disable Add to bundle for the selected sold-out variant."
  - "Per-product variants can be selected and added/removed from the bundle; quantity changes follow variant rules."
  - "Tier settings and messages update the summary progress; Shopify Discounts remains the price authority."
  - "The selected items are submitted together, and the existing cart drawer opens on success."
  - "Theme Editor section unload/reload does not duplicate listeners or state roots."
  - "Schema, locale JSON, accessibility, responsive behavior, and diff hygiene are statically reviewed."
status: IMPLEMENTED; CODE REVIEW COMPLETE; THEME CHECK PASSED; LOCAL VISUAL QA PENDING
```

## QA record

- The reference Product list was inspected in the Shopify theme editor and storefront. Its option area keeps mobile and desktop controls in separate wrappers, and uses diagonal strikes for unavailable/sold-out values.
- `product_card_swatch_limit` uses the documented string-valued select options (2–6), and its saved value is the string `"4"` to preserve the merchant's selection with the matching schema type.
- Full Shopify Theme Check passed at error level after syncing `origin/dev`; 35 non-error offenses remain across 18 files. Local storefront visual QA is still pending.
- `git diff --check` passed after resolving the sync conflicts and updating the implementation.
