# Status

## Deploy Dokploy

Dùng `docker-compose.yml` trong repo này để deploy bằng Dokploy Compose. Compose chỉ tạo 1 service app; MongoDB nên cấu hình bằng database/service riêng trong Dokploy hoặc MongoDB ngoài.

Biến env Dokploy cần cấu hình:

- `MONGODB_URI`: bắt buộc, connection string MongoDB app dùng.
- `APP_PORT`: port public bind ra host, mặc định `3000`.
- `PORT`: port app Next.js chạy trong container, mặc định `3000`.
- `CHECK_INTERVAL_MINUTES`: chu kỳ check server, mặc định `30`.
- `RETENTION_DAYS`: số ngày giữ lịch sử/screenshot, mặc định `10`.
- `NEXT_TELEMETRY_DISABLED`: tắt telemetry Next.js, mặc định `1`.

Ví dụ `MONGODB_URI`:

```env
MONGODB_URI=mongodb://username:password@host:27017/status-dashboard?authSource=admin
```