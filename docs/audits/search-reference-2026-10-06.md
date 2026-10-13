# Search reference audit — 2026-10-06

## Scope and reference contract

Read-only reference: theme `166302089264`, Search and Search?q=ring editor preview, plus user screenshots. Development upload/editor target: unpublished `144448127024` (`spinel-theme/codex/spinel-chieutt-dev`). Work remains on `codex/spinel-chieutt-dev`; no push, main promotion, or cross-repository sync.

The reference contract was documented before this refactor: keep the original Search input in place when focused or typed into; open a scrollable smart-result panel directly beneath it, with dim/blur backdrop. Blank focus shows recently viewed vertical product rows. Typed focus shows Suggestions with bold query matches, Products, Blog posts, Pages and Collections as available, shared product prices/quick add, and View all results. Enter submits native search. Escape/backdrop dismissal returns to the original input without clearing the query/caret. Mobile uses the same input and a panel constrained to the viewport.

The actual reference editor exposes Search results → Search and Results → Filter and sort (Filter, Product count, Sort, Column switcher), Product list (Add block → **Promo card only**, static Product card, static Pagination). Pagination is nested inside Product list. Static reorder controls are locked; dynamic Promo cards can be reordered. Native result tabs are Products, Articles, Pages; this theme labels Articles as Blog posts consistently with smart results.

Reference ring displayed an inconsistent summary (12 search results vs 28 product items). Development uses Shopify's actual full result count rather than reproducing that inconsistency.

## Implementation

- Search is composed from native `_search-input`, `_search-results`, `_search-products` Theme Blocks and a nested JSON template. Static parents expose no misleading dynamic Add block chooser. Product list has one curated Promo slot, the existing configurable `product-card` kernel, and existing `pagination` kernel.
- Shared collection toolbar/filter/count/sort accept optional native Search context and preserve existing Collection fallback. Both facet forms retain q, prefix, types and sorting; Clear all retains the query. Existing collection AJAX/grid controller handles search filtering, sorting and columns.
- The original shared form-field input is never moved, cloned or replaced by the smart controller. The sibling panel/backdrop control presentation; no page-input transfer into the header modal and no body scroll lock on focus. Nested input border was resolved by a scoped shared field contract (form owns border/background; inner control owns text only).
- Shared predictive request service requests query/product/collection/article/page, with source toggles. Header Search retains its separate existing presentation and uses the same request service. Abort + request revision prevents stale responses; loading/empty/error preserve native Enter fallback.
- Recent history is bounded to eight product paths, stores product views without product-page requests, validates same-origin product paths, quietly skips failed section requests, and loads only the merchant-selected count. Predictive and recent product rows reuse the same Liquid endpoint, shared price and quick-add kernels.
- Section width, scheme, custom alpha background, and opt-in responsive padding follow shared contracts. QA found collection CSS overriding the custom background; scoped specificity now preserves the selected background.

### Native Collections limitation

Shopify's native `search.results` returns products, articles and pages, not collections. This matches the reference full-search tabs. Collections are available in smart search and navigate directly to the matching collection. View all results uses the native search route and cannot provide native collection pagination. No fabricated collection results/counts or duplicate client-side pagination were added.

## Verification evidence

### Code and server validation

- 12 focused tests pass: recent product recording/dedup, bounded/validated paths, blocked storage, failed requests, unload cancellation, configured count2, tab keyboard selection, clear action, editor lifecycle, original input/query/caret preservation, closing result actions before shared overlay handoff, and existing shared quick-add/quick-view module loading.
- Theme Check: zero errors across the theme. Existing warnings are not treated as newly resolved.
- Shopify server initially rejected duplicate dynamic `content_for 'blocks'` branches; replaced with one captured native slot. Corrected native block/template upload succeeded. Subsequent scoped uploads succeeded.
- Git diff whitespace check passed. Port9292 has no listener; no theme-dev watcher remains.

### Real storefront

