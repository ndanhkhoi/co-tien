# Cơ Tiên Giới — World Bible

Nguồn sự thật cho thế giới của Cơ Tiên. Phần danh sách bên dưới được sinh từ `src/game/content/roster.json` (tạo hình, chiêu) và `src/game/content/lore.json` (truyện, tiểu sử); khi sửa dữ liệu, cập nhật lại tài liệu này.

## Bối cảnh

Cơ Tiên Giới là đại lục tu tiên nơi các môn phái không phân thắng bại bằng gươm đao mà bằng Thần Cơ Đạo — dùng linh lực truyền qua cây cơ để điều khiển bi trên Linh Đài. Mười năm một lần, Thiên Hạ Đệ Nhất Cơ Hội tụ hội cao thủ mười ba môn phái. Bạn là một tán tu vô danh, đi qua từng vùng đất để thách đấu, học chiêu và chiêu mộ đồng đạo.

Toàn bộ tên, truyện, môn phái, nhân vật, chiêu thức và tranh là sáng tác riêng cho Cơ Tiên.

## Hệ (lớp) và nội tại

| Hệ | Nội tại (chế độ Tiên Đạo) |
|---|---|
| Thần Xạ | Khoá hướng ngắm để xem dải lệch khi đổi lực; đổi hướng sẽ mở khoá. |
| Cuồng Chiến | Đầu cơ cứng truyền lực mạnh hơn 10%, nhưng tầm áp phê giảm 25%. |
| Pháp Tu | Trước mỗi cú chọn giữ áp phê ngang hoặc tiến/lùi; trục còn lại giảm. |
| Hộ Pháp | Mỗi lượt cơ được chọn một đoạn băng mềm cho cú của mình. |
| Chú Sư | Sau cú hợp lệ kết thúc lượt, để lại một vùng cát nhỏ tại điểm dừng bi cái cho cú kế của đối thủ. |
| Ảnh Sát | Sau chuỗi ghi điểm, chọn soi đường hoặc tăng lực cho cú tiếp theo. |
| Luân Hồi | Hai chiêu cơ bản chung nhịp: dùng luân phiên hồi nhanh hơn một lượt; lặp lại hồi bình thường. |

## Kỹ năng

Mỗi tướng có **2 chiêu cơ bản** và **1 tuyệt chiêu**. 65 bộ chiêu có 65 tập cơ chế khác nhau. Các vùng, vật chắn, gió, giếng hút, băng và dòng xoáy được mô phỏng chung cho trận thật, đường dự đoán và AI. Tuyệt chiêu bậc 5 dùng hình học riêng qua trường `ult`; cổng, rễ và hút miệng lỗ qua `shape`. Trên bàn phăng, hút miệng lỗ trở thành giếng trên nỉ, cổng đặt thành hành lang. Trên bàn phăng, hộ thể chuyển thành chỉnh băng; các chiêu chỉ có ý nghĩa với lỗ được đổi sang hiệu ứng phù hợp. Cổ Điển và thử thách không dùng kỹ năng hoặc nội tại.


## Môn phái

### Thiên Quang Kiếm Tông (`thienquang`)

- **Dấu ấn (5/5 tướng):** Ba phương án lực/áp phê, đường mô phỏng và điểm dừng.
- **Tuyệt chiêu bậc 5:** Tam ảnh dự đoán.

Chính đạo kiếm tông trên dãy núi đá trắng, nơi mặt trời mọc đầu tiên. Đệ tử luyện cơ như luyện kiếm: thẳng, chuẩn, không thừa một li. Linh Đài của họ là chuẩn mực mà mọi môn phái khác dùng để so.

- **Linh Đài:** Đá cẩm thạch trắng, nỉ lam thẫm. Bàn chuẩn mực, không đặc tính. Nỉ `#3c506b`.
- **Thiên Tượng — Gió Núi:** Gió giật từng cơn đẩy bi đang lăn theo hướng gió.
- **Biểu tượng:** a golden flying sword crossing a radiant sun halo. **Màu:** #e9d27a / #9cd3ff.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Tô Kiếm Nhi** | Nữ Hiệp | Thần Xạ | Quang Kiếm Dẫn Lộ (vision) | Quang Kiếm Minh Nhãn (reveal) | Quang Kiếm Đại Trận (vision, reveal) |
| 2 | **Mạc Thiết Sơn** | Hiệp Khách | Hộ Pháp | Quang Kiếm Dẫn Lộ (vision) | Quang Kiếm Nhu Bích (railcraft) | Quang Kiếm Đại Trận (vision, sand) |
| 3 | **Bạch Vân Khanh** | Hiệp Khách | Pháp Tu | Quang Kiếm Dẫn Lộ (vision) | Quang Kiếm Toàn Quyết (spin) | Quang Kiếm Đại Trận (vision, slick) |
| 4 | **Lăng Thiên Kỳ** | Nữ Hiệp | Cuồng Chiến | Quang Kiếm Dẫn Lộ (vision) | Quang Kiếm Cương Kình (power) | Quang Kiếm Đại Trận (vision, vortex) |
| 5 | **Kiếm Thánh Diệp Huyền Quang** | Hiệp Khách | Thần Xạ | Quang Kiếm Dẫn Lộ (vision) | Quang Kiếm Minh Nhãn (reveal) | Tam Quang Chiếu Lộ (vision, shield) |

