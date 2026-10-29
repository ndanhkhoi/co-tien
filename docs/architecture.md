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
  styles/     base.css, kit.css, screens.css, match.css, skin.css
public/art/   tranh đã xử lý (webp) — xem docs/art-pipeline.md
```

## Luồng một cú đánh

```
UI (kéo/chạm bàn, nút xoay, lực, ĐÁNH) ──► Match.shoot(input)
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

- `physics.ts`: mô phỏng mặt bàn theo mét, thêm độ cao `z` và vận tốc đứng `vz` cho cú nhảy (2.5D). Ma sát trượt và lăn, spin ba trục, throw khi cắt bi, ném băng có
  áp phê, bước thời gian theo thời điểm va chạm (không xuyên bi), khối bi khít khi phá được giải bằng tiếp
  xúc mềm bước nhỏ. `Terrain` thêm lực đều (nghiêng / gió, có giật), vùng ma sát và giếng hấp dẫn — chỉ tác
  động lên bi đang lăn.
  Góc nâng cơ 0–75° tách vận tốc ngang và đứng; trên 10° có thể tạo cú nảy khỏi mặt bàn, chịu trọng lực và mất năng lượng khi tiếp đất. Vùng tiếp xúc đầu cơ thu hẹp theo cos góc nâng: đánh lệch tâm làm giảm xung lực đứng, dễ trượt cơ hơn khi nâng cao; trượt cơ không tạo cú nhảy có kiểm soát. Đây là mô hình 2.5D cho cú nhảy, không phải bộ mô phỏng cơ và mặt bàn 3D đầy đủ. Va chạm bi xét khoảng cách theo ba trục; bi đủ cao vượt được bi chắn hoặc băng. Bi bay khỏi bàn phát `off-table` để luật xử lý, không tính là vào lỗ.
- `table.ts`: kích thước WPA (bàn 7 ft 1,981 × 0,991 m, bi 57,15 mm, miệng lỗ góc 117,5 mm / giữa 130 mm,
  hàm lỗ 142° / 104°, viền 12,7 cm, nút ngắm cách mép băng 3 11/16 in) và bàn carom UMB.
- `rack.ts`: xếp bi đúng luật cho 8/9/10 bi và carom; đặt lại bi.
- `rules/`: 8 bi, 9/10 bi (rotation), carom phăng tự do và 3 băng theo WPA 2026 / UMB.
- `aim.ts`: dự đoán điểm chạm, bi ảo, hướng bi mục tiêu.

## `src/game` — trận đấu và nội dung

- `match.ts`: máy trạng thái của một trận (`aim → rolling → option / rack-over / match-over`), năng lượng,
  hồi chiêu, nội tại hệ, 24 nhóm cơ chế chiêu, Thiên Tượng, Địa Lợi, tua lại.
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
đánh được **+6** (`ENERGY_PER_SHOT`). Phần còn lại trả theo **điểm cú đánh** của `src/core/shot-score.ts`:
mỗi bi của mình vào lỗ hoặc điểm carom là 1 điểm, cộng thêm khi cú khó hoặc đẹp (cắt mỏng từ 50°, bi băng,
hai băng, bi kết, gỡ băng, nhảy bi, cú xa, ăn nhiều bi, carom ba băng; cú phá không có thưởng). Mỗi điểm
được **+11** (`ENERGY_PER_VALUE`), rồi điều chỉnh theo chỉ số năng lượng của cơ và Địa Lợi. Cú lỗi không
có điểm. Đối thủ phạm lỗi thì được **+12**. Ảnh Sát cần chuỗi ăn liền ít nhất **4 bi** (`ASSASSIN_RUN`) và
cả chuỗi đạt **5 điểm** (`ASSASSIN_VALUE`). Thông báo sau cú vào gọi tên cú đẹp (“Cú đẹp!”, “Tuyệt kỹ!”
kèm tên các kỹ thuật), Luyện thế cũng hiện tên đó. `match.ts` phát sự kiện
`energy` với `side`, `gain` (phần tăng thực tế sau giới hạn) và `total`. Cổ Điển không cộng năng lượng.
Hai chiêu thường hồi sau **2–3 lượt đánh của chính mình**; hệ Luân Hồi chỉ giảm một lượt khi dùng luân phiên hai chiêu cơ bản.
Tuyệt chiêu cần đầy thanh năng lượng.

## `src/ai`

