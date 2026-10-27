# Đồ hoạ: được tạo thế nào

Toàn bộ tranh trong game (tướng, môn phái, icon chiêu, hiệu ứng, bản đồ, logo, icon ứng dụng, giao diện)
được **vẽ bằng mô hình sinh ảnh AI** theo prompt riêng, rồi **duyệt nghiêm từng tấm**. Không tải ảnh từ
internet hay lấy từ tác phẩm khác.

## Công cụ

| Công cụ | Model | Dùng cho |
|---|---|---|
| Image API (`--tool api`) | **`cx/gpt-6-sol-image` duy nhất** | mọi tranh mới và tranh vẽ lại, có ảnh tham chiếu khi cần |
| Codex CLI (`--tool codex`) | tuỳ cấu hình CLI | tuỳ chọn cũ còn trong script, không dùng trong quy trình hiện tại |
| Antigravity CLI (`--tool agy`) | tuỳ cấu hình CLI | tuỳ chọn cũ; tài khoản agy không còn dùng được |

Script nằm trong `.claude/skills/game-art/`. API là lựa chọn mặc định của **quy trình**; hiện
`gen-image.sh` và `gen-sect.sh` vẫn có mặc định công cụ cũ, nên phải truyền `--tool api` hoặc đặt biến:

```bash
GEN_NO_FALLBACK=1 GEN_CHAR_TOOL=api GEN_REF_TOOL=api GEN_SHEET_TOOL=api \
  .claude/skills/game-art/scripts/gen-sect.sh SECT WORK
```

Đặt `IMAGE_API_MODEL=cx/gpt-6-sol-image` trong `.env.image-api` (gitignored), nơi giữ khoá API.
Không đổi model hay chuyển sang CLI khi lỗi; `GEN_NO_FALLBACK=1` tắt cơ chế chuyển công cụ dự phòng.

## Quy trình

1. **Thiết kế bằng chữ** — `src/game/content/roster.json` giữ `look` của từng tướng: giới tính, tuổi,
   tóc, trang phục, cây cơ, dấu hiệu riêng; cùng dữ liệu môn phái và chiêu.
2. **Sinh prompt** — `build-prompts.py` ghép đề bài với khối phong cách. Prompt chân dung, biểu cảm và
   ăn mừng đều chèn **toàn bộ `look`**, dưới chỉ dẫn “Character spec … must match”. Icon dùng mực đen
   và một màu nhấn môn phái, cấm phát sáng, ánh kim và màu thừa; ô biểu tượng là dấu son + đen.
   Flipbook dùng mực màu môn phái, mép cọ trắng giấy, cấm glow và mảng trắng sáng. Khi duyệt prompt,
   áp dụng chung quy tắc không ánh kim, không màu thừa cho icon, biểu tượng và flipbook.
3. **Vẽ** — `gen-sect.sh` vẽ cut-out trước cho từng tướng, rồi chân dung và tư thế ăn mừng tham chiếu
   cut-out; bảng 2×2 biểu cảm tham chiếu chân dung. Script còn vẽ splash, cut-in, bảng 4×4 icon,
   bảng 5×5 VFX, flipbook 4×4, viền bàn và hai cây cơ; bỏ qua ảnh gốc đã có.
4. **Cắt và xuất** — `process-sect.py` cắt lưới, tách nền và xuất webp vào `public/art/`, tạo bảng duyệt.
   Riêng icon UI dùng `slice-ui-icons.py SHEET.png OUT_DIR name1 … name16`: cắt bảng 4×4, flood fill
   từ mép từng ô để xoá giấy, giữ phần trắng nằm trong viền mực như bi và bàn tay, xuất tối đa 128 px.
   Icon UI ở `public/art/ui/icons/`, được `src/ui/icons.ts` phục vụ qua `icon(name)`.
5. **Duyệt** — đóng vai người duyệt khó tính: so từng tranh với `look`, ảnh tham chiếu và các tướng
   khác. Loại ảnh sai giới tính, mặt/tóc/mắt/dấu nhận diện/trang phục/cơ; loại tướng giống nhau hoặc
   giống nhân vật đã có, chữ sai dấu, vật thể sai nghĩa, màu thừa, ánh kim hay lạc phong cách.
   Không chấp nhận chỉ vì ảnh đẹp. Khi vẽ lại tướng, **vẽ lại cả những cảnh truyện có tướng trong `cast`**.
6. **Đồng bộ nền** — `rebackground.sh WORK SECT [ids]` dùng ảnh cũ làm tham chiếu, chỉ vẽ lại nền chân
   dung và biểu cảm thành giấy dó, giữ nhân vật; chuyển bản cũ vào `raw/old/`, bỏ qua ảnh đã có nền giấy.
7. **Tranh truyện** — `gen-story-art.sh WORK [scenes]` đọc `scenes` và `cast` trong `story.json`, gửi
   cut-out của từng tướng trong cảnh làm tham chiếu kèm `look`; `vodanh` dùng `references/story-vodanh.webp`
   trong skill. Nếu thiếu cut-out của bất kỳ tướng nào trong cảnh, script bỏ qua cảnh để chạy lại sau.
   Mặc định dùng API và bỏ qua PNG gốc đã có; đặt `REDO=1` để vẽ lại các cảnh được chỉ định, xuất vào
   `public/art/story/`. Khi chạy, đặt thêm `GEN_NO_FALLBACK=1`.

## Phong cách

**Thuỷ Mặc**: tranh mực trên giấy dó, mực đen, một màu son, nhiều khoảng trống, không phát sáng, không chữ
vàng 3D. Tướng giữ tạo hình anime màu sắc trên giấy; hiệu ứng dùng nét mực màu môn phái. Dấu ấn chỉ dùng
son và đen. Quy tắc đầy đủ: `.claude/skills/game-art/references/style-bible.md`.

**Quy tắc tài sản:** mọi hình đồ hoạ trong game phải là tranh được vẽ qua pipeline; không tự vẽ SVG,
không dùng emoji hay thư viện icon. Đây là quy tắc cho nội dung mới và thay thế; mã hiện tại vẫn còn
`ballArt`/`cueArt` vẽ SVG trong `src/ui/icons.ts`, còn bi trên bàn dùng shader.

## Ảnh gốc

Ảnh gốc độ phân giải đầy đủ và prompt nằm **ngoài repo**, được lưu và sao lưu riêng. `public/art/` chỉ
chứa bản đã xử lý cho game. Muốn vẽ lại hay vẽ thêm: đọc `.claude/skills/game-art/SKILL.md`, cấu hình
`.env.image-api` rồi chạy script với API và model được quy định ở trên. Không đưa khoá hay vị trí thư
mục riêng vào tài liệu hoặc commit.