- **Tô Kiếm Nhi** — Đệ tử nhỏ tuổi nhất Thiên Quang, nổi tiếng vì dám thách đấu cả trưởng lão. Mỗi lần thua lại dán thêm một miếng băng lên má làm kỷ niệm. *“Một cú thẳng, một tiếng rơi. Lần này ta không trượt đâu!”*
- **Mạc Thiết Sơn** — Người giữ cổng sơn môn suốt hai mươi năm. Chưa ai đánh bi qua được tấm khiên kiếm của ông mà không trả giá. *“Muốn vào núi, hãy thắng ta trước.”*
- **Bạch Vân Khanh** — Thư sinh kiếm khách yêu mây hơn yêu kiếm. Đường bi của y uốn lượn như mây trôi, đẹp đến mức đối thủ quên cả phòng thủ. *“Bi cũng như mây, đừng ép, hãy dẫn.”*
- **Lăng Thiên Kỳ** — Chấp pháp trưởng lão với vết sẹo dọc mắt trái, kỷ niệm của trận chiến với Huyết Sát. Nàng đánh bi như chém kiếm: mạnh, nhanh, không do dự. *“Luật là luật. Phạm lỗi thì nhận phạt.”*
- **Kiếm Thánh Diệp Huyền Quang** — Kiếm Thánh bất lão, người đặt ra Thần Cơ Đạo. Chín thanh phi kiếm quanh ông từng là chín cây cơ của chín đối thủ đã bại. *“Khi tâm đã thấy, tay chỉ việc theo.”*

### Huyết Sát Ma Môn (`huyetsat`)

- **Dấu ấn (5/5 tướng):** Xung lực hình nón theo hướng cơ tại lần chạm đầu.
- **Tuyệt chiêu bậc 5:** Xung lực hình nón.

Ma môn chinh phạt dựng thành trên quặng sắt đỏ. Với Huyết Sát, một ván bida là một trận chiến, và băng bàn bằng sắt bật bi mạnh như đòn trả đũa.

- **Linh Đài:** Sắt đen gai. Băng cứng, bi bật mạnh hơn. Nỉ `#5b3d3f`.
- **Thiên Tượng — Địa Chấn:** Mặt đất rung: các bi đang nằm yên bị xê dịch nhẹ khi bạn đánh.
- **Biểu tượng:** a blood moon pierced by a black iron halberd. **Màu:** #c1272d / #ff7a45.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Hắc Lang** | Hiệp Khách | Ảnh Sát | Huyết Kình Dẫn Lộ (blast) | Huyết Kình Truy Ảnh (second) | Huyết Kình Đại Trận (blast, railcraft) |
| 2 | **Đồ Cuồng** | Hiệp Khách | Cuồng Chiến | Huyết Kình Dẫn Lộ (blast) | Huyết Kình Cương Kình (power) | Huyết Kình Đại Trận (blast, wind) |
| 3 | **Huyết Cơ Mị Nương** | Nữ Hiệp | Chú Sư | Huyết Kình Dẫn Lộ (blast) | Huyết Kình Sa Chú (sand) | Huyết Kình Đại Trận (blast, well) |
| 4 | **Tư Đồ Liệt** | Hiệp Khách | Cuồng Chiến | Huyết Kình Dẫn Lộ (blast) | Huyết Kình Cương Kình (power) | Huyết Kình Đại Trận (blast, spinwash) |
| 5 | **Ma Tôn Cửu U** | Yêu Tộc | Luân Hồi | Huyết Kình Dẫn Lộ (blast) | Huyết Kình Luân Chuyển (spinwash) | Huyết Kình Phá Trận (blast, nudge) |

- **Hắc Lang** — Sát thủ trẻ của Huyết Sát, mũ trùm tai sói không bao giờ rời. Chỉ cần đối thủ sơ hở một cú, hắn dọn sạch bàn. *“Một sơ hở thôi. Ta chỉ cần một.”*
- **Đồ Cuồng** — Gã khổng lồ đeo mặt nạ sắt, xích quấn quanh tay như vòng tay. Hắn không biết áp phê, chỉ biết đánh mạnh hơn nữa. *“Bida là phải nổ!”*
- **Huyết Cơ Mị Nương** — Huyết pháp sư sau tấm mạng ren đen. Một ánh nhìn của nàng đủ làm tay cơ thủ run như gặp mùa đông. *“Tay ngươi… đang run đấy à?”*
- **Tư Đồ Liệt** — Tướng quân già chinh phạt bốn phương, lá cờ trên lưng chưa từng hạ. Ông đánh bida như dàn trận, mỗi cú là một mũi tiến quân. *“Phá trận trước, ăn bi sau.”*
- **Ma Tôn Cửu U** — Ma Tôn của Huyết Sát, kẻ được cho là đã đảo ngược thời gian để thắng một ván định mệnh. Không ai biết hắn đã sống bao nhiêu lần. *“Ta đã thấy ván này kết thúc thế nào rồi.”*

### Hoa Linh Tiên Đảo (`hoalinh`)

- **Dấu ấn (5/5 tướng):** Gió có hướng.
- **Tuyệt chiêu bậc 5:** Hai vùng gió ngược chiều.

Đảo hoa đào trôi giữa mây, quê của hồ ly linh và gió xuân. Người Hoa Linh tin rằng bi lăn đẹp nhất khi người đánh không vội.

- **Linh Đài:** Gỗ anh đào. Nỉ êm, bi lăn mượt hơn chút. Nỉ `#3b5d57`.
- **Thiên Tượng — Xuân Phong:** Gió xuân giật từng cơn đẩy bi đang lăn.
- **Biểu tượng:** a five-petal peach blossom with a curled fox tail. **Màu:** #e07aa5 / #b8f0e0.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Đào Tiểu Muội** | Nữ Hiệp | Pháp Tu | Hoa Phong Dẫn Lộ (wind) | Hoa Phong Toàn Quyết (spin) | Hoa Phong Đại Trận (wind, sand) |
| 2 | **Phong Linh Tử** | Hiệp Khách | Ảnh Sát | Hoa Phong Dẫn Lộ (wind) | Hoa Phong Truy Ảnh (second) | Hoa Phong Đại Trận (wind, slick) |
| 3 | **Hồ Tiên Nguyệt Ly** | Yêu Tộc | Chú Sư | Hoa Phong Dẫn Lộ (wind) | Hoa Phong Sa Chú (sand) | Hoa Phong Đại Trận (wind, vortex) |
| 4 | **Thanh Liên Đại Sư** | Hiệp Khách | Hộ Pháp | Hoa Phong Dẫn Lộ (wind) | Hoa Phong Nhu Bích (railcraft) | Hoa Phong Đại Trận (wind, shield) |
| 5 | **Đảo Chủ Mộng Hoa** | Nữ Hiệp | Luân Hồi | Hoa Phong Dẫn Lộ (wind) | Hoa Phong Luân Chuyển (spinwash) | Lưỡng Nghi Hoa Phong (wind, second) |

