# Phase 2 Theme Settings QA Report

## Submission

- Implementation commit: `83aafeaa37491944b6cb112398c7f2c1f34f8d5e`
- Commit subject: `fix(theme): harden scheme fallbacks and wire footer social links`
- Submitted: `2026-09-23 13:59:17 +0700` (`Asia/Ho_Chi_Minh`)
- Branch: `dev`

## Acceptance criteria

| Criteria | Result | Evidence |
| --- | --- | --- |
| AC-003 / AC-004: old color schemes do not emit empty CSS tokens | PASS | `snippets/css-variables.liquid` normalizes every content/button token before output; missing legacy keys fall back to the normalized defaults and hover backgrounds preserve `blank -> transparent`. |
| AC-013 / AC-014: global social URLs have a Footer consumer | PASS | `blocks/social-links.liquid` renders `snippets/social-links.liquid`; the active Footer group and preset use `social-links` instead of `follow-us`; blank URLs are omitted and configured URLs are escaped. |
| AC-015: submission and QA evidence | PASS | This report records the implementation commit, timestamp, test commands, results, and remaining environment limitations. |

## Automated validation

- `node --test tests/*.test.cjs`: **PASS** — 22 tests passed.
- `git diff --check`: **PASS**.
- JSON/schema parsing for Footer group, theme settings, settings data, and schema locale: **PASS**.
- Regression scan for `follow-us` and direct scheme CSS output: **PASS** — no remaining matches in theme source/config.

## Shopify validation

- `shopify theme info --store omnise-theme-base.myshopify.com --json`: **PASS** — CLI `4.8.0`; no development theme is currently configured (`development_theme_id: null`).
- `shopify theme check --path .`: **FAIL / existing repository blockers** — 2 errors in unchanged `sections/gallery-custom.liquid` for missing `t:general.gallery_custom` translations, plus 32 warnings across 15 files. No new offense was reported in the changed Footer/social files; the existing `snippets/css-variables.liquid` complexity warning remains outside this focused change.

## Manual QA status

- Footer social URL empty/non-empty behavior: **PASS** by contract tests; storefront rendering was not available without a development theme.
- Footer mobile visual/overflow check: **NOT TESTED** in a browser; the responsive contract test confirms the existing `767.98px` Footer media query and `flex-wrap` social layout.
- Theme Editor add/remove/reorder/save/reload: **NOT TESTED** because no development theme is configured.

## Regression scope

- Only `blocks/_column.liquid`, the new `blocks/social-links.liquid`, Footer configuration/preset, social snippet escaping, scheme-token normalization, locale metadata, tests, and related documentation changed.
- No other source/config location still references the removed `follow-us` Footer menu or emits a scheme CSS custom property directly from `scheme.settings.*`.
