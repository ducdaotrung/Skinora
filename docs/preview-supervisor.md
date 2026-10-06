# Giữ preview Shopify trên cổng 9292

Yêu cầu Node.js và Shopify CLI đã đăng nhập store `spinel-theme.myshopify.com`.
Chạy từ repository, trên branch `codex/spinel-chieutt-dev`:

```sh
node scripts/preview-supervisor.cjs start
node scripts/preview-supervisor.cjs status
tail -f .shopify/preview-supervisor/preview.log
node scripts/preview-supervisor.cjs stop
```

`start` chạy nền và tiếp tục khi đóng terminal. `run` chạy trực tiếp trong terminal,
dừng bằng Ctrl+C. Chạy `stop` để chủ động tắt; supervisor không khởi động lại sau lệnh này.
Không chạy thêm `shopify theme dev` riêng khi supervisor đang chạy.

Supervisor cố định theme `144448127024`, tên `spinel-theme/codex/spinel-chieutt-dev`,
role `unpublished`. Trước mỗi lần chạy `theme dev`, nó chạy `shopify theme info`
và xác minh ID, tên, role, store; nếu không đúng sẽ chỉ ghi lỗi và chờ thử lại.
Preview upload/sync file local vào theme development, với `--nodelete` để không xóa
file remote. Không bật đồng bộ Theme Editor vào local.

Process thoát được phát hiện sau khoảng 2 giây; cổng mất được xác nhận qua hai
lần kiểm tra để tránh restart do một lỗi kết nối thoáng qua. Process khởi động
có tối đa 120 giây để mở cổng. Trước khi restart, supervisor dừng cả process group
của preview cũ; gửi SIGTERM rồi SIGKILL sau 1,5 giây nếu cần. Thời gian chờ tăng
2, 4, 8… tối đa 60 giây khi lỗi lặp lại, và trở về 2 giây sau 60 giây hoạt động ổn định.
Chuyển khỏi branch cho phép sẽ dừng supervisor và preview.

Lock ngăn chạy nhiều supervisor. Lock cũ được phục hồi khi owner đã chết;
process preview còn lại chỉ được dừng sau khi kiểm tra command đúng theme/store/path.
Process khác đang chiếm cổng được giữ nguyên; log báo xung đột để người dùng xử lý.
PID và log nằm trong `.shopify/` đã được Git ignore. Log append, có thể lớn dần;
chỉ xóa/di chuyển log sau khi đã `stop`.

Không thể cam kết cổng không bao giờ rớt: máy sleep/tắt, supervisor bị kill,
mất mạng hoặc hết phiên đăng nhập đều có thể ngắt preview. Sau khi khởi động lại
máy, chạy `start` lại. Cơ chế kiểm tra TCP bảo đảm listener local, không kiểm tra
chất lượng HTTP/storefront hoặc tính thành công của từng asset upload. Khi CLI báo
lỗi xác thực, dừng supervisor, hoàn tất đăng nhập Shopify, rồi chạy lại.

Kiểm thử logic phục hồi, không upload theme:

```sh
node --test tests/preview-supervisor.test.cjs
```
