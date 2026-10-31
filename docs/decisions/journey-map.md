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

## Phương án bị loại

- Giữ tranh 3:2 và thêm một tranh nền riêng phía sau: khó giấu đường nối giữa hai tranh, nhãn vẫn chật.
- Vẽ nối dài tranh cũ ra hai bên: công cụ vẽ hiện có không có chế độ vẽ nối theo vùng che.
- Bản vẽ thứ nhất: Độc Vụ Cốc khó nhận ra.
- Bản vẽ thứ hai: đường đi từ Hoa Linh sang thẳng Thiên Cơ, Hải Long thành nhánh cụt.

## Hệ quả

- Mốc tương tác (`PINS` trong `src/ui/screens/journey.ts`) là phần trăm của tranh 16:9 và phải nằm đúng quảng
  trường. Thiên Quang và Băng Phách nằm sát mép trên, nên mốc đặt ở đoạn đường ngay dưới quảng trường để không
  chạm thanh trên cùng.
- Thứ tự mốc lấy từ `CHAPTERS`; UI không có tuyến riêng.
- Thay tranh thì duyệt lại đường nối, toạ độ mốc và khoảng cách giữa mốc với thanh trên cùng.