`brain.ts` tìm cú đánh bằng chính bộ mô phỏng: liệt kê đường ăn thẳng / đánh băng, thử biến thể lực và áp
phê, chấm điểm theo vị trí bi cái cho cú sau, chọn phòng thủ khi rủi ro; nhận cùng thông số bàn và Thiên
Tượng như người chơi. `chooseSkill` trong `brain.ts` chọn chiêu ở cả bốn cấp AI, kể cả cấp 1;
chỉ chọn trong các chiêu sẵn dùng được truyền vào. Sau khi chọn chiêu, AI dựng lại đầy đủ gói hiệu ứng
và tìm lại cú đánh; chiêu dời bi dùng vị trí được trận thật chấp nhận, trên cả bàn lỗ và bàn phăng.
Metadata hình học và xung lực hình quạt đi cùng yêu cầu worker. Chạy trong Web Worker (`ai-worker.ts`) qua `ai-client.ts` để không giật hình.

## `src/render`

`table-view.ts` dựng bàn (vẽ bằng canvas theo kích thước thật, dùng ảnh viền bàn của môn phái khi có),
bi (`ball-mesh.ts`: shader cầu, lăn theo vận tốc góc), cơ, đường ngắm + bi ảo + mũi tên hướng, Thiên Tượng,
hiệu ứng chiêu (`skill-fx.ts`: ghép các nét mực VFX của môn phái theo từng nhóm cơ chế, flipbook tuyệt chiêu).
Độ cao mô phỏng nâng hình bi khỏi bóng trên mặt bàn; đường ngắm cú nhảy chạy một đoạn mô phỏng ngắn thay cho tia bi ảo phẳng.

Code/shader cho bi và bàn phục vụ hình học và trạng thái mô phỏng (số/sọc, màu, ánh sáng, xoay vật lý). Tranh, icon và trang trí UI vẫn là tài sản nguyên bản sinh riêng qua pipeline; ngoại lệ vật thể mô phỏng không áp dụng cho chúng.

## `src/ui`

Màn hình là DOM phủ trên canvas (`app.ts` quản lý ngăn xếp màn hình). `menus.ts` (trang chủ, Luận Cơ, Song Đấu,
Tàng Các, cài đặt), `journey.ts` (bản đồ Hành trình), `codex.ts` (nội dung Cơ Tiên Lục, hiện trong Tàng Các), `practice.ts` và `practice-desk.ts` (Luyện thế: màn chọn thế và bảng bên bàn), `story.ts` (đọc truyện có tranh, mở chương theo Hành trình), `match-screen.ts`
(HUD, kéo/chạm bàn, nút xoay, thanh lực, chiêu, cut-in, AI diễn hoạt), `install-gate.ts` (bắt cài PWA trên điện thoại),
`viewport-guard.ts` (bắt xoay ngang, kiểm tra cửa sổ trên máy tính), `hints.ts` / `intro.ts` (hướng dẫn).
`icons.ts` cung cấp `icon(name)` để tạo icon tranh từ `public/art/ui/icons/`.

Tàng Các gộp các tab vào thanh tiêu đề gọn để dành chiều cao cho nội dung: **Tướng, Cơ, Bàn** là đồ sở hữu, **Vùng đất, Hệ, Luật** là Cơ Tiên Lục. Trang tướng có nút **Tiểu sử** mở trang Cơ Tiên Lục của tướng đó (tiểu sử, câu nói, bộ tranh) khi tướng đã được khám phá, tức đã gặp hoặc đã sở hữu (`known`). Từng thẻ vùng đất có số tướng đã gặp riêng.

**Luyện thế** là ô thứ sáu ở trang chủ. Màn chọn thế liệt kê thế mẫu (`PRACTICE_DRILLS` trong `src/game/practice.ts`) và Thế của tôi (tối đa 12, lưu ở khoá `cotien.practice.v1`, qua `sanitizeSaved`), với hình bàn vẽ từ chính hình học và màu bi của mô phỏng. Trong bàn, `practice-desk.ts` chiếm cột chiêu: chế độ **Xếp bi** có khay chứa mọi bi chưa ra bàn (chạm để đặt hoặc cất, kéo ra bàn, kéo bi ra mép để cất), chế độ **Đánh** có số cú/số bi vào, **Đánh lại** (`Match.undoShot` dùng ảnh chụp trước cú), **Về thế đầu**, **Lưu thế** và **Đường đi** (`Match.sight`, mô phỏng đường của mọi bi như Thần Nhãn).

