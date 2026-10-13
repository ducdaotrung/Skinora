# Contact reference audit and implementation

Reference: Shopify trial theme 166302089264, `/pages/contact`, inspected read-only in Theme Editor on desktop and mobile.
Development target: 144448127024, `spinel-theme/codex/spinel-chieutt-dev`, verified unpublished via Shopify theme list.

## Behavior contract recorded before implementation

- Reference resolves to the Contact template, despite the supplied stale media-with-text section identifier. Composition: Divider → centered Contact → Divider → Instagram image/text marquee. One H1: Contact us; Instagram heading is H2.
- Contact copy: `[ NEED HELP ]`, `Contact us`, `Have a question? Fill out the form and we’ll respond within 1–2 business days.` Form width 700px, desktop padding 70/90px; mobile padding 50/50px. Name/email share a desktop row and stack on mobile. Phone, topic, message follow in reading/tab order. Submit uses the shared primary button, centered.
- Reference email is required; name, phone, topic and message are optional. Topic starts empty and offers Product details; Order & shipping; Size & fit; Returns & exchanges; Wholesale & partnerships; Press & media; Other. Shopify owns contact delivery, spam checks, server errors and success response.
- Instagram: `[ JOIN US ]`, `Follow us on Instagram @ELVARA`; alternating six editable portrait image slots and three pairs of @ELVARA/FOLLOW US text. Reference images and links are unselected. Preserve placeholders and blank links; no invented photographs or destinations. Desktop padding 100/120px, mobile 60/60px.
- Reuse Custom section, Header, Eyebrow, Heading, Text, Divider, Contact form, Contact field, Marquee, Marquee item and Image. Theme Settings own typography/button/form tokens and margins. JSON owns merchant copy/composition. No new section, block or JavaScript.
- All template blocks are dynamic and remain selectable/reorderable/duplicable/removable through current allow-lists. Custom section is the existing generic composition surface; Contact form permits only Contact field; Marquee permits only Marquee item. Useful custom fields: two, platform cap 50; marquee: six purposeful image/text items, shallow nesting. Missing typography blocks are omitted; empty images use the current image placeholder kernel.
- Form extension preserves existing required-name/message defaults while allowing this template to match reference optional fields. Phone must accept international formatting, use `tel` keyboard and standard contact[phone]. Custom fields require their own editor attributes. Native form controls supply keyboard operation; no new listener lifecycle.

## Initial audit findings

- Local Contact was unrelated to reference: sample image, generic form and example contact addresses. Replace composition with reference merchant copy without changing global navigation, footer, page assignment, schemes or other templates.
- P2: phone field restricted input to digits via pattern and numeric keyboard, rejecting +, spaces and parentheses.
- P2: Contact field had no block.shopify_attributes, preventing reliable direct selection in preview.
- P2: Name/email/message UI strings were hard-coded; use storefront locale keys.
- Reference media and Instagram links need merchant configuration; response time and @ELVARA are reference copy requiring factual review before a future live promotion.
- Current foundation, form, button and marquee contracts remain authoritative. Shared form improvements should be candidates for a separately authorized outbound theme-base/dev sync. No cross-repository synchronization is performed.

## Validation

- PASS: Shopify Theme Check exits 0, zero errors; no findings in changed Contact/form/locale files. Repository has 18 existing files with unrelated warnings.
- PASS: recursive template schema check for every setting ID, range step, select option and child allow-list. Server upload also validates richtext and nested template structure.
- PASS: scoped upload of template + Contact form + Contact field + English storefront locale to unpublished development theme. Final template upload succeeds. No Git commit/push or theme publication.
- PASS: development editor loads the Contact template assigned to the existing one page; saved/reloaded state renders copy and blocks without Liquid errors.
- PASS: desktop preview width 1612px: form 700px, identity columns 342px/342px, both headings centered, one H1 plus Instagram H2, no horizontal page overflow. Desktop image placeholders render 300px wide.
- PASS: mobile preview width 375px: form 343px, identity column 343px, both headings centered, no overflow. Image placeholders render 160px wide. Current global typography, form radius and button style are preserved rather than copying trial-theme global styling.
- PASS: initial Name/Message optional, Email required; both added Require name/Require message controls individually turn on HTML required after Theme Editor re-render. Both QA changes were undone and required=false restored; Save disabled. Defaults true preserve other saved form instances. These two merchant labels intentionally use plain English literals, following existing custom-field Required/Field type labels; storefront labels use locale keys.
- PASS: preview click on Phone opens its correct Custom field panel. Phone field hides Options; dropdown schema exposes Options only for dropdown/radio. Dropdown has all seven reference topics and empty initial value.
- PASS: international phone +84 (28) 1234 5678 reports valid; selecting Order & shipping updates selected value; invalid-email reports native typeMismatch; missing Email reports valueMissing. Test values cleared; no message sent.
- PASS: shared primitives retain labelled inputs, button variant, native select/textarea keyboard behavior, block editor attributes, and CSS/JS marquee hover/focus/reduced-motion contract. No new JavaScript or listener lifecycle.
- PASS: git diff --check. Port 9292 free before/after QA; no watcher was started.
- NOT TESTED: actual contact delivery, Shopify spam/CAPTCHA flow, server-returned success/error response, all block add/remove/duplicate/reorder combinations, all color schemes, translation languages and every existing unchanged setting. No external contact submission was authorized.

## Deliberate reconciliation with current Spinel

- Image max-width schema steps are 16px: configure desktop304/mobile160 instead of trial300/150. The placeholder desktop intrinsic width is300px; mobile160px. No fork of Image kernel.
- Custom section padding max100px: Instagram bottom spacing uses section100 + marquee20 on desktop; mobile uses section60 + marquee0. Other measured spacing follows reference.
- Dividers retain global responsive page margins, matching current full-width container contract. Reference full-bleed section setting is not recreated.
- Blank reference Instagram links remain blank and unselected media remain editable placeholders.
- Original unrelated local template is recoverable from Git history; unrelated worktree edits were preserved.

Evidence: /private/tmp/contact-dev-desktop.jpg and /private/tmp/contact-dev-mobile.jpg.
