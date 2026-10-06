# Shared overlays

## Ownership

- `snippets/component-overlay.liquid`: shared HTML dialog shell, optional
  title, accessible label, HTML backdrop close target, drag handle and
  scrollable body.
- `snippets/component-overlay-cursor.liquid`: one global custom-cursor,
  rendered outside overlay content so it can follow the active backdrop.
- `assets/component-overlay.css`: popup/drawer/sheet geometry, spacing, radius,
  backdrop, pointer close affordance and motion. Uses existing Theme Settings
  tokens.
- `assets/component-overlay.js`: open/close state, Escape/backdrop, focus return,
  pointer close positioning, interrupted transitions, reduced motion and
  reusable `SheetGesture`. Opening focuses the close control by default;
  Theme Editor selection handlers pass `focus: false` to keep focus in the editor.
- Feature controllers own only content, forms, variants and trigger wiring.

Popup blocks, Pickup availability, back-in-stock Notify and Size chart render
this same shell. It is a `<div role="dialog">`, and the controller manages its
visibility, initial focus, Tab wrapping and focus return. Dialogs marked with
`append_to_body` are portaled to `document.body` before opening so Product
Details transforms and overflow cannot clip them. The controller remembers
the original location and restores it during teardown.

Cart order options and Localization retain their existing commerce/navigation
shells. They consume the shared sheet radius/header classes and `SheetGesture`
through adapters; their nested commerce/navigation state remains feature-owned.
The main Cart drawer, Search and mobile header drawer now use the same
`component-overlay` lifecycle directly while preserving their feature markup.
The desktop mega menu remains a native `details` dropdown because its hover and
focus semantics are different from a modal; its backdrop and custom cursor use
the shared overlay tokens/helper. Product media remains a specialized native
`dialog` because zoom, pan and gallery navigation own its lifecycle.

## Contract

Capture body markup and render `component-overlay` with a unique `id`, `label`
and `content`. Optional parameters are documented in its LiquidDoc. Omit `title`
for a headerless layout (Contact/Pickup); close and mobile drag affordances remain.
Feature CSS may style body content, but must not recreate panel dimensions,
padding, transitions, backdrop, header, close control or radius.

```js
const overlay = window.ThemeOverlay.get(dialog);
overlay.open({ opener: trigger });
// Default storefront opening focuses the close control and traps Tab in the overlay.
// Feature controllers can defer the panel reveal by one frame so the backdrop
// leads the content when a loaded view needs a softer entrance.
// overlay.open({ opener: trigger, defer: true });
// Theme Editor selection handlers keep focus in the editor:
// overlay.open({ opener: null, focus: false, restoreFocus: false });
overlay.close();
// On section removal:
overlay.destroy();
```

Desktop uses a viewport-centered `popup` (scale .95 → 1 + fade) or a
right-anchored `drawer` (slide from right).
The loaded Quick View popup intentionally uses a softer `scale .9 → 1` entrance
over 500ms, with a 700ms backdrop timeline. Its close path reverses the panel
from `scale(1)` to `scale(.9)` over the same 700ms backdrop timeline, so the
panel and backdrop finish together; its controller opens only after the product
DOM and primary media are ready.
Quick View keeps the overlay body as its only scroll container; the desktop
media-left layout keeps product details sticky without creating a second column
scroll area. Mobile layouts remain a single natural document flow.
Mobile through 767.98px uses `bottom_sheet` (slide from bottom) or `drawer`.
Drawer padding settings control the panel's outer inset on top, right and
bottom; they never remove the header/body content padding. An unchecked setting
keeps those edges flush at `0`.
All modes use the global motion and backdrop tokens. Backdrop alpha is part of
`--overlay-backdrop-color` as an `rgba()` background color so the blur remains
visible while the overlay opacity setting still controls the configured alpha.
Backdrop color, element opacity and blur transition with the same duration and
easing. At rest, element opacity remains `1` so the configured color alpha does
not weaken the blur; sheet dragging fades the backdrop from that baseline.
On fine pointers, the HTML backdrop itself receives the hover event and
activates the global `<custom-cursor>` DOM element. It uses the active overlay
scheme, expands to 6.4rem with a 2.2rem SVG X, and collapses smoothly when the
pointer leaves the backdrop. Touch contexts do not show it; reduced-motion
contexts disable the transition while keeping the backdrop close action
available.
Sheets are content-height
with a viewport cap, common top corner radius, safe-area padding, and a
scrollable body. On mobile, dragging can start from any non-interactive panel
surface while the sheet body is at scroll-top, so the panel can be dismissed
without reaching the header. The panel follows the finger until the dismiss
threshold, then applies resistance while the backdrop fades with drag progress.
A header drag remains available even when the body is scrolled; form controls,
links and other interactive targets retain their native behavior.

## Validation

Run `node --test tests/component-overlay.test.cjs` for controller and pointer
close regressions.
`tests/overlay-fixture.html` is a manual browser fixture for the shared
`div[role="dialog"]` shell with the real component CSS/JS; its output records
opening transforms and backdrop color. It does not render Liquid or replace
storefront/Theme Editor QA.

Before release verify the actual theme at mobile, 768px and desktop: popup
animation, drawer animation, drag/cancel, Escape, backdrop, Tab confinement,
focus return, long content scroll, sticky PDP position and reduced motion.
In Theme Editor verify add/remove/duplicate/reorder/select/save/reload, all
existing desktop/mobile layout settings, and variant-dependent pickup/Notify.