`src/main.ts` nạp năm tệp CSS: `base.css` đặt nền tảng Thuỷ Mặc (màu, chữ, nền đọc và safe area);
`kit.css` chứa thành phần dùng chung như nút, thẻ chọn và hộp thoại. `screens.css` dành cho các màn hình,
`match.css` dành cho giao diện trận đấu; `skin.css` nạp cuối để phủ khung tranh, nút dấu son, chuyển trang và màn xuất hiện tướng. Chuyển màn trong `app.ts` có hướng tiến/lùi/đặt lại; màn cũ trở thành `inert`, được gỡ sau 280 ms; `turnPage` chỉ giữ ảnh chụp DOM của phần cũ trong lúc nội dung thật đổi ngay. Các chuyển động tôn trọng `prefers-reduced-motion`.

Lớp DOM giữ một khung thiết kế **16:9 (844×475)**, scale đều để nằm trọn trong vùng màn hình đã trừ safe area, tối đa **2,2** (`installUiScale()` trong `main.ts`). Bên trong khung không có media query hay đơn vị `vw`/`vh`: mọi phần tử co dãn theo khung, không theo cửa sổ. Dải thừa quanh khung (`body.stage`) luôn là phông sống, không phải nền một màu. Màn hình rộng rãi (cạnh ngắn ≥ 480 px và scale khi có khung ≥ 1: desktop, tablet, cửa sổ lạ) bật `body.theatre`: game nằm trong khung bình phong vẽ (`art/ui/frame/stage.webp`, nine-slice, góc tràn ra ngoài) trên phông sống (`#backdrop`: tranh theo màn trôi chậm, sương `stage-mist.webp`, lớp giấy lót dưới bàn). Phông lấy từ `Screen.backdrop` (mặc định keyart; trận dùng splash môn phái đối thủ; Cơ Tiên Truyện dùng tranh trang đang đọc) qua `App.setBackdrop`. Ở chế độ này splash/màn tải cũng nằm trong khung, `--bleed-*` bằng 0 và canvas bị cắt theo khung. Khi lề hai bên đủ rộng (`body.cast-room`), tướng của hai bên (`Screen.cast`) đứng hai cạnh khung; màn cao (4:3, 5:4, tablet) có lề trên đủ rộng (`body.cast-top`) thì tướng ló đầu qua mép trên khung. Điện thoại không có khung gỗ: splash/màn tải phủ toàn màn hình ở kích thước gốc. Cửa sổ dưới 640×360 hiện thông báo vì chữ và nút không còn đủ rõ; mọi tỉ lệ khác đều chơi được. Canvas Pixi vẫn phủ cửa sổ; bố cục bàn quy đổi biên HUD và độ lệch khung DOM sang pixel màn hình. Sự kiện `cotien:ui-resize` cập nhật lại bàn sau khi khung đổi kích thước. Safe area được tính một lần ở khung ngoài; token vùng chạm trong `base.css` bù ngược `--ui-scale` để giữ tối thiểu 44 pixel hiển thị. Khoảng `--bleed-*` quy đổi phần bù viewport về layout pixel: nền tối modal/bảng áp phê/chiêu, nền đối đầu và tranh trang chủ phủ cả phần bù, trong khi nội dung và nút vẫn nằm trong khung an toàn. Kích thước HUD theo khung thiết kế, không tăng theo chiều cao màn hình ngoài.

Trên điện thoại còn phải cài PWA (`mustInstall()`), màn hình cài đặt hiện trước ngay cả khi máy đang
dọc; `viewport-guard.ts` bỏ qua chặn xoay ngang trong thời gian này. Màn cài đặt dùng kích thước CSS
thật, không thu phóng theo khung game ngang. Lớp UI bám vùng nền
`100dvh` qua `ResizeObserver` để cập nhật theo thanh trình duyệt mobile. Màn chặn xoay phủ tối thiểu
`100lvh` và tô nền gốc cùng màu mực để vùng home indicator của iOS standalone không lộ nền giấy.

`src/platform/device.ts` chặn
cử chỉ trình duyệt ngoài vùng cuộn, nhưng cho cuộn trong `.scroll` hoặc phần tử hoặc phần tử cha có `overflow`
`auto`/`scroll` và nội dung thực sự tràn; chặn cả pinch zoom nhiều ngón.

## Điều khiển hiện tại

