# Status

## Deploy Dokploy

Dùng `docker-compose.yml` trong repo này để deploy bằng Dokploy Compose.

Biến env Dokploy nên cấu hình:

- `APP_PORT`: port public bind ra host, mặc định `3000`.
- `PORT`: port app Next.js chạy trong container, mặc định `3000`.
- `MONGODB_URI`: URI MongoDB app dùng, mặc định `mongodb://mongodb:27017/status-dashboard`.
- `MONGO_INITDB_DATABASE`: tên DB Mongo nội bộ, mặc định `status-dashboard`.
- `CHECK_INTERVAL_MINUTES`: chu kỳ check server, mặc định `30`.
- `RETENTION_DAYS`: số ngày giữ lịch sử/screenshot, mặc định `10`.
- `NEXT_TELEMETRY_DISABLED`: tắt telemetry Next.js, mặc định `1`.

Nếu dùng MongoDB ngoài Dokploy, đổi `MONGODB_URI` sang connection string ngoài rồi có thể bỏ service `mongodb` khỏi compose.