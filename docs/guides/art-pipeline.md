# Đồ hoạ: được tạo thế nào

Hướng dẫn vẽ, cắt và duyệt tranh. Chi tiết từng bước và script nằm trong skill
`.claude/skills/game-art/SKILL.md`; file này giữ quy tắc và lý do.

Toàn bộ tranh trong game (tướng, môn phái, icon chiêu, hiệu ứng, bản đồ, logo, icon ứng dụng, giao diện)
được **vẽ bằng mô hình sinh ảnh AI** theo prompt riêng, rồi **duyệt nghiêm từng tấm**. Không tải ảnh từ
internet hay lấy từ tác phẩm khác.

## Cài đặt công cụ

Tranh được sinh qua **9router**, model **`cx/gpt-6-sol-image`**, bằng các script trong
`.claude/skills/game-art/`. Cần Bash, curl, jq, ImageMagick (`magick`), Python 3 và Pillow.

1. Sao chép `.env.image-api.example` thành `.env.image-api` tại gốc repo.
2. Điền `IMAGE_API_BASE` (URL API 9router gồm `/v1`) và `IMAGE_API_KEY`; giữ
   `IMAGE_API_MODEL=cx/gpt-6-sol-image`. File cấu hình được gitignore, không commit khoá API.
3. Viết prompt và chọn ảnh tham chiếu theo `.claude/skills/game-art/SKILL.md`, rồi chạy:

```bash
.claude/skills/game-art/scripts/gen-image.sh --out /path/to/art/image.png --prompt-file /path/to/art/prompt.txt
.claude/skills/game-art/scripts/gen-sect.sh SECT /path/to/art
```

`--ref` giữ tạo hình nhân vật; `--style-ref` giữ phong cách. Request lỗi trả mã lỗi và đường dẫn
response để kiểm tra trước khi chạy lại.

## Quy trình

1. **Thiết kế bằng chữ**: `src/game/content/roster.json` giữ `look` của từng tướng: giới tính, tuổi,
   tóc, trang phục, cây cơ, dấu hiệu riêng; cùng dữ liệu môn phái và chiêu.
2. **Sinh prompt**: `build-prompts.py` ghép đề bài với khối phong cách. Prompt chân dung, biểu cảm và
   ăn mừng đều chèn **toàn bộ `look`**, dưới chỉ dẫn “Character spec … must match”. Icon dùng mực đen
   và một màu nhấn môn phái, cấm phát sáng, ánh kim và màu thừa; ô biểu tượng là dấu son + đen.
   Flipbook dùng mực màu môn phái, mép cọ trắng giấy, cấm glow và mảng trắng sáng. Khi duyệt prompt,
   áp dụng chung quy tắc không ánh kim, không màu thừa cho icon, biểu tượng và flipbook.
3. **Vẽ**: `gen-sect.sh` vẽ cut-out trước cho từng tướng, rồi chân dung và tư thế ăn mừng tham chiếu
   cut-out; bảng 2×2 biểu cảm tham chiếu chân dung. Script còn vẽ splash, cut-in, bảng 4×4 icon,
   bảng 5×5 VFX, flipbook 4×4, viền bàn và hai cây cơ; bỏ qua ảnh gốc đã có.
4. **Cắt và xuất**: `process-sect.py` cắt lưới, tách nền và xuất webp vào `public/art/`, tạo bảng duyệt.
   Riêng icon UI dùng `slice-ui-icons.py SHEET.png OUT_DIR name1 … name16`: cắt bảng 4×4, flood fill
   từ mép từng ô để xoá giấy, giữ phần trắng nằm trong viền mực như bi và bàn tay, xuất tối đa 128 px.
   Icon UI ở `public/art/ui/icons/`, được `src/ui/icons.ts` phục vụ qua `icon(name)`.
5. **Duyệt**: đóng vai người duyệt khó tính: so từng tranh với `look`, ảnh tham chiếu và các tướng
   khác. Loại ảnh sai giới tính, mặt/tóc/mắt/dấu nhận diện/trang phục/cơ; loại tướng giống nhau hoặc
   giống nhân vật đã có, chữ sai dấu, vật thể sai nghĩa, màu thừa, ánh kim hay lạc phong cách.
   Không chấp nhận chỉ vì ảnh đẹp. Khi vẽ lại tướng, **vẽ lại cả những cảnh truyện có tướng trong `cast`**.