- **Đào Tiểu Muội** — Cô bé má phúng phính, đi đâu cũng có hồ ly con ngồi trên đầu. Đánh bi bằng hoa đào và nụ cười, nhưng đừng coi thường. *“Hoa rơi đúng chỗ, bi cũng vậy!”*
- **Phong Linh Tử** — Kiếm khách lang thang ngậm cọng cỏ, buộc chuông trên tóc. Hắn ngủ gật cả trong trận, rồi tỉnh dậy ăn liền ba bi. *“Gió thổi đâu, bi theo đó.”*
- **Hồ Tiên Nguyệt Ly** — Cửu vĩ hồ tiên đã tu ngàn năm. Chín cái đuôi của nàng có thể vẽ nên mê trận khiến đối thủ quên mất bi nào là bi của mình. *“Ngươi nhìn bi, hay nhìn ta?”*
- **Thanh Liên Đại Sư** — Lão tăng ngồi trên đài sen, tĩnh lặng như mặt hồ. Ông chưa từng vội một cú nào, và cũng hiếm khi để thua. *“Tâm tĩnh thì bi tự vào.”*
- **Đảo Chủ Mộng Hoa** — Chủ nhân đảo Hoa Linh, sống giữa mơ và thực. Người ta đồn ván nào nàng thua, nàng chỉ việc tỉnh mộng và đánh lại. *“Ván này… chỉ là một giấc mơ thôi.”*

### Băng Phách Tuyết Cung (`bangphach`)

- **Dấu ấn (5/5 tướng):** Vùng nỉ trơn.
- **Tuyệt chiêu bậc 5:** Hành lang trơn, hai vùng hãm.

Cung điện băng phương Bắc dưới cực quang. Nỉ ở đây lạnh và trơn, bi lăn xa đến mức người ngoại bang thường đánh quá tay.

- **Linh Đài:** Khung băng tạc. Nỉ trơn, bi lăn xa. Nỉ `#436373`.
- **Thiên Tượng — Bão Tuyết:** Đụn tuyết phủ lên nỉ: bi lăn vào đụn tuyết chậm hẳn lại.
- **Biểu tượng:** a six-petal ice lotus inside a crescent moon. **Màu:** #6cc4ef / #e6fbff.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Tuyết Nhi** | Nữ Hiệp | Thần Xạ | Băng Lộ Dẫn Lộ (slick) | Băng Lộ Minh Nhãn (reveal) | Băng Lộ Đại Trận (slick, wind) |
| 2 | **Hàn Thạch** | Hiệp Khách | Hộ Pháp | Băng Lộ Dẫn Lộ (slick) | Băng Lộ Nhu Bích (railcraft) | Băng Lộ Đại Trận (slick, well) |
| 3 | **Lạc Sương** | Tinh Linh | Pháp Tu | Băng Lộ Dẫn Lộ (slick) | Băng Lộ Toàn Quyết (spin) | Băng Lộ Đại Trận (slick, spinwash) |
| 4 | **Bắc Minh Cuồng Hùng** | Yêu Tộc | Cuồng Chiến | Băng Lộ Dẫn Lộ (slick) | Băng Lộ Cương Kình (power) | Băng Lộ Đại Trận (slick, nudge) |
| 5 | **Cung Chủ Hàn Nguyệt** | Nữ Hiệp | Chú Sư | Băng Lộ Dẫn Lộ (slick) | Băng Lộ Sa Chú (sand) | Băng Hà Song Hãm (slick, spin) |

- **Tuyết Nhi** — Tiểu đệ tử Băng Phách, cung pha lê luôn đeo sau lưng. Nàng ngắm bi như ngắm tên, một mắt nhắm, một mắt cười. *“Trúng rồi nhé!”*
- **Hàn Thạch** — Hộ vệ to lớn của Tuyết Cung, giáp băng không bao giờ tan. Ít nói, nhưng mỗi lời đều chắc như khiên. *“Giữ vững.”*
- **Lạc Sương** — Tiên tử băng liên, tóc đen dài chấm gót. Đường áp phê của nàng xoay như những cánh sương tuyết rơi. *“Nhẹ thôi, như sương đọng trên sen.”*
- **Bắc Minh Cuồng Hùng** — Chiến binh nửa người nửa gấu trắng từ bờ biển băng phương Bắc. Cây cơ của hắn làm từ băng nghìn năm và xương cá voi. *“GRAAAH! Bàn này của ta!”*
- **Cung Chủ Hàn Nguyệt** — Cung chủ Băng Phách, lạnh như vầng trăng đêm đông. Khi nàng vung cơ, cả Linh Đài đóng băng và đối thủ chỉ còn đứng nhìn. *“Mùa đông đã đến. Với ngươi.”*

### Thiên Cơ Các (`thienco`)

- **Dấu ấn (5/5 tướng):** Vật phản xạ.
- **Tuyệt chiêu bậc 5:** Hai đoạn phản xạ nghiêng.

Các lâu đồng thau của những nhà cơ quan thuật. Họ tính đường bi bằng bàn tính, la bàn và bánh răng, và là những người đầu tiên đo được góc bật băng.

