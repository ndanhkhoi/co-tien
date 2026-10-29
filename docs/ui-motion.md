# Tên menu và chuyển động

Tên được đối chiếu với cách dùng trong `docs/story.md`, truyện và các luồng UI: “cơ” là môn nghệ thuật
của thế giới, “luận” gợi so tài, “tàng các” gợi nơi lưu giữ. Đây là lựa chọn biên tập dựa trên nội dung
nguyên bản của repo, không lấy tên từ một trò chơi khác. Phụ đề làm rõ chức năng cho người mới.

| Tên cũ | Các ứng viên và ý nghĩa | Chọn |
| --- | --- | --- |
| Đấu nhanh | Luận Cơ: so tài bằng cơ; Thách Đấu: rõ hành động; Giao Đấu: giao tranh ngắn | Luận Cơ — đặc trưng bida tu tiên; phụ đề “So tài cùng máy” |
| Hai người | Song Đấu: hai bên đối đầu; Đối Cơ: đối thủ chung bàn; Bằng Hữu: thân tình nhưng ít rõ tính cạnh tranh | Song Đấu — ngắn, phụ đề “Hai người · chung máy” |
| Thử thách | Luyện Cơ: luyện cú đánh; Khảo Nghiệm: sắc thái tu luyện; Phá Thế: giải thế bi | Luyện Cơ — dễ hiểu, hợp các bài có lời giải |
| Bộ sưu tập | Tàng Các: nơi lưu giữ; Bảo Các: kho vật quý; Tàng Bảo: nhấn sưu tầm vật phẩm | Tàng Các — chứa cả tướng, cơ và bàn; phụ đề “Chiêu mộ” kèm tiến độ |
| Truyện | Cơ Tiên Truyện: tên tác phẩm; Truyền Kỳ: chất truyện cổ; Cố Sự: ngắn nhưng khó hiểu hơn | Cơ Tiên Truyện — thống nhất tên tác phẩm và tiêu đề màn hình |
| Cơ Tiên Lục | Cơ Tiên Lục: sổ ghi thế giới; Giới Lục: ngắn nhưng mơ hồ; Tàng Thư: thư viện | Giữ Cơ Tiên Lục — đã rõ bản sắc; nay là các tab Vùng đất, Hệ, Luật trong Tàng Các |
| Luyện tự do | Luyện thế: bày thế rồi đánh; Bàn tập: rõ nhưng nhạt; Tự Do Cơ: dài | Luyện thế — ô thứ sáu ở trang chủ, phụ đề “Tự bày thế tập” |
| Hành trình | Hành trình: đi qua bản đồ; Tiên Lộ: đường tu tiên; Du Hành: đi khám phá | Giữ Hành trình — dễ hiểu và gắn với tiến độ |

## Chuyển động

- `app.ts`: tiến từ phải, màn cũ lùi nhẹ; quay lại đảo chiều; reset crossfade. Thời lượng 280 ms.
  Màn cũ trở thành inert, dispose ngay; điều hướng mới loại màn đang rời để không chồng nhiều lớp.
- `turnPage`: giữ bản sao không tương tác của nội dung cũ, cập nhật nội dung thật ngay, trượt/fade 280 ms.
  Bấm liên tiếp huỷ animation và xoá bản sao cũ. Không đo layout trong vòng animation.
- Intro: tranh crossfade, phần chữ trượt theo hướng; nút Trước/Tiếp và vuốt dùng cùng luồng.
- Truyện: chữ trượt, chỉ crossfade khi đường dẫn tranh đổi; tranh được kế thừa giữ nguyên.
- Tàng Các (gồm các tab Cơ Tiên Lục): tab chuyển theo thứ tự; chi tiết mở/đóng bằng tấm trượt. Chi tiết vùng đất và tướng
  có Trước/Tiếp và vuốt; tướng chỉ duyệt qua các trang đã khám phá. Hành trình dùng cùng chuyển động
  cho tấm vùng đất và hộp thoại cao thủ. Luyện Cơ và Luyện thế mở thẳng bàn, dùng chuyển cảnh toàn màn hình.
- Tướng: tranh trang chủ và trang tướng đi lên/fade; thẻ chiêu lệch 60 ms, thẻ chọn tướng lệch tối đa
  160 ms theo hàng. Hai tướng ở màn chuẩn bị quét từ hai phía, lớp mực dùng tranh cutin đã có;
  dấu Đấu đóng cuối, toàn chuỗi 900 ms.
- Thông báo giữa bàn: dải mực quét vào từ trái (380 ms) rồi mờ dần; chạm bất kỳ hoặc ✕ để đóng ngay.
- Kết liễu (`src/ui/finisher.ts`, khoảng 2,7 s): màn tối 0–0,22 s, dải mực môn phái 0–0,3 s, tướng lao vào kèm
  hai bóng mờ 0,08–0,42 s, bi quyết định bay theo vệt mực 0,42–0,74 s, lỗ mực nổ và màn rung từ 0,74 s, dấu son
  “Kết liễu” đóng ở 0,8 s, dòng tên cú ở 1 s, tan dần lúc 2,7 s; chạm để bỏ qua.
- Bảng cập nhật: logo và nét cọ mực chạy qua lại 1,8 s mỗi vòng.
- `prefers-reduced-motion`: bỏ chuyển động trang/tướng, trang con cập nhật tức thời; Kết liễu hiện tĩnh, không
  rung, không bóng mờ; nét cọ bảng cập nhật đứng yên.

CSS nằm trong phần “Cơ Tiên: directional pages and painted champion entrances” của `src/styles/skin.css`.
