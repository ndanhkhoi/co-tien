# Cơ Tiên — bida tu tiên

Game bida cho điện thoại (màn hình ngang) và máy tính, với vật lý và luật bida thật, đặt trong một thế giới
tiên hiệp riêng: **Cơ Tiên Giới** — 13 môn phái, 65 tướng, mỗi tướng có nội tại và 3 chiêu. Cài được như ứng
dụng (PWA), chơi offline.

**Chơi ngay:** https://ndanhkhoi.github.io/co-tien/

## Tính năng

- **Bida thật**
  - 8 bi, 9 bi, 10 bi theo luật WPA 2026 (push-out, 3 lỗi liên tiếp, luật phá 3 bi, quyền chọn sau phá
    không hợp lệ, gọi bi gọi lỗ) và bi-a phăng tự do, 3 băng theo UMB.
  - Kích thước chuẩn WPA: bàn 7 ft, bi 57,15 mm, miệng lỗ góc 117,5 mm và lỗ giữa 130 mm, hàm lỗ 142°/104°.
  - Vật lý: ma sát trượt và lăn, spin ba trục, throw, squirt, áp phê đổi góc bật băng, phá bi bảo toàn năng
    lượng. Cú nhảy dùng góc nâng cơ, lực và điểm chạm trong mô hình 2.5D; nâng cao cần đánh gần tâm hơn, bi có thể văng bàn. Màu bi theo bộ Aramith truyền thống, vẽ bằng shader và lăn theo vận tốc góc thật.
- **Hai chế độ cho mọi thể loại:** **Tiên Đạo** (chiêu, nội tại, địa thế) và **Cổ Điển** (bida thuần).
- **Địa thế:** mỗi môn phái có Linh Đài riêng (màu nỉ, ma sát, độ nảy băng, miệng lỗ) và Thiên Tượng ngẫu
  nhiên — bão tuyết, sóng lừng, gió giật, giếng sao, rễ cây… — đều là lực và ma sát thật trong mô phỏng,
  báo trước và vẽ lên bàn. Địa Lợi cho tướng đánh trên bàn quê nhà.
- **Luận Cơ:** so tài nhanh với máy. **Song Đấu:** hai người luân phiên trên cùng một thiết bị.
- **Luyện Cơ:** luyện từng cú đánh qua các bài thế có lời giải; **Luyện thế** (mở từ Luyện Cơ) cho kéo xếp bi ngay trên bàn lỗ hoặc bàn phăng thật, rồi đánh tự do không luật, không đổi lượt và đặt lại thế bất cứ lúc nào. **Tàng Các:** chiêu mộ tướng, chọn cơ và bàn.
- **Hành trình:** bản đồ Cơ Tiên Giới; mỗi vùng có 5 cao thủ để thách đấu (thắng thì chiêu mộ được) và các
  thử thách. 60 thử thách được sinh tự động, mỗi bài có lời giải đã kiểm chứng bằng vật lý.
- **Cơ Tiên Truyện:** truyện chữ có tranh minh hoạ thuỷ mặc, 15 chương mở dần theo Hành trình — một câu
  chuyện riêng của Cơ Tiên Giới, lấy cảm hứng từ cách kể của truyện cổ Việt Nam và Trung Hoa.
- **Cơ Tiên Lục:** wiki trong game về vùng đất, tướng, hệ và luật chơi; tướng chưa gặp hiện "???".
- **Điều khiển cảm ứng:** kéo/chạm trên bàn và nút xoay để ngắm, kéo bi cái hoặc dùng nút hướng để
  đặt bi; chuyển “Ngắm thử” để canh đường trước khi chốt. Chọn điểm áp phê trên bi, chỉnh thanh lực rồi
  chạm ĐÁNH hoặc giữ–thả để nạp lực; rung, giữ màn hình sáng; bắt cài app và xoay ngang trên điện thoại, kiểm tra kích thước cửa
  sổ trên máy tính.