- **Linh Đài:** Đồng thau bánh răng. Bàn chuẩn xác, không đặc tính. Nỉ `#365858`.
- **Thiên Tượng — Cơ Quan Nghiêng:** Cơ quan nâng một đầu bàn: bi lăn chậm trôi về một phía.
- **Biểu tượng:** a brass gear with a cyan lightning core. **Màu:** #d9a441 / #7fe3ff.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Tiểu Ban** | Hiệp Khách | Thần Xạ | Cơ Trận Dẫn Lộ (bumper) | Cơ Trận Minh Nhãn (reveal) | Cơ Trận Đại Trận (bumper, slick) |
| 2 | **Mộc Ngưu** | Linh Tượng | Hộ Pháp | Cơ Trận Dẫn Lộ (bumper) | Cơ Trận Nhu Bích (railcraft) | Cơ Trận Đại Trận (bumper, vortex) |
| 3 | **Lỗ Diệu Diệu** | Nữ Hiệp | Pháp Tu | Cơ Trận Dẫn Lộ (bumper) | Cơ Trận Toàn Quyết (spin) | Cơ Trận Đại Trận (bumper, shield) |
| 4 | **Hoả Lôi Tiên Sinh** | Hiệp Khách | Cuồng Chiến | Cơ Trận Dẫn Lộ (bumper) | Cơ Trận Cương Kình (power) | Cơ Trận Đại Trận (bumper, second) |
| 5 | **Thần Toán Gia Cát Vân** | Hiệp Khách | Luân Hồi | Cơ Trận Dẫn Lộ (bumper) | Cơ Trận Luân Chuyển (spinwash) | Chiết Quang Song Kính (bumper, power) |

- **Tiểu Ban** — Thợ học việc của Thiên Cơ Các, luôn có một chú chim cơ quan trên vai. Cậu tin mọi cú đánh đều giải được bằng toán. *“Góc 37 độ, lực 6 phần. Xong!”*
- **Mộc Ngưu** — Trâu gỗ cơ quan do Các Chủ chế tạo để canh giữ kho bản vẽ. Nó không biết nói, nhưng biết chặn mọi đường bi. *“…kẽo kẹt… (tiếng bánh răng)”*
- **Lỗ Diệu Diệu** — Nữ cơ quan sư điều khiển rối gỗ bằng những sợi tơ linh. Con rối nhỏ của nàng có thể đẩy bi đúng một li. *“Rối của ta không bao giờ trượt tay.”*
- **Hoả Lôi Tiên Sinh** — Nhà phát minh lập dị đã thổi bay ba phòng thí nghiệm. Cây cơ của ông là một khẩu pháo pháo hoa thu nhỏ. *“Nếu không nổ, nghĩa là chưa đủ thuốc!”*
- **Thần Toán Gia Cát Vân** — Thần toán của Thiên Cơ Các, nhìn bàn bida như nhìn một bàn cờ. Người ta nói ông tính trước được mười cú. *“Ván này ta đã thắng từ ba cú trước.”*

### Độc Vụ Cốc (`docvu`)

- **Dấu ấn (5/5 tướng):** Vùng tiêu áp phê.
- **Tuyệt chiêu bậc 5:** Vành tiêu áp phê quanh lõi trơn.

Thung lũng chướng khí, nơi các y sư và cổ sư nuôi độc như nuôi con. Linh Đài mục rêu làm bi chậm lại, như mọi thứ khác trong sương độc.

- **Linh Đài:** Gỗ mục rêu phong. Nỉ ẩm, bi chậm hơn. Nỉ `#45523b`.
- **Thiên Tượng — Vũng Độc:** Vũng độc nhớt: bi đi qua mất áp phê và trượt ngắn lại.
- **Biểu tượng:** a coiled green snake around a potion gourd. **Màu:** #7ccd3c / #d8ff6a.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Lục Xà** | Yêu Tộc | Ảnh Sát | Độc Toàn Dẫn Lộ (spinwash) | Xà Ảnh (second) | Độc Toàn Đại Trận (spinwash, well) |
| 2 | **Độc Thủ Lão Quái** | Hiệp Khách | Chú Sư | Độc Toàn Dẫn Lộ (spinwash) | Độc Toàn Sa Chú (sand) | Độc Toàn Đại Trận (spinwash, nudge) |
| 3 | **Ngũ Độc Đồng Tử** | Hiệp Khách | Pháp Tu | Độc Toàn Dẫn Lộ (spinwash) | Kim Tằm Xoáy (spin) | Độc Toàn Đại Trận (spinwash, nudge) |
| 4 | **Huyết Lang Nhân** | Ma Vật | Ảnh Sát | Độc Toàn Dẫn Lộ (spinwash) | Độc Toàn Truy Ảnh (second) | Độc Toàn Đại Trận (spinwash, spin) |
| 5 | **Quỷ Y Dược Vương** | Nữ Hiệp | Luân Hồi | Độc Toàn Dẫn Lộ (spinwash) | Kim Châm Hộ Mạch (shield) | Độc Hoàn Tán Toàn (spinwash, reveal) |

- **Lục Xà** — Thiếu nữ rắn của Độc Vụ, mắt hổ phách khe dọc. Nàng chờ đợi lâu như rắn rình mồi, rồi ra đòn chỉ một lần. *“Ssss… đến lượt ta.”*
- **Độc Thủ Lão Quái** — Lão độc sư râu dài, bầu độc đeo hông. Hơi thở của lão cũng đủ làm đối thủ hoa mắt. *“Hít sâu vào, cháu ngoan…”*
- **Ngũ Độc Đồng Tử** — Cậu bé đầu cạo trọc chỉ chừa một chỏm, năm con cổ trùng là bạn thân. Bi đi đâu, đàn côn trùng dẫn tới đó. *“Bọn nhỏ của tớ đói rồi!”*
- **Huyết Lang Nhân** — Sói người đột biến từ dược thuật, ống thuốc xanh cắm sau lưng. Càng đánh hắn càng hung, càng khát thắng. *“Gừ… thêm một bi nữa…”*
- **Quỷ Y Dược Vương** — Quỷ Y bất tử của Độc Vụ, chiếc mặt nạ mỏ chim luôn đẩy lên trán. Bà có thuốc chữa mọi thứ, kể cả một cú đánh hỏng. *“Hỏng à? Uống viên này rồi đánh lại.”*

### Hải Long Bang (`hailong`)

- **Dấu ấn (5/5 tướng):** Băng mềm/cứng và dòng chảy.
- **Tuyệt chiêu bậc 5:** Dòng chảy hướng chọn, điểm hút cuối dòng và chỉnh băng.

Bến cảng hải tặc nằm trên lưng một con rồng biển đã ngủ. Ở Hải Long, cược bằng vàng, thua thì xuống thuyền chèo, và bàn bida chòng chành theo sóng.

