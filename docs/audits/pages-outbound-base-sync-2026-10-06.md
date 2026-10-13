# Nine-page outbound synchronization — 2026-10-06

Requested direction: Spinel development → `theme-base/dev` only. Source freshly fetched at `6c1fac90`; base freshly fetched at `4e0f02a3`. Normal merge preserves both histories, with the final tree scoped to the requested pages.

## Coverage and content review

| Requested page | Verified template | Result |
| --- | --- | --- |
| Blogs page | `templates/blog.json` | Template, sections, blocks, assets and snippet closure already match source. |
| Blog post page | `templates/article.json` | Already matches except navigation outer wrapper radius; synchronize radius zero while retaining child card radius. |
| Collection list page | `templates/list-collections.json` | Implementation and dependency closure already match source. |
| Gift card | `templates/gift_card.liquid` | Implementation, CSS and QR/clipboard JavaScript already match source. |
| Cart page | `templates/cart.json` | Implementation, recommendations, explicit product-list/grid context, disclosure, Primary actions and direct shadow alpha already match source. |
| About page | `templates/page.about-us.json` | Template and dependency closure already match source. |
| Contact page | `templates/page.contact.json` | Template, shared form fields and dependency closure already match source. |
| FAQ page | `templates/page.faqs.json` | Template matches; intentionally retain newer base FAQ category/item and tests from `e9b5997e` (storefront empty-answer behavior), rather than regress to older source guards. |
| 404 | `templates/404.json` | Synchronize section, fixed Heading/Text/Button defaults and original reference audit. Existing shared kernels/media renderer match source. |

Content comparison covered 119 discovered template/section/block/asset/snippet paths. FAQ category was also reviewed explicitly. Base Quick Add media/pointer/versioned-loader fixes and mobile media pagination remain unchanged.

## Scope preservation

Search, Default Page, Password and Recently viewed features are excluded. Global merchant configuration, layout, locale files, collection filtering, carousel and unrelated base work are preserved byte-for-byte from the pre-sync base tree. Source history is retained as a merge parent; this does not imply that excluded features are present in the resulting tree.

Sync executed in an isolated temporary clone on `codex/spinel-chieutt-dev`; the shared working checkout and concurrent uncommitted Search changes were not staged, stashed or modified. No origin push, main change, Shopify upload, publication or Theme Editor mutation occurred.

## Validation

- Targeted page and shared commerce regressions: 70 tests, 67 passed, 3 known baseline failures reproduced on a clean archive of source `6c1fac90`.
- Known failures: shared schema standard expects `Top` for 404 while approved source uses `Top padding` (`Bottom padding` has the same contract discrepancy); two Quick Add test VM harnesses cannot parse existing ESM imports. No standards exceptions or source behavior changes were introduced to hide these failures.
- Standalone Theme Check **1.15.0**: 408 files inspected, zero offenses. This older checker is not equivalent to current Shopify CLI Theme Check. CLI 4.8.4 `theme info` returns Development Theme ID Not set, so modern CLI validation was not rerun under the strict development-theme gate.
- All section/block schema JSON and template JSON parse; selected Cart, recommendations, Gift card, editorial text and retained Quick Add/media JavaScript syntax checks pass. `git diff --check` passes.
- Existing 404 source audit records prior development-theme editor and responsive QA; no new browser/editor QA was performed for this Git-only synchronization. Optional real background media, boundary-width and accessibility follow-ups in that audit remain outstanding.
- Port 9292 has no listener; no watcher started.

Final pre-push source fetch advanced to `ae2cc621` with only an excluded Search results block change. Its history was preserved by a further normal merge while the final page tree and excluded Search content remained unchanged. Base remained `4e0f02a3`.
