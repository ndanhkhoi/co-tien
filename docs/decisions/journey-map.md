# Tranh bản đồ Hành trình

## Bối cảnh

Bản đồ `public/art/ui/map.webp` phải vẽ đúng tuyến `CHAPTERS` trong `src/game/content/career.ts`:
lần lượt Thiên Quang, Hoa Linh, Hải Long, Thiên Cơ, Băng Phách, Độc Vụ, Kim Sa, Vạn Thú, Huyết Sát, U Minh,
Tinh Tú, Thiên Hương và cuối cùng là Hư Không.

Bản đầu có tỉ lệ 3:2. Khung game 844×475 rộng hơn, nên bản đồ chỉ chiếm khoảng 607 px ở giữa, hai bên là hai
dải giấy trống và nhãn các vùng sát mép bị chen nhau.

## Quyết định

Vẽ lại bản đồ ở tỉ lệ 16:9 (1536×864) để tranh phủ kín cả khung, kể cả phía sau thanh trên cùng. Thanh trên cùng
nổi trên phần trời và mây của tranh. 13 vùng đất nằm trong vùng giữa; mép tranh chỉ có núi, mây và biển.

Trong ba bản vẽ, chọn bản thứ ba vì:

- đường đi liên tục và đúng thứ tự 1 đến 13;
- giữ tuyết phía tây bắc, biển phía đông, hoang mạc phía tây và vết nứt Hư Không ở góc tây nam;
- Độc Vụ Cốc có rừng nấm dễ nhận ra.

## Vẽ lại lần hai: bớt chi tiết, thoáng dải trên

Bản 16:9 đầu tiên phủ kín khung nhưng vẽ nhiều chi tiết và để núi, tháp chạm lên dải trên, khiến thanh trên
cùng và tiêu đề bị chìm. Vẽ lại với yêu cầu chặt hơn:

- dải trên 30% chỉ có sương, mây và núi xa rất mờ; không nhà cửa, đảo hay đường đỏ;
- 13 quảng trường nằm trong khoảng y 32 đến 90% của tranh, cách nhau tối thiểu 18% bề ngang;
- khoảng 60% mặt tranh là mảng yên tĩnh (sương, nước, giấy trống); đường đỏ mảnh, đi bằng những cung dài.

Trong ba bản vẽ mới, lại chọn bản thứ ba: dải trên gần như trống, đủ 13 vùng đúng thứ tự, đường đỏ đơn tuyến
không tự cắt. Bản một để tháp Thiên Quang và núi tuyết Băng Phách chạm vào dải trên, đường đỏ chỉ quét mép
đảo Hoa Linh; bản hai dày đặc chi tiết và đường đỏ bỏ sót Hải Long.

## Vệt chấm son thay cho đường liền

Đường đỏ liền trên tranh vẫn đọc như một sợi chỉ đè lên phong cảnh. Vẽ lại lần ba thay cách biểu thị
tuyến: các chấm son rời rạc như điểm chu sa trên bản đồ cổ, mỗi chấm lớn bằng một dấu bút chấm,
đặt cách nhau dọc tuyến, không còn nét liền. Chấm vẫn đủ dẫn đường giữa các mốc mà tranh thoáng
hẳn; quầng giấy hậu xử lý của bản trước không còn cần và bị bỏ.

Trong ba bản vẽ, chọn bản một: vệt chấm qua đủ 13 vùng đúng thứ tự, đơn tuyến, dải trên thuần sương,
khoảng 62% mặt tranh yên tĩnh. Bản hai và ba bị gãy tuyến ở nửa trên (nhánh cụt hoặc đoạn rời giữa
Hoa Linh, Hải Long, Thiên Cơ).

## Hoàn thiện giữa chừng: quầng giấy cho đường đỏ, nền tiêu đề

Hai vết còn sót sau lần vẽ lại (về sau phần quầng giấy bị vệt chấm son thay luôn):

- Đường đỏ son bị mực đen nuốt ở vài đoạn (Thiên Quang sang Hoa Linh, quanh Vạn Thú). Khi xuất ảnh,
  thêm một quầng giấy mảnh ôm sát nét đỏ: chọn mask đỏ theo hue và độ bão hoà, nới mềm ra, phủ dải
  màu giấy, rồi vẽ lại nét đỏ gốc lên trên. Đường nổi trên mọi nền mà vẫn đọc như khoảng chừa giấy
  của tranh, không phải hiệu ứng sáng.
- Nền tiêu đề từ đầu bị lỗi cú pháp CSS: màu đặt ở layer đầu của `background` shorthand khiến cả
  khai báo vô hiệu, tiêu đề thực chất không có nền nên chìm vào tranh. Không dùng tấm nền riêng cho
  tiêu đề (lệch với mọi màn khác, nơi tiêu đề nằm trần trên giấy); thay vào đó, phần trên tranh được
  pha dần thành màu giấy của trang bằng một scrim chìm dưới mốc, nên tiêu đề, triện son và nét bút
  đọc như trên mọi màn hình khác.

## Phương án bị loại

- Giữ tranh 3:2 và thêm một tranh nền riêng phía sau: khó giấu đường nối giữa hai tranh, nhãn vẫn chật.
- Vẽ nối dài tranh cũ ra hai bên: công cụ vẽ hiện có không có chế độ vẽ nối theo vùng che.
- Bản vẽ thứ nhất (lần một): Độc Vụ Cốc khó nhận ra.
- Bản vẽ thứ hai (lần một): đường đi từ Hoa Linh sang thẳng Thiên Cơ, Hải Long thành nhánh cụt.
- Vòng vẽ lại thứ hai nhằm làm trống hẳn góc tây bắc (chỗ tiêu đề): cả ba bản đều không đạt. Model
  luôn vẽ núi tuyết cao ở tây bắc; hai bản cho đường đỏ phân nhánh, một bản gãy đoạn giữa Thiên Cơ
  và Băng Phách. Giữ bản đã chọn và để tấm nền tiêu đề đặc tự che khu vực đó.

## Hệ quả

- Mốc tương tác (`PINS` trong `src/ui/screens/journey.ts`) là phần trăm của tranh 16:9 và phải nằm đúng quảng
  trường. Thiên Quang và Băng Phách nằm sát mép trên, nên mốc đặt ở đoạn đường ngay dưới quảng trường để không
  chạm thanh trên cùng. Mốc Độc Vụ hạ thấp hơn quảng trường một chút để nhãn Băng Phách không đè lên huy hiệu.
- Mốc khoá thêm một vòng giấy quanh huy hiệu và đổi nền huy hiệu khoá sang mực đậm hơn để nổi trên các mảng
  tranh tối (Vạn Thú, Huyết Sát, Hư Không).
- Thứ tự mốc lấy từ `CHAPTERS`; UI không có tuyến riêng.
- Thay tranh thì duyệt lại đường nối, toạ độ mốc và khoảng cách giữa mốc với thanh trên cùng.