- **Linh Đài:** Gỗ thuyền đinh đồng. Băng mềm như mạn tàu. Nỉ `#375a61`.
- **Thiên Tượng — Sóng Lừng:** Bàn chòng chành qua lại như trên thuyền.
- **Biểu tượng:** a sea dragon coiled around an anchor. **Màu:** #e0782f / #5fd7c8.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Tiểu Ngư** | Nữ Hiệp | Ảnh Sát | Hải Triều Dẫn Lộ (railcraft, wind) | Hải Triều Truy Ảnh (second) | Hải Triều Đại Trận (railcraft, vortex) |
| 2 | **Sa Đại Đao** | Yêu Tộc | Cuồng Chiến | Hải Triều Dẫn Lộ (railcraft, wind) | Hải Triều Cương Kình (power) | Hải Triều Đại Trận (railcraft, shield) |
| 3 | **Thuyền Nương Lưu Hương** | Nữ Hiệp | Thần Xạ | Hải Triều Dẫn Lộ (railcraft, wind) | Hải Triều Minh Nhãn (reveal) | Hải Triều Đại Trận (railcraft, second) |
| 4 | **Thiết Neo Lão Kình** | Hiệp Khách | Hộ Pháp | Hải Triều Dẫn Lộ (railcraft, wind) | Hải Triều Hộ Quyết (shield) | Hải Triều Đại Trận (railcraft, reveal) |
| 5 | **Đông Hải Long Vương** | Yêu Tộc | Chú Sư | Hải Triều Dẫn Lộ (railcraft, wind) | Hải Triều Sa Chú (sand) | Triều Hoàn Quy Uyên (railcraft, wind, vortex) |

- **Tiểu Ngư** — Nữ hải tặc tí hon bịt một mắt, da rám nắng, tóc xanh như rong biển. Cô đánh bi nhanh như cá chuồn. *“Bi của ngươi giờ là chiến lợi phẩm của ta!”*
- **Sa Đại Đao** — Gã hải tặc răng cá mập, đao to như mái chèo. Hắn ăn bi như cá mập đớp mồi. *“Ngoạm!”*
- **Thuyền Nương Lưu Hương** — Thuyền trưởng tóc xoăn đỏ của Hải Long, ống nhòm luôn trong tay. Không có đường bi nào nàng không nhìn thấy trước. *“Gió đã thuận. Nhổ neo!”*
- **Thiết Neo Lão Kình** — Lão thuỷ thủ khổng lồ mang mỏ neo trên lưng. Một khi ông thả neo, không bi nào nhúc nhích nổi. *“Neo đã thả. Đứng yên.”*
- **Đông Hải Long Vương** — Long Vương Đông Hải, râu xanh dài chấm ngực. Ông gọi sóng biển dâng lên Linh Đài và hút bi vào xoáy nước. *“Biển cả không thua ai bao giờ.”*

### U Minh Đảo (`uminh`)

- **Dấu ấn (5/5 tướng):** Cặp cổng vật lý.
- **Tuyệt chiêu bậc 5:** Cặp cổng hành lang.

Hòn đảo của vong hồn trên dòng sông lãng quên. Người chết vẫn chơi bida ở đây, và các lỗ bàn đôi khi mở, đôi khi bị quỷ khí phong kín.

- **Linh Đài:** Gỗ đen xương. Nỉ xám tro, không đặc tính. Nỉ `#3f4a44`.
- **Thiên Tượng — Quỷ Môn:** Một lỗ bị quỷ khí phong kín trong cú này.
- **Biểu tượng:** a jade ghost lantern with a soul flame. **Màu:** #2fd6a7 / #9dffe3.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Đăng Hồn Đồng Tử** | Tinh Linh | Chú Sư | Minh Môn Dẫn Lộ (bumper) | Minh Môn Sa Chú (sand) | Minh Môn Đại Trận (bumper, spinwash) |
| 2 | **Cốt Kiếm** | Tinh Linh | Ảnh Sát | Minh Môn Dẫn Lộ (bumper) | Minh Môn Truy Ảnh (second) | Minh Môn Đại Trận (bumper, nudge) |
| 3 | **Vong Xuyên Bà Bà** | Tinh Linh | Luân Hồi | Minh Môn Dẫn Lộ (bumper) | Minh Môn Luân Chuyển (spinwash) | Minh Môn Đại Trận (bumper, spin) |
| 4 | **Câu Hồn Sứ** | Tinh Linh | Chú Sư | Minh Môn Dẫn Lộ (bumper) | Minh Môn Sa Chú (sand) | Minh Môn Đại Trận (bumper, reveal) |
| 5 | **U Minh Quỷ Đế** | Tinh Linh | Cuồng Chiến | Minh Môn Dẫn Lộ (bumper) | Minh Môn Cương Kình (power) | U Môn Song Khoá (bumper, sand) |

- **Đăng Hồn Đồng Tử** — Bé trai ma trong suốt với lá bùa vàng trên trán. Cậu cầm đèn lồng dẫn hồn, và đôi khi dẫn cả bi đi lạc. *“Đi theo ánh đèn nhé…”*
- **Cốt Kiếm** — Kiếm sĩ xương đội nón lá, vẫn luyện cơ dù đã chết trăm năm. Hắn quên tên mình nhưng chưa quên một chiêu nào. *“Xương cốt cũ, chiêu thức mới.”*
- **Vong Xuyên Bà Bà** — Bà lão chèo đò trên sông Vong Xuyên, tay cầm bát canh lãng quên. Uống một ngụm, ngươi sẽ quên cú đánh hỏng vừa rồi. *“Uống đi con, quên hết là xong.”*
- **Câu Hồn Sứ** — Sứ giả câu hồn nửa đen nửa trắng của Âm Ty. Xích câu hồn của hắn phong kín lỗ bàn như phong kín cửa luân hồi. *“Cửa này… đã đóng.”*
- **U Minh Quỷ Đế** — Quỷ Đế U Minh, hàm vuông mắt ngọc, tóc là lửa ma. Hắn cai trị đảo vong hồn bằng nắm đấm và cây quyền trượng xương. *“Ở đây, ta là luật.”*