6. **Đồng bộ nền**: `rebackground.sh WORK SECT [ids]` dùng ảnh cũ làm tham chiếu, chỉ vẽ lại nền chân
   dung và biểu cảm thành giấy dó, giữ nhân vật; chuyển bản cũ vào `raw/old/`, bỏ qua ảnh đã có nền giấy.
7. **Tranh truyện**: `gen-story-art.sh WORK [scenes]` đọc `scenes` và `cast` trong `story.json`, gửi
   cut-out của từng tướng trong cảnh làm tham chiếu kèm `look`; `vodanh` dùng `references/story-vodanh.webp`
   trong skill. Nếu thiếu cut-out của bất kỳ tướng nào trong cảnh, script bỏ qua cảnh để chạy lại sau.
   Bỏ qua PNG gốc đã có; đặt `REDO=1` để vẽ lại các cảnh được chỉ định, xuất vào
   `public/art/story/`.

8. **Tư thế kết liễu**: mỗi tướng có `champions/{id}/finisher.webp` cho hiệu ứng Kết liễu: cùng nhân vật với
   cut-out (gửi cut-out làm `--ref`, chèn toàn bộ `look`), lao người theo đường chéo từ trên trái xuống dưới
   phải, đầu cơ thúc về góc dưới phải, một vệt mực màu môn phái theo sau đầu cơ, nền trong suốt, khổ
   1536×1024. Xuất bản cắt sát, tối đa 820 px, webp chất lượng 74 (khoảng 230 KB mỗi tướng). Nếu thiếu tranh,
   game dùng cut-out.

## Phong cách

**Thuỷ Mặc.** Quy tắc đầy đủ: `.claude/skills/game-art/references/style-bible.md`.

- Tranh mực trên giấy dó: mực đen, một màu son, nhiều khoảng trống.
- Không phát sáng, không chữ vàng 3D.
- Tướng giữ tạo hình anime màu sắc trên giấy.
- Hiệu ứng dùng nét mực màu môn phái.
- Dấu ấn chỉ dùng son và đen.

**Quy tắc tài sản.**

- Mọi tranh, icon, minh hoạ và trang trí giao diện là tài sản nguyên bản, sinh riêng qua pipeline bằng model
  quy định.
- Không dùng ảnh internet, tài sản của tác phẩm khác, emoji, thư viện icon, hay SVG tự vẽ thay tranh.
- Code/shader chỉ được dựng vật thể mô phỏng như bi và bàn (hình học, số/sọc, màu, ánh sáng, xoay theo vật lý).
  Ngoại lệ này không áp dụng cho tranh, icon hay trang trí UI.
- Vật thể mang tính minh hoạ trong giao diện, kể cả ảnh xem cơ mặc định, vẫn dùng tranh qua pipeline.

## Ảnh gốc

- Ảnh gốc độ phân giải đầy đủ và prompt nằm **ngoài repo**, được lưu và sao lưu riêng.
- `public/art/` chỉ chứa bản đã xử lý cho game.
- Muốn vẽ lại hay vẽ thêm: đọc `.claude/skills/game-art/SKILL.md`, cấu hình `.env.image-api`, rồi chạy script
  với API và model quy định ở trên.
- Không đưa khoá API hay vị trí thư mục riêng vào tài liệu hoặc commit.

## Yêu cầu riêng cho tranh giao diện

- **Khung chín lát** (`ui/frame/*.webp`): ghi rõ trong prompt rằng phần giữa phẳng, đều, trống và hoa văn chỉ
  nằm ở hai đầu ngắn, để chữ không bao giờ đè lên hoa văn khi khung co giãn.
- **Nút hành động** (`ui/actions/*.webp`) gồm cả icon và chữ thư pháp tiếng Việt; DOM chỉ giữ tên trợ năng.
- **Cây cơ môn phái** (`sects/{id}/cue-a|b.webp`) có thể có tua rua hay chạm khắc chìa ra, nhưng thân cơ phía
  đầu cơ phải thẳng và đều, vì game đo bề dày phần đó để phóng.
- **Bản đồ Hành trình** (`ui/map.webp`, 3:2) phải khớp tuyến `CHAPTERS` trong `career.ts`; mốc tương tác trong
  `journey.ts` nằm đúng quảng trường trên tranh. Thay tranh thì duyệt lại cả đường nối và toạ độ mốc. Vì sao
  chọn phương án hiện tại: [decisions/journey-map.md](../decisions/journey-map.md).
