# Vật lý, bàn và luật (`src/core`)

`src/core` không phụ thuộc DOM hay PixiJS: Web Worker của AI và Vitest chạy nó trực tiếp. Đơn vị là mét và giây.

## Bản đồ

| File | Sở hữu |
|---|---|
| `physics/` | Mô phỏng, cổng `index.ts`: `types.ts` (bi, thế giới, sự kiện, địa thế), `strike.ts` (cú cơ, squirt, trượt cơ, nảy 2.5D), `collision.ts` (bi, băng, lỗ), `terrain.ts` (lực đều, vùng ma sát, giếng, xoáy), `step.ts` (vòng bước thời gian) |
| `table.ts` | Kích thước bàn lỗ WPA 7 ft và bàn carom UMB (miệng lỗ, hàm lỗ, viền, nút ngắm) |
| `rack.ts` | Xếp bi 8/9/10 bi và carom, đặt lại bi |
| `rules/` | Mỗi thể loại một `RuleSet` (`types.ts`): `eight-ball.ts`, `rotation.ts` (9/10 bi), `carom.ts` |
| `aim.ts` | Dự đoán điểm chạm, bi ảo, hướng bi mục tiêu |
| `shot-score.ts` | Điểm cú đánh từ chuỗi sự kiện vật lý: số bi/điểm cộng thưởng kỹ thuật, kèm tên kỹ thuật cho HUD |
| `cue-power.ts`, `ball-styles.ts`, `rng.ts` | Đường cong lực, màu bi theo bộ Aramith truyền thống, RNG có seed |

## Quyết định và ràng buộc

- **Vật lý thật, không dịch chuyển bi tuỳ tiện.** Chiêu và Thiên Tượng chỉ được là lực, vùng ma sát, vật chắn
  hoặc kích thước lỗ trong mô phỏng. Nhờ vậy trận thật, đường dự đoán và AI luôn khớp nhau.
- **Lực đều nhỏ hơn lực cản lăn.** Nghiêng bàn và gió phải dưới μr·g ≈ 0,108 m/s², nên bi đứng yên không bao giờ
  tự trôi. `physics/terrain.ts` (`clampAcceleration`) còn chặn tổng lực (kể cả vùng chồng nhau) dưới một phần lực cản lăn nhỏ nhất. Lực địa
  thế chỉ tác động lên bi đang lăn.
- **Bước thời gian theo thời điểm va chạm**, không bước cố định, để bi nhanh không xuyên nhau. Khối bi khít lúc
  phá được giải bằng tiếp xúc mềm bước nhỏ.
- **Cú nhảy là mô hình 2.5D**, không phải mô phỏng cơ và mặt bàn 3D: bi có thêm độ cao `z` và vận tốc đứng
  `vz`; góc nâng cơ tách vận tốc ngang và đứng, đánh lệch tâm khi nâng cao dễ trượt cơ. Bi đủ cao vượt được bi
  chắn hoặc băng. Bi văng khỏi bàn phát sự kiện `off-table` để luật xử lý, không tính là vào lỗ. Kiểm thử:
  `tests/jump-physics.test.ts`.
- **Bi nghỉ và băng ở xa được bỏ qua** trong vòng lặp để tiết kiệm CPU trên điện thoại.

## Luật

- **WPA** cho 8 bi, 9 bi, 10 bi: push-out, ba lỗi liên tiếp, luật phá ba bi, quyền chọn sau phá không hợp lệ,
  gọi bi gọi lỗ.
- **UMB** cho carom: phăng tự do, ba băng.
- Văn bản luật hiện cho người chơi: `src/game/content/rules-text.ts`.

Mọi `RuleSet` giữ cùng hợp đồng trong `rules/types.ts`:

- xếp bi, bi cái, bi được chạm trước, kiểu gọi, `resolve`, mục tiêu cho HUD;
- trận, dự đoán và AI dùng bộ luật nào cũng được, không rẽ nhánh theo thể loại;
- thêm thể loại là thêm một `RuleSet` và đăng ký trong `rules/index.ts`.

## Điểm cú đánh

`shot-score.ts` là nguồn duy nhất cho độ khó của cú. Ba nơi đọc từ đây: năng lượng Tiên Đạo, điều kiện Ảnh Sát
và lời khen sau cú.

- Cú phá không có thưởng; cú lỗi không có điểm.
- Đổi cách chấm thì cập nhật `tests/shot-score.test.ts`.
- Cách điểm đổi ra năng lượng: [match-and-modes.md](match-and-modes.md#năng-lượng-tiên-đạo).

## Kiểm thử

`tests/physics.test.ts`, `rules.test.ts`, `jump-physics.test.ts`, `shot-score.test.ts`. Thử thách trong
`challenges.json` có lời giải được chính bộ mô phỏng kiểm chứng (`tests/challenges.test.ts`), nên đổi vật lý
có thể buộc chạy lại `npm run gen:challenges`.