### Tinh Tú Thần Sơn (`tinhtu`)

- **Dấu ấn (5/5 tướng):** Giếng hút.
- **Tuyệt chiêu bậc 5:** Song giếng.

Đài quan tinh trên đỉnh núi cao nhất. Các tinh quan đọc đường bi trong chòm sao và tin rằng mỗi cú đánh đã được viết sẵn trên trời.

- **Linh Đài:** Đá núi khắc chòm sao. Bi trượt lâu hơn trước khi lăn. Nỉ `#453f63`.
- **Thiên Tượng — Tinh Lực:** Sao băng rơi xuống bàn: bi lăn gần tâm sao bị hút cong đường.
- **Biểu tượng:** a seven-star constellation around a moon disc. **Màu:** #8a7cf0 / #ffe9a3.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Lạc Lạc Tinh Linh** | Tinh Linh | Pháp Tu | Tinh Tuyền Dẫn Lộ (well) | Tinh Tuyền Toàn Quyết (spin) | Tinh Tuyền Đại Trận (well, shield) |
| 2 | **Tinh Quan Thủ Vệ** | Hiệp Khách | Hộ Pháp | Tinh Tuyền Dẫn Lộ (well) | Tinh Tuyền Nhu Bích (railcraft) | Tinh Tuyền Đại Trận (well, second) |
| 3 | **Nguyệt Hoa Tiên Tử** | Tinh Linh | Thần Xạ | Tinh Tuyền Dẫn Lộ (well) | Tinh Tuyền Minh Nhãn (reveal) | Tinh Tuyền Đại Trận (well, power) |
| 4 | **Nhật Diệu Chiến Thần** | Tinh Linh | Cuồng Chiến | Tinh Tuyền Dẫn Lộ (well) | Tinh Tuyền Cương Kình (power) | Tinh Tuyền Đại Trận (well, railcraft) |
| 5 | **Tinh Đế Thiên Xu** | Tinh Linh | Pháp Tu | Tinh Tuyền Dẫn Lộ (well) | Tinh Tuyền Toàn Quyết (spin) | Song Tinh Dẫn Độ (well, wind) |

- **Lạc Lạc Tinh Linh** — Tinh linh tí hon da xanh nhạt phát sáng, đôi cánh chuồn chuồn trong suốt. Cô rải sao lên bàn để dẫn bi đi. *“Hihi, sao rơi kìa!”*
- **Tinh Quan Thủ Vệ** — Kỵ sĩ canh giữ đài quan tinh, giáp khắc chòm sao. Anh ta đứng gác ba trăm năm chưa từng chợp mắt. *“Không bi nào qua được chòm Bắc Đẩu.”*
- **Nguyệt Hoa Tiên Tử** — Tiên tử ánh trăng với vầng nguyệt trên trán, tóc tết một bím dài màu đêm. Nàng ngắm bi dưới trăng và chưa từng trượt. *“Trăng soi tới đâu, bi tới đó.”*
- **Nhật Diệu Chiến Thần** — Chiến thần mặt trời tóc lửa, giáp đĩa mặt trời rực sáng. Mỗi cú đánh của nàng nóng như giữa trưa hè. *“Ha! Ánh dương không biết lùi bước!”*
- **Tinh Đế Thiên Xu** — Tinh Đế cai quản bầu trời đêm, áo choàng chứa cả dải ngân hà. Ông có thể biến một lỗ bàn thành hố đen nuốt chửng mọi thứ. *“Mọi vì sao rồi cũng rơi về ta.”*

### Kim Sa Hoàng Triều (`kimsa`)

- **Dấu ấn (5/5 tướng):** Vùng cát.
- **Tuyệt chiêu bậc 5:** Dải cát chừa khe.

Hoàng triều sa mạc dưới mặt trời không bao giờ tắt. Nỉ phủ cát nặng làm bi đi chậm, và kẻ thiếu kiên nhẫn thua trước khi kịp hiểu vì sao.

- **Linh Đài:** Sa thạch khảm vàng. Nỉ cát nặng, ma sát cao. Nỉ `#846e47`.
- **Thiên Tượng — Bão Cát:** Gió cát thổi ngang và cát phủ dày làm bi chậm.
- **Biểu tượng:** a golden sun disc with turquoise wings. **Màu:** #e8b84a / #4fe0d0.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Sa Hồ** | Yêu Tộc | Ảnh Sát | Kim Sa Dẫn Lộ (sand) | Kim Sa Truy Ảnh (second) | Kim Sa Đại Trận (sand, nudge) |
| 2 | **Thạch Tượng Hộ Lăng** | Linh Tượng | Hộ Pháp | Kim Sa Dẫn Lộ (sand) | Kim Sa Nhu Bích (railcraft) | Kim Sa Đại Trận (sand, spin) |
| 3 | **Kim Nhãn Tế Ti** | Hiệp Khách | Chú Sư | Kim Sa Dẫn Lộ (sand) | Kim Sa Truy Ảnh (second) | Kim Sa Đại Trận (sand, reveal) |
| 4 | **Sa Vương Kim Giáp** | Hiệp Khách | Cuồng Chiến | Kim Sa Dẫn Lộ (sand) | Kim Sa Cương Kình (power) | Kim Sa Đại Trận (sand) |
| 5 | **Thái Dương Nữ Hoàng** | Nữ Hiệp | Thần Xạ | Kim Sa Dẫn Lộ (sand) | Kim Sa Minh Nhãn (reveal) | Sa Mạc Khuyết Môn (sand, slick) |

