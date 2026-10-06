# Collections with tabs color audit — 2026-10-05

Reference: Spinel theme 166302089264, section `template--23983517925424__collections_with_tabs_kF3iyn` (behavioral reference; settings were temporarily changed without saving, then the editor was reloaded).

## Intended behavior verified before implementation

- Collection blocks expose Inherit / Color scheme and an independent Custom background toggle.
- With autoplay stopped and one collection active, its selected color scheme applies to the entire composition: composition background, header, all collection titles/counts/arrows, and active progress indicator. It does not apply only to that collection image or row.
- Custom background overrides the entire composition background only. In the reference, scheme 3 plus a light custom background retained white header, titles, count, arrows and progress from scheme 3. Placeholder surfaces derive from the overridden background and retained text tokens.
- Placeholder media keeps the canonical neutral mixed surface; it does not become a flat exact scheme background.
- In boxed layout, scheme and custom background apply to the box interior only; the outer section padding keeps its section scheme. In unboxed layout, the section root is the owner.
- Switching to an inherited collection must restore the section and boxed container's original schemes independently.
- Mouse, keyboard, autoplay and Theme Editor block selection must all use the same activation path and update colors together. Mobile has the same active collection ownership.

## Defect in Spinel

The block scheme was placed only on the image panel, while the title rows and header are siblings outside that panel. Active-tab JavaScript did not propagate any scheme. Therefore changes could not recolor the composition.

## Implementation and validation

- Active panel exposes normalized scheme ID and independent custom-background metadata; no settings IDs or defaults changed.
- The existing shared activation path updates the owning box (boxed) or section (unboxed), including hover, keyboard, autoplay and Theme Editor block selection. Inherit removes the previous override and restores the original owner scheme.
- Existing shared color-scheme classes and `--background-color` are reused; placeholder tokens remain canonical. No new CSS color library or custom per-row styling.
- Removed image-only scheme/background overrides that conflicted with composition ownership.
- PASS: 5/5 focused regression tests cover boxed/unboxed ownership, independent custom background, fallback restoration, keyboard activation, and Liquid scheme-object/string serialization.
- PASS: JavaScript syntax, `git diff --check`, Shopify Theme Check (0 errors, 35 existing warnings, 0 offenses in changed files).
- PASS: scoped upload of only the three implementation files to development theme 144448127024 (`spinel-theme/codex/spinel-chieutt-dev`, unpublished). No templates/configs uploaded.
- PASS: fresh Theme Editor session on development theme: Scheme 3 recolored boxed interior/header/all titles while retaining outer section background; custom background retained white scheme text; unboxed scheme recolored the entire section; Inherit restored base colors; mobile preview retained the same scheme ownership. QA used an unsaved temporary section, removed afterward, and never saved or published template changes.
- The user's existing editor session retained its previously loaded JavaScript and unsaved settings. That session was preserved; save those settings and reload to receive the new asset. Browser proof: `/private/tmp/collections-with-tabs-color-qa.png`.
- Port 9292: no listener or watcher.
- Shared-base consistency: this corrects shared collection-tab behavior and is suitable for a subsequent expressly requested outbound sync to `theme-base/dev`; no cross-repository sync is performed in this request.

Changed implementation files: `assets/collections-with-tabs.js`, `blocks/collections-with-tabs-item.liquid`, `sections/collections-with-tabs.liquid`.