- ring: 30 native results, 3-column product cards, separate Products/Blog posts/Pages tabs, shared sidebar filters, real 3/4/5 column switcher (4 computed columns confirmed).
- Blank focus after a real product view shows Recently viewed with image/title/price/shared Choose options row.
- ring smart: Suggestions, five shared product rows with prices/Choose options, Blog post result, View all results. faq smart: Pages → FAQ. aurelia smart: product rows including Add to cart and Collections → Aurelia. All four requested resource groups confirmed.
- Availability filter updates 30→28 via shared AJAX; q/prefix/types retained, full count and native tabs refresh correctly. Price ascending retains query/filter and selected sort. Pagination navigation reaches `/search?page=2&q=ring`.
- Original input before/after focus has the same ID and exact desktop rectangle x703/y263/w418/h24; value remains ring and focus remains on that input. Typing retains its rectangle. ArrowLeft caret3 followed by backdrop keyboard activation restores focused original input, value ring and caret3. Escape closes without clearing. Unit fixture verifies original object identity; browser evidence verifies stable single input ID/geometry/focus/caret rather than claiming a cross-call DOM-handle comparison.
- Mobile375: no horizontal overflow (document375); 343px smart panel, max495px, scrollable body. Shared filter opens a bottom sheet with sorting/facets. Empty predictive state shows No results found + View all. Native Enter from faq reaches q=faq/prefixlast/types and displays FAQ in the Pages panel. Temporary viewport override reset.
- Shared price/quick-add endpoint and modules were retained; prior end-to-end cart-add test added one item and restored the cart. This final refactor verified the current recent-row Choose options opens the shared Quick add dialog with variants/media/price/Add to cart while the anchored backdrop is closed, then closed it without a cart mutation.

### Theme Editor once-per-setting grouped QA

New Search settings were changed, saved and verified in storefront output: custom heading Find jewelry, H2, LG, gap30, input600×56/padding24, custom placeholder, smart enabled/disabled, recent enabled/disabled + limit2, all four source toggles. Conditional recent controls disappear when smart is disabled; count disappears when recent is disabled.

Product list: 8/page, desktop4/mobile1, four gaps10/12/6/8 and full width were saved and reflected in output. Section: full width, Scheme2, #FFF2E0, padding80/40 and opt-in mobile20/24; fresh reload confirms selected scheme, background and padding styles. Responsive padding uses the same shared section tokens; mobile override controls appear only when enabled.

Shared toolbar: gap24, height48, sticky mobile, desktop4/6 and mobile8/10 padding. Count alignment right. Sort outline. Columns desktop icon/outline and mobile text/primary. Filter drawer layouts, sidebar closed/default padding30, funnel, outline button, md headings, chevron, collapsed filters, limit10 and sorting disabled; visible_if states and actual drawer output checked. Pagination secondary/small with all desktop/mobile padding8 reflected in actual nav data/style. Product card scheme mode shows the shared scheme selector; card render continues through the existing shared kernel.

Toolbar hide removes controls from the actual preview; restore brings them back. Actual Add block chooser contains only Promo card. Inserting it renders Curate Your Set; dynamic reorder is available; it was removed before default restoration. Static block reorder is correctly locked. Native editor selection/render reload was exercised throughout; scoped initialization avoids duplicate handlers.

**Persisted default restoration**: only `templates/search.json` was restored after QA. Fresh storefront and fresh editor reload show H1/Search results, gap24/input550×48/padding18, sources/recent enabled limit5, 20/page, desktop3/mobile2/gaps4/full width off, Scheme1/blank custom background/60×60 padding. No temporary Promo remains; Save is disabled on fresh editor load. Cart was not changed by the final refactor QA.

### Artifacts

- `/private/tmp/search-final-desktop.jpg`
- `/private/tmp/search-final-anchored.jpg`
- `/private/tmp/search-final-mobile.jpg`
- `/private/tmp/search-final-editor-tree.jpg`