`src/ui/screens/match-screen.ts` nhận kéo/chạm trực tiếp trên bàn. Kéo xoay cơ tương đối quanh bi cái; kéo xa bi cái giảm tốc xoay để ngắm tinh. Chạm bi để ngắm thẳng vào bi, chạm vị trí trống để ngắm tới đó; nút đổi mục tiêu chuyển bi. Hai nút xoay chỉnh 0,1° mỗi chạm, giữ để xoay nhanh dần.

Giữ hoặc kéo bi cái nhỏ mở một bi lớn cạnh cột điều khiển; ngón tay dời điểm đánh trên bi lớn, thả tay là đóng. Chạm nhanh bi cái nhỏ mở bảng áp phê: chạm hoặc kéo điểm đánh trên bi lớn, hoặc chọn Giữa, Trô, Cule, Giật, Trái, Phải. Bảng này cũng có thanh “Nâng cơ” 0–75° cho cú nhảy: lực và góc quyết định tầm bay, góc cao giảm tầm ngang; quá nhẹ có thể chạm bi chắn, quá mạnh có thể văng bàn. Chạm thanh lực đặt mức tại điểm chạm, kéo để tinh chỉnh từ mức hiện tại; chạm ĐÁNH dùng lực đã chọn. Gọi lỗ bằng cách chạm lỗ trên bàn; lỗ đã gọi hiện trong ô mục tiêu phía trên, nút đẩy bi (push-out) nằm trong cột điều khiển, không có gì đặt trên băng bàn. Giữ ĐÁNH cho lực dao động rồi thả để đánh; trượt ngón ra xa để huỷ.

Khi có bi trong tay, kéo bi cái hoặc chạm bàn để dời; bốn nút hướng chỉnh 3 mm mỗi chạm và nhanh dần khi giữ. “Ngắm thử” chuyển thao tác bàn sang ngắm, cho xem đường bi trước khi chốt; “Dời bi” quay lại đặt vị trí. Khi dời bi, cả cơ và tia ngắm đều ẩn; chỉ hiện lại ở Ngắm thử. “ĐẶT BI” xác nhận vị trí, không đánh ngay. Bước đặt chiêu là trạng thái riêng và dùng “THI TRIỂN” để xác nhận.

HUD Tiên Đạo có ba ô icon tranh riêng của tướng đang điều khiển, lấy bằng `skillIconUrl(champion.id, slot)`; mỗi ô hiện tên, trạng thái sẵn sàng/hồi chiêu hoặc phần trăm năng lượng tuyệt chiêu. Chạm ô mở thẻ mô tả và nút dùng, không thi triển ngay. Trang tướng, Cơ Tiên Lục và thông tin đối thủ dùng ba nút chiêu với thẻ chi tiết có icon, tên, hồi chiêu hoặc yêu cầu 100 năng lượng, mô tả và nút trở về trang tướng.

## PWA và cập nhật

`vite-plugin-pwa` tải sẵn code, tranh đệ quy trong `art/ui/` và `art/table/`, chân dung, icon chiêu và biểu tượng
môn phái theo `globPatterns` trong `vite.config.ts`; các ảnh khác trong `art/` được cache khi tải lần đầu.

Trong bản production, `src/main.ts` kiểm tra bản mới mỗi **15 phút**, khi ứng dụng trở lại phía trước, khi có
mạng trở lại, và khi bấm “Kiểm tra” ở mục Phiên bản trong Cài đặt. Ngay khi bản mới bắt đầu tải (`updatefound`),
menu bị chặn bằng tấm “Đang tải bản mới…” để không ai tiếp tục chơi bản cũ; tải lỗi thì tấm này tự gỡ. `src/ui/app.ts` buộc áp dụng ngay từ menu; nếu đang ở màn hình trận đấu thì chờ hết trận,
khi chuyển sang màn hình không dùng stage. Lúc áp dụng, một lớp **chặn thao tác** hiện “Đang cập nhật
bản mới…” trước khi kích hoạt service worker mới và tải lại ứng dụng.

## Kiểm thử

`npm test` (Vitest): vật lý, luật, AI, 60 thử thách có lời giải, độ tương phản bi–nỉ (ΔE ≥ 25) cho mọi
môn phái. `tests/skill-usage.test.ts` kiểm tra AI dùng chiêu thường/tuyệt chiêu qua các ván, cộng và
giới hạn năng lượng, sự kiện `energy`, hồi chiêu và tuyệt chiêu đặt bi của AI cấp 1. `npm run build` chạy typecheck trước khi build.

