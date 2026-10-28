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
npm test           # vật lý, luật, AI, thử thách, tương phản bi–nỉ
npm run build      # typecheck + bản production vào dist/
```

## Quy tắc

- **Vật lý và luật là thật.** Mọi chiêu và Thiên Tượng phải biểu diễn bằng lực, ma sát, chướng ngại hoặc
  kích thước lỗ trong mô phỏng — không dịch chuyển bi tuỳ tiện. Lực nghiêng/gió phải nhỏ hơn lực cản lăn.
- **Không dùng tài sản của game khác.** Không dùng tên, hình, chiêu thức hay biểu tượng của bất kỳ game hay tác phẩm nào khác.
- **Giữ bi dễ nhìn.** Màu nỉ mới phải qua `tests/sect-contrast.test.ts` (ΔE ≥ 25 với mọi bi).
- **Giao diện theo Thuỷ Mặc** (`src/styles/main.css`): giấy, mực, một màu son, không phát sáng.
- **Mobile trước.** Kiểm tra màn hình ngang ~844×390, vùng chạm ≥ 44 px.
- Commit theo Conventional Commits (`feat:`, `fix:`, `docs:`…), mỗi commit một việc.

## Thêm một tướng

1. Thêm vào `src/game/content/roster.json`: `id`, `name`, `sect`, `tier`, `cls`, `look` (ghi rõ giới tính và
   một tổ hợp nét nhận diện không trùng tướng khác), `pose`, `expr`, 3 `skills` (`kinds` từ 24 nhóm cơ chế,
   `icon` mô tả icon).
2. Thêm tiểu sử và câu nói vào `src/game/content/lore.json`.
3. Vẽ tranh theo `.claude/skills/game-art/SKILL.md` (`gen-sect.sh <môn-phái> <thư-mục>` chỉ vẽ phần còn thiếu),
   duyệt bảng tổng hợp, chạy `process-sect.py` để xuất vào `public/art/`.
4. Cập nhật `docs/world-bible.md`, chạy `npm test`.

## Thêm một môn phái

Thêm môn phái vào `roster.json` (màu, bối cảnh, biểu tượng, 2 cây cơ), 5 tướng bậc 1–5, rồi:
`SectId` và các bảng `TABLE_LOOK` / `CUE_STATS` / `CUE_NAMES` trong `src/game/content/sects.ts`, Thiên Tượng
trong `src/game/terrain.ts` (`rollOmen` + `OMEN_INFO`), chương trong `src/game/content/career.ts`, mốc trên
bản đồ trong `src/ui/screens/journey.ts`, truyện trong `lore.json`.
