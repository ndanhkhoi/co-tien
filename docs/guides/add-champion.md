# Thêm tướng hoặc môn phái

Tướng và môn phái là dữ liệu. Typecheck (`Record<SectId, …>`) và các test roster sẽ báo phần còn thiếu, nên
chạy `npm test` và `npm run build` sau mỗi bước.

## Thêm một tướng

1. **Dữ liệu**: thêm vào `src/game/content/roster.json`: `id`, `name`, `sect`, `tier`, `kind` (một trong sáu
   loại tạo hình), `cls` (một trong bảy hệ), ba `skills` (slot 0/1 cơ bản, slot 2 tuyệt chiêu; `kinds` lấy từ
   `SkillKind`). Phần mô tả để vẽ: `look` (ghi rõ giới tính và một tổ hợp nét nhận diện không trùng tướng
   khác), `pose`, `expr`, và `icon` cho từng chiêu. Bản build lược các trường mô tả vẽ; code game không đọc chúng.
2. **Tên**: tên tướng và chiêu phải nguyên bản, không lấy từ game hay tác phẩm khác.
   `tests/roster-names.test.ts` kiểm tra tên chiêu không trùng và không lặp chữ đầu quá nhiều trong môn phái.
3. **Truyện**: tiểu sử và câu nói vào `src/game/content/lore.json`.
4. **Tranh**: theo [art-pipeline.md](art-pipeline.md): cut-out, chân dung, biểu cảm, ăn mừng, ba icon chiêu
   và tư thế Kết liễu `champions/{id}/finisher.webp`. Duyệt từng tấm trước khi xuất vào `public/art/`.
5. **Tài liệu**: thêm tướng vào bảng môn phái trong [world/world-bible.md](../world/world-bible.md) (tên, loại,
   hệ, tên và nhóm cơ chế của ba chiêu).
6. **Kiểm tra**: `npm test`, `npm run build`, rồi mở trang tướng và một trận Tiên Đạo để thử ba chiêu.

## Thêm một môn phái

1. `roster.json`: môn phái (màu, bối cảnh, biểu tượng, hai cây cơ) và năm tướng bậc 1–5.
2. `src/game/content/sects.ts`: thêm vào `SectId`, rồi `TABLE_LOOK` (Linh Đài), `CUE_STATS`, `CUE_NAMES`.
   Màu nỉ phải qua `tests/sect-contrast.test.ts`.
3. `src/game/terrain.ts`: Thiên Tượng trong `rollOmen` và `OMEN_INFO`. Phải là lực/ma sát thật, dưới lực cản lăn.
4. `src/game/content/career.ts`: chương Hành trình trong `CHAPTERS`; `src/ui/screens/journey.ts`: toạ độ mốc
   trong `PINS`, khớp quảng trường trên tranh bản đồ.
5. `lore.json`: truyện môn phái; nếu môn phái có chương Cơ Tiên Truyện, cập nhật `story.json` và
   [world/story.md](../world/story.md).
6. Tranh môn phái (splash, viền bàn, cơ, biểu tượng, VFX) qua `gen-sect.sh`.
7. Thêm mục môn phái vào [world/world-bible.md](../world/world-bible.md).
