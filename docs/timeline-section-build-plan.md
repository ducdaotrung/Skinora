# Timeline section build plan

```yaml
section_type: content
role: "Present a merchant-authored sequence of milestones with a single active slide and a year navigation rail."
placement: "Dynamic section in JSON templates; enabled on all templates. Merchants can add, remove, and reorder the section."
context: "No Shopify resource context. All milestone content is authored in Theme Editor blocks."
data_sources:
  - "Timeline List theme block child blocks, rendered in configured order."
section_settings:
  - "section_width: page_width | full_width; default page_width."
  - "desktop_alignment: left | center | right; default left."
  - "mobile_alignment: left | center | right; default left."
  - "gap_desktop: 0..100 px; default 32."
  - "gap_mobile: 0..100 px; default 24."
  - "color_scheme: Theme Settings color scheme; default scheme-1."
  - "padding_top / padding_bottom: 0..100 px; default 0."
  - "customize_mobile_padding and optional mobile top/bottom padding; default off/0."
block_settings:
  - "Timeline List: Layout controls one adjacent-slide preview setting for desktop and mobile (off by default: 1 slide; on: 1.5 slides) and slide/fade transition. Navigation controls arrow visibility/style; Timeline controls the always-visible milestone rail style and left/top/bottom position; Gap is the final group and controls desktop/mobile slide spacing."
  - "Timeline List child (`timeline-slide`, displayed as Slide): owns the Timeline label and accepts shared theme content blocks."
allowed_blocks:
  section:
    - "header (static singleton)"
    - "timeline-list (static singleton)"
  timeline_list:
    - "Timeline Slide only; repeatable, capped by Shopify's 50-block section limit."
limits:
  max_blocks: 50
  nesting_depth: 4
  section_slots: 2
preset_tree:
  - "Static Header with Eyebrow, Heading, and Text."
  - "Static Timeline List with five editable Timeline Slide milestones."
  - "Each Timeline Slide matches the shared Carousel Slide layout and adds a Timeline label for navigation."
shell_responsibilities:
  - "Use the section-spacing, page-width/full-width container, color scheme, and align-content contracts."
  - "Keep section spacing/padding and parent alignment at the section; do not add section.shopify_attributes."
responsive_responsibilities:
  - "Timeline Slide mirrors the shared Carousel Slide layout and accepts the same content blocks, with an additional Timeline label."
  - "Milestone controls remain horizontally scrollable when their count exceeds available width."
  - "The section Header preset is centered independently; each milestone Header inherits section desktop/mobile alignment."
runtime_responsibilities:
  - "Use the shared Swiper viewport/factory; the list is always a carousel and has no grid option."
  - "Use shared indexed-slide and previous/next control binders for milestone controls."
  - "Support timeline-dot, text-underline, and progress-with-label pagination styles."
  - "Use the fade effect only when adjacent-slide preview is disabled, matching Slideshow's transition behavior."
  - "Load the timeline runtime from the global layout in design mode so dynamically inserted Theme Editor sections receive lifecycle listeners; load it from Timeline List on the storefront."
  - "Build navigation labels from each rendered Timeline Slide’s `data-timeline-label`; nested block settings are not available to the parent Liquid loop."
  - "Initialize/destroy per timeline-list instance and handle section/block editor lifecycle events."
  - "Without JavaScript, show all item content in a readable vertical sequence and hide inactive controls."
app_block_policy: "No @app blocks; the section has fixed Header/Timeline List slots, and Timeline List accepts Timeline Slide blocks only."
empty_and_missing_states:
  - "No timeline items: render no empty carousel or navigation rail."
  - "Missing item image/content: keep the milestone label and render available content safely."
  - "One item: show its timeline label and hide previous/next arrows."
reuse_decisions:
  reused_components:
    - "blocks/header.liquid, with an opt-in inherit_alignment mode for section-owned alignment."
    - "blocks/heading.liquid, blocks/text.liquid, and blocks/eyebrow.liquid inside Header."
    - "blocks/buttons.liquid and snippets/theme-button.liquid."
    - "blocks/image.liquid and snippets/image.liquid."
    - "blocks/slide.liquid as the layout and settings reference for Timeline Slide."
    - "snippets/swiper-carousel.liquid, snippets/swiper-stylesheet.liquid, and assets/swiper-carousel.css."
    - "assets/swiper-carousel.js create/destroy factory, extended with indexed-slide controls."
  new_shared_components:
    - "A reusable bindSwiperSlideControls() API in assets/swiper-carousel.js, consumed by Timeline List."
  new_theme_blocks:
    - "blocks/timeline-list.liquid: owns the repeating milestone slot, rail, and Swiper composition."
    - "blocks/timeline-slide.liquid: mirrors Carousel Slide and adds a Timeline label."
  consumers_reviewed:
    - "Existing Header usages across sections, templates, and section-group presets; inheritance is opt-in and defaults off to preserve saved alignment behavior."
    - "Existing Swiper factory consumers; the new API is additive and does not change their initialization."
routes:
  - skill: "section-schema-block-composer"
    reason: "Define the two fixed section slots, nested repeatable item slot, defaults, and preset tree."
  - skill: "liquid-css-js-builder"
    reason: "Compose the section shell, controlled theme blocks, reusable Swiper, rail controls, and scoped lifecycle."
  - skill: "responsive-theme-editor-guard"
    reason: "Check split/stack layout, overflow, focus, block add/remove/reorder, and editor lifecycle."
  - skill: "section-qa-release-gate"
    reason: "Review schema, translations, ranges, diff, accessibility, and available static validation."
unresolved_dependencies: []
acceptance_checklist:
  - "The section exposes only Header and Timeline List as top-level blocks."
  - "Timeline List exposes only repeatable Timeline Slide children and always uses carousel behavior."
  - "Timeline List keeps Gap as its final settings group; preview defaults to one slide and switches desktop and mobile to 1.5 slides together."
  - "Timeline navigation supports left, top, and bottom placement; the progress line tracks the active milestone center and animates with reduced-motion support."
  - "Timeline year/date labels control their matching slide and track slide changes in the reverse direction."
  - "Section layout, appearance, gap, and padding settings match the supplied schema reference."
  - "Existing shared Header and Swiper consumers retain their current behavior by default."
  - "Schema translations, responsive fallback, accessibility state, and editor lifecycle are reviewed."
status: IMPLEMENTED; STATIC REVALIDATION AND VISUAL QA PENDING
```