Not exhaustively tested: every setting permutation, offline browser failure simulation, browser zoom/accessibility assistive technology, and a pointer-coordinate backdrop click (backdrop keyboard activation verified). Pixel parity across global reference theme typography/schemes is not claimed: implementation uses Spinel shared tokens and cards. Native collection-search limitation is explicit above.

## Shared base consistency

Candidate outbound shared-base changes: optional Search context in collection toolbar/filter/count/sort; form-field option label/name fallback; native Search blocks/template, anchored predictive service/styles/controller, validated recent history and row endpoint, associated locale/test contracts. Review these together to preserve architecture rather than copying only layout. No cross-repository files were copied. Any requested outbound sync must fetch both refs and normally merge to theme-base/dev, never theme-base/main.

## Focused input presentation correction — 2026-10-06

- The open search form now renders an opaque white surface above the smart-search backdrop. The same input element remains focused in place.
- The trailing control switches by query state: empty shows the magnifier; populated shows the clear X. Clearing restores the magnifier and focus. Enter still submits the native search with q, prefix, and type parameters.
- Verified on development theme `144448127024` in the authenticated `beae.com` Chrome profile: populated query, empty query, typed query, clear, and Enter submission. The desktop preview showed the white input above the dim/blur backdrop. Mobile viewport was not tested in this pass.
- Targeted tests: 5 passed. JavaScript syntax and `git diff --check` passed. Shopify Theme Check reported 36 warnings across 19 files and no errors. Port 9292 had no listener. Development files uploaded selectively with `--nodelete`; no watcher started.

## Smart result tabs follow-up — 2026-10-06

User screenshot contract, documented before editing: retain Suggestions above a resource tab row (Products / Collections / Blog posts / Pages); show only the active nonempty resource group, preserve selection when subsequent queries still contain it, otherwise choose the first available group. Blank query keeps Recently viewed without resource tabs. Tabs support click, ArrowLeft/Right, Home/End with roving focus and labelled tabpanels. Remove text underlines throughout only the smart panel; focus outlines and a non-underline selected-tab indicator remain. Original input/single-icon presentation remains unchanged.

Implemented in the shared smart renderer and scoped suggestions stylesheet. Header predictive requests and the native full-search tabs are unchanged; no schema settings were added. Nonempty groups alone receive tabs and each render restores the previous group if available. Product rows retain the shared price/quick-add endpoint. Selected tabs use fill/font weight; links, chips and labels have no text decoration.

Development preview QA after selective upload and fresh reload: ring returned Products and Blog posts; clicking Blog posts showed the engagement article alone, ArrowRight wrapped to Products, and Escape restored the original input with value `ring` and caret 4. Aurelia returned Products and Collections; Collections displayed Aurelia. FAQ returned Pages alone and selected it automatically. All inspected product/article/collection/page link computed text decorations were `none`. No-results had no tabs and retained View all results. Clear showed Recently viewed with no tabs. At 375×812, the panel was 343px wide, document width/scroll width were both 375px, and mobile Blog posts activation worked. The temporary viewport was reset. Screenshots: `/private/tmp/search-smart-tabs-desktop.jpg`, `/private/tmp/search-smart-tabs-mobile.jpg`.

Validation: 13 focused tests passed, covering roving keyboard activation, available-group preservation/fallback, stale async responses, original-input/caret and clear-icon behavior, recent validation/bounds and editor unload. JavaScript syntax and `git diff --check` passed. Shopify Theme Check: 0 errors, 36 warnings. Port 9292 had no listener; no watcher started. Only the renderer and stylesheet were uploaded to unpublished development theme `144448127024` with `--nodelete`. No Git push or shared-base sync. These renderer/style contracts are candidates for an expressly requested outbound sync to theme-base/dev.

## Recent searches follow-up — 2026-10-06

