# Shared Swiper carousel

The theme exposes a reusable Swiper rendering and lifecycle contract for
slideshow, featured collection, content list, and product media surfaces.

## Liquid markup

Capture direct `.swiper-slide` items and render the shared viewport:

```liquid
{% capture slides %}
  {% for item in items %}
    <article class="swiper-slide content-card">
      {{ item.title }}
    </article>
  {% endfor %}
{% endcapture %}

{% capture pagination %}
  <div class="swiper-pagination" data-swiper-pagination></div>
{% endcapture %}

{% render 'swiper-carousel',
  id: 'FeaturedContent',
  content: slides,
  root_class: 'content-list__carousel',
  aria_label: 'Featured content',
  pagination: pagination
%}
```

The snippet owns the `.swiper` and `.swiper-wrapper` contract. The caller owns
slide markup, controls, pagination markup, and section-specific styling.
Pass `layout: 'grid'` when the same items should render as a responsive grid;
that mode keeps the markup contract but skips Swiper initialization. Set
`--swiper-carousel-grid-columns` and `--swiper-carousel-grid-gap` from the
owning section or block when using grid mode.
Render `swiper-stylesheet` once in the owning section or layout where the
component is used.

The built-in Product List block and Collection Tab block use the same
`product-collection-grid` renderer. Their `grid` option keeps the existing CSS
grid, while `carousel` adds Swiper slide markup and delegates initialization to
`product-collection-carousel.js`.

Autoplay is an opt-in component contract. Pass `autoplay`, `pause_on_hover`,
and `autoplay_delay` to `swiper-carousel`; it exposes the normalized values as
`data-swiper-autoplay`, `data-swiper-autoplay-pause-on-hover`, and
`data-swiper-autoplay-delay` on the Swiper root. The runtime respects reduced
motion preferences, pauses on hover when configured, and uses the delay in
milliseconds.

Navigation buttons use the shared `swiper-nav-button` class with optional
`swiper-nav-button--prev`, `swiper-nav-button--next`, and
`swiper-nav-button--icon-only` modifiers. The icon-only modifier lets the
button fit its rendered SVG instead of using the default navigation control
size. Global
`--swiper-nav-size`, `--swiper-nav-size-mobile`, and `--swiper-nav-icon-size`
control the button and SVG dimensions. The button radius always follows
`--navigation-radius`, while a component may override these variables on its
carousel root when its navigation needs a different scale.

For shared hover navigation, add `swiper-carousel__container` to the wrapper
that contains the Swiper viewport and navigation, then add
`swiper-carousel__navigation--show_on_hover` to the navigation element. On
hover-capable desktop devices, the shared stylesheet fades the buttons in and
slides them inward by half their configured size; touch layouts keep the
controls available without requiring hover.

Pagination consumes Swiper's `--swiper-pagination-progressbar-size` token for
progress bars. Use pagination-specific custom properties on a component when
its colors or bullet sizing need a local override; keep pagination width and
placement in the owning component. Slideshow and hotspot carousel share
`swiper-pagination--overlay` with `swiper-pagination--desktop-left|center|right`
and `swiper-pagination--mobile-left|center|right` alignment modifiers. The section
provides `--swiper-pagination-inline-padding`; overlay controls use 24px desktop
and 16px mobile bottom spacing. Progress bars span this inset at every alignment.
Add `swiper-pagination--below` when the
pagination should flow below the carousel; it provides shared position,
spacing, width, and centering behavior through `--swiper-pagination-spacing`
and `--swiper-pagination-width`. Use
`swiper-carousel__navigation--centered` for overlay controls that should stay
centered on the slide area when below-flow pagination is present; set
`--swiper-navigation-center-offset` to the pagination flow offset.

Bullet buttons use a 24px height by default. Inactive buttons are 24px wide;
the active button is 48px wide. Override the pagination hit-size and hit-width
custom properties on the pagination root when a component needs different
dimensions. Their width tokens are `--swiper-pagination-bullet-hit-width` and
`--swiper-pagination-bullet-active-hit-width`; height uses
`--swiper-pagination-bullet-hit-size`. The `::before` and `::after` layers own
the visible dot and active indicator through the bullet width/height and
active width/height tokens. Override these tokens on the pagination root
instead of resizing or painting the button itself. Optional placement/spacing
tokens intentionally have consumer fallbacks; they are not missing global
settings.

Pass `show_next_slide_preview: true` to `swiper-carousel` when a desktop
carousel should reveal the next item. The shared contract keeps the numeric
`slidesPerView` value at the configured column count and uses the component
viewport's controlled visual overflow to reveal a 15% preview
(`--swiper-carousel-preview-size`), so the visible items retain their
configured column width. The preview is desktop-only and does not affect grid
layouts or mobile slide counts.

Pass `show_next_slide_preview_on_mobile: true` when a one-column mobile
carousel should reveal the next item. The product/collection carousel runtime
uses `slidesPerView: 1.2` at mobile widths; an explicit two-column mobile
setting remains unchanged.

## JavaScript

Use the shared factory from a section or feature module:

```js
import { Pagination } from './swiper-loader.js';
import { bindSwiperControls, bindSwiperSlideControls, createSwiperCarousel } from './swiper-carousel.js';

const root = document.querySelector('[data-content-list]');
const swiper = createSwiperCarousel(root.querySelector('[data-swiper-carousel]'), {
  modules: [Pagination],
  slidesPerView: 1,
  spaceBetween: 16,
  breakpoints: { 768: { slidesPerView: 3 } },
  pagination: { el: root.querySelector('[data-swiper-pagination]'), clickable: true }
});

bindSwiperControls(swiper, {
  scope: root,
  previous: '[data-swiper-previous]',
  next: '[data-swiper-next]'
});

bindSwiperSlideControls(swiper, {
  scope: root.querySelector('[data-slide-navigation]'),
  selector: '[data-swiper-slide-index]',
  activeClass: 'is-active',
  currentValue: 'step',
  scrollActiveIntoView: true
});
```

`createSwiperCarousel` adds the shared A11y module, enables `watchOverflow`,
deduplicates modules, and is idempotent per element. Use
`destroySwiperCarousel` during section unload or component disconnect. The
factory returns the native Swiper instance so existing product/media behavior
can keep using `slideTo`, `slidePrev`, `slideNext`, `update`, and Swiper events.

`bindSwiperSlideControls` provides a reusable indexed-control contract for
year rails, step navigation, or other controls that target a specific slide.
Each button supplies a numeric `data-swiper-slide-index`; the binder delegates
clicks within the supplied scope, updates an optional active class and
`aria-current`, and returns cleanup for editor unloads. `scrollActiveIntoView`
is opt-in and respects reduced-motion preferences.
