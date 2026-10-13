# Product list and Collection tab Promo cards

Promo card is a dynamic child of Product list and each Collection tab. Static
Product card controls remain; Add block exposes only Promo card, with no category.
Settings control card slot, mobile top, links, responsive image/video, overlay,
content, typography, CTA, gaps, scheme and padding. Each list owns its captured
slot stream; positions clamp to the last boundary and ties retain block order.
One DOM card moves above products on mobile and returns to its original slot.
Selection reveals an off-screen card without scrolling a visible card to slot 1.

Product and Promo cards use the same shared entrance scan, stable layout row
stagger, hidden-tab activation, global animation toggle and reduced motion.
Animation belongs to the inner card, preserving Swiper's layout transform.
Template-specific JSON, products and imagery are not copied across branches.

Validation: targeted rendering/lifecycle/animation tests, JS syntax, whitespace
checks and Theme Check on this branch. Live Peeko editor covered add/remove,
position changes, grid/carousel, mobile-top, selection and owning-tab activation.
Base runtime is scoped to Product/Promo cards; existing theme motion tokens and
motion_block_animations setting remain authoritative.