Screenshot contract before implementation: blank smart search shows Recent searches above Recently viewed, with history icons, replay buttons and Clear all; a divider separates the two modules. Record submitted searches rather than typing, keep five normalized unique queries in most-recent order, replay into the same original input with predictive results, and clear only search history. Hide an empty or unavailable history gracefully. Keep the prior no-underline requirement, tabs for populated queries and product history unchanged. This focused feature uses a fixed five-item bound without introducing additional merchant settings.

Implemented shared localStorage history with whitespace normalization, case-insensitive deduplication, newest-first ordering, five-entry bound and 200-character query bound. Storage errors/malformed data safely omit history. Native submits (including header search), smart View all and nonempty landed search URLs record history; replay/typing alone do not. Deferred script order is handled by recording landed queries when the shared service becomes available. Replay uses escaped text/attributes and the existing suggestion handler; Clear all refreshes the blank panel and restores original input focus. English storefront locale labels are added; no schema changes.

Real development QA: submitted Aurelia via Enter, reloaded, cleared input and observed persisted Aurelia above Recently viewed. Clicking Aurelia filled the original input with caret 7 and rendered Products/Collections predictive tabs. Clear all removed only the history module, leaving the existing Linea product row, empty input and input focus. Clear all computed text decoration was `none`. Mobile 375×812 showed a 343px panel with document width/scroll width 375px and functional Clear all; viewport reset after QA. Desktop/mobile screenshots: `/private/tmp/search-recent-searches-desktop.jpg`, `/private/tmp/search-recent-searches-mobile.jpg`.

Validation: 18 focused tests passed, including submitted dedup/order/cap, malformed/blocked storage, unsafe query escaping, landed-entry initialization, same-input replay, isolated clearing and editor cleanup. JavaScript syntax and `git diff --check` passed. Final Theme Check: 0 errors, 36 warnings. Port 9292 has no listener; no watcher started. Six owned search files selectively uploaded with `--nodelete` to unpublished development theme `144448127024`; no Git push or base sync. History renderer/controller/style/locale contracts are additional shared-base sync candidates, subject to explicit direction.

## Results schema correction — 2026-10-06

Live read-only reference confirms the screenshot targets the full-page Results block: Items per page 50; composition gap desktop/mobile 50/16; tab font Default, Body, Accent, Heading; top/bottom padding 0 with conditional custom mobile padding. Output uses vertical composition gaps, distinct from Product list card grid gaps. Implement these controls on Results, pass page size into native pagination, preserve Product list grid/card controls, and scope tab font to native results tabs. Smart panel input, tabs and histories remain independent.

Implemented on `_search-results`; native pagination accepts the parent page size, with legacy child/default fallback for alternate callers. The saved development template contained no legacy Product list page-size override to migrate. The duplicate Product list schema control was removed; its grid/card settings remain. New labels use schema locales and font choices map to shared body/accent/heading family tokens; Default preserves existing typography.

Editor QA covered every new setting once: saved/reloaded page size 10 (8 products plus article/page resources), desktop gap 30, heading font, padding 12/18; mobile gap 20, conditional custom padding 8/14. Responsive collection CSS initially overrode gap, corrected with a Results-specific selector and verified computed mobile gap 20px and padding 8px/14px. Restored all defaults and fresh reloaded: page size 50, gaps 50/16, Default font, padding 0/0, custom mobile off; mobile output gap 16px, padding 0px and 28 product rows. Screenshot `/private/tmp/search-results-schema-editor.jpg` shows persisted defaults. No smart input/history/tab behavior changed.

Final validation: 18 focused tests pass; Theme Check 0 errors, 38 warnings; clean final `git diff --check`; port 9292 has no listener. Three owned schema/block files uploaded selectively to development theme, followed by a scoped child pagination fallback upload. A concurrent merge briefly introduced conflict markers during QA; they were resolved by its owner before final checks. No cross-repository sync or Git push performed by this task. Results schema, responsive spacing and font-token contracts belong in any explicitly requested shared-base sync.
