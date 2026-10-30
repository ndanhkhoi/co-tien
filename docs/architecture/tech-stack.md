# Công nghệ và triển khai

Phiên bản cụ thể nằm trong `package.json` và `package-lock.json`; file này chỉ giải thích vì sao chọn từng công
nghệ và việc deploy chạy thế nào.

## Công nghệ

| Phần | Chọn | Vì sao |
|---|---|---|
| Ngôn ngữ | TypeScript `strict` (`tsconfig.json`) | Vật lý, luật và dữ liệu 65 tướng có nhiều hợp đồng chéo; `Record<SectId, …>` buộc mỗi môn phái mới phải đủ mọi bảng |
| Build, dev server | Vite | Khởi động nhanh, ES module gốc, Web Worker dạng ES (`worker.format`), và plugin trong `vite.config.ts` sinh manifest tranh, lược trường vẽ khỏi `roster.json` |
| Vẽ bàn | PixiJS 8 (WebGL) | Shader cầu cho bi, batch sprite cho hiệu ứng, chạy mượt trên điện thoại. Chỉ dùng cho bàn: [decisions/pixi-and-dom.md](../decisions/pixi-and-dom.md) |
| Giao diện | DOM + CSS thuần, không framework | Số màn ít, trạng thái nằm trong `Match` và hồ sơ; một framework UI chỉ thêm tầng trung gian và dung lượng. Tiện ích dựng DOM ở `src/ui/dom.ts` |
| Mô phỏng | Tự viết (`src/core/physics.ts`) | Engine vật lý chung không có ma sát trượt/lăn, spin ba trục, throw, squirt và hình học lỗ theo WPA; tự viết cũng để AI chạy cùng mô phỏng trong worker |
| AI | Web Worker | Tìm cú bằng hàng nghìn mô phỏng mà không giật khung hình |
| PWA | vite-plugin-pwa (Workbox) | Chơi offline, cài như app; tranh lớn đi qua kho riêng: [platform.md](platform.md) |
| Âm thanh | WebAudio tổng hợp (`src/audio/sound.ts`) | Không có file âm thanh để tải, giữ bản cài nhẹ |
| Font | `@fontsource` Noto Serif và Be Vietnam Pro | Đủ dấu tiếng Việt, đóng gói cùng app nên chạy offline |
| Lưu dữ liệu | `localStorage` | Không có server hay tài khoản; mã chia sẻ `TC1.` thay cho đồng bộ: [decisions/save-keys.md](../decisions/save-keys.md) |
| Test | Vitest | Cùng cấu hình với Vite, chạy trực tiếp `src/core` và `src/game` vì hai lớp này không phụ thuộc DOM |
| Script phụ | vite-node (`tools/`, `tsconfig.tools.json`) | Chạy TypeScript dùng chung code game, ví dụ sinh thử thách |
| Tranh | 9router, model `cx/gpt-6-sol-image`, Python/ImageMagick | Xem [guides/art-pipeline.md](../guides/art-pipeline.md) |

Không có backend, không có analytics, không có thư viện UI hay icon.

## Triển khai

Push lên `main` chạy `.github/workflows/deploy.yml`: `npm ci`, `npm test`, `npm run build`, rồi
`wrangler pages deploy dist` lên Cloudflare Pages (dự án `co-tien`, tên miền `cotien.khoinda.vn`). Token và
account ID nằm trong GitHub Actions secrets của repo, không bao giờ nằm trong repo.

- Test hoặc build lỗi thì không deploy.
- Commit chỉ đổi tài liệu có thể thêm `[skip ci]` vào tiêu đề để không deploy lại.
- Bản mới đến người chơi qua cơ chế cập nhật PWA, không giữa trận: [platform.md](platform.md#cập-nhật-bản-mới).
