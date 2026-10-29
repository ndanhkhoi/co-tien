# Đóng góp cho Cơ Tiên

Cảm ơn bạn muốn mở rộng Cơ Tiên. Tài liệu nên đọc trước:

- `docs/architecture.md` — code được tổ chức thế nào, luồng một cú đánh
- `docs/world-bible.md` — thế giới, môn phái, hệ, tướng, chiêu
- `docs/art-pipeline.md` — đồ hoạ được tạo và duyệt thế nào
- `AGENTS.md` — quy tắc làm việc (cho người lẫn AI agent)

## Cài đặt

```bash
npm install
npm run dev        # http://localhost:5173  (thêm ?gate để xem màn hình cài đặt PWA)
npm test           # vật lý, luật, AI, thử thách, Luyện thế, chấm điểm cú, gió, tương phản bi–nỉ
npm run build      # typecheck + bản production vào dist/
```

## Quy tắc

- **Vật lý và luật là thật.** Mọi chiêu và Thiên Tượng phải biểu diễn bằng lực, ma sát, chướng ngại hoặc
  kích thước lỗ trong mô phỏng — không dịch chuyển bi tuỳ tiện. Lực nghiêng/gió phải nhỏ hơn lực cản lăn; gió
  giữ một chiều suốt lượt (cơn giật chỉ làm yếu đi, không đảo chiều) và có sức gió hiện cho người chơi.
- **Không dùng tài sản của game khác.** Không dùng tên, hình, chiêu thức hay biểu tượng của bất kỳ game hay tác phẩm nào khác.
- **Tranh và mô phỏng.** Tranh, icon, minh hoạ và trang trí UI phải được sinh riêng, nguyên bản qua pipeline với `cx/gpt-6-sol-image`; không tải tài sản internet, không tự vẽ SVG, emoji hay thư viện icon. Code/shader chỉ được dựng vật thể mô phỏng như bi/bàn (hình học, số/sọc, màu, ánh sáng, xoay theo vật lý), không thay tranh hoặc icon.
- **Giữ bi dễ nhìn.** Màu nỉ mới phải qua `tests/sect-contrast.test.ts` (ΔE ≥ 25 với mọi bi).
- **Giao diện theo Thuỷ Mặc** (`src/styles/{base,kit,screens,match,skin}.css`, `skin.css` nạp cuối): giấy, mực, một màu son, không phát sáng.
- **Một khung 16:9.** Kiểm tra điện thoại ngang 932×430 và desktop 1280×800, vùng chạm ≥ 44 px. Khung 9 lát
  (`border-image`) giữ viền 1px trong suốt, vì Safari/iOS không vẽ ảnh viền trên viền dày 0; kiểm tra trên WebKit.
- **Hiệu năng.** Mã chạy mỗi khung hình không được đọc layout (`getBoundingClientRect`, `offsetWidth`); dùng
  `uiOrigin()`/`uiScale()` và đo một lần mỗi lần đổi bố cục.
- Commit theo Conventional Commits (`feat:`, `fix:`, `docs:`…), mỗi commit một việc.

## Thêm một tướng

1. Thêm vào `src/game/content/roster.json`: `id`, `name`, `sect`, `tier`, `kind`, `cls`, `look` (ghi rõ giới tính và
   một tổ hợp nét nhận diện không trùng tướng khác), `pose`, `expr`, 3 `skills` (`kinds` từ 24 nhóm cơ chế,
   `icon` mô tả icon).
2. Thêm tiểu sử và câu nói vào `src/game/content/lore.json`.
3. Vẽ tranh theo `.claude/skills/game-art/SKILL.md` (`gen-sect.sh <môn-phái> <thư-mục>` chỉ vẽ phần còn thiếu),
   duyệt bảng tổng hợp, chạy `process-sect.py` để xuất vào `public/art/`. Vẽ thêm tư thế kết liễu
   `champions/{id}/finisher.webp` (thân người chéo từ trên trái xuống dưới phải, đầu cơ thúc về góc dưới phải,
   nền trong suốt; xem `docs/art-pipeline.md`).
4. Cập nhật `docs/world-bible.md` (cả tên và nhóm cơ chế của ba chiêu, giữ tiểu sử), chạy `npm test` và `npm run build`.

## Thêm một môn phái

