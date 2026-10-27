# Kiến trúc

Cơ Tiên là một web app tĩnh (TypeScript + Vite + PixiJS 8), cài được như PWA, không có server. Mọi logic
chạy trên máy người chơi; dữ liệu lưu trong `localStorage`.

```
src/
  core/       mô phỏng và luật — không phụ thuộc DOM, chạy được trong worker và test
  ai/         AI đối thủ (Web Worker)
  game/       trận đấu, địa thế, hồ sơ, nội dung game (dữ liệu)
  render/     PixiJS: bàn, bi, cơ, đường ngắm, hiệu ứng chiêu
  ui/         màn hình DOM phủ trên canvas, điều khiển, hướng dẫn
  audio/      âm thanh tổng hợp bằng WebAudio (không có file âm thanh)
  platform/   cảm ứng, rung, toàn màn hình, cài PWA
public/art/   tranh đã xử lý (webp) — xem docs/art-pipeline.md
```

## Luồng một cú đánh

```
UI (joystick, kéo bàn, nút ĐÁNH) ──► Match.shoot(input)
                                       │ strike(): bi cái nhận vận tốc + spin, có squirt / trượt cơ
                                       ▼
          mỗi khung hình: Match.update(dt) ──► physics.step(world, dt)   (ma sát, va chạm, băng, lỗ, địa thế)
                                       │ sự kiện va chạm / vào lỗ
                                       ▼
                         bi dừng ──► rules.resolve(state, shot) ──► Resolution (lỗi, giữ lượt, bi trong tay, thắng ván)
                                       │ năng lượng, hồi chiêu, Thiên Tượng lượt sau
                                       ▼
                               Match emit('turn' | 'resolved' | 'rack-over' …) ──► UI / TableView / AI
```

## `src/core` — vật lý và luật

- `physics.ts`: mô phỏng 2D theo mét. Ma sát trượt và lăn, spin ba trục, throw khi cắt bi, ném băng có
  áp phê, bước thời gian theo thời điểm va chạm (không xuyên bi), khối bi khít khi phá được giải bằng tiếp
  xúc mềm bước nhỏ. `Terrain` thêm lực đều (nghiêng / gió, có giật), vùng ma sát và giếng hấp dẫn — chỉ tác
  động lên bi đang lăn.
- `table.ts`: kích thước WPA (bàn 7 ft 1,981 × 0,991 m, bi 57,15 mm, miệng lỗ góc 117,5 mm / giữa 130 mm,
  hàm lỗ 142° / 104°, viền 12,7 cm, nút ngắm cách mép băng 3 11/16 in) và bàn carom UMB.
- `rack.ts`: xếp bi đúng luật cho 8/9/10 bi và carom; đặt lại bi.
- `rules/`: 8 bi, 9/10 bi (rotation), carom phăng tự do và 3 băng theo WPA 2026 / UMB.
- `aim.ts`: dự đoán điểm chạm, bi ảo, hướng bi mục tiêu.

## `src/game` — trận đấu và nội dung

- `match.ts`: máy trạng thái của một trận (`aim → rolling → option / rack-over / match-over`), năng lượng,
  hồi chiêu, nội tại hệ, 16 nhóm cơ chế chiêu, Thiên Tượng, Địa Lợi, tua lại.
- `terrain.ts`: Thiên Tượng của từng môn phái, biểu diễn bằng vật lý (`Terrain`, chướng ngại, rung).
- `content/roster.json`: **nguồn sự thật** cho môn phái, hệ và tướng (tạo hình dùng để vẽ, chiêu).
- `content/lore.json`: truyện thế giới, môn phái, tiểu sử và câu nói của tướng.
- `content/story.json`: Cơ Tiên Truyện — 15 chương, mỗi trang có thể kèm tranh (`art`), `scenes` giữ đề bài
  vẽ cho từng tranh (xem `docs/story.md`).
- `content/sects.ts`: kiểu dữ liệu, sức mạnh chiêu theo bậc, bàn và cơ của môn phái, đường dẫn tranh.
- `content/career.ts`: Hành trình 13 chương; `challenges.json`: 60 thử thách có lời giải đã kiểm chứng
  (`npm run gen:challenges`).
- `profile.ts`: hồ sơ người chơi, tự chuyển đổi save cũ (khoá `thancong.profile.v1` giữ nguyên để không mất
  dữ liệu sau khi đổi tên game).

## `src/ai`

`brain.ts` tìm cú đánh bằng chính bộ mô phỏng: liệt kê đường ăn thẳng / đánh băng, thử biến thể lực và áp
phê, chấm điểm theo vị trí bi cái cho cú sau, chọn phòng thủ khi rủi ro; nhận cùng thông số bàn và Thiên
Tượng như người chơi. Chạy trong Web Worker (`ai-worker.ts`) qua `ai-client.ts` để không giật hình.

## `src/render`

`table-view.ts` dựng bàn (vẽ bằng canvas theo kích thước thật, dùng ảnh viền bàn của môn phái khi có),
bi (`ball-mesh.ts`: shader cầu, lăn theo vận tốc góc), cơ, đường ngắm + bi ảo + mũi tên hướng, Thiên Tượng,
hiệu ứng chiêu (`skill-fx.ts`: ghép các nét mực VFX của môn phái theo từng nhóm cơ chế, flipbook tuyệt chiêu).

## `src/ui`

Màn hình là DOM phủ trên canvas (`app.ts` quản lý ngăn xếp màn hình). `menus.ts` (trang chủ, đấu nhanh,
bộ sưu tập, cài đặt), `journey.ts` (bản đồ Hành trình), `codex.ts` (Cơ Tiên Lục), `story.ts` (đọc truyện có tranh, mở chương theo Hành trình), `match-screen.ts`
(HUD, joystick, chiêu, cut-in, AI diễn hoạt), `install-gate.ts` (bắt cài PWA trên điện thoại),
`viewport-guard.ts` (bắt xoay ngang, kiểm tra cửa sổ trên máy tính), `hints.ts` / `intro.ts` (hướng dẫn).
Toàn bộ giao diện theo hệ thiết kế Thuỷ Mặc trong `src/styles/main.css`.

## PWA và cập nhật

`vite-plugin-pwa` tải sẵn code, UI, chân dung, icon chiêu và biểu tượng môn phái (~4 MB); tranh lớn (toàn
thân, splash, VFX) tải khi cần và lưu cache. Bản mới được kiểm tra định kỳ và cài khi người chơi rời bàn.

## Kiểm thử

`npm test` (Vitest): vật lý, luật, AI, 60 thử thách có lời giải, độ tương phản bi–nỉ (ΔE ≥ 25) cho mọi
môn phái. `npm run build` chạy typecheck trước khi build.