Console test ẩn (bản dev hoặc `?dev`): `cotien.cheat(name, ...args)` với `unlockAll`, `coins(n)`, `xp(n)`, `story`, `journey`, `challenges`, `energy`, `reset`; ví dụ `cotien.cheat('coins', 5000)`. `coins`/`xp` cộng số lượng; `story` mở chương qua mốc Hành trình; không có giao diện cheat.

## Tải tài nguyên

`src/platform/preload.ts` giữ toàn bộ tranh trong một kho Cache Storage lâu dài tên `art`. Danh sách
`virtual:art-manifest` sinh lúc build ghi đường dẫn, dung lượng và **mã nội dung** (sha1) của từng file; mỗi file
trong kho mang header `x-art-rev`. Service worker chỉ phục vụ kho này (CacheFirst), còn loader tự điền và giữ
kho khớp với bản build theo từng file, với các yêu cầu `?rev=` đi thẳng ra mạng.

- **Màn tải** (`ui/screens/loading.ts`): lần đầu mở game tải **toàn bộ** tranh (~92 MB, hiện số MB), để sau đó
  chơi không bao giờ phải chờ ảnh. Một bản build có tranh mới quay lại màn này nhưng chỉ tải những file có mã
  nội dung đổi. Bật tiết kiệm dữ liệu thì chỉ tải phần cốt lõi (giao diện, chân dung, icon chiêu, bàn, tướng và
  môn phái của người chơi). Dấu `cotien.assets` = `<mã bộ tranh>:all|core`; mã bộ tranh (`__ART_VERSION__`) chỉ
  đổi khi có tranh đổi, nên bản cập nhật chỉ sửa code không hiện màn tải.
- **Nền:** ở menu, phần còn thiếu (lỗi mạng, tiết kiệm dữ liệu) tải tiếp 2 luồng lúc trình duyệt rảnh; tranh
  giao diện và cutout tướng của người chơi được giải mã sẵn và giữ trong bộ nhớ để màn hình không chớp trắng.
- **Trận:** kiểm tra và tải ảnh của hai tướng và môn phái của bàn, rồi giải mã trước cutout, flipbook và cut-in.

Sau khi tải đủ, file không còn trong manifest bị xoá khỏi kho. Các kho `art-<mã build>` của bản cũ bị xoá.
Lỗi mạng không chặn khởi động: ảnh tải theo nhu cầu và lần mở sau thử lại. `?loading` giữ màn tải để xem thiết kế.
Tiến trình hiện bằng nét cọ mực và phần trăm tải.

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
Các vùng và đoạn dùng tranh riêng trong `public/art/table/skills/`; preview có vòng đặt, điểm đặt, mũi tên và dấu chiều xoáy. Tám cơ chế được phân bổ vào 65 bộ chiêu khác nhau. `ult` định danh hình học riêng của tuyệt chiêu bậc 5 theo môn phái; `shape` chọn cổng, rễ chữ V hoặc hút vành lỗ. Các lựa chọn nội tại trên HUD đi qua `lockAim`, `choosePassive`, `useGuard`; `spinReach` được chia sẻ với AI và dự đoán.

Trên bàn phăng, `effectiveKind` đổi hộ thể thành chỉnh băng, phong ấn lỗ thành làm run,
nuốt lỗ thành tăng áp phê, hút lỗ thành tiên tri và dịch chuyển thành dời bi.
Cổ Điển và thử thách không kích hoạt kỹ năng, nội tại hoặc Thiên Tượng.


## Hợp đồng nội dung và chế độ

`Champion.kind` có sáu loại tạo hình: Hiệp Khách, Nữ Hiệp, Yêu Tộc, Tinh Linh, Linh Tượng, Ma Vật; `cls` là một trong bảy hệ nội tại, độc lập với loại. `roster.json` giữ 65 tướng × 3 tên chiêu; `sects.ts` dựng slot 0/1/2, mô tả, hồi chiêu và sức mạnh. Tám cơ chế đặt bàn là `slick`, `sand`, `bumper`, `railcraft`, `wind`, `well`, `spinwash`, `vortex`; danh sách và hành vi nằm trong World Bible.

