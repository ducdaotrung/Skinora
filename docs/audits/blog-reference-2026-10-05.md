# Blog archive reference implementation contract

Reference: Spinel store theme 166302089264 (Updated copy of Elvara), blog `/blogs/news`. Reference is read-only; deployment uses unpublished theme 144448127024 only.

Blog-template Shopify resource owns all articles and tags. Section has fixed Title, Tag filter and Blog list slots. Blog list owns static Featured post, shared Blog card and native Pagination. Featured and regular card content use editable nested article role blocks. Paginate seven articles per page; every article appears once even when Featured post is hidden. Selecting a tag navigates to Shopify's filtered blog route, resets pagination, and marks the selected tag. Empty blogs and no matching articles remain valid; hidden static blocks do not silently drop resources.

Observed section defaults: page width, gap40desktop/30mobile, top/bottom dividers off, selected color scheme, padding70top/90bottom and custom mobile 50/50. Typography, media radius, form/button tokens and shared cards follow current Spinel base. Base shell, scheme/background, section padding and responsive contracts remain consistent; preserve shipped setting IDs and static slot IDs.

Local audit findings to fix: global `.blog-posts` and `.blog-card__title` rules collide with reusable feeds; archive always skips article0 even if Featured is hidden; current featured/pagination JSON incorrectly marks fixed slots as dynamic; Featured inherit-radius resolves Square, LCP image lazy loads, and mobile ignores padding/alignment controls; Pagination style/height controls currently have no consuming styles.

No cross-repository synchronization or live-theme deployment is authorized.

## Complete observed reference controls

Section: seven articles/page, page width, CENTER alignment, gap40/30, Scheme1; padding70/90 with opt-in mobile 50/50. Top/bottom section dividers off. Separate existing Divider section full without padding, thickness1px, fill length, inherited border, zero padding; its existing placement extended to blog as well as collection.

Title: RSS on, Heading2 visual/H1 semantic, padding0/0, mobile override off. Resource-specific Blog title block reuses base heading classes and typography/spacing tokens because generic Heading does not own blog/RSS data. Existing static ID `heading` preserved.

Tag filter: tag limit5 includes All posts, Underline/Button/Icon style, Default/Heading/Body/Accent font, Heading3 visual, gap40/24, padding0/0 and opt-in mobile. Selected filtered tag outside the first tags remains visible within the limit. Desktop centered row; mobile nowrap horizontal scrolling. Native tag routes clear page parameter and selected tag uses aria-current.

Blog archive list: grid3 desktop/1mobile; horizontal gap16, vertical40/mobile30. Featured and Pagination fixed static slots corrected in saved JSON; the shared Blog card slot remains static with dynamic content children.

Featured: two equal desktop columns, image left/content right, stacked mobile square image; Large image approx600px desktop; height choices Adapt/XS/S/M/L/XL, LEFT alignment, child gap8/8, border0, radiusInherited, shadowNone, Scheme2. Desktop content padding50 each edge, opt-in mobile24 top/bottom20 left/right. Dynamic children Title→Meta→Description→Button receive closest.article. Title Heading3/H2, unlimited lines, pad0/0; Meta author/date on Small pad0/12; Description two lines Medium pad0/12; Button Subtle no icon pad0/0. Shipped legacy content control IDs remain as a fallback for saved instances with no nested children, clearly grouped as Legacy content.

Regular card: Vertical, Original ratio, LEFT, gap8/8, border0, inherited radius, no shadow, inherited color. Content padding20/0/0/10 with mobile override off. Children Title Heading4/H2 pad0/0; Meta date/author Small pad0/4; Description two lines Medium pad0/6; Subtle Button no icon pad0/0.

Pagination: Primary/Secondary/Outline/Text styling; inherited or XS/S/M/L/XL height, pad0/0 and opt-in mobile. Native paginate URLs and parts with aria-current page; shared button tokens compose current-page and navigation controls.

## Validation and deployment

Uploaded only the blog section, its title/filter/archive/featured/pagination blocks, blog template, existing Divider placement and blog locale strings to unpublished theme 144448127024. No Git push or watcher was started. Port 9292 has no listener. A read-only pull of the five shared Blog card kernels confirmed exact equality with local files; no dependency replacement was needed.

Theme Check completed with zero errors and 35 existing warnings outside the changed blog scope. Liquid fixture and shared View all regression tests pass 11/11; fixtures test resource accounting, featured-hidden preservation, subsequent page resources, empty states and selected-tag limits and numeric native page titles. Native Shopify pagination was verified separately in Theme Editor because LiquidJS fixtures do not emulate the platform paginate fetch. `git diff --check` passes. The skill validator is unavailable because its installed runtime lacks `@shopify/theme-check-common`; Shopify Theme Check and upload schema validation were used.

Browser QA on the development theme verified fixed static slots, section 70/90 and mobile 50 padding, RSS toggle output, nested Featured Title/Meta/Description/Button editing, hidden Featured retaining the first article, page 1 containing one featured plus six cards, page 2 containing the three remaining articles with its own first article featured, and Previous/Next/page links. Selecting CARE from page 2 resets the route to its tagged URL without a page parameter and renders its one matching article. Button filter active state has readable white text on primary black; two-line description truncation is correct. Final mobile preview verified the Large featured image at343×343px. All temporary editor changes were undone.