- **Sa Hồ** — Tiểu đạo chích tai cáo sa mạc, khăn vàng che mặt. Cô lướt qua cát nhanh như cơn gió và luôn lấy được thứ mình muốn. *“Của ngươi? Giờ là của ta rồi.”*
- **Thạch Tượng Hộ Lăng** — Tượng sư tử đá canh lăng mộ cổ, sống dậy khi có kẻ xâm phạm. Nó im lặng ngàn năm và có thể chờ thêm ngàn năm nữa. *“…(tiếng đá nghiến)…”*
- **Kim Nhãn Tế Ti** — Lão tế ti trọc đầu với mặt nạ mắt vàng che nửa mặt. Ông nói chuyện với mặt trời và hút năng lượng của kẻ đối diện. *“Mặt trời đã thấy hết, con ạ.”*
- **Sa Vương Kim Giáp** — Sa Vương râu quai nón trong giáp vảy cá sấu vàng. Ông chinh phục sa mạc bằng sức mạnh và muốn chinh phục cả Linh Đài. *“Cát vàng này là lãnh thổ của ta!”*
- **Thái Dương Nữ Hoàng** — Nữ hoàng mặt trời da nâu, tóc tết đen, vương miện vàng rực. Bà ngồi trên ngai đã ba đời và chưa thua một ván nào ở kinh đô. *“Quỳ xuống trước ánh dương.”*

### Vạn Thú Lâm (`vanthu`)

- **Dấu ấn (5/5 tướng):** Rễ vật chắn chữ V.
- **Tuyệt chiêu bậc 5:** Rễ chữ V.

Rừng cổ thụ của linh thú và thần điểu. Rễ cây có thể trồi lên mặt bàn bất cứ lúc nào, và thú ở đây đánh bằng bản năng.

- **Linh Đài:** Vỏ cổ thụ. Băng mềm, bi nảy ít hơn. Nỉ `#394f3e`.
- **Thiên Tượng — Rễ Cổ Thụ:** Rễ cây trồi lên nỉ: bi chạm rễ bật lại như chạm băng.
- **Biểu tượng:** a leaf crown with a beast claw mark. **Màu:** #3fae6a / #ffb04d.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Mộc Linh** | Tinh Linh | Pháp Tu | Mộc Căn Dẫn Lộ (bumper) | Mộc Căn Toàn Quyết (spin) | Mộc Căn Đại Trận (bumper, second) |
| 2 | **Báo Nữ A Man** | Yêu Tộc | Ảnh Sát | Mộc Căn Dẫn Lộ (bumper) | Mộc Căn Truy Ảnh (second) | Mộc Căn Đại Trận (bumper, power, railcraft) |
| 3 | **Thạch Quy Lão** | Yêu Tộc | Hộ Pháp | Mộc Căn Dẫn Lộ (bumper) | Mộc Căn Nhu Bích (railcraft) | Mộc Căn Đại Trận (bumper, railcraft) |
| 4 | **Lôi Ưng Vũ Vương** | Yêu Tộc | Thần Xạ | Mộc Căn Dẫn Lộ (bumper) | Mộc Căn Minh Nhãn (reveal) | Mộc Căn Đại Trận (bumper, wind) |
| 5 | **Thụ Mẫu Thanh Long** | Tinh Linh | Chú Sư | Mộc Căn Dẫn Lộ (bumper) | Mộc Căn Sa Chú (sand) | Cổ Mộc Phân Căn (bumper, well) |

- **Mộc Linh** — Tiểu mộc linh da lá xanh, đội mũ quả sồi. Nó sinh ra từ một hạt giống rơi trên Linh Đài và lớn lên cùng tiếng bi lăn. *“Lá rơi… bi cũng rơi!”*
- **Báo Nữ A Man** — Nữ thợ săn tai báo của Vạn Thú Lâm. Nàng rình bi như rình mồi rồi vồ liền ba cú. *“Đứng im. Ta đang săn.”*
- **Thạch Quy Lão** — Lão rùa đá mai rêu, đeo kính tròn, sống lâu hơn cả khu rừng. Ông chậm, nhưng chưa từng để lọt một bi. *“Chậm mà chắc, cháu ạ.”*
- **Lôi Ưng Vũ Vương** — Vũ Vương mình người đầu ưng, cánh mang sấm sét. Ông nhìn thấy đường bi từ trên cao như nhìn con mồi dưới đất. *“Từ trên cao, mọi thứ đều rõ.”*
- **Thụ Mẫu Thanh Long** — Thụ Mẫu da vỏ cây, tóc là tán lá điểm hoa trắng, thanh long cuộn quanh vai. Bà là mẹ của cả khu rừng. *“Rễ của ta ăn sâu hơn ngươi tưởng.”*

### Hư Không Uyên (`hukhong`)

- **Dấu ấn (5/5 tướng):** Hút miệng lỗ; giếng trên nỉ ở bàn phăng.
- **Tuyệt chiêu bậc 5:** Hút vành lỗ.

Vực sâu nơi hiện thực bị xé rách. Mọi thứ đến gần đều bị nuốt, kể cả ánh sáng; miệng lỗ của Linh Đài Hư Không phập phồng như đang thở.

- **Linh Đài:** Hắc thạch nứt vỡ. Miệng lỗ rộng hơn một chút. Nỉ `#543d5b`.
- **Thiên Tượng — Hư Không Thở:** Miệng lỗ phình to hoặc co hẹp trong cú này.
- **Biểu tượng:** a single void eye inside a cracked ring. **Màu:** #b44fe0 / #ff5fe0.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Hư Trùng** | Ma Vật | Ảnh Sát | Hư Uyên Dẫn Lộ (well) | Hư Uyên Truy Ảnh (second) | Hư Uyên Đại Trận (well, spin) |
| 2 | **Phệ Hồn Thú** | Ma Vật | Cuồng Chiến | Hư Uyên Dẫn Lộ (well) | Hư Lực (power) | Hư Uyên Đại Trận (well, reveal, sand) |
| 3 | **Vô Diện Khách** | Tinh Linh | Luân Hồi | Hư Uyên Dẫn Lộ (well) | Hư Uyên Luân Chuyển (spinwash) | Hư Uyên Đại Trận (teleport, well) |
| 4 | **Hư Không Mẫu Hoàng** | Yêu Tộc | Chú Sư | Hư Uyên Dẫn Lộ (well) | Hư Uyên Sa Chú (sand) | Hư Uyên Đại Trận (well, slick) |
| 5 | **Thôn Thiên Ma Vương** | Ma Vật | Cuồng Chiến | Hư Uyên Dẫn Lộ (well) | Hư Uyên Cương Kình (power) | Hư Uyên Nhiếp Khẩu (well, vortex) |

