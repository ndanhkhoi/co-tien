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
  styles/     base.css, kit.css, screens.css, match.css
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

Trong Tiên Đạo, mỗi bên bắt đầu ván với **30 năng lượng**, tối đa **100** (`ENERGY_MAX`). Mỗi cú
đánh được **+8**; mỗi bi của mình vào lỗ hoặc điểm carom có mức cơ sở **+14**, rồi điều chỉnh theo chỉ
số năng lượng của cơ, nội tại và Địa Lợi. Đối thủ phạm lỗi thì được **+12**. `match.ts` phát sự kiện
`energy` với `side`, `gain` (phần tăng thực tế sau giới hạn) và `total`. Cổ Điển không cộng năng lượng.
Hai chiêu thường hồi sau **2–3 lượt đánh của chính mình**; hệ Luân Hồi giảm một lượt (còn 1–2).
Tuyệt chiêu cần đầy thanh năng lượng.

## `src/ai`

`brain.ts` tìm cú đánh bằng chính bộ mô phỏng: liệt kê đường ăn thẳng / đánh băng, thử biến thể lực và áp
phê, chấm điểm theo vị trí bi cái cho cú sau, chọn phòng thủ khi rủi ro; nhận cùng thông số bàn và Thiên
Tượng như người chơi. `chooseSkill` trong `brain.ts` chọn chiêu ở cả bốn cấp AI, kể cả cấp 1;
chỉ chọn trong các chiêu sẵn dùng được truyền vào. Chạy trong Web Worker (`ai-worker.ts`) qua `ai-client.ts` để không giật hình.

## `src/render`

`table-view.ts` dựng bàn (vẽ bằng canvas theo kích thước thật, dùng ảnh viền bàn của môn phái khi có),
bi (`ball-mesh.ts`: shader cầu, lăn theo vận tốc góc), cơ, đường ngắm + bi ảo + mũi tên hướng, Thiên Tượng,
hiệu ứng chiêu (`skill-fx.ts`: ghép các nét mực VFX của môn phái theo từng nhóm cơ chế, flipbook tuyệt chiêu).

## `src/ui`

Màn hình là DOM phủ trên canvas (`app.ts` quản lý ngăn xếp màn hình). `menus.ts` (trang chủ, đấu nhanh,
bộ sưu tập, cài đặt), `journey.ts` (bản đồ Hành trình), `codex.ts` (Cơ Tiên Lục), `story.ts` (đọc truyện có tranh, mở chương theo Hành trình), `match-screen.ts`
(HUD, joystick, chiêu, cut-in, AI diễn hoạt), `install-gate.ts` (bắt cài PWA trên điện thoại),
`viewport-guard.ts` (bắt xoay ngang, kiểm tra cửa sổ trên máy tính), `hints.ts` / `intro.ts` (hướng dẫn).
`icons.ts` cung cấp `icon(name)` để tạo icon tranh từ `public/art/ui/icons/`.

`src/main.ts` nạp bốn tệp CSS: `base.css` đặt nền tảng Thuỷ Mặc (màu, chữ, nền đọc và safe area);
`kit.css` chứa thành phần dùng chung như nút, thẻ chọn và hộp thoại. `screens.css` dành cho các màn hình,
`match.css` dành cho giao diện trận đấu; hai phần này đang được xây dựng lại.

Trên điện thoại còn phải cài PWA (`mustInstall()`), màn hình cài đặt hiện trước ngay cả khi máy đang
dọc; `viewport-guard.ts` bỏ qua chặn xoay ngang trong thời gian này. `src/platform/device.ts` chặn
cử chỉ trình duyệt ngoài vùng cuộn, nhưng cho cuộn trong `.scroll` hoặc phần tử hoặc phần tử cha có `overflow`
`auto`/`scroll` và nội dung thực sự tràn; chặn cả pinch zoom nhiều ngón.

## PWA và cập nhật

`vite-plugin-pwa` tải sẵn code, tranh trực tiếp trong `art/ui/`, chân dung, icon chiêu và biểu tượng
môn phái theo `globPatterns` trong `vite.config.ts`; các ảnh khác trong `art/` được cache khi tải lần đầu.