Thêm môn phái vào `roster.json` (màu, bối cảnh, biểu tượng, 2 cây cơ), 5 tướng bậc 1–5, rồi:
`SectId` và các bảng `TABLE_LOOK` / `CUE_STATS` / `CUE_NAMES` trong `src/game/content/sects.ts`, Thiên Tượng
trong `src/game/terrain.ts` (`rollOmen` + `OMEN_INFO`), chương trong `src/game/content/career.ts`, mốc trên
bản đồ trong `src/ui/screens/journey.ts`, truyện trong `lore.json`.


## Hợp đồng cần giữ

- `kind` là loại tạo hình (Hiệp Khách, Nữ Hiệp, Yêu Tộc, Tinh Linh, Linh Tượng, Ma Vật), `cls` chọn hệ nội tại. Hai chiêu thường ở slot 0/1, tuyệt chiêu ở slot 2; không suy ra slot từ bậc sức mạnh.
- Chiêu đặt bàn dùng tám nhóm `slick`, `sand`, `bumper`, `railcraft`, `wind`, `well`, `spinwash`, `vortex`. Dùng cùng `SkillCast`/world cho trận thật, dự đoán và AI; kiểm tra cả bàn lỗ, bàn phăng và bước huỷ/xác nhận đặt chiêu.
- Tiên Đạo có chiêu, nội tại, địa thế; Cổ Điển và Luyện Cơ không bật các hiệu ứng này. Năng lượng và lợi thế Ảnh Sát
  trả theo điểm cú đánh (`src/core/shot-score.ts`); đổi cách chấm thì cập nhật `tests/shot-score.test.ts`. Giữ tên menu hiện tại: Hành trình, Luận Cơ, Song Đấu, Luyện Cơ, Tàng Các (có Cơ Tiên Lục), Cơ Tiên Truyện, Luyện thế.
- DOM giữ khung 16:9 (844×475), scale đều to nhất vừa vùng safe area, chừa dải khung tranh, và căn giữa (tối đa 2,2) trong `main.ts`; không dùng media query hay `vw`/`vh` bên trong khung; canvas quy đổi cả độ lệch khung. Màn cài PWA dùng kích thước thật. Kiểm tra cuộn, modal, chuyển tiến/lùi và giảm chuyển động.
- Giữ khoá save `thancong.profile.v1`; thêm trường qua mặc định và `sanitize`, giữ tương thích mã `TC1.`. Thế đã lưu
  của Luyện thế nằm ở khoá riêng `cotien.practice.v1`, đọc qua `sanitizeSaved`.
- Tranh đi qua loader trong `src/platform/preload.ts`: lần đầu tải trọn bộ vào kho `art`, mỗi file có mã nội dung nên bản mới chỉ tải lại tranh đã đổi; nền lúc rảnh bù phần thiếu, trận kiểm tra và giải mã trước. Bổ sung tranh mới vào đường dẫn mà manifest nhận; không bỏ cơ chế cập nhật PWA chờ người chơi rời bàn.


## Kiểm tra điều khiển

Ngắm bằng kéo/chạm bàn và hai nút xoay; áp phê nhanh bằng giữ/kéo bi cái nhỏ (mở bi lớn tạm thời), chính xác bằng điểm đánh trên bi lớn hoặc các lựa chọn nhanh. Chạm thanh lực để đặt mức, kéo để tinh chỉnh; chạm bi trên bàn hiện số bi (trong Luyện thế, kéo bi chỉ dời bi, không hiện nhãn); thông báo giữa bàn đóng khi chạm hoặc bấm ✕ và tắt được trong cài đặt; giữ ĐÁNH dùng lực dao động và trượt ra xa để huỷ. Khi bi trong tay, kiểm tra dời bằng kéo/chạm hoặc bốn nút hướng, chuyển “Ngắm thử” / “Dời bi”, rồi “ĐẶT BI”. Kiểm tra ba icon chiêu đúng tướng, mở chi tiết trước khi dùng, hồi chiêu và năng lượng. Safe area được trừ một lần ở khung ngoài; vùng chạm bù ngược `--ui-scale`. Kiểm tra kích thước hiển thị sau scale, cả giả lập iPhone ngang 932×430 CSS pixel và cửa sổ desktop 1280×800, 1920×1080. Kiểm tra góc nâng cơ, nhảy qua bi chắn, tiếp đất và bi văng bàn; tuyệt chiêu phải chờ ĐÁNH rồi mới hiện cut-in, hiệu ứng bàn và cú đánh. Thắng ván bằng cú sạch phải hiện Kết liễu (chạm để bỏ qua). Màn cài app có hướng dẫn cho cả iPhone/iPad và Android.