The pagination loop now lives in its owning archive Theme Block and explicitly passes its paginate object to the static Pagination block, preventing isolated block scopes from rendering every blog article. Mobile media specificity overrides desktop fixed heights, and the outer archive gap uses the mobile gap token.

Shared typography, color schemes, button styles, media radius and spacing contracts intentionally remain base-driven. The reference and development blog content differ, so this is not a claim of 100% pixel identity. Empty-blog behavior has fixture coverage; no store content was deleted for QA. Every possible option combination, media upload and blog feed reader was not manually exercised. No cross-repository copy or synchronization was performed; future outbound base synchronization requires an explicit direction and targets theme-base/dev by default.

Native page titles and the current page are normalized to strings before comparison, so Shopify numeric titles render the current-page button instead of the plain ellipsis branch. This runtime regression has a dedicated fixture. Final browser QA confirmed Primary current-page styling with white text on black and inherited44px height; switching to Outline/Large visibly produced an outlined52px control. Both settings were undone to Primary/Inherit, with Save disabled. Final mobile Large image343×343px and responsive one-column cards were verified.

## Follow-up: reuse collection pagination

The initial blog implementation shared button tokens but owned separate pagination markup/CSS. After the user requested collection consistency, the native page-link markup from `blocks/_collection-pagination.liquid` was extracted to `snippets/pagination-pages.liquid`; both collection and blog now render that snippet. Collection pagination styles moved from `assets/section-collection.css` to `assets/component-pagination.css`, loaded by both blocks. Blog pagination has no parallel stylesheet. Existing collection load-more/infinite branches and their JavaScript hooks remain unchanged.

Blog schema IDs and native paginate context remain intact. Blog Text maps to shared Tertiary; hyphenated blog height values map to the collection underscore values. Both now use the collection sizes36/40/48/56/64px, inherited button heights, active/hover variants and arrow links. This supersedes the prior blog-only28/36/44/52/60px sizes described in the earlier QA history. Container height88px desktop/72px mobile also follows collection composition.

The five changed theme files were uploaded only to theme144448127024. A read-only comparison found unrelated local collection CSS edits absent on dev; deployment staged the existing remote collection asset with only pagination removed, preserving those remote styles and all local dirty edits. Tests pass12/12, Theme Check reports zero errors/35 existing warnings, and diff whitespace validation passes. Port9292 remains unused.

Post-refactor browser QA could not run because the Chrome session disconnected. Prior blog UI verification applies to the earlier implementation, not the new shared component. Local regression rendering verifies numeric current pages/native URLs, Text→Tertiary mapping, Extra-small→extra_small mapping and mobile padding values. Collection load-more/infinite markup was compared with HEAD and remains unchanged. Runtime visual checks of the shared refactor remain unverified.

## Follow-up: canonical schema option values

Audited the implemented blog/article blocks against `blocks/heading.liquid` and shared card/collection contracts. Previous/next Title size, Blog meta Title size, Comments Heading size and Featured legacy Title size used visual h1…h6 values. All now use canonical display/xl/lg/md/sm/xs/custom values and translated base option labels. Blog title and Tag filter already used the six preset tokens; both now include the base Custom option with10–100px range,24px default and conditional visibility. Each Custom setting changes the rendered heading font size; semantic HTML h1…h6 values remain unchanged.

`snippets/heading-size-token.liquid` preserves old saved visual values through h1→display,h2→xl,h3→lg,h4→md,h5→sm,h6→xs normalization. Featured legacy content now renders base heading classes instead of independent size CSS. Pagination Extra-small/Extra-large schema values are now extra_small/extra_large, matching collection; its adapter still supports existing hyphenated values.

Radius/shadow options already match shared Blog card contracts; no changes were needed. Resource-specific media height/width controls retain their established resource behavior. Existing padding setting IDs were retained to preserve saved merchant settings. A full local template/section/block scan found no remaining saved title_size/heading_size h1…h6 values. Read-only pulls of development article/blog JSON showed no explicit legacy sizes, so no remote template configuration was overwritten.

Eight theme files were uploaded successfully to unpublished theme144448127024. Schema validation,14/14 Liquid/regression tests, Theme Check with0 errors/35 existing warnings, and whitespace validation pass. Browser connection remains unavailable; new option dropdowns and Custom changes have not been manually exercised in Theme Editor. Port9292 has no listener; no watcher, Git push or cross-repository sync was performed.

## Follow-up: consistent schema labels across the theme

Standardized 39 sections and seven blog/article blocks to the existing schema locale. Section padding now resolves to Top, Bottom, Customize for mobile, Top (mobile), and Bottom (mobile). Blog/article typography labels use Heading size and HTML Tag, matching the Heading kernel. Semantic H1–H6 HTML tag choices remain unchanged; visual size choices never use Heading 1–6 labels.

The global visual-size option audit found Collections with tabs as the remaining exception. Its four options now use display/xl/lg/md and canonical labels; the existing collections-with-tabs-item adapter already handles heading_1–heading_4. Development templates contained no saved instances requiring migration.

Uploaded 46 files successfully to unpublished theme 144448127024. Deployment was staged from remote files and modified only schema presentation and the four normalized tab size values/default; all non-schema Liquid/CSS and other remote settings were preserved. Schema validation and the current 10 targeted tests pass, Theme Check reports zero errors and 35 existing warnings, and git diff --check passes. Theme Editor QA remains NOT TESTED because the browser connection is unavailable. Port 9292 has no listener; no watcher, Git push or cross-repository sync was performed.