- **Hư Trùng** — Con bọ hư không nhỏ xíu, mắt hồng phát sáng. Nó đào hang xuyên qua hiện thực và gặm năng lượng của đối thủ. *“Kẹt kẹt kẹt!”*
- **Phệ Hồn Thú** — Quái thú hư không có cái miệng răng nanh ngay giữa bụng. Nó gầm lên làm cả Linh Đài rung chuyển. *“GRRRAAAH!”*
- **Vô Diện Khách** — Lữ khách không mặt, chiếc mặt nạ trơn phản chiếu bầu trời sao. Không ai biết hắn đến từ đâu, và hắn có thể ở bất cứ đâu. *“Ta là không ai cả.”*
- **Hư Không Mẫu Hoàng** — Mẫu Hoàng hư không ba mắt, giáp kitin tím, râu côn trùng rung rung. Bà sinh ra cả bầy hư trùng và không biết thế nào là thương xót. *“Con của ta đói rồi.”*
- **Thôn Thiên Ma Vương** — Ma Vương nuốt trời, thân khổng lồ nứt vỡ ánh sáng hồng. Hắn đã nuốt mười hai vì sao và đang thèm vì thứ mười ba. *“Mọi thứ… đều sẽ bị nuốt.”*

### Thiên Hương Các (`thienhuong`)

- **Dấu ấn (5/5 tướng):** Dòng xoáy.
- **Tuyệt chiêu bậc 5:** Hai xoáy ngược chiều.

Lầu các lụa hồng giữa hồ trăng, nơi các mỹ nhân luyện mị thuật bằng vũ điệu, tiếng đàn và hương thơm. Kẻ đến thách đấu thường mất hồn trước khi mất ván.

- **Linh Đài:** Gỗ sơn son khảm mẫu đơn. Nỉ lụa, bi trượt êm hơn. Nỉ `#5e3a4d`.
- **Thiên Tượng — Lụa Trải:** Lụa trải trên nỉ: bi lướt qua lụa trượt êm và lăn xa hơn.
- **Biểu tượng:** a folding fan open over a peony. **Màu:** #d6407a / #ffd1a8.

| Bậc | Tướng | Giới | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Hồng Liên** | Nữ Hiệp | Ảnh Sát | Hương Lưu Dẫn Lộ (vortex) | Hương Lưu Truy Ảnh (second) | Hương Lưu Đại Trận (vortex, power) |
| 2 | **Tử Trinh** | Nữ Hiệp | Chú Sư | Hương Lưu Dẫn Lộ (vortex) | Hương Lưu Sa Chú (sand) | Hương Lưu Đại Trận (vortex, railcraft) |
| 3 | **Ngân Cầm** | Nữ Hiệp | Pháp Tu | Hương Lưu Dẫn Lộ (vortex) | Hương Lưu Toàn Quyết (spin) | Hương Lưu Đại Trận (vortex, wind) |
| 4 | **Kim Phượng** | Nữ Hiệp | Cuồng Chiến | Hương Lưu Dẫn Lộ (vortex) | Hương Lưu Cương Kình (power) | Hương Lưu Đại Trận (vortex) |
| 5 | **Mị Cơ Các Chủ** | Nữ Hiệp | Luân Hồi | Hương Lưu Dẫn Lộ (vortex) | Hương Lưu Luân Chuyển (spinwash) | Song Vũ Nghịch Toàn (vortex, spinwash) |

- **Hồng Liên** — Vũ cơ tay áo dài của Thiên Hương Các. Mỗi bước nhảy của nàng để lại tàn ảnh, và đối thủ không biết đâu mới là thật. *“Nhìn theo tay áo ta này…”*
- **Tử Trinh** — Nữ điều hương tóc tím, nốt ruồi dưới mắt. Mùi hương của nàng khiến người ta quên cả cách cầm cơ. *“Thơm không? Hít thêm chút nữa đi…”*
- **Ngân Cầm** — Cầm sư tóc bạch kim, cây đàn tranh không bao giờ rời lưng. Tiếng đàn của nàng dẫn bi trôi về lỗ như nước chảy. *“Nghe kỹ… bi đang hát đấy.”*
- **Kim Phượng** — Đao phiến khách tóc lửa, đôi quạt thép không rời thắt lưng. Đẹp, nhưng là mỹ nhân duy nhất của Thiên Hương thích đánh trực diện. *“Mê ta à? Thử đỡ cú này trước đã.”*
- **Mị Cơ Các Chủ** — Các chủ Thiên Hương, nhan sắc khuynh quốc khuynh thành. Người ta nói chưa ai nhìn thẳng vào mặt nàng sau tấm quạt mà còn giữ được ván đấu. *“Ngươi thua rồi, từ lúc nhìn thấy ta.”*

## Địa Thế (chế độ Tiên Đạo)

Mỗi Linh Đài có đặc tính riêng (ma sát, độ nảy băng, miệng lỗ). Đầu mỗi lượt có 25% khả năng nổi Thiên Tượng của môn phái, kéo dài một cú đánh, được báo trước và vẽ lên bàn. Thiên Tượng là lực và ma sát thật trong mô phỏng (`src/game/terrain.ts`); lực nghiêng/gió chỉ tác động lên bi đang lăn và luôn nhỏ hơn lực cản lăn (μr·g ≈ 0,108 m/s²). AI nhận cùng thông số.

**Địa Lợi:** tướng đánh trên Linh Đài của môn phái mình nhận +20% năng lượng và không gặp Thiên Tượng.

## Phong cách hình ảnh

Thuỷ Mặc: giấy dó, mực đen, một màu son; tướng giữ tạo hình anime màu sắc. Chi tiết ở `docs/art-pipeline.md` và `.claude/skills/game-art/references/style-bible.md`.