Trong bản production, `src/main.ts` kiểm tra bản mới mỗi **15 phút** và khi ứng dụng trở lại phía trước
(nếu có mạng). `src/ui/app.ts` buộc áp dụng ngay từ menu; nếu đang ở màn hình trận đấu thì chờ hết trận,
khi chuyển sang màn hình không dùng stage. Lúc áp dụng, một lớp **chặn thao tác** hiện “Đang cập nhật
bản mới…” trước khi kích hoạt service worker mới và tải lại ứng dụng.

## Kiểm thử

`npm test` (Vitest): vật lý, luật, AI, 60 thử thách có lời giải, độ tương phản bi–nỉ (ΔE ≥ 25) cho mọi
môn phái. `tests/skill-usage.test.ts` kiểm tra AI dùng chiêu thường/tuyệt chiêu qua các ván, cộng và
giới hạn năng lượng, sự kiện `energy`, hồi chiêu và tuyệt chiêu đặt bi của AI cấp 1. `npm run build` chạy typecheck trước khi build.

Console test ẩn (bản dev hoặc `?dev`): `cotien.cheat(name, ...args)` với `unlockAll`, `coins(n)`, `xp(n)`, `story`, `journey`, `challenges`, `energy`, `reset`; ví dụ `cotien.cheat('coins', 5000)`. `coins`/`xp` cộng số lượng; `story` mở chương qua mốc Hành trình; không có giao diện cheat.

## Tải tài nguyên

`src/platform/preload.ts` tải ảnh theo 3 tầng, dựa trên danh sách `virtual:art-manifest` sinh lúc build:
màn tải (`ui/screens/loading.ts`) chặn ở lần đầu và sau mỗi bản cập nhật để tải phần cốt lõi (giao diện, chân dung,
icon chiêu, bàn, tướng và môn phái của người chơi); phần còn lại tải nền khi ở menu (bỏ qua khi bật tiết kiệm dữ
liệu); mỗi trận tải và giải mã sẵn ảnh của hai tướng và môn phái của bàn. Ảnh lớn được service worker lưu vào kho
`art-<mã build>`, kho của bản cũ bị xoá khi bản mới chạy. `?loading` giữ màn tải để xem thiết kế.

## Thi triển kỹ năng theo vị trí

`useSkill(side, slot, cast?)` nhận `SkillCast` trong `src/game/skill-cast.ts`: tâm theo mét,
hướng được chuẩn hoá, chỉ số đoạn băng và vị trí 0–1 trên đoạn đó, chiều xoáy `cw/ccw`,
băng `soft/hard`. Bỏ tham số thì chọn tâm giữa bi cái và bi gần nhất, hướng về bi ấy,
băng gần tâm nhất. Bộ dựng thuần `buildCast` giới hạn tâm trong nỉ và tránh tâm đè bi;
vật chắn tránh cả bi và lỗ. Slot được lưu độc lập với tier.

`Match.activeEffects` giữ hiệu ứng theo bên nhận; `SkillDef.target` mặc định `self`, có thể
đặt `opponent` (ví dụ bẫy cát). Hiệu ứng hết sau cú đánh của bên nhận. `terrain()`,
`obstacles()`, `simulationWorld()` ghép kỹ năng với Thiên Tượng; lực tổng được chặn trong
physics dưới 0,8 lần lực cản lăn nhỏ nhất, kể cả vùng ma sát chồng nhau. AI dựng cùng hiệu ứng
rồi tìm lại cú đánh; đường dự đoán dùng cùng world và tham số đầu cơ.

Sau “Dùng”, chiêu có vị trí vào bước đặt: kéo/chạm bàn hoặc dùng mũi tên, “THI TRIỂN” xác nhận,
“Huỷ đặt chiêu” huỷ mà không tiêu chiêu. Nút đổi chiều/băng (phím R) chọn chiều xoáy hoặc băng mềm/cứng.
Các vùng và đoạn dùng tranh riêng trong `public/art/table/skills/`; preview có vòng đặt, điểm đặt, mũi tên và dấu chiều xoáy. Tám cơ chế đã có API; phân bổ vào 65 bộ chiêu
và tuyệt chiêu riêng môn phái thuộc các phần tiếp theo.