Tên màn hình: **Luận Cơ** (đấu AI), **Song Đấu** (hai người chung máy), **Luyện Cơ** (thử thách), **Tàng Các** (tướng/cơ/bàn và Cơ Tiên Lục), **Hành trình**, **Cơ Tiên Truyện**, **Luyện thế** (bàn tập tự do). **Tiên Đạo / Cổ Điển** là lựa chọn luật hiệu ứng trong thiết lập trận, độc lập với thể loại 8/9/10 bi hoặc phăng.

Nội tại đi qua cùng `Match` cho người và AI: Thần Xạ khoá hướng và mở khoá khi đổi góc; Cuồng Chiến tăng lực 10%, giảm tầm áp phê 25%; Pháp Tu chọn trục áp phê (trục chọn ×1,2, trục kia ×0,8); Hộ Pháp chọn băng mềm một lần mỗi lượt cơ; Chú Sư để vùng cát sau cú hợp lệ kết thúc lượt; Ảnh Sát cần ăn liền 4 bi (`ASSASSIN_RUN`) rồi mới chọn thông tin hoặc lực ×1,12, dùng xong phải gom lại chuỗi; Luân Hồi giảm một lượt hồi chiêu khi luân phiên hai slot cơ bản.

Hồ sơ giữ `thancong.profile.v1`; `sanitize` bổ sung trường mới, lọc ID trang bị/tướng không còn hợp lệ, giữ các tướng bậc 1 miễn phí và xoá trường cũ `avatar`/`skills`. Mã chia sẻ giữ tiền tố `TC1.` và cũng đi qua `sanitize` khi nhập.

Trang tướng ở Tàng Các và Cơ Tiên Lục dùng ba nút icon chiêu; chạm từng nút mở hộp mô tả riêng (hồi chiêu hoặc 100 năng lượng cho tuyệt chiêu), đóng để trở lại trang tướng.

Ba nút chiêu hiện tên và hồi chiêu/năng lượng ngay trên trang tướng. Xem trước bàn trong Tàng Các giữ tỉ lệ kích thước bàn WPA gồm cả viền, không kéo giãn theo chiều rộng thẻ.

Tuyệt chiêu được ghi nhận khi xác nhận dùng nhưng phần diễn hoạt chờ thao tác ĐÁNH: khoá điều khiển, hiện cut-in tướng, rồi hiệu ứng trên bàn, sau đó cơ vung và mô phỏng cú đánh mới bắt đầu. Cả người và AI đi qua cùng luồng; chờ diễn hoạt tôn trọng tạm dừng và được huỷ khi rời trận.

## Quyết định UI ngày 2026-10-28

Giữ PixiJS WebGL cho bàn, bi, hiệu ứng; DOM cho điều khiển/menu/truyện. Đổi engine không tự giải quyết letterbox, layout hoặc trạng thái điều khiển.

Mỗi lượt hiện tối đa một mẹo (`hintTurn`), mẹo còn lại quay lại ở lượt sau. Chạm bi trên bàn hiện nhãn có ảnh bi dựng bằng chính shader bi (`TableView.ballPortrait`). Thông báo lượt/lỗi/ghi điểm là dải mực bán trong suốt (`ink-wide.webp`, ~82%) quét qua phía trên giữa bàn rồi mờ dần, không chặn thao tác hoặc dừng mô phỏng; hai khung người chơi là tấm giấy vẽ (`name-wide.webp`), người chờ lượt mờ nhẹ; trạng thái AI đang tính thu gọn về dải trên. Ô mục tiêu bỏ nền trắng. Thanh lực dùng thước dọc với phần trăm và giữ vùng kéo đầy đủ. Nội tại tách tên hệ và trạng thái; chưa đạt điều kiện chỉ hiện thông tin, hành động sẵn sàng dùng khung mực. Nút tạm dừng dùng một lưới đồng kích thước; nút hành động cài đặt cùng độ rộng. Hành trình bỏ khung thẻ, hòa mép tranh vào nền và ngăn cuộn quá biên lan ra ngoài.

Nút hành động trong ván là tranh tròn có icon và chữ thư pháp, tên thao tác vẫn có trong `aria-label`.
Trang chủ chừa vùng header ngoài chân dung. Trang tướng dùng hàng grid thống nhất cho ba chiêu,
bao gồm tên xuống dòng. Scroll hint neo vào cha trực tiếp để giữ đúng lớp và vùng đọc truyện.
Tên tuyệt chiêu dùng nền nét mực riêng; bản đồ dùng tuyến `CHAPTERS` và tọa độ khớp tranh 3:2.
