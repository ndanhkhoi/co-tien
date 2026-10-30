---
name: game-art
description: Vẽ mới hoặc vẽ lại tài sản nguyên bản cho Cơ Tiên qua 9router, chỉ model cx/gpt-6-sol-image; cắt, tách nền và xuất webp vào public/art. Dùng cho nhân vật, cảnh truyện, icon, biểu tượng, VFX và giao diện.
---

# Game art pipeline

Mọi tranh, icon, minh hoạ và trang trí UI phải được sinh riêng, nguyên bản cho Cơ Tiên qua 9router với model `cx/gpt-6-sol-image`; không tải từ internet, không dùng nhân vật, tên hay biểu tượng của tác phẩm khác, không tự vẽ SVG, không emoji hoặc thư viện icon. Code/shader chỉ được vẽ vật thể mô phỏng như bi và bàn (hình học, số/sọc, màu, ánh sáng và xoay theo vật lý); không dùng ngoại lệ này để thay tranh, icon hay trang trí UI.
Đọc trước khi vẽ:

- `docs/world/world-bible.md` — môn phái, hệ, tướng, chiêu
- `references/style-bible.md` — phong cách, bảng màu, nền, kích thước
- `references/prompt-templates.md` — khối prompt theo loại tài sản

## Tools

| Script | Công dụng |
|---|---|
| `scripts/gen-image.sh --out f.png --prompt-file p.txt [--ref r.png]` | sinh một ảnh, có thể gửi nhiều ảnh tham chiếu |
| `scripts/gen-sect.sh SECT WORK` | sinh prompt và bộ ảnh môn phái, bỏ qua ảnh gốc đã có |
| `scripts/rebackground.sh WORK SECT [ids]` | thay nền chân dung/biểu cảm thành giấy dó, giữ nhân vật; ảnh cũ vào `raw/old/`, bỏ qua ảnh đã trên giấy |
| `scripts/gen-story-art.sh WORK [scenes]` | minh hoạ từ `story.json`, xuất `public/art/story/`; `REDO=1` để vẽ lại |
| `scripts/slice-grid.py sheet.png --rows R --cols C --out dir --names a,b,… --key none\|black\|alpha\|green [--trim] --size N` | cắt lưới, tách nền, xuất webp |
| `scripts/slice-ui-icons.py sheet.png OUT_DIR name1 … name16` | cắt bảng icon UI 4×4, xoá giấy bằng flood fill từ mép ô, giữ bi/bàn tay trắng trong viền mực; xuất tối đa 128 px |

## Cài đặt và bắt đầu

Cài `bash`, `curl`, `jq`, ImageMagick (`magick`), Python 3 và Pillow cho các script sinh và xử lý ảnh.
Từ thư mục gốc repo:

```bash
cp .env.image-api.example .env.image-api
```

Điền `IMAGE_API_BASE` (URL API 9router, gồm `/v1`) và `IMAGE_API_KEY` vào `.env.image-api`.
Model là `cx/gpt-6-sol-image`. File cấu hình được gitignore; không đưa khoá, host hay vị trí thư mục
riêng vào tài liệu hoặc commit. Xem các thiết lập chất lượng, nền trong suốt và ảnh tham chiếu trong
file mẫu.

Sinh một ảnh từ prompt hoặc cả bộ môn phái:

```bash
.claude/skills/game-art/scripts/gen-image.sh --out /path/to/art/image.png --prompt-file /path/to/art/prompt.txt
.claude/skills/game-art/scripts/gen-sect.sh SECT /path/to/art
```

Ảnh tham chiếu được gửi qua `--ref`; dùng `--style-ref` để khớp phong cách mà không sao chép nhân vật.
Khi request lỗi, script trả mã lỗi và đường dẫn response để kiểm tra trước khi chạy lại.
Ảnh gốc và prompt lưu ngoài repo; chỉ bản đã xử lý đi vào `public/art/`.

## Workflow per sect

1. **Cut-out trước** cho từng tướng: ảnh định nghĩa nhân vật, nền trong suốt.
2. **Chân dung chibi và tư thế ăn mừng** dùng cut-out làm `--ref`; **bảng biểu cảm 2×2** (tập trung,
   vui, buồn/bực, thi triển) dùng chân dung làm `--ref`. `build-prompts.py` chèn toàn bộ `look` từ
   `roster.json` vào cả ba loại prompt, dưới câu “Character spec … must match”. Giữ mọi dấu nhận diện,
   đạo cụ, bạn đồng hành và cây cơ đặc trưng.
