# Kiểm thử

## Lệnh

Xem `scripts` trong `package.json`. Trước mỗi commit chạy:

```bash
npm test         # Vitest, toàn bộ tests/
npm run build    # tsc --noEmit rồi vite build
```

- Chạy một file khi đang sửa: `npx vitest run tests/physics.test.ts`.
- Đổi vật lý hay luật làm hỏng `tests/challenges.test.ts` thì sinh lại thử thách bằng
  `npm run gen:challenges`, không sửa tay `challenges.json`.

## Test nào giữ gì

Tên file trong `tests/` nói lên phạm vi. Những test giữ một quy tắc của dự án (đừng nới lỏng để cho qua):

| Test | Quy tắc |
|---|---|
| `sect-contrast.test.ts` | Mọi màu nỉ đủ tương phản với mọi bi |
| `terrain-wind.test.ts` | Gió không đảo chiều trong lượt, có đủ ba sức gió |
| `roster-names.test.ts`, `roster-kits.test.ts`, `roster-kind.test.ts` | Tên chiêu không trùng, bộ chiêu khác nhau, `kind` hợp lệ |
| `challenges.test.ts` | Mọi thử thách có lời giải đúng theo mô phỏng hiện tại |
| `shot-score.test.ts` | Cách chấm điểm cú |
| `skill-usage.test.ts` | AI dùng chiêu, năng lượng và hồi chiêu |

Test sai thì sửa code, không sửa test cho qua, trừ khi quy tắc thực sự đổi và đã được đồng ý.

## Kiểm tra trên thiết bị

Test tự động không bắt được lỗi bố cục và cảm ứng. Với thay đổi giao diện hay điều khiển:

- Thử ở **932×430 cảm ứng** (điện thoại ngang), **1536×864 chuột** (laptop Full HD zoom 125%) và **2560×1440 chuột** (màn 2K).
  Vùng chạm hiển thị ≥ 44 px sau scale.
- Thử với `prefers-reduced-motion`.
- Thay đổi khung nine-slice hay safe area thì thử trên WebKit (Safari/iOS); ảnh chụp từ trình duyệt desktop không
  thấy lỗi compositing của iOS.
- Điều khiển: đi qua danh sách trong [gameplay/controls.md](../gameplay/controls.md) cho phần mình đã sửa,
  gồm cả bi trong tay, đặt/huỷ chiêu, cú nhảy và văng bàn, Kết liễu.
- Màn cài app: `npm run dev`, mở với `?gate`. Màn tải: `?loading`.
- Cheat trong console bản dev: `src/dev/cheats.ts`.

## Ảnh chụp cho README và docs

- Chụp ở khung **932×430 @2x** (ảnh màn hình lớn ở 2K, 2560×1440 @1x), lưu webp vào `docs/screenshots/` với tên hiện có.
- Tướng của người chơi luôn là **Ngân Cầm** (`ngancam`). Chỉ đổi trong hồ sơ của trình duyệt chụp ảnh, không
  bao giờ đổi mặc định của game.
- Thay đổi làm khác một màn đã có ảnh thì chụp lại đúng những ảnh đó, cùng trạng thái màn hình, trong cùng
  thay đổi, và sửa chữ mô tả đi kèm trong README.
