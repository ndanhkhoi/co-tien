# Ký tự

Người gõ tay trên bàn phím Việt hiếm khi gõ ra gạch dài, mũi tên hay nháy cong. Văn máy rải chúng khắp nơi,
nên chúng là dấu hiệu dễ thấy nhất. Bảng dưới là luật script `scan.mjs` kiểm.

| Ký tự | Được dùng | Không dùng, sửa thành |
|---|---|---|
| `—` gạch dài | Đầu lời thoại và gạch dẫn lời trong đoạn thoại; một ô hay chuỗi chỉ gồm `—` làm giá trị trống | Chen giữa câu để giải thích hay đổi ý. Sửa bằng dấu phẩy, hai chấm, ngoặc đơn, hoặc tách thành hai câu |
| `–` gạch ngắn | Khoảng số (`3–5`, `${a} – ${b}`); cặp tên riêng (`Bá Nha – Tử Kỳ`) | Mọi chỗ khác; viết lại hoặc dùng `-` |
| `→ ← ⇒ ➜ ⟷` mũi tên | Giữa hai code span chỉ chiều phụ thuộc (`` `core` ← `game` ``) | Chuỗi "A → B → C" thay cho câu. Viết "A, rồi B, rồi C", "đổi A thành B", hoặc liệt kê có số |
| `…` ba chấm | Lời bỏ lửng, chữ "Đang tải…" | `...` ba dấu chấm: đổi thành `…` cho thống nhất |
| `“ ”` nháy kép cong | Trích lời, tên gọi trong văn tiếng Việt | Mở mà không đóng, hoặc trộn với `"` thẳng trong cùng đoạn văn |
| `‘ ’` nháy đơn cong | Không dùng | Đổi thành `“ ”` hoặc bỏ |
| `×` | Giữa số hoặc cạnh số (`844×475`, `×2`) | Nối hai khái niệm ("bida × tu tiên"); viết bằng chữ |
| `≈` | Cạnh số trong docs kỹ thuật | Trong câu, viết "khoảng" |
| Emoji | Không dùng | Icon và trang trí đi qua art pipeline (`game-art`) |
| NBSP, ZWSP, soft hyphen, BOM | Không dùng | Xoá; thường lọt vào khi chép từ web hay từ chat |
| Khoảng trắng trước `, . ; : ! ?` | Không dùng | Xoá khoảng trắng |

## Không phải ký tự nhưng cùng loại

Script không bắt những thứ này; người soát tự xem:

- **In đậm làm nhãn ở mọi dòng.** Danh sách mà dòng nào cũng mở bằng `**Nhãn:**` hay `**Nhãn** —` là khuôn
  văn máy. Chỉ giữ khi người đọc cần dò nhanh theo nhãn (bảng tra tướng, bước làm có tên); còn lại viết câu.
- **Tiêu đề Viết Hoa Từng Chữ** khi không phải tên riêng. Tiếng Việt chỉ viết hoa chữ đầu tiêu đề.
- **Hai chấm cuối tiêu đề** (`## Cách dùng:`).
- **Số, ngày, tiền kiểu Anh** trong câu Việt: `1,000.5`, `September 4`, `$` trước tiền VND.
