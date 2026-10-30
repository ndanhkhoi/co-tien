# Điều khiển trong trận

Nguồn: `src/ui/screens/match-screen.ts` (trận) và `practice-desk.ts` (Luyện thế).

Đây là hợp đồng với người chơi. Đổi một thao tác thì trong cùng thay đổi:

- cập nhật file này;
- chụp lại các ảnh README có màn đó ([guides/testing.md](../guides/testing.md#ảnh-chụp-cho-readme-và-docs)).

## Ngắm

- Kéo trên bàn xoay cơ tương đối quanh bi cái; kéo càng xa bi cái xoay càng chậm để ngắm tinh.
- Chạm một bi để ngắm thẳng vào nó, chạm chỗ trống để ngắm tới đó.
- Hai nút xoay chỉnh từng nấc nhỏ; giữ để xoay nhanh dần.

## Áp phê và nâng cơ

- **Giữ hoặc kéo** bi cái nhỏ: mở một bi lớn tạm thời, ngón tay dời điểm đánh, thả là đóng.
- **Chạm** bi cái nhỏ: mở bảng chỉnh chính xác — kéo điểm đánh trên bi lớn hoặc chọn nhanh (Giữa, Trô, Cule,
  Giật, Trái, Phải), và thanh Nâng cơ cho cú nhảy. Góc nâng cơ điều khiển cú nhảy vật lý 2.5D; bi có thể văng
  bàn và luật xử lý văng bàn phải giữ đúng.

## Lực và đánh

- Chạm thanh lực đặt mức tại điểm chạm, kéo để tinh chỉnh, rồi chạm **ĐÁNH**.
- Giữ ĐÁNH: lực dao động, thả để đánh; trượt ngón ra xa để huỷ.
- Sau mỗi cú (kể cả của máy) thanh lực giữ lực vừa đánh cho tới khi tới lượt một người chơi, rồi về mức riêng
  của người đó (mỗi bên Song Đấu giữ mức riêng).

## Gọi bi và thông tin

- Chạm một bi trên bàn hiện nhãn với ảnh và số bi. Trong Luyện thế chỉ chạm-thả mới hiện nhãn; kéo chỉ dời bi.
- Gọi lỗ bằng cách chạm lỗ. Lỗ đã gọi hiện trong ô mục tiêu phía trên; không có gì đặt trên băng bàn.
- 9 bi và 10 bi hiện hai bi tiếp theo, số in trên bi; chạm một bi hiện nhãn ngay trên bi đó ở bàn.
- Chân dung người tới lượt có mũi tên son nhấp nhô; mỗi thẻ có khay bi (8 bi: cả nhóm, bi còn trên bàn mờ).

## Bi trong tay

- Kéo bi cái hoặc chạm bàn để dời bi.
- Cụm nút hướng tròn chỉnh từng nấc nhỏ; giữ để nhanh dần.
- **Ngắm thử** chuyển sang ngắm để xem đường trước khi chốt; **Dời bi** quay lại đặt.
- Khi đang dời bi, cơ và tia ngắm ẩn.
- **ĐẶT BI** xác nhận vị trí, không đánh ngay.

## Chiêu (Tiên Đạo)

- Ba ô icon tranh riêng của tướng; chạm mở thẻ chi tiết, không thi triển ngay.
- Chiêu đặt bàn vào bước đặt: kéo/chạm bàn hoặc mũi tên, đổi chiều/băng (phím R), **THI TRIỂN** xác nhận,
  **Huỷ đặt chiêu** không tiêu chiêu.
- Tuyệt chiêu được ghi nhận khi xác nhận, nhưng diễn hoạt chờ ĐÁNH: khoá điều khiển → cut-in → hiệu ứng bàn →
  cơ vung → mô phỏng. Người và AI đi cùng luồng; tạm dừng và rời trận đều huỷ đúng.

## Thông báo và tạm dừng

- Thông báo giữa bàn đóng khi chạm bất kỳ đâu hoặc ✕. Công tắc *Thông báo giữa bàn* (Cài đặt, menu Tạm dừng)
  tắt chúng, trừ lỗi và thắng ván.
- Mỗi lượt hiện tối đa một mẹo (`hintTurn`).
- Menu Tạm dừng: tỉ số, ba công tắc nhanh (âm thanh, nhạc, thông báo) và một cột hành động. Thoát trận luôn
  hỏi xác nhận.
- Kết liễu: chạm để bỏ qua.

## Song Đấu và Luận Cơ

- **Song Đấu:** mỗi bên đặt tên, chọn tướng đã sở hữu (không trùng bên kia) và cơ; hai bên cùng chọn bàn.
  **Đổi tướng** bốc lại tướng cho cả hai từ các tướng đã sở hữu.
- **Luận Cơ:** **Đổi đối thủ** bốc lại tướng AI trong các bậc của cấp độ đã chọn.

Kiểm tra trên thiết bị: [guides/testing.md](../guides/testing.md).
