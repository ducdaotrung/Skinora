# FAQ reference audit — 2026-10-06

## Intended behavior (recorded before implementation)

Reference: Shopify theme `166302089264`, `/pages/about-us?view=faqs` (read-only).
The supplied media-with-text section ID no longer exists on this template; the visible
FAQ content belongs to `custom_section_Ve9BxK`. The template is assigned to zero pages.

- Centered `[ FAQS ]` eyebrow and one H1, “Frequently asked questions”.
- Five ordered groups: Jewelry & Materials, Ring Sizing, Orders & Shipping,
  Returns & Exchanges, Jewelry Care. Each has an H2 and three numbered questions.
- First question in each group starts expanded. Each row toggles independently,
  with a chevron, thin dividers, and its answer immediately after the question.
- Mobile retains the same order and single-column structure; long questions wrap.
  Buttons must work with keyboard input and retain visible focus.
- Final centered support heading, explanatory text, and Contact us CTA.
- Preserve merchant editable groups, questions, answers, typography, and appearance.
  Empty answers should not create inert storefront rows; editor selection should open
  the containing row. Reordering/duplicating should retain independent row IDs.

## Reference findings

- P1: Contact us has no destination and is disabled.
- P2: Ring Size Guide is plain placeholder text, not a link. Preserve the copy until
  an actual guide destination is supplied; do not invent a URL.
- P2: Two sidebar group names do not describe their rendered content (Ring Sizing and
  Jewelry Care). Use accurate group names in the development template.

## Implementation contract

Reuse `rich-text`, `faq-accordion`, `group`, `heading`, `eyebrow`, `text`,
`button`, `faq_accordion`, `faq_item`, `faq_answer_text`, and shared accordion-details.
No new section, block, stylesheet, JavaScript controller, or schema is required.
The FAQ section allows group/accordion; each category group renders a heading and
accordion, each accordion renders three row blocks, each row one answer text.
All category/row/answer blocks remain dynamic and reorderable; rich-text fixed
eyebrow/heading/text slots are static and excluded from block_order.
Shared theme kernels own typography, colors, width, responsive layout, and interaction.
Page-specific composition and merchant copy live in `templates/page.faqs.json`.
No cross-repository synchronization is authorized or needed for template content.
The existing `faq_item` visibility guard required a runtime fix: nested block
settings are not reliable during storefront traversal. Its captured, rendered
answer now determines visibility. Legacy inline answers and editor empty states
remain supported. This shared fix should be synchronized to `theme-base/dev`
only through a separately authorized outbound sync preserving both histories.

## Validation

- PASS: Development theme ID/name/unpublished verified; only FAQ template and
  `blocks/faq_item.liquid` uploaded successfully to `144448127024`.
- PASS: Theme Check error gate, 323 files, zero errors / 34 existing warnings.
- PASS: `git diff --check`; 8 focused Liquid visibility and shared disclosure tests.
- PASS: Template settings/types/ranges/select options and static/dynamic block_order
  validated against local schemas. Three sections; 52 blocks total; FAQ section has
  45 dynamic blocks, within the 50-block limit; deepest nesting is four levels.
- PASS: Storefront has one H1, five category H2s, 15 questions with their answers,
  and five initially open rows. Enter opens another row without closing siblings;
  Space closes it; aria-expanded follows the state. Visible keyboard focus.
- PASS: No horizontal overflow at 390, 767, 768, 1149, or 1150px; all widths retain
  15 rows and five default open answers. Content is capped at 1100px on desktop.
- PASS: Theme Editor loads faqs with the expected dynamic hierarchy and unchanged
  schema controls; selecting the second question opens its answer with correct
  aria-expanded. No editor changes were saved during selection QA.
- PASS: Contact us resolves to the verified existing `/pages/contact` contact form.
- NOT TESTED: Exhaustive add/remove/duplicate/reorder and every existing kernel
  setting combination; no schemas or JavaScript lifecycle were modified.
- Follow-up: Ring Size Guide remains merchant-editable placeholder copy from the
  reference, awaiting a real destination. Typography follows current Spinel tokens
  and font settings rather than changing global fonts to match the reference theme.
- Preview uses `?view=faqs`; the template remains assigned to zero pages, avoiding
  a store-wide page assignment change during development.
- Port 9292: no listener before or after QA; no preview watcher started.
- Overall: PASS WITH FOLLOW-UPS (guide destination and separately authorized base sync).
