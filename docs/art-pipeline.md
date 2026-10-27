# Đồ hoạ: được tạo thế nào

Toàn bộ tranh trong game (65 tướng, 13 môn phái, icon chiêu, hiệu ứng, bản đồ, logo, icon ứng dụng, giao
diện) được **vẽ bằng mô hình sinh ảnh AI** theo prompt viết riêng cho game, rồi **duyệt thủ công từng
tấm**. Không có ảnh nào tải từ internet hay lấy từ game khác.

## Công cụ

| Công cụ | Model | Dùng cho |
|---|---|---|
| 9router (OpenAI-compatible API, chạy trên máy) | `cx/gpt-6-sol-image` (model ảnh của Codex) | phần lớn tranh: nhân vật (có ảnh tham chiếu), cảnh, icon, VFX, UI |
| Codex CLI | cùng model | nhân vật ở giai đoạn đầu |
| Antigravity CLI (`agy`) | Gemini image | cảnh và sprite ở giai đoạn đầu |

Script nằm trong skill `.claude/skills/game-art/` — `gen-image.sh` gọi một trong ba công cụ, gửi kèm ảnh
tham chiếu (giữ cùng gương mặt tướng) và ảnh mẫu phong cách (giữ cùng nét vẽ giữa các môn phái).

## Quy trình

1. **Thiết kế bằng chữ** — tạo hình từng tướng trong `src/game/content/roster.json` (giới tính, tuổi, tóc,
   trang phục, cây cơ, tư thế, nét nhận diện riêng), bối cảnh từng môn phái.
2. **Sinh prompt** — `build-prompts.py` ghép mô tả với các khối prompt cố định của style bible.
3. **Vẽ** — `gen-sect.sh` vẽ cả môn phái: ảnh tách nền gốc của tướng → chân dung chibi, tư thế ăn mừng,
   bảng 4 biểu cảm (dùng ảnh gốc làm tham chiếu) → splash, nền cut-in, bảng 16 icon, bảng 25 VFX, flipbook
   16 khung, viền bàn, 2 cây cơ.
4. **Cắt và xuất** — `process-sect.py` cắt lưới, tách nền, xuất webp đúng kích thước vào `public/art/`, dựng
   bảng tổng hợp để duyệt.
5. **Duyệt** — xem từng bảng tổng hợp; ảnh không đạt bị xoá và vẽ lại. Lý do loại thường gặp: giống nhân vật
   nổi tiếng (một tướng từng bị vẽ giống Kratos), sai giới tính, các tướng na ná nhau, chữ sai dấu, vật thể
   giống súng, lạc phong cách.
6. **Đồng bộ phong cách** — `rebackground.sh` vẽ lại riêng phần nền (giữ nguyên nhân vật) khi đổi hướng thiết
   kế, như lúc chuyển sang Thuỷ Mặc.

## Phong cách

**Thuỷ Mặc**: tranh mực trên giấy dó, mực đen, một màu son, nhiều khoảng trống, không phát sáng, không chữ
vàng 3D. Tướng giữ tạo hình anime màu sắc, đặt trên nền giấy có vệt mực màu môn phái. Hiệu ứng chiêu là nét
bút lông màu, vẽ phủ lên mặt bàn. Quy tắc đầy đủ: `.claude/skills/game-art/references/style-bible.md`.

## Ảnh gốc

Ảnh độ phân giải đầy đủ (PNG, nhân vật có nền trong suốt) và prompt đã dùng nằm ngoài repo, trong thư viện
`co-tien-gioi/art-master/` của tác giả (vài trăm MB, sao lưu riêng). `public/art/` chỉ chứa bản đã nén cho
game. Muốn vẽ lại hay vẽ thêm: đọc `.claude/skills/game-art/SKILL.md`, cấu hình `.env.image-api`
(mẫu: `.env.image-api.example`) rồi chạy `gen-sect.sh`.
