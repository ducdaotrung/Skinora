# Shopify Theme Base

Spinel preview trên branch `codex/spinel-chieutt-dev`: chạy
`node scripts/preview-supervisor.cjs start` để giữ cổng 9292 và tự phục hồi.
Xem [hướng dẫn supervisor](docs/preview-supervisor.md) để kiểm tra, đọc log và dừng.

Base theme được khởi tạo bằng Shopify Skeleton Theme cho store `omnise-theme-base`.

## Store and branches

- Store: [spinel-theme](https://admin.shopify.com/store/spinel-theme)
- Production theme: Git branch `main`
- Development theme: Git branch `codex/spinel-chieutt-dev`, unpublished theme `144448127024`
- Shopify MCP và Shopify CLI đã được xác thực trong môi trường hiện tại.

## Development

Chỉ làm việc trên `codex/spinel-chieutt-dev`:

```bash
git switch codex/spinel-chieutt-dev
node scripts/preview-supervisor.cjs start
```

## Checks

```bash
git diff --check
shopify theme check --path .
```

## Theme settings

Phase 2 global Theme Settings contract and acceptance criteria are documented in
[docs/phase-2-theme-settings.md](docs/phase-2-theme-settings.md).

## Promote

Chỉ push `origin/codex/spinel-chieutt-dev` sau khi fetch và merge lịch sử remote mới nhất. Không triển khai lên `main` hoặc theme live `144223469616` trong workflow development.
