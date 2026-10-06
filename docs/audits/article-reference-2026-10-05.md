# Blog post reference implementation contract

Reference: layouthub-template-v2 theme 191896977707, Default blog post (article `where-quality-meets-nature` reached from supplied blog URL). Audited read-only in the Theme Editor.

Article is the resource owner. Main section is article-template-only, with ordered editable Blog meta → Featured image → Content → Tags and sharing → Previous and next posts → Comments blocks. Preserve current block IDs and setting IDs while migrating the template from fixed static slots to this editable stream. Retain Divider as a compatible existing base block. Resource text comes from Shopify article, no duplicated merchant text.

Main maximum width 800px; section gap50px desktop/30px mobile. Top divider on, bottom off, full-width divider on. Scheme inherited. Padding100px/120px desktop and opt-in50px/60px mobile. Base default responsive scaling remains .75 tablet/.5 mobile when no mobile override.

Meta center-aligned, H2 visual/H1 semantic, tags/date/author/comments on, internal gap10px. Featured image adapts, supports default/page/full/full without padding. Content comes from article. Sharing has Facebook/X/Pinterest actionable share URLs. Previous/next settings consume heading and radius tokens; edge posts omit missing neighbors. Comments render only when blog enables them, include moderation-aware success and errors, preserve entered fields, and paginate existing comments.

Related posts is a separate article-only section using shared Heading + Blog list + Blog card kernels and parent blog context. Carousel: max8 posts, desktop4/mobile1, inside chevron navigation with secondary style and hover behavior; gaps4px. Section width page, gap40/30; top divider on/content-width, bottom off; padding100/120 and custom mobile60/60. Base tokens, common navigator, form, media, and lifecycle retained. Empty/long text, missing images, first/last article, comments-disabled/moderated, dark scheme, editor re-render and responsive overflow require QA.

Shared-base synchronization review: schema naming, tokens, layout-flow, divider, form, share and Blog list/card reused within Spinel. No cross-repository sync authorized or performed.

Dynamic main block cap14 supports a duplicate six-block composition plus compatible dividers, while preventing excessive repeated canonical article content. Add block remains usable with the shipped seven saved slots (including disabled legacy divider).

## Validation and delivery

- Development branch: `codex/spinel-chieutt-dev`; origin `omnisecom/spinel-theme`. Existing seven unrelated dirty files preserved. No Git push/merge or cross-repository copy performed.
- Development theme verified by explicit `spinel-theme.myshopify.com` inventory: `144448127024`, `spinel-theme/codex/spinel-chieutt-dev`, unpublished. Scoped CLI uploads passed; live theme untouched.
- Shopify Theme Check: PASS, zero errors; 35 existing warnings outside changed scope. Changed files have no offenses. `git diff --check`: PASS. Schema JSON, unique setting IDs and range defaults: PASS. Theme Block count147, no new block files. No JavaScript changes.
- Shopify Liquid skill documentation search passed after permitted network escalation. Bundled skill validator could not start due to missing `@shopify/theme-check-common`; installed Shopify CLI Theme Check and Shopify server-side schema validation used instead.
- Theme Editor/browser QA PASS: six dynamic main blocks and usable Add block picker; date toggle affects output; custom mobile padding visibility; full-width image without padding; navigation title size/radius controls; mobile Prev/Next without article titles; centered Related Posts desktop/mobile; four desktop/one mobile carousel items; mobile swipe advances article; Facebook/X/Pinterest URLs valid. Test setting changes reverted, Save disabled.
- NOT TESTED: posting comments (blog comments disabled), actual background image/video uploads, every setting option permutation, exhaustive keyboard/dark-scheme/long-content permutations. Comments disabled editor hint verified; storefront only renders enabled blog comments.
- Responsive behavior uses the shared base typography, colors, form fields and media/navigation radii. Reference and development article content differ; pixel-identical rendering is not claimed. Final Theme Editor screenshot QA PASS: Related pagination hidden on desktop and visible on mobile using an opt-in Blog list argument; editor restored to desktop with Save disabled.
- Port9292: no listener; no preview watcher started or left running.
