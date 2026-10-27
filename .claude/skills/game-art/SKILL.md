---
name: game-art
description: Vẽ mới hoặc vẽ lại tài sản nguyên bản cho Cơ Tiên qua image API, chỉ model cx/gpt-6-sol-image; cắt, tách nền và xuất webp vào public/art. Dùng cho nhân vật, cảnh truyện, icon, biểu tượng, VFX và giao diện.
---

# Game art pipeline

Mọi tranh phải được sinh riêng cho Cơ Tiên, không tải từ internet, không dùng nhân vật, tên hay biểu
tượng của tác phẩm khác. Mọi hình đồ hoạ phải là painted asset: không tự vẽ SVG, không emoji, không
thư viện icon. Đây là quy tắc làm nội dung; mã hiện tại vẫn còn `ballArt`/`cueArt` vẽ SVG trong
`src/ui/icons.ts`, bi trên bàn dùng shader.
Đọc trước khi vẽ:

- `docs/world-bible.md` — môn phái, hệ, tướng, chiêu
- `references/style-bible.md` — phong cách, bảng màu, nền, kích thước
- `references/prompt-templates.md` — khối prompt theo loại tài sản

## Tools

| Script | Công dụng |
|---|---|
| `scripts/gen-image.sh --tool api --out f.png --prompt-file p.txt [--ref r.png]` | sinh một ảnh, có thể gửi nhiều ảnh tham chiếu |
| `scripts/gen-sect.sh SECT WORK` | sinh prompt và bộ ảnh môn phái, bỏ qua ảnh gốc đã có |
| `scripts/rebackground.sh WORK SECT [ids]` | thay nền chân dung/biểu cảm thành giấy dó, giữ nhân vật; ảnh cũ vào `raw/old/`, bỏ qua ảnh đã trên giấy |
| `scripts/gen-story-art.sh WORK [scenes]` | minh hoạ từ `story.json`, xuất `public/art/story/`; `REDO=1` để vẽ lại |
| `scripts/slice-grid.py sheet.png --rows R --cols C --out dir --names a,b,… --key none\|black\|alpha\|green [--trim] --size N` | cắt lưới, tách nền, xuất webp |
| `scripts/slice-ui-icons.py sheet.png OUT_DIR name1 … name16` | cắt bảng icon UI 4×4, xoá giấy bằng flood fill từ mép ô, giữ bi/bàn tay trắng trong viền mực; xuất tối đa 128 px |

**Mặc định của quy trình là API, chỉ model `cx/gpt-6-sol-image`.** Cấu hình model này trong
`.env.image-api` (gitignored), nơi giữ khoá API. Không ghi khoá, host hay vị trí thư mục riêng vào tài liệu.
`codex` và `agy` vẫn là lựa chọn trong script, nhưng không dùng cho quy trình hiện tại; tài khoản agy
không còn dùng được. Không đổi model hoặc tự chuyển công cụ khi lỗi.

Hiện `gen-image.sh` vẫn mặc định `codex`; `gen-sect.sh` mặc định nhân vật `codex`, bảng ảnh `agy`.
Vì vậy luôn truyền `--tool api` khi gọi trực tiếp, đặt `GEN_NO_FALLBACK=1`, và chạy cả môn phái bằng:

```bash
GEN_NO_FALLBACK=1 GEN_CHAR_TOOL=api GEN_REF_TOOL=api GEN_SHEET_TOOL=api \
  .claude/skills/game-art/scripts/gen-sect.sh SECT WORK
```

`rebackground.sh` và `gen-story-art.sh` đã mặc định `GEN_TOOL=api`; vẫn đặt `GEN_NO_FALLBACK=1`.
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
`GEN_NO_FALLBACK=1 REDO=1 scripts/gen-story-art.sh WORK scene1 scene2 …`.
Script đọc `scenes` và `cast`, gửi cut-out của từng tướng cùng `look` làm tham chiếu; `vodanh` dùng
`references/story-vodanh.webp`. Thiếu cut-out của bất kỳ tướng nào thì bỏ qua cảnh, báo chờ; chạy lại
sau khi đã có ảnh. Mặc định bỏ qua PNG gốc đã có, xuất webp vào `public/art/story/`.

## Output layout (`public/art/`)

```
public/art/
  champions/{id}/portrait.webp  cutout.webp  win.webp  expr-{focus|joy|sad|cast}.webp
  sects/{sect}/emblem.webp  splash.webp  cutin.webp  felt.webp  rail.webp  cue-a.webp  cue-b.webp
  sects/{sect}/vfx/{element}.webp
  sects/{sect}/flip/{00..15}.webp
  skills/{champion}-{1|2|u}.webp
  story/{scene}.webp
  ui/{name}.webp
  ui/icons/{name}.webp
```

Id khớp dữ liệu `src/game/content/`. Icon UI được `src/ui/icons.ts` cung cấp qua `icon(name)`.
Kiểm tra `vite.config.ts` khi thêm tài sản cần tải sẵn: mẫu `art/ui/*.webp` hiện không bao gồm
thư mục con `ui/icons/`; ảnh trong `art/` có cache lúc tải lần đầu.

## How VFX turns into skill animation

Thuỷ Mặc: hiệu ứng là nét cọ mực màu, mép trắng giấy trên nền trong suốt, ghép lên nỉ bằng normal
blending, không cộng ánh sáng. `src/render/skill-fx.ts` chuyển các phần tử tĩnh thành vòng mực, nét
chém, hạt, xích, bùa, xoáy và flipbook. `src/ui/skill-cutin.ts` diễn hoạt cut-out, dải mực và tên chiêu.
Chọn phần tử theo nhóm cơ chế để cùng một loại chiêu dễ nhận ra giữa các môn phái.
