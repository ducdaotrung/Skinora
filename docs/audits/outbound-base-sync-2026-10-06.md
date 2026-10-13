# Outbound development sync — 2026-10-06

- User authorized commit and outbound sync to `theme-base/dev` only. Scoped Spinel commit: `07f738d2`; unrelated working-tree edits were excluded.
- Fetched Spinel development `d0401951` and base development `d4b18692`. Normal merge commits `3cb47282` and `93b66346` preserve both histories. Base's newer FAQ empty-answer behavior, tests, and Quick-add fixes were retained.
- Current Shopify CLI Theme Check found an inherited origin integration error: `cdd98f3e` added `recently-viewed-card` to the global layout without committing that section. No committed version of the missing section exists in fetched history. The other chat's uncommitted section was not copied.
- Follow-up restores the prior base layout footer region, omitting the incomplete section call and associated script include until the complete feature is committed. Already committed assets and all merge history remain preserved.
- Validation: Shopify CLI 4.8.4 Theme Check exits 0, zero errors and 35 warnings across 20 files; `git diff --check` passes; eight FAQ/disclosure tests pass. Older standalone Theme Check had missed the missing-section error; current CLI validation is authoritative.
- Scope is Git only: no origin push, Shopify upload, publication, or Theme Editor mutations. New Theme Editor/browser QA was not performed for this history sync; prior Contact and marquee QA is recorded in their audit files. Port 9292 has no listener.
