# Điều khiển trong trận

Nguồn: `src/ui/screens/match/` (trận) và `src/ui/screens/practice/desk.ts` (Luyện thế).

Đây là hợp đồng với người chơi. Đổi một thao tác thì trong cùng thay đổi:

- cập nhật file này;
- chụp lại các ảnh README có màn đó ([guides/testing.md](../guides/testing.md#ảnh-chụp-cho-readme-và-docs)).

## Ngắm

- Kéo trên bàn xoay cơ tương đối quanh bi cái; kéo càng xa bi cái xoay càng chậm để ngắm tinh.
- Chạm một bi để ngắm thẳng vào nó, chạm chỗ trống để ngắm tới đó.
- Hai nút xoay chỉnh từng nấc nhỏ; giữ để xoay nhanh dần.

## Đặt chiêu

- Kéo hoặc chạm bàn chỉ dời tâm vùng đặt; hướng giữ nguyên.
- Khi đang đặt chiêu, hai nút xoay, phím mũi tên trái/phải, Q/E và con lăn chuột xoay hướng chiêu (bấm giữ xoay nhanh dần).
- Hướng ban đầu là hướng ngắm hiện tại. `R` đổi chiều xoáy hoặc độ băng mềm/cứng.

## Áp phê và nâng cơ

- **Giữ hoặc kéo** bi cái nhỏ: mở một bi lớn tạm thời, ngón tay dời điểm đánh, thả là đóng.
- **Chạm** bi cái nhỏ: mở bảng chỉnh chính xác: kéo điểm đánh trên bi lớn hoặc chọn nhanh (Giữa, Trô, Cule,
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
- Mỗi thẻ cũng gắn chip ảnh hưởng đang tác dụng cho bên đó (run tay, giảm lực, che mắt, dắt lệch, phong lỗ,
  bi chỉ định, bi giả, phản chiêu úp) cùng số lượt còn lại. Chiêu úp chỉ ghi “một chiêu đang úp”, không lộ tên.
- Khi bị dắt lệch, ô mục tiêu ghi rõ “Hướng bị dắt lệch X°”; trên nỉ vẫn có chấm son theo hướng thật.
- Bi bị chỉ định có vòng son quanh bi, ô mục tiêu yêu cầu “phải chạm bi đó trước”.

## Bi trong tay

- Kéo bi cái hoặc chạm bàn để dời bi.
- Cụm nút hướng tròn chỉnh từng nấc nhỏ; giữ để nhanh dần.
- **Ngắm thử** chuyển sang ngắm để xem đường trước khi chốt; **Dời bi** quay lại đặt.
- Khi đang dời bi, cơ và tia ngắm ẩn.
- **ĐẶT BI** xác nhận vị trí, không đánh ngay.

## Chiêu (Tiên Đạo)

- Ba ô icon tranh riêng của tướng; chạm mở thẻ chi tiết, không thi triển ngay.
- Chiêu đặt bàn vào bước đặt: kéo/chạm bàn hoặc mũi tên dời tâm; xoay hướng bằng nút xoay, phím mũi tên trái/phải, Q/E
  hoặc con lăn chuột; đổi chiều/băng (phím R); **THI TRIỂN** xác nhận, **Huỷ đặt chiêu** không tiêu chiêu.
- Tuyệt chiêu được ghi nhận khi xác nhận, nhưng diễn hoạt chờ ĐÁNH. Thứ tự là khoá điều khiển, cut-in, hiệu ứng
  bàn, cơ vung, rồi mô phỏng. Người và AI đi cùng luồng; tạm dừng và rời trận đều huỷ đúng.
- Khuynh thành chuyển tay điều khiển trong một cú: thông báo nêu người đánh hộ, thẻ và nút điều khiển theo
  người thi triển, còn bi cái và luật cú đánh vẫn thuộc bên đang tới lượt.
- Bi giả vẽ giống bi mục tiêu thật; khi chúng đang tác dụng, đường dự đoán của bi mục tiêu bị ẩn, chỉ còn
  đường bi cái.
- Địa chấn có mũi tên gió/nghiêng sẵn trên nỉ và thông báo nêu hướng, độ mạnh trước khi đánh.
- Dời/đổi bi chạy một nét mực ngắn tới chỗ mới; bật giảm chuyển động thì bi hiện ngay tại vị trí đã chốt.

## Thông báo và tạm dừng

- Thông báo giữa bàn đóng khi chạm bất kỳ đâu hoặc bấm phím; vạch son ở chân cho biết thời gian còn lại. Công tắc *Thông báo giữa bàn* (Cài đặt, menu Tạm dừng)
  tắt chúng, trừ lỗi và thắng ván.
- Mỗi lượt hiện tối đa một mẹo (`hintTurn`); mẹo đóng bằng nút “Đã hiểu”.
- Khi chiêu sẵn sàng mà người chơi chưa dùng, một mảnh giấy gợi ý hiện cạnh ô chiêu: chạm vào để mở chiêu, chạm
  chỗ khác để ẩn; mảnh giấy tự ẩn sau 4,5 giây.
- Menu Tạm dừng: tỉ số, ba công tắc nhanh (âm thanh, nhạc, thông báo) và một cột hành động. Thoát trận luôn
  hỏi xác nhận.
- Kết liễu giữ tranh và dòng kết quả đủ lâu để đọc (bản thường 2,9 giây); chạm để bỏ qua.

## Song Đấu và Luận Cơ

- **Song Đấu:** mỗi bên đặt tên, chọn tướng đã sở hữu (không trùng bên kia) và cơ; hai bên cùng chọn bàn.
  Thẻ mỗi bên ghi bậc của tướng, vì hai bên được chọn tướng khác bậc.
  **Đổi tướng** bốc lại tướng cho cả hai từ các tướng đã sở hữu.
- **Luận Cơ:** **Đổi đối thủ** bốc lại tướng AI trong các bậc của cấp độ đã chọn.

Kiểm tra trên thiết bị: [guides/testing.md](../guides/testing.md).
