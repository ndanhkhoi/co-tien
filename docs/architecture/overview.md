# Tổng quan kiến trúc

Cơ Tiên là web app tĩnh (TypeScript, Vite, PixiJS 8), cài như PWA, không có server. Mọi logic chạy trên máy
người chơi; dữ liệu người chơi nằm trong `localStorage`. Bản production được host trên Cloudflare Pages.

## Các lớp

| Thư mục | Trách nhiệm | Được import |
|---|---|---|
| `src/core` | Mô phỏng, hình học bàn, xếp bi, luật, chấm điểm cú. Thuần, không DOM, chạy được trong worker và test | không gì của app |
| `src/game` | Trận đấu, Thiên Tượng, hồ sơ, Luyện thế; `content/` là dữ liệu | `core` |
| `src/ai` | Đối thủ máy, chạy trong Web Worker | `core`, `game` |
| `src/render` | PixiJS: bàn, bi, cơ, đường ngắm, hiệu ứng chiêu | `core`, `game` |
| `src/ui` | Màn hình DOM phủ trên canvas, HUD, điều khiển | mọi lớp dưới |
| `src/platform` | Thiết bị, cài PWA, tải tranh | lá |
| `src/audio` | Âm thanh tổng hợp bằng WebAudio, không có file âm thanh | lá |
| `src/styles` | CSS Thuỷ Mặc, xem [ui.md](ui.md) | |

Không bao giờ import ngược lên (ví dụ `core` import `game`). Lý do: `core` phải chạy được trong Web Worker
của AI và trong Vitest mà không kéo theo DOM hay PixiJS, và mọi tính năng mới phải dùng chung một mô phỏng.

Điểm vào là `src/main.ts`: nạp CSS, dựng khung 16:9, đăng ký service worker, khởi động `App`
(`src/ui/app.ts`) quản lý ngăn xếp màn hình.

## Luồng một cú đánh

```
UI (ngắm, lực, ĐÁNH) ─► Match.shoot(input)
                         │ bi cái nhận vận tốc + spin (squirt, trượt cơ)
                         ▼
        mỗi khung: Match.update(dt) ─► physics.step(world, dt)   ma sát, va chạm, băng, lỗ, địa thế
                         │ sự kiện va chạm / vào lỗ / văng bàn
                         ▼
             bi dừng ─► RuleSet.resolve(state, shot) ─► lỗi, giữ lượt, bi trong tay, thắng ván
                         │ năng lượng, hồi chiêu, Thiên Tượng lượt sau
                         ▼
                 Match emit(...) ─► UI, TableView, AI
```

Trận thật, đường dự đoán và AI dùng cùng một `world` mô phỏng (`Match.simulationWorld()`), nên mọi chiêu và
Thiên Tượng tự động đúng ở cả ba nơi.

## File lớn

`match-screen.ts`, `match.ts`, `menus.ts`, `table-view.ts`, `brain.ts` đã vượt ngưỡng ~500 dòng. Code mới
cho chúng đặt vào module riêng, nhỏ, rồi để file lớn gọi tới (xem CONTRIBUTING.md, *Nguyên tắc code*).
Kiểm tra kích thước hiện tại bằng `wc -l src/**/*.ts`.

## Đọc tiếp

[physics-and-rules.md](physics-and-rules.md) · [match-and-modes.md](match-and-modes.md) · [ai.md](ai.md) ·
[rendering.md](rendering.md) · [ui.md](ui.md) · [platform.md](platform.md)
