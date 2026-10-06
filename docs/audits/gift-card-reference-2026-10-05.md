# Gift card reference and Spinel audit — 2026-10-05

## Reference and behavior contract

Reference: https://admin.shopify.com/store/spinel-theme/themes/166302089264/editor?previewPath=%2Fgift_cards%2F123456%2Fpreview

Audited in logged-in Chrome before implementation. The Gift card template has no sections or local schema settings. Desktop: centered 468px content, balance, Shopify gift-card illustration (320px), shop name, redemption instructions, 120px QR inside 160px area, formatted code, two equal-width actions. Mobile: same sequence, narrower content, actions stacked. Copy changes its label to Code copied. No print button is present. Reference mobile mode restored to desktop; no merchant settings changed or Save action performed.

## Implementation and ownership

- Standalone `templates/gift_card.liquid`, as required by Shopify's native Liquid gift-card template. No section/block schema, new placement, or fake editor controls.
- Shopify owns balance, code, expiration, enabled state, QR identifier and Wallet pass. Actual card/transaction creation was outside QA scope.
- Shared `css-variables` and `critical.css` supply theme typography, color schemes, focus, and buttons. Semantic h1/h2 use independent heading-xl/lg visual roles. Current merchant global settings are preserved, so fonts/button treatment differ from the reference.
- Scoped `gift-card.css` owns composition, mobile stacking, and print treatment. QR uses Shopify's official QR library and native qr_identifier. QR's white quiet zone is intentional for scan contrast.
- Deferred gift-card.js owns clipboard feedback. Clipboard API first, user-initiated legacy copy for restricted editor iframes, manual code selection if neither succeeds. Legacy path copies the unformatted raw code from an ephemeral textarea.
- Disabled, expired, zero balance and expiration date have separate localized states. Apple Wallet badge remains conditional. Print stylesheet retains redemption content and hides actions/Wallet.
- Customer-facing additions use additive English locale keys. Existing collection-page locale edits are preserved.

## Validation evidence

- PASS: `node --test tests/gift-card.test.cjs` (4 tests): native QR payload/dimensions; exact unformatted clipboard code; denied API legacy fallback; total copy failure with honest error/manual selection.
- PASS: JavaScript syntax and `git diff --check`.
- PASS: Shopify Theme Check, 0 errors / 35 existing warnings; no offense in gift-card files or English locale. Output: `/private/tmp/gift-card-themecheck.json`.
- PASS: native development Theme Editor desktop/mobile renders actual Shopify sample balance, illustration, instructions, QR, code, shared buttons; no dedicated settings/blocks are offered, matching reference.
- PASS: initial native Clipboard API denial exposed and fixed. Legacy copy returned true and announced success in the native editor. Unit fixtures verify exact raw code in final implementation.
- NOT VERIFIED: end-to-end system clipboard content. Session clipboard comparison against the fixed preview sample returned false. A later attempt to output clipboard data was rejected by automatic approval review because a gift-card code is sensitive bearer data; output was not performed and no workaround attempted.
- NOT TESTED: native expired/disabled/zero/expiration/Wallet states (preview only provides active sample; no actual gift cards created). Liquid branches retained/expanded, Wallet path preserved. Browser print dialog was not opened; print CSS reviewed.
- PASS: scoped uploads with `--nodelete` only to unpublished `144448127024`, name `spinel-theme/codex/spinel-chieutt-dev`, store spinel-theme.myshopify.com. Explicit theme list verified exact ID/name/role, because theme info's Development Theme ID is not set. No settings_data upload, live/reference upload, commit, push, or cross-repository sync.
- PASS: port 9292 has no listener; no preview watcher started or left running.

## Consistency / synchronization

Uses the existing shared theme typography, scheme, button, and mobile breakpoint contracts. The gift-card standalone composition/locale/runtime may be candidates for a future explicitly requested outbound theme-base/dev synchronization. No sync was authorized or performed.

Overall: PASS WITH FOLLOW-UPS for system clipboard verification and native non-active card states.
