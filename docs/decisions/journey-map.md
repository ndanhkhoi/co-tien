# Tranh bản đồ Hành trình

**Bối cảnh.** Bản đồ `public/art/ui/map.webp` (3:2) phải vẽ đúng tuyến `CHAPTERS` trong
`src/game/content/career.ts`: Thiên Quang → Hoa Linh → Hải Long → Thiên Cơ → Băng Phách → Độc Vụ → Kim Sa →
Vạn Thú → Huyết Sát → U Minh → Tinh Tú → Thiên Hương → Hư Không.

**Quyết định.** Chọn phương án hai trong ba bản vẽ: đường đi liên tục, giữ tuyết phía bắc, biển phía đông,
hoang mạc và vết nứt Hư Không.

**Loại bỏ.** Phương án một có đường tắt sai tuyến; phương án ba đặt đường lệch khỏi đài Tinh Tú.

**Hệ quả.** Mốc tương tác (`PINS` trong `src/ui/screens/journey.ts`) phải nằm đúng quảng trường trên tranh; thứ
tự lấy từ `CHAPTERS`, UI không có tuyến riêng. Thay tranh thì duyệt lại đường nối và toạ độ mốc.
