# Search outbound base synchronization — 2026-10-06

Requested direction: Spinel development branch → `Chieu2507/shopify-theme-base:dev`.
Source: `9c4fbae5fd4ce787aaa8a1084fac7099086ccc7f`, containing Search completion `20a91d5631a9ec2dbd1b0a268125a83ffe191ab3`. Target parent: `e14a3461`.

## Scope and history

Normal merge preserves both development histories. Because earlier scoped merges intentionally excluded Search while retaining source ancestry, this merge explicitly restores the complete committed Search dependency closure: native Search blocks/template/section/controller, shared collection toolbar Search context, predictive service/styles/header integration, recent-product row endpoint/history loader, layout script registration, query fields, Search locale additions, tests and native QA audit.

Only Search locale additions are transferred; unrelated page labels remain target-owned. Search section padding labels use the existing canonical `Top`/`Bottom` keys. Target FAQ fixes, carousel/media fixes, page/password/404 implementations, existing audit records and global merchant settings are preserved. No source uncommitted fixes are included. No main branch, origin push, Shopify upload or live theme change is part of this synchronization.

## Completion audit

The committed Search reference audit records real development storefront and Theme Editor checks: anchored same-input predictive search, preserved query/caret, recent products/submitted searches, source toggles, resource tabs and keyboard navigation, native products/articles/pages results, filtering/sorting/columns/pagination, empty states, responsive 375px layout, and saved/restored schema defaults. Native collections remain predictive-only because Shopify's native search excludes collections. This synchronization does not claim new exhaustive browser QA beyond that recorded evidence.

All referenced Liquid snippets, Theme Blocks and assets exist in the integrated target; shared forms/product cards/pagination remain target-owned dependencies. No completion blocker was found for the Search scope.

## Fresh validation

- Search/history/recent-product tests: **18/18 pass**.
- Complete integration suite: **155/158 pass**. Isolated target-parent baseline: **137/140 pass**, with exactly the same three failures: existing 404 padding label vocabulary assertion and two Quick Add/Quick View VM tests that cannot parse the existing static ESM import. Those unrelated files are preserved rather than silently included in a Search sync; there are no additional failing tests.
- Shopify Theme Check on integrated files: **0 errors, 39 warnings**.
- Search JavaScript syntax and staged whitespace checks pass.
- CLI theme list verified development theme `144448127024`, `spinel-theme/codex/spinel-chieutt-dev`, unpublished. Theme Check was local; no upload or watcher.
- Port 9292 had no listener.
