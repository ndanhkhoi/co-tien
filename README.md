# Cơ Tiên — bida × tu tiên

Game bida cho điện thoại (màn hình ngang) và máy tính, với vật lý và luật bida thật, đặt trong một thế giới
tiên hiệp riêng: **Cơ Tiên Giới** — 13 môn phái, 65 tướng, mỗi tướng có một nội tại và ba chiêu. Cài được như
ứng dụng (PWA), chơi offline, không cần tài khoản.

**Chơi ngay:** https://cotien.khoinda.vn/

## Có gì trong game

**Bida thật.**

- 8 bi, 9 bi, 10 bi theo luật WPA; bi-a phăng tự do và ba băng theo UMB.
- Bàn và bi đúng kích thước chuẩn.
- Ma sát trượt và lăn, spin ba trục, throw, squirt, áp phê đổi góc bật băng.
- Cú nhảy theo góc nâng cơ; bi có thể văng bàn.

**Tu tiên trên bàn bi.**

- **Tiên Đạo** bật chiêu, nội tại và địa thế; **Cổ Điển** là bida thuần.
- Mỗi chiêu và mỗi Thiên Tượng (gió, bão tuyết, sóng lừng, giếng sao…) là lực và ma sát thật trong mô phỏng,
  nên đường dự đoán luôn đúng.
- Năng lượng nạp theo độ khó và độ đẹp của cú đánh.
- Cú thắng ván mở màn **Kết liễu** riêng của từng tướng.

**Cách chơi**

| | |
|---|---|
| **Hành trình** | Bản đồ 13 vùng đất, thách đấu cao thủ để chiêu mộ họ |
| **Luận Cơ** | Đấu nhanh với máy: 4 cấp, 4 lối đánh, AI tìm cú bằng chính bộ mô phỏng |
| **Song Đấu** | Hai người chung một máy, mỗi bên chọn tướng và cơ riêng |
| **Luyện Cơ** | 60 thử thách có lời giải đã kiểm chứng, chấm sao |
| **Luyện thế** | Tự bày thế, đánh tự do, đánh lại, xem trước đường đi của mọi bi |
| **Tàng Các** | Tướng, Pháp Cơ, Linh Đài và Cơ Tiên Lục — wiki của thế giới |
| **Cơ Tiên Truyện** | Truyện chữ có tranh thuỷ mặc, 15 chương mở dần theo Hành trình |

**Làm cho điện thoại.**

- Điều khiển bằng chạm và kéo: [docs/gameplay/controls.md](docs/gameplay/controls.md).
- Giao diện nằm trong một khung 16:9, vừa mọi màn hình.
- Lần đầu tải trọn bộ tranh (khoảng 100 MB), sau đó chơi không phải chờ; bản cập nhật chỉ tải phần tranh đã đổi.

## Hình ảnh

Chụp ở 932×430, tướng của người chơi là Ngân Cầm.

![Trang chủ](docs/screenshots/trang-chu.webp)

| Luận Cơ | Song Đấu |
| --- | --- |
| ![Chọn trận Luận Cơ](docs/screenshots/luan-co.webp) | ![Song Đấu: mỗi bên chọn tướng, tên và Pháp Cơ](docs/screenshots/song-dau.webp) |
| **Trận đấu · mũi tên chỉ lượt** | **Tạm dừng** |
| ![Trận đấu: mũi tên son trên chân dung người tới lượt](docs/screenshots/tran-dau.webp) | ![Menu tạm dừng](docs/screenshots/tam-dung.webp) |
| **Chiêu thức** | **Tuyệt chiêu** |
| ![Thẻ chiêu thức](docs/screenshots/dat-chieu.webp) | ![Thẻ tuyệt chiêu](docs/screenshots/tuyet-chieu.webp) |
| **Kết liễu** | **Hành trình** |
| ![Hiệu ứng kết liễu khi thắng ván](docs/screenshots/ket-lieu.webp) | ![Bản đồ Hành trình](docs/screenshots/hanh-trinh.webp) |
| **Luyện thế · chọn thế** | **Luyện thế · Đường đi** |
| ![Chọn thế luyện](docs/screenshots/luyen-the-chon.webp) | ![Bàn Luyện thế với đường đi của mọi bi](docs/screenshots/luyen-the.webp) |
| **Tàng Các** | **Trang tướng** |
| ![Tàng Các](docs/screenshots/tang-cac.webp) | ![Thông tin tướng và ba icon kỹ năng](docs/screenshots/trang-tuong.webp) |
| **Cơ Tiên Lục** | **Cơ Tiên Truyện** |
| ![Cơ Tiên Lục trong Tàng Các](docs/screenshots/co-tien-luc.webp) | ![Đọc Cơ Tiên Truyện](docs/screenshots/co-tien-truyen.webp) |

Trên màn hình lớn (1280×800), khung 16:9 nằm giữa phông tranh, tướng đứng hai bên:

![Khung sân khấu trên desktop](docs/screenshots/desktop-san-khau.webp)

## Phát triển

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

- Công nghệ: TypeScript, Vite, PixiJS 8 (WebGL), vite-plugin-pwa, âm thanh tổng hợp bằng WebAudio. Không có
  server. Vì sao chọn từng thứ: [docs/architecture/tech-stack.md](docs/architecture/tech-stack.md).
- Deploy lên Cloudflare Pages mỗi khi push lên `main`.

Tài liệu:

- [docs/README.md](docs/README.md) — mục lục tài liệu: kiến trúc, lối chơi, thế giới, hướng dẫn, quyết định
- [CONTRIBUTING.md](CONTRIBUTING.md) — quy tắc và quy trình đóng góp
- [AGENTS.md](AGENTS.md) — quy tắc cho AI agent

## Ý tưởng, nội dung và đồ hoạ đến từ đâu

- **Ý tưởng và định hướng:** tác giả (Nguyễn Đức Anh Khôi) — game bida tu tiên, thế giới Cơ Tiên Giới, lối
  chơi, phong cách Thuỷ Mặc, tên game, và mọi quyết định duyệt hay loại nội dung.
- **Nguyên bản:** toàn bộ tên, truyện, môn phái, nhân vật, chiêu thức và tranh là sáng tác riêng cho Cơ Tiên,
  không dùng nội dung của bất kỳ game hay tác phẩm nào khác.
- **Viết nội dung và code:** phát triển cùng trợ lý AI (Claude, qua Claude Code) theo chỉ đạo của tác giả —
  trợ lý đề xuất và viết, tác giả chọn và duyệt.
- **Đồ hoạ:** toàn bộ tranh vẽ bằng mô hình sinh ảnh AI (`cx/gpt-6-sol-image` qua 9router) theo prompt viết
  riêng cho game, rồi duyệt và chỉnh từng tấm: [docs/guides/art-pipeline.md](docs/guides/art-pipeline.md).

## Giấy phép

Mã nguồn: MIT. Các agent skill bên thứ ba trong `.claude/skills` (trừ `game-art`) thuộc
[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills),
giấy phép Apache-2.0 — xem `.claude/skills/README.md`.
