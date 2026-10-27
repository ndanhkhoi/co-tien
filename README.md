# Thần Công Bida

Game bida kỹ năng cho điện thoại (màn hình ngang) và máy tính. Cài được như app (PWA) và chơi offline.

**Chơi ngay:** https://ndanhkhoi.github.io/than-cong-bida/

## Tính năng

- **Năm thể loại theo luật WPA (2026) và UMB:** 8 bi, 9 bi, 10 bi (gọi bi, gọi lỗ), bi-a phăng tự do và 3 băng.
  - Push-out ở 9 bi và 10 bi.
  - Thua ván khi phạm lỗi 3 lần liên tiếp (9 bi, 10 bi).
  - Luật phá 3 bi ở 9 bi (Regulation 16).
  - Người vào bàn được quyền chọn khi đối thủ phá không hợp lệ.
  - Gọi lỗ cho bi 8.
  - Đặt lại bi trên đường dọc của bàn, đúng luật WPA.
- **Xếp bi đúng luật:**
  - 8 bi: bi đỉnh nằm trên điểm chân bàn, bi 8 giữa hàng thứ ba, hai góc sau một bi trơn một bi sọc.
  - 9 bi: bi 1 ở đỉnh, bi 9 ở giữa và nằm trên điểm chân bàn.
  - 10 bi: bi 1 ở đỉnh, bi 10 giữa hàng thứ ba.
  - Carom: bi đỏ trên điểm chân bàn, bi của đối thủ trên điểm đầu bàn, bi cái lệch 18,25 cm.
- **Màu bi theo bộ Aramith truyền thống.** Số in trên hai vòng tròn trắng đối diện nhau, sọc nằm giữa thân bi. Bi cái có 6 chấm đỏ như bộ bi thi đấu truyền hình. Bi được vẽ bằng shader WebGL và lăn theo đúng vận tốc góc của mô phỏng.
- **Vật lý thật:**
  - Có ma sát trượt và ma sát lăn, nên các cú dừng bi, kéo bi, theo bi xảy ra tự nhiên.
  - Phê ngang làm đổi góc bật băng. Cắt bi có hiệu ứng throw. Đánh phê có hiệu ứng squirt.
  - Va chạm tính theo đúng thời điểm tiếp xúc.
  - Khi phá bi, khối bi khít được mô phỏng bằng tiếp xúc đàn hồi bước 3 µs, nên vỡ đối xứng và bảo toàn năng lượng.
  - Hàm lỗ dùng góc 142°/104° theo chuẩn WPA.
- **Thao tác như game native:**
  - Kéo trên bàn để xoay cơ.
  - Giữ nút ↺ ↻ để xoay liên tục, giữ càng lâu xoay càng nhanh.
  - Thanh TINH để chỉnh góc từng chút.
  - Bảng chọn điểm phê. Đặt điểm ra ngoài vòng đỏ thì có thể trượt cơ.
  - Giữ nút **ĐÁNH** để nạp lực. Kim lực chạy lên xuống, mỗi lượt nhanh hơn. Lực càng mạnh, giữ càng lâu thì tay càng run, nên có thể "lỡ tay" như ngoài đời. Kéo ngón tay ra xa nút để hủy.
  - Không chọn được text, không hiện menu khi giữ lâu, không zoom.
  - Rung haptic (trên Android), giữ màn hình luôn sáng.
- **AI 4 cấp độ, 4 lối đánh:**
  - Tìm cú đánh bằng mô phỏng vật lý: ăn thẳng, đánh băng, đi bi cho cú sau, phòng thủ, đặt bi trong tay, push-out.
  - Chạy trong Web Worker nên không làm giật hình.
  - Diễn hoạt như người thật: xoay cơ, ngắm, nạp lực rồi đánh.
- **Sự Nghiệp:** 5 chương với 15 đối thủ, mỗi người có tên, tính cách và lời thoại riêng. Đi từ quán đầu hẻm Sài Gòn đến giải Vô Địch Quốc Gia.
- **60 thử thách** chia 5 nhóm (ăn thẳng, cắt bi, đánh băng, đi bi, phăng). Thử thách được sinh tự động, và mỗi cái đều có lời giải đã được kiểm chứng bằng vật lý.
- **Kỹ năng lật kèo:** Thần Nhãn, Phê Thần, Thổi Bi, Bảo Hộ, Run Tay, Hồi Cục.
- **Biến thể bàn:** Bi Nổ, Hố Ma, Sương Mù, Nỉ Băng, Lỗ Hẹp.
- **Bộ sưu tập:** 6 cây cơ với chỉ số riêng và 5 mặt bàn.
- **Khác:** 2 người chơi cùng máy, chế độ thuận tay trái, xuất và nhập mã lưu.

## Phát triển

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # vật lý, luật, AI, 60 thử thách
npm run build          # bản production vào dist/
npm run gen:challenges # sinh lại bộ thử thách (có kiểm chứng lời giải)
npm run gen:icons      # sinh lại icon PNG
```

Công nghệ: TypeScript, Vite, PixiJS 8 (WebGL) và vite-plugin-pwa. Âm thanh được tổng hợp bằng WebAudio, không dùng file âm thanh nào.

```
src/core     vật lý, hình học bàn, xếp bi, luật (8/9/10 bi, carom), dự đoán đường ngắm
src/ai       AI tìm cú đánh (chạy trong Web Worker)
src/game     trận đấu (state machine), nội dung (cơ, bàn, kỹ năng, NPC, thử thách), hồ sơ người chơi
src/render   PixiJS: bàn vẽ thủ công, shader bi, cơ, đường ngắm, hiệu ứng
src/ui       màn hình, HUD, điều khiển cảm ứng
tools        sinh thử thách, sinh icon
tests        vitest
```

## Giấy phép

MIT