- **AI 4 cấp, 4 lối đánh:** tìm cú đánh bằng chính bộ mô phỏng (kể cả địa thế), chạy trong Web Worker.
- **Người mới:** giới thiệu thế giới, gợi ý đúng lúc, luật chơi đầy đủ trong menu tạm dừng.

### Hình ảnh trong game

Ảnh chụp bằng Chromium giả lập cảm ứng ở 932×430 CSS pixel; game giữ khung 16:9 và scale đều theo màn hình.

| Trang chủ | Luận Cơ |
| --- | --- |
| ![Trang chủ](docs/screenshots/trang-chu.webp) | ![Chọn trận Luận Cơ](docs/screenshots/luan-co.webp) |
| Trận đấu · chạm bi để xem số | Chiêu thức |
| ![Trận đấu, chạm bi hiện số bi](docs/screenshots/tran-dau.webp) | ![Thẻ chiêu thức](docs/screenshots/dat-chieu.webp) |
| Tuyệt chiêu | Trang tướng |
| ![Thẻ tuyệt chiêu](docs/screenshots/tuyet-chieu.webp) | ![Thông tin tướng và ba icon kỹ năng](docs/screenshots/trang-tuong.webp) |
| Hành trình | Cơ Tiên Truyện |
| ![Bản đồ Hành trình](docs/screenshots/hanh-trinh.webp) | ![Đọc Cơ Tiên Truyện](docs/screenshots/co-tien-truyen.webp) |
| Luyện thế | Màn hình lớn |
| ![Xếp bi trong Luyện thế](docs/screenshots/luyen-the.webp) | ![Khung sân khấu trên desktop](docs/screenshots/desktop-san-khau.webp) |

## Phát triển

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # vật lý, luật, AI, thử thách, tương phản bi–nỉ
npm run build          # typecheck + bản production vào dist/
npm run gen:challenges # sinh lại bộ thử thách (có kiểm chứng lời giải)
```

TypeScript, Vite, PixiJS 8 (WebGL), vite-plugin-pwa. Âm thanh tổng hợp bằng WebAudio, không có file âm
thanh. Tài liệu: [kiến trúc](docs/architecture.md) · [thế giới](docs/world-bible.md) · [cốt truyện](docs/story.md) ·
[đồ hoạ](docs/art-pipeline.md) · [đóng góp](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) cho AI agent.

## Ý tưởng, nội dung và đồ hoạ đến từ đâu

- **Ý tưởng và định hướng:** tác giả (Nguyễn Đức Anh Khôi) — game bida tu tiên, thế giới Cơ Tiên Giới,
  các lựa chọn về lối chơi, phong cách Thuỷ Mặc, tên game, và mọi quyết định duyệt hay loại nội dung.
- **Nguyên bản:** toàn bộ tên, truyện, môn phái, nhân vật, chiêu thức và tranh là sáng tác riêng cho Cơ Tiên,
  không dùng nội dung của bất kỳ game hay tác phẩm nào khác.
- **Viết nội dung và code:** được phát triển cùng trợ lý AI (Claude, qua Claude Code) theo chỉ đạo của tác
  giả — trợ lý đề xuất và viết, tác giả chọn và duyệt.
- **Đồ hoạ:** toàn bộ tranh được vẽ bằng mô hình sinh ảnh AI (`cx/gpt-6-sol-image` qua
  9router) theo prompt viết riêng cho game, rồi duyệt và chỉnh từng
  tấm. Quy trình, công cụ và tiêu chí duyệt: [docs/art-pipeline.md](docs/art-pipeline.md) và skill
  `.claude/skills/game-art`.

## Giấy phép

Mã nguồn: MIT. Các agent skill bên thứ ba trong `.claude/skills` (trừ `game-art`) thuộc
[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills),
giấy phép Apache-2.0 — xem `.claude/skills/README.md`.

> Ảnh trong bảng trên được chụp lại từ bản UI hiện tại sau vòng review asset ngày 28/10/2026.