3. **Splash môn phái và dải cut-in**.
4. **Bảng icon 4×4**: 3 chiêu × 5 tướng + biểu tượng. Prompt hiện dùng nền giấy, mực đen và một màu
   nhấn môn phái; cấm glow, ánh kim, màu thừa và khối 3D bóng. Ô biểu tượng chỉ son + đen.
   Kiểm tra nền thực tế trước khi tách; không mặc định dùng `--key black` cho bảng nền giấy.
5. **Bảng VFX 5×5**: các phần tử theo template, mực màu môn phái với mép cọ trắng giấy, nền trong suốt.
6. **Flipbook 4×4**: giọt mực nở thành biểu tượng rồi tan; cùng tâm và tỷ lệ, không trim từng khung.
   Prompt hiện cấm glow, ký hiệu trắng sáng và mảng màu đặc bão hoà. Quy tắc duyệt thêm: không ánh kim,
   không màu thừa; một màu nhấn môn phái, dấu ấn chỉ son + đen.
7. **Viền bàn và hai cây cơ**; xem script và prompt hiện tại cho danh sách thực sự được sinh.
8. Chạy `process-sect.py`, mở ảnh và bảng tổng hợp để duyệt nghiêm từng tấm. So với `look`, cut-out,
   chân dung và toàn bộ tướng khác: mặt, tóc, mắt, dấu nhận diện, giới tính, trang phục, đạo cụ, cây cơ,
   màu và dáng. Loại ảnh giống nhân vật đã có, tướng na ná nhau, sai spec, chữ, cắt cụt hoặc lạc phong
   cách; ảnh đẹp nhưng sai vẫn phải vẽ lại.

Khi vẽ lại một tướng, tìm mọi cảnh có id đó trong `story.json` → `cast`, rồi **vẽ lại cả các cảnh ấy**:
`REDO=1 scripts/gen-story-art.sh WORK scene1 scene2 …`.
Script đọc `scenes` và `cast`, gửi cut-out của từng tướng cùng `look` làm tham chiếu; `vodanh` dùng
`references/story-vodanh.webp`. Thiếu cut-out của bất kỳ tướng nào thì bỏ qua cảnh, báo chờ; chạy lại
sau khi đã có ảnh. Mặc định bỏ qua PNG gốc đã có, xuất webp vào `public/art/story/`.

## Output layout (`public/art/`)

```
public/art/
  champions/{id}/portrait.webp  cutout.webp  win.webp  finisher.webp  expr-{focus|joy|sad|cast}.webp
  sects/{sect}/emblem.webp  splash.webp  cutin.webp  felt.webp  rail.webp  cue-a.webp  cue-b.webp
  sects/{sect}/vfx/{element}.webp
  sects/{sect}/flip/{00..15}.webp
  skills/{champion}-{1|2|u}.webp
  story/{scene}.webp
  ui/{name}.webp
  ui/frame/{name}.webp   (khung 9 lát: band, plate, scroll, panel, stage; close-seal)
  ui/icons/{name}.webp
```

Id khớp dữ liệu `src/game/content/`. Icon UI được `src/ui/icons.ts` cung cấp qua `icon(name)`.
Mọi file `.webp` dưới `public/art/` tự vào manifest của bộ tải ảnh (`src/platform/preload.ts`) kèm mã nội dung:
lần đầu người chơi tải trọn bộ, bản sau chỉ tải lại file có nội dung đổi. Không cần sửa `vite.config.ts` khi thêm tranh.

`finisher.webp` (Kết liễu): cùng nhân vật với cut-out (gửi cut-out làm `--ref`, chèn `look`), lao người theo đường
chéo trên trái xuống dưới phải, đầu cơ thúc về góc dưới phải, vệt mực màu môn phái sau đầu cơ, nền trong suốt,
`--size 1536x1024`; xuất cắt sát, tối đa 820 px, webp q74. Khung 9 lát cho chữ: prompt nêu rõ phần giữa phẳng và
trống, trang trí chỉ ở hai đầu ngắn; cắt sát thân khung theo chiều dọc trước khi dùng.

## How VFX turns into skill animation

Thuỷ Mặc: hiệu ứng là nét cọ mực màu, mép trắng giấy trên nền trong suốt, ghép lên nỉ bằng normal
blending, không cộng ánh sáng. `src/render/skill-fx.ts` chuyển các phần tử tĩnh thành vòng mực, nét
chém, hạt, xích, bùa, xoáy và flipbook. `src/ui/skill-cutin.ts` diễn hoạt cut-out, dải mực và tên chiêu.
Chọn phần tử theo nhóm cơ chế để cùng một loại chiêu dễ nhận ra giữa các môn phái.