## Block contracts

### Timeline List

- **Role:** controlled, always-carousel composition that owns the milestone item slot and its year navigation rail.
- **Children:** only repeatable `timeline-slide` blocks; no grid mode or `@app` slot.
- **Ownership:** owns slide-to-slide interaction, responsive slide gap and a shared preview setting (one slide by default; 1.5 on both devices when enabled), transition, timeline rail style, and arrows; section owns overall width, color scheme, section gap, alignment, and padding.
- **Output:** shared Swiper viewport containing direct `.carousel-slide.swiper-slide` Timeline Slide roots, followed by a labelled navigation landmark with one button per slide.
- **Runtime:** shared indexed-slide and previous/next control binders handle active state and navigation; per-instance module owns init, cleanup, and Shopify editor events.

### Timeline Slide

- **Role:** one Timeline List slide with a navigation label.
- **Children:** the same `@theme` content block slot as Carousel Slide.
- **Ownership:** mirrors Carousel Slide layout settings and adds the Timeline label consumed by the rail.
- **Output:** one `.carousel-slide.swiper-slide` root with a stable ID and `data-timeline-label`.

## Reference analysis

- `blocks/timeline-slide.liquid` mirrors `blocks/slide.liquid`, accepts the same content blocks, and adds a Timeline label consumed by navigation.
- `blocks/blog-list.liquid` and `blocks/collection-list-items.liquid` establish list-block ownership and responsive list behavior. Timeline List uses the same parent-list responsibility but fixes the mode to carousel as requested.
- `blocks/carousel.liquid`, `snippets/swiper-carousel.liquid`, `assets/swiper-carousel.js`, and `assets/swiper-carousel.css` provide the shared slider foundation. The generic factory is retained; only indexed slide controls are added.
- Existing Header instances include explicit left/center/right values. Its new inheritance mode is opt-in and defaults off so those consumers keep their current output; Timeline presets opt in so section alignment reaches the Header.

## QA record

- Shopify Theme Check previously reported **0 errors and 33 warnings** across 15 existing files; it could not be rerun after this fix because the sandbox denied Shopify CLI access to its preferences file.
- JavaScript syntax, section schema JSON, locale JSON, and `git diff --check` passed before extracting the dedicated Timeline Slide block; revalidation is pending.
- The open Theme Editor preview still showed the pre-fix rail labels and interaction after the local edits, so fresh visual confirmation of the updated runtime remains outstanding.
- Timeline Slide mirrors Carousel Slide; the timeline rail supports horizontal and vertical axes. Storefront visual confirmation at desktop and mobile widths remains outstanding.
- The Theme Editor remained unsaved to preserve its existing restore-last-session state.
