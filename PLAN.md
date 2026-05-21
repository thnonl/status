# Kế hoạch: Next.js Server Status Dashboard

## Summary
- Tạo project Next.js App Router + TypeScript + Tailwind + dark admin dashboard.
- Backend chạy long-lived Node server để dùng cron nội bộ.
- MongoDB lưu server config, status history, screenshot bằng GridFS.
- File plan lưu tại `E:\status\PLAN.md`.

## Key Changes
- **Stack**: Next.js App Router, TypeScript, MongoDB/Mongoose, Playwright, node-cron, Tailwind, shadcn/ui, Recharts.
- **Env**: `.env.example` gồm `MONGODB_URI`, `CHECK_INTERVAL_MINUTES=30`, `RETENTION_DAYS=10`.
- **Data model**:
  - `Server`: `name`, `url`, `description`, `tags`, `enabled`, `createdAt`, `updatedAt`.
  - `StatusCheck`: `serverId`, `url`, `status`, `httpStatus`, `responseTimeMs`, `error`, `screenshotFileId`, `checkedAt`.
  - Screenshot binary lưu GridFS; metadata liên kết qua `screenshotFileId`.

## Implementation Changes
- **CRUD server**:
  - Dashboard page hiển thị server cards.
  - Add/edit/delete server bằng URL + metadata tối thiểu.
  - API routes: list/create/update/delete server, validate URL, enable/disable server.
- **Status worker**:
  - Cron mỗi 30 phút lấy server `enabled=true`.
  - Playwright mở URL, đo response time, lấy HTTP status nếu có, screenshot full page.
  - Lưu kết quả vào `StatusCheck`, ảnh vào GridFS.
  - Error/timeout vẫn tạo history record với status `down`.
- **Cleanup worker**:
  - Cron riêng xóa `StatusCheck` quá 10 ngày.
  - Xóa luôn GridFS screenshots tương ứng.
- **UI/UX**:
  - Dark theme mặc định, responsive mobile/tablet/desktop.
  - Admin layout: sidebar, topbar, cards, table/history, filters.
  - Server card: name, URL, current status, last checked, uptime 24h/10d, thumbnail screenshot.
  - Details page: full status history, screenshot gallery/timeline, filters by status/date.
  - Charts: uptime trend, response time trend, up/down distribution, recent incidents.
- **Operational behavior**:
  - Cron chỉ khởi tạo 1 lần trong Node runtime, tránh duplicate khi hot reload/dev.
  - Playwright timeout mặc định 30s; status `degraded` nếu response chậm theo threshold nội bộ.
  - Không yêu cầu auth trong v1 trừ khi bổ sung sau.

## Test Plan
- Unit/integration:
  - CRUD server API tạo/sửa/xóa/list đúng.
  - URL validation reject invalid URL.
  - StatusCheck lưu đúng success/down/error.
  - Cleanup xóa history + GridFS ảnh quá 10 ngày.
- Manual:
  - Thêm server hợp lệ → card xuất hiện.
  - Chạy cron/check thủ công → screenshot hiển thị.
  - Mở details page → thấy timeline + ảnh từng lần check.
  - Responsive test: mobile, tablet, desktop.
  - Sai URL/down server → dashboard báo down, không crash.

## Assumptions
- Runtime chọn: long-lived Node server.
- Screenshot storage chọn: MongoDB GridFS.
- DB connection URL do bạn cung cấp qua `MONGODB_URI`.
- Plan file target: `E:\status\PLAN.md`.
- MVP chưa có auth, multi-user, notification, alert email/webhook.
