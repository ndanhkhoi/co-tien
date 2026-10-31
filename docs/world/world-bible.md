# Cơ Tiên Giới: World Bible

Thế giới của Cơ Tiên cho người viết nội dung, người vẽ và người làm game. Dữ liệu gốc là
`src/game/content/roster.json` (môn phái, hệ, tướng, tên và nhóm cơ chế của chiêu) và
`src/game/content/lore.json` (truyện, tiểu sử). Bảng tướng và chiêu dưới đây được viết tay, nên **sửa
dữ liệu thì sửa luôn file này** trong cùng thay đổi. Cách chiêu và địa thế chạy trong mô phỏng:
[gameplay/skills-and-terrain.md](../gameplay/skills-and-terrain.md).

## Bối cảnh

Cơ Tiên Giới là đại lục tu tiên nơi các môn phái không phân thắng bại bằng gươm đao mà bằng Thần Cơ Đạo: dùng linh lực truyền qua cây cơ để điều khiển bi trên Linh Đài. Mười năm một lần, Thiên Hạ Đệ Nhất Cơ Hội tụ hội cao thủ mười ba môn phái. Bạn là một tán tu vô danh, đi qua từng vùng đất để thách đấu, học chiêu và chiêu mộ đồng đạo.

Toàn bộ tên, truyện, môn phái, nhân vật, chiêu thức và tranh là sáng tác riêng cho Cơ Tiên.

## Hệ (lớp) và nội tại

| Hệ | Nội tại (chế độ Tiên Đạo) |
|---|---|
| Thần Xạ | Khoá hướng ngắm để xem dải lệch khi đổi lực; đổi hướng sẽ mở khoá. |
| Cuồng Chiến | Đầu cơ cứng truyền lực mạnh hơn 10%, nhưng tầm áp phê giảm 25%. |
| Pháp Tu | Trước mỗi cú chọn giữ áp phê ngang hoặc tiến/lùi; trục còn lại giảm. |
| Hộ Pháp | Mỗi lượt cơ được chọn một đoạn băng mềm cho cú của mình. |
| Chú Sư | Sau cú hợp lệ kết thúc lượt, để lại một vùng cát nhỏ tại điểm dừng bi cái cho cú kế của đối thủ. |
| Ảnh Sát | Ăn liền ít nhất 4 bi không đứt chuỗi, cả chuỗi đạt 5 điểm cú đánh (bi thường 1 điểm, cú khó được thêm), rồi chọn soi đường hoặc tăng lực cho cú tiếp theo. |
| Luân Hồi | Hai chiêu cơ bản chung nhịp: dùng luân phiên hồi nhanh hơn một lượt; lặp lại hồi bình thường. |

`kind` là loại tạo hình, độc lập với hệ chiến đấu (`cls`): Hiệp Khách, Nữ Hiệp, Yêu Tộc, Tinh Linh, Linh Tượng, Ma Vật. Đây không phải cột giới tính; nội tại thuộc hệ, không thuộc loại.

## Kỹ năng

Mỗi tướng có **2 chiêu cơ bản** và **1 tuyệt chiêu**. 65 bộ chiêu có 65 tập cơ chế khác nhau. Các vùng, vật chắn, gió, giếng hút, băng và dòng xoáy được mô phỏng chung cho trận thật, đường dự đoán và AI. Tuyệt chiêu luôn là cơ chế mới, không chung nhóm nào với chiêu 1; cổng, rễ và hút miệng lỗ qua `shape`. Trên bàn phăng, hút miệng lỗ trở thành giếng trên nỉ, cổng đặt thành hành lang. Trên bàn phăng, hộ thể chuyển thành chỉnh băng; các chiêu chỉ có ý nghĩa với lỗ được đổi sang hiệu ứng phù hợp. Cổ Điển và thử thách không dùng kỹ năng hoặc nội tại.


Có **34 nhóm cơ chế**, trong đó mười cơ chế đặt trên bàn gồm:

| Mã | Cơ chế | Thao tác và tác động |
|---|---|---|
| `slick` | Dải Trượt | Đặt vùng giảm ma sát, kéo dài đường lăn. |
| `sand` | Sa Trận | Đặt vùng tăng ma sát, hãm bi đi qua. |
| `bumper` | Trấn Vật | Đặt vật phản xạ theo hướng chọn; hình `gate` chừa cổng, `roots` tạo chữ V. |
| `railcraft` | Chỉnh Băng | Chọn đoạn băng và độ mềm/cứng để đổi độ nảy. |
| `wind` | Dẫn Phong | Chọn hướng gió đẩy bi đang lăn. |
| `well` | Tinh Điểm | Đặt tâm hút bẻ cong đường lăn; hình `rim` hút sát miệng lỗ. |
| `spinwash` | Tán Toàn | Đặt vùng làm tiêu áp phê. |
| `vortex` | Toàn Lưu | Đặt tâm và chọn chiều xoáy thuận/nghịch. |
| `silk` | Lụa Mê Hồn | Trải ba xoáy nhỏ thành dải chữ S theo hướng chọn, bẻ cong đường bi bằng lực thật. |
| `quake` | Địa Chấn | Tuyệt chiêu bậc 5: nghiêng bàn theo hướng chọn đúng 1,2 giây đầu, có báo trước. |

**Thang bậc** (`KIND_RANK` trong `src/game/content/sects.ts`): nấc 1 tự thân hoặc thông tin (`vision`, `reveal`, `shield`, `spin`, `power`, `second`, `nudge`, `blind`); nấc 2 quấy một cú hoặc vật trên bàn (`chill`, `freeze`, `sand`, `slick`, `spinwash`, `bumper`, `railcraft`, `wind`, `well`, `vortex`, `blast`, `drain`); nấc 3 điều khiển nhẹ đối thủ (`drift`, `decoy`); nấc 4 ép luật và dời bi (`silk`, `called`, `displace`, `seal`, `maw`, `gravity`); nấc 5 bẻ luật (`swap`, `teleport`, `counter`, `puppet`, `rewind`, `quake`). Nấc của một chiêu là nấc cao nhất trong `kinds`. Chiêu 2 đúng nấc của bậc tướng; tuyệt chiêu cao hơn một nấc, tướng bậc 4 và 5 đều bẻ luật. Tên và icon của chiêu phải nói đúng cơ chế.

Chiêu có thể kéo dài bằng `turns`: tối đa 2 cú của người nhận; chỉ tuyệt chiêu của tướng bậc 5 được 3 cú.
`target: both` áp dụng cho cả hai bên.

Các nhóm quấy phá và outplay (trên bàn phăng, dời bi thành run tay và đổi chỗ thành dời bi cái): `blind` mất đường dự đoán; `drift` dắt lệch hướng đánh;
`called` chỉ định bi phải chạm trước; `displace` dời bi sát lỗ; `swap` đổi chỗ bi; `decoy` đặt bi giả làm vật chắn;
`counter` đặt úp hoá giải chiêu và hút năng lượng; `puppet` đánh thay một cú của đối thủ mà không tính lỗi.

Chiêu đặt cần xác nhận “THI TRIỂN”; huỷ bước đặt không tiêu chiêu. Chiêu cơ bản hồi 2–3 lượt đánh của chính mình theo cơ chế đầu tiên trong `kinds`; tuyệt chiêu cần 100 năng lượng, có sức mạnh bằng bậc tướng cộng 2. `target: opponent` lưu hiệu ứng cho cú của đối thủ, mặc định áp dụng cho bên dùng.

## Môn phái

### Thiên Quang Kiếm Tông (`thienquang`)

- **Dấu ấn (5/5 tướng):** Ba phương án lực/áp phê, đường mô phỏng và điểm dừng.
- **Tuyệt chiêu bậc 5:** Cửu Kiếm Quy Nhất: dịch chuyển bi cái, mở điểm hút miệng lỗ và soi đường bi.

Chính đạo kiếm tông trên dãy núi đá trắng, nơi mặt trời mọc đầu tiên. Đệ tử luyện cơ như luyện kiếm: thẳng, chuẩn, không thừa một li. Linh Đài của họ là chuẩn mực mà mọi môn phái khác dùng để so.

- **Linh Đài:** Đá cẩm thạch trắng, nỉ lam thẫm. Bàn chuẩn mực, không đặc tính. Nỉ `#3c506b`.
- **Thiên Tượng (Gió Núi):** Gió giật từng cơn đẩy bi đang lăn theo hướng gió.
- **Biểu tượng:** a golden flying sword crossing a radiant sun halo. **Màu:** #e9d27a / #9cd3ff.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Tô Kiếm Nhi** | Nữ Hiệp | Thần Xạ | Kiếm Chỉ Đường (vision) | Phi Kiếm Dò Lối (reveal) | Hàn Quang Kiếm Ảnh (chill, second) |
| 2 | **Mạc Thiết Sơn** | Hiệp Khách | Hộ Pháp | Kim Chung Chiếu Lộ (vision) | Trấn Sơn Thủ (freeze) | Thiết Sơn Áp Cơ (drift, freeze) |
| 3 | **Bạch Vân Khanh** | Hiệp Khách | Pháp Tu | Vân Kiếm Tam Lộ (vision) | Mây Cuốn Đầu Cơ (drift) | Vân Hải Phong Môn (seal, blind) |
| 4 | **Lăng Thiên Kỳ** | Nữ Hiệp | Cuồng Chiến | Thương Kiếm Chiếu Tâm (vision) | Chấp Pháp Lệnh (called) | Chấp Pháp Phản Lệnh (counter, reveal) |
| 5 | **Kiếm Thánh Diệp Huyền Quang** | Hiệp Khách | Thần Xạ | Huệ Nhãn (vision) | Kiếm Tâm Phản Chiêu (counter) | Cửu Kiếm Quy Nhất (teleport, maw, reveal) |

- **Tô Kiếm Nhi.** Đệ tử nhỏ nhất Thiên Quang, gác cổng thay sư phụ những hôm trời đẹp. Thua ván nào cô dán thêm một miếng băng lên má, còn thanh phi kiếm lá liễu trên vai thì bay trước dò đường bi cho cô. *“Một cú thẳng, một tiếng rơi. Lần này ta không trượt đâu!”*
- **Mạc Thiết Sơn.** Người giữ cổng sơn môn hai mươi năm, thắng hay thua mặt cũng không đổi sắc. Ông đứng sau lưng ai, cây cơ người ấy nặng như đeo cả ngọn núi. *“Muốn vào núi, hãy thắng ta trước.”*
- **Bạch Vân Khanh.** Thư sinh kiếm khách yêu mây hơn yêu kiếm. Y không chắn đường ai, chỉ thả một làn mây qua đầu cơ đối thủ, rồi cho mây phủ kín miệng lỗ họ đang nhắm. *“Bi cũng như mây, đừng ép, hãy dẫn.”*
- **Lăng Thiên Kỳ.** Chấp pháp trưởng lão, vết sẹo dọc mắt trái là kỷ niệm đêm Huyết Nguyệt. Nàng chỉ bi nào, đối thủ phải chạm bi ấy trước; ai định dùng chiêu với nàng thì vướng ngay điều luật nàng đặt úp sẵn. *“Luật là luật. Phạm lỗi thì nhận phạt.”*
- **Kiếm Thánh Diệp Huyền Quang.** Kiếm Thánh bất lão, người đặt ra Thần Cơ Đạo và Thiên Hạ Đệ Nhất Cơ Hội. Chín thanh phi kiếm đứng quanh ông nghìn năm chưa hạ, như thể ông vẫn đang giữ một cú đánh chưa chịu buông. *“Khi tâm đã thấy, tay chỉ việc theo.”*

### Huyết Sát Ma Môn (`huyetsat`)

- **Dấu ấn (5/5 tướng):** Xung lực hình nón theo hướng cơ tại lần chạm đầu.
- **Tuyệt chiêu bậc 5:** Cửu U Nghịch Thiên: đổi chỗ bi và làm run tay đối thủ trong 3 cú.

Ma môn chinh phạt dựng thành trên quặng sắt đỏ. Với Huyết Sát, một ván bida là một trận chiến, và băng bàn bằng sắt bật bi mạnh như đòn trả đũa.

- **Linh Đài:** Sắt đen gai. Băng cứng, bi bật mạnh hơn. Nỉ `#5b3d3f`.
- **Thiên Tượng (Địa Chấn):** Mặt đất rung: các bi đang nằm yên bị xê dịch nhẹ khi bạn đánh.
- **Biểu tượng:** a blood moon pierced by a black iron halberd. **Màu:** #c1272d / #ff7a45.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Hắc Lang** | Hiệp Khách | Ảnh Sát | Lang Nha Bộc (blast) | Huyết Trảo (second) | Lang Vương Tập Kích (power, chill) |
| 2 | **Đồ Cuồng** | Hiệp Khách | Cuồng Chiến | Cuồng Huyết (blast) | Chấn Địa (freeze) | Cuồng Phong Loạn Cơ (drift, chill) |
| 3 | **Huyết Cơ Mị Nương** | Nữ Hiệp | Chú Sư | Huyết Chú (blast) | Tơ Máu Khiên Hồn (drift) | Xích Nguyệt Nhiếp Tâm (called, chill) |
| 4 | **Tư Đồ Liệt** | Hiệp Khách | Cuồng Chiến | Hành Quân Lệnh (blast) | Phá Trận (displace) | Thiết Kỵ Tái Chiến (rewind, power) |
| 5 | **Ma Tôn Cửu U** | Yêu Tộc | Luân Hồi | Ma Giác Chấn (blast) | Tiên Tri Ma Nhãn (counter) | Cửu U Nghịch Thiên (swap, chill) |

- **Hắc Lang.** Sát thủ trẻ đội mũ tai sói, được Ma Tôn sai đi theo kẻ lạ. Hắn không cần chiêu gì cao, chỉ cần đối thủ run tay một lần là có cớ đánh thêm một cú. *“Một lần run tay thôi. Ta chỉ cần một.”*
- **Đồ Cuồng.** Gã khổng lồ đeo mặt nạ sắt, gầm một tiếng là cả bàn rung. Đứng trước hắn, tay người khác mỏi rã và đầu cơ cứ lệch theo cơn cuồng của hắn. *“Bida là phải nổ!”*
- **Huyết Cơ Mị Nương.** Huyết pháp sư sau tấm mạng ren đen. Sợi tơ máu của nàng dắt đầu cơ người ta đi lệch, và dưới trăng đỏ, nàng bảo bi nào thì đối thủ phải đánh bi ấy. *“Tay ngươi… đang run đấy à?”*
- **Tư Đồ Liệt.** Tướng quân chinh phạt bốn phương, lá cờ trên lưng chưa từng hạ. Ông dời bi đối thủ khỏi miệng lỗ như rút quân khỏi cửa ải, trận nào hỏng thì thu quân đánh lại. *“Phá trận trước, ăn bi sau.”*
- **Ma Tôn Cửu U.** Ma Tôn của Huyết Sát, kẻ đã lùi thời gian hàng trăm lần để cứu một người rơi vào Hư Không đêm Huyết Nguyệt. Hắn thấy trước chiêu của đối thủ và biết cách đổi chỗ thắng thua trên bàn. *“Ta đã thấy ván này kết thúc thế nào rồi.”*

### Hoa Linh Tiên Đảo (`hoalinh`)

- **Dấu ấn (5/5 tướng):** Gió có hướng.
- **Tuyệt chiêu bậc 5:** Song Điệp Nghịch Mộng: đổi chỗ hai bi, dắt lệch cơ và che mắt đối thủ trong 3 cú.

Đảo hoa đào trôi giữa mây, quê của hồ ly linh và gió xuân. Người Hoa Linh tin rằng bi lăn đẹp nhất khi người đánh không vội.

- **Linh Đài:** Gỗ anh đào. Nỉ êm, bi lăn mượt hơn chút. Nỉ `#3b5d57`.
- **Thiên Tượng (Xuân Phong):** Gió xuân giật từng cơn đẩy bi đang lăn.
- **Biểu tượng:** a five-petal peach blossom with a curled fox tail. **Màu:** #e07aa5 / #b8f0e0.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Thanh Liên Đại Sư** | Hiệp Khách | Hộ Pháp | Liên Phong Tịnh Tâm (wind) | Tâm Tĩnh Như Thủy (shield) | Thiên Liên Kết Giới (sand, shield) |
| 2 | **Phong Linh Tử** | Hiệp Khách | Ảnh Sát | Phong Ảnh (wind) | Chuông Bạc Nhiếp Hồn (chill) | Trúc Ảnh Phân Thân (decoy) |
| 3 | **Đào Tiểu Muội** | Nữ Hiệp | Pháp Tu | Xuân Hồ Dẫn Phong (wind) | Tiểu Hồ Kéo Cơ (drift) | Tiểu Hồ Tha Bi (displace) |
| 4 | **Hồ Tiên Nguyệt Ly** | Yêu Tộc | Chú Sư | Hồ Tức Dẫn Lưu (wind) | Hồ Mị Điểm Châu (called) | Cửu Vĩ Hoán Hồn (swap, blind) |
| 5 | **Đảo Chủ Mộng Hoa** | Nữ Hiệp | Luân Hồi | Mộng Điệp (wind) | Hồi Mộng (rewind) | Song Điệp Nghịch Mộng (swap, drift, blind) |

- **Thanh Liên Đại Sư.** Lão tăng quét lá đào ở bến đảo, người dạy cú đầu tiên cho mọi khách mới. Ông không tranh hạng; đánh với ông, bi của khách chậm lại giữa những cánh sen. *“Tâm tĩnh thì bi tự vào.”*
- **Phong Linh Tử.** Kiếm khách lang thang ngậm cọng cỏ, buộc chuông bạc trên tóc. Chuông kêu một tiếng là tay đối thủ run, và giữa rừng trúc, người ta không còn biết quả bi nào là bóng. *“Gió thổi đâu, bi theo đó.”*
- **Đào Tiểu Muội.** Cô bé mười hai tuổi má phúng phính, được linh hồ ngàn năm chọn làm chủ. Con hồ ly trên đầu em hay kéo cơ người ta lệch đi, và bi đối thủ nằm sát miệng lỗ là nó ngậm tha về giữa bàn. *“Hoa rơi đúng chỗ, bi cũng vậy!”*
- **Hồ Tiên Nguyệt Ly.** Cửu vĩ hồ tiên tu ngàn năm. Đuôi nàng điểm bi nào, đối thủ phải chạm bi ấy trước; chín cái đuôi phẩy một lượt là hai quả bi đổi chỗ, còn mắt người xem thì mờ đi. *“Ngươi nhìn bi, hay nhìn ta?”*
- **Đảo Chủ Mộng Hoa.** Chủ nhân đảo Hoa Linh, sống giữa mơ và thực. Ván nào thua, nàng tỉnh mộng và đánh lại; ván nào đối thủ sắp thắng, nàng cho họ mơ một giấc trong đó bi đã đổi chỗ. *“Ván này… chỉ là một giấc mơ thôi.”*

### Băng Phách Tuyết Cung (`bangphach`)

- **Dấu ấn (5/5 tướng):** Vùng nỉ trơn.
- **Tuyệt chiêu bậc 5:** Nguyệt Ngưng Thời Khắc: quay ngược thời gian ván đấu và tạo hộ thể bảo vệ bi.

Cung điện băng phương Bắc dưới cực quang. Nỉ ở đây lạnh và trơn, bi lăn xa đến mức người ngoại bang thường đánh quá tay.

- **Linh Đài:** Khung băng tạc. Nỉ trơn, bi lăn xa. Nỉ `#436373`.
- **Thiên Tượng (Bão Tuyết):** Đụn tuyết phủ lên nỉ: bi lăn vào đụn tuyết chậm hẳn lại.
- **Biểu tượng:** a six-petal ice lotus inside a crescent moon. **Màu:** #6cc4ef / #e6fbff.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Lạc Sương** | Tinh Linh | Pháp Tu | Sương Liên Khai Kính (slick) | Ngọc Liên Toàn Vũ (spin) | Tịnh Liên Tán Toàn (spinwash, chill) |
| 2 | **Hàn Thạch** | Hiệp Khách | Hộ Pháp | Thuẫn Hàn Kính (slick) | Sương Phong Thấu Cốt (chill) | Ảnh Băng Trấn Bàn (decoy, freeze) |
| 3 | **Tuyết Nhi** | Nữ Hiệp | Thần Xạ | Băng Tiễn Chỉ Lộ (slick) | Hàn Mục Mê Hướng (drift) | Băng Tiễn Phong Khẩu (seal, freeze) |
| 4 | **Bắc Minh Cuồng Hùng** | Yêu Tộc | Cuồng Chiến | Hùng Chưởng Băng Ngân (slick) | Chấn Băng Hất Châu (displace) | Bạch Hùng Ném Bi (teleport, power) |
| 5 | **Cung Chủ Hàn Nguyệt** | Nữ Hiệp | Chú Sư | Hàn Khí Xâm Cốt (slick) | Nguyệt Ảnh Hoán Vị (swap) | Nguyệt Ngưng Thời Khắc (rewind, shield) |

- **Lạc Sương.** Tiên nữ áo băng hai mươi tuổi, người tiếp khách lạ đầu tiên ở Tuyết Cung. Nàng dạy khách đánh nhẹ trên nỉ sương, và bi lăn qua làn sương của nàng thì mất hết áp phê. *“Nhẹ thôi, như sương đọng trên sen.”*
- **Hàn Thạch.** Hộ vệ gác cửa đại điện ba mươi năm, giáp băng không bao giờ tan. Ít nói, nhưng khi anh dựng những quả bi băng giả lên bàn thì đối thủ đứng im rất lâu. *“Giữ vững.”*
- **Tuyết Nhi.** Cô bé mười lăm tuổi, cung thủ giỏi nhất Tuyết Cung. Mũi tên băng của em ghim chặt miệng lỗ đối thủ đang nhắm. Cung Chủ nói thẳng: mười năm nữa, ngai băng là của em. *“Băng không lệch, tên cũng không lệch!”*
- **Bắc Minh Cuồng Hùng.** Chiến binh nửa người nửa gấu trắng, con của một hộ vệ Tuyết Cung và linh thú gấu Vạn Thú. Hắn hất bi đối thủ khỏi miệng lỗ, rồi nhấc bi cái ném tới chỗ mình thích. *“GRAAAH! Bàn này của ta!”*
- **Cung Chủ Hàn Nguyệt.** Cung chủ Băng Phách, người khoá thời gian quanh cung suốt trăm năm để bông sen của mẹ không tàn. Nàng bắt được khoảnh khắc vừa qua đứng lại để đánh lần nữa. *“Mùa đông đã đến. Với ngươi.”*

### Thiên Cơ Các (`thienco`)

- **Dấu ấn (5/5 tướng):** Vật phản xạ.
- **Tuyệt chiêu bậc 5:** Thiên Cơ Đoán Mệnh: đổi chỗ hai bi và ép đối thủ chạm bi chỉ định trong 3 cú.

Các lâu đồng thau của những nhà cơ quan thuật. Họ tính đường bi bằng bàn tính, la bàn và bánh răng, và là những người đầu tiên đo được góc bật băng.

- **Linh Đài:** Đồng thau bánh răng. Bàn chuẩn xác, không đặc tính. Nỉ `#365858`.
- **Thiên Tượng (Cơ Quan Nghiêng):** Cơ quan nâng một đầu bàn: bi lăn chậm trôi về một phía.
- **Biểu tượng:** a brass gear with a cyan lightning core. **Màu:** #d9a441 / #7fe3ff.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Hoả Lôi Tiên Sinh** | Hiệp Khách | Cuồng Chiến | Lôi Pháo Trấn Vật (bumper) | Pháo Chấn (power) | Thần Hoả Lôi Pháo (blast, chill) |
| 2 | **Mộc Ngưu** | Linh Tượng | Hộ Pháp | Cơ Giáp (bumper) | Bánh Răng Kẹt Cơ (freeze) | Mộc Ngưu Kéo Cày (drift, sand) |
| 3 | **Tiểu Ban** | Hiệp Khách | Thần Xạ | Đồng Tước Trấn Lộ (bumper) | Đồng Tước Giả Châu (decoy) | Thần Nỏ Điểm Châu (called, slick) |
| 4 | **Lỗ Diệu Diệu** | Nữ Hiệp | Pháp Tu | Con Quay Thần (bumper) | Tơ Linh Điểm Châu (called) | Khôi Lỗi Hoán Châu (swap, freeze) |
| 5 | **Thần Toán Gia Cát Vân** | Hiệp Khách | Luân Hồi | La Bàn Trấn Cơ (bumper) | Bát Môn Trận (counter) | Thiên Cơ Đoán Mệnh (swap, called) |

- **Hoả Lôi Tiên Sinh.** Nhà chế tạo râu cháy xém, xếp hạng thấp nhất Thiên Cơ vì làm nổ nhiều xưởng nhất. Ông lén chế máy đo Hư Không; mỗi phát pháo của ông nổ tung cụm bi và làm tay đối thủ run cầm cập. *“Lần này chắc chắn nổ đúng chỗ!”*
- **Mộc Ngưu.** Trâu gỗ cơ quan canh kho bản vẽ, chưa thấy ấn của Các Chủ thì chưa nhích. Khi nó kéo cày, nỉ thành luống cát và đầu cơ đối thủ bị dây ách lôi đi. *“…kẽo kẹt… (tiếng bánh răng)”*
- **Tiểu Ban.** Cậu học việc mười bốn tuổi đã ráp xong cỗ nỏ đồng trưởng lão bỏ dở. Chim đồng của cậu gập cánh thành bi giả, còn mũi nỏ cắm vào bi nào thì đối thủ phải chạm bi ấy trước. *“Bánh răng không biết nói dối.”*
- **Lỗ Diệu Diệu.** Nữ cơ quan sư mười chín tuổi điều khiển rối gỗ bằng tơ linh. Sợi tơ buộc vào bi nào, đối thủ phải đánh bi ấy; giật một lượt, hai quả bi đổi chỗ như hai con rối đổi vai. *“Rối của ta không bao giờ trượt tay.”*
- **Thần Toán Gia Cát Vân.** Thần toán của Thiên Cơ Các, học trò cũ của Tinh Đế, bỏ đi vì không chịu để sao viết sẵn đời mình. Ông tính trước mười cú, đổi chỗ bi rồi chỉ định bi đối thủ phải đánh. *“Ván này ta đã thắng từ ba cú trước.”*

### Độc Vụ Cốc (`docvu`)

- **Dấu ấn (5/5 tướng):** Vùng tiêu áp phê.
- **Tuyệt chiêu bậc 5:** Quỷ Y Hoàn Nguyên: đảo ngược trạng thái bàn về vị trí trước cú đánh.

Thung lũng chướng khí, nơi các y sư và cổ sư nuôi độc như nuôi con. Linh Đài mục rêu làm bi chậm lại, như mọi thứ khác trong sương độc.

- **Linh Đài:** Gỗ mục rêu phong. Nỉ ẩm, bi chậm hơn. Nỉ `#45523b`.
- **Thiên Tượng (Vũng Độc):** Vũng độc nhớt: bi đi qua mất áp phê và trượt ngắn lại.
- **Biểu tượng:** a coiled green snake around a potion gourd. **Màu:** #7ccd3c / #d8ff6a.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Lục Xà** | Yêu Tộc | Ảnh Sát | Xà Độc Tán Toàn (spinwash) | Xà Ảnh (second) | Vạn Xà Quy Huyệt (blind, drain) |
| 2 | **Độc Thủ Lão Quái** | Hiệp Khách | Chú Sư | Độc Vụ (spinwash) | Hồ Lô Sa Chướng (sand) | Độc Chướng Ảo Châu (decoy, chill) |
| 3 | **Ngũ Độc Đồng Tử** | Hiệp Khách | Pháp Tu | Cổ Trùng Tán Kình (spinwash) | Cổ Trùng Cắn Tay (drift) | Ngũ Độc Phong Huyệt (seal, chill) |
| 4 | **Huyết Lang Nhân** | Ma Vật | Ảnh Sát | Lang Trảo Tiêu Toàn (spinwash) | Lang Nhãn Khoá Mồi (called) | Bóng Sói Vồ Mồi (teleport, second) |
| 5 | **Quỷ Y Dược Vương** | Nữ Hiệp | Luân Hồi | Ngân Châm Giải Toàn (spinwash) | Kim Châm Hộ Mạch (counter, shield) | Quỷ Y Hoàn Nguyên (rewind) |

- **Lục Xà.** Thiếu nữ rắn mười tám tuổi, mắt hổ phách khe dọc. Nàng phun một làn độc che mắt đối thủ, hút cạn linh lực của họ, rồi chờ đúng một cú để ra tay. *“Ssss… đến lượt ta.”*
- **Độc Thủ Lão Quái.** Lão độc sư râu dài, bầu độc đeo hông. Khói từ bầu của lão đọng thành những quả bi ảo, ai hít phải thì tay run như sốt rét. *“Hít sâu vào, cháu ngoan…”*
- **Ngũ Độc Đồng Tử.** Cậu bé mười hai tuổi đầu cạo chừa một chỏm, năm con cổ trùng là bạn thân. Bọn nhỏ cắn tay đối thủ cho lệch cơ, rồi bò vào nằm chắn kín một miệng lỗ. *“Bọn nhỏ của tớ đói rồi!”*
- **Huyết Lang Nhân.** Sói người đột biến từ dược thuật, ống thuốc xanh cắm sau lưng. Hắn khoá mắt vào một quả bi và bắt đối thủ chạm nó trước; tới lượt mình, hắn vồ bi cái tới chỗ nào tuỳ thích rồi đánh liền hai cú. *“Gừ… thêm một bi nữa…”*
- **Quỷ Y Dược Vương.** Quỷ Y của Độc Vụ, hành nghề từ Đại Kiếp, bảy trăm năm mới luyện xong Hồi Xuân Đan. Kim châm của bà chặn đứng chiêu đối thủ, còn cú đánh hỏng thì bà chữa như chữa bệnh: đánh lại. *“Hỏng à? Uống viên này rồi đánh lại.”*

### Hải Long Bang (`hailong`)

- **Dấu ấn (5/5 tướng):** Băng mềm/cứng và dòng chảy.
- **Tuyệt chiêu bậc 5:** Long Vương Hải Khiếu: địa chấn nghiêng bàn kéo cả bi đang nằm yên.

Bến cảng hải tặc nằm trên lưng một con rồng biển đã ngủ. Ở Hải Long, cược bằng vàng, thua thì xuống thuyền chèo, và bàn bida chòng chành theo sóng.

- **Linh Đài:** Gỗ thuyền đinh đồng. Băng mềm như mạn tàu. Nỉ `#375a61`.
- **Thiên Tượng (Sóng Lừng):** Bàn chòng chành qua lại như trên thuyền.
- **Biểu tượng:** a sea dragon coiled around an anchor. **Màu:** #e0782f / #5fd7c8.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Thiết Neo Lão Kình** | Hiệp Khách | Hộ Pháp | Thiết Neo Dẫn Lưu (railcraft, wind) | Cự Neo Hộ Thân (shield) | Neo Trấn Biển (bumper, freeze) |
| 2 | **Sa Đại Đao** | Yêu Tộc | Cuồng Chiến | Sa Đao Dẫn Triều (railcraft, wind) | Hàm Mập Doạ Hồn (chill) | Vây Mập Cuộn Sóng (drift, vortex) |
| 3 | **Tiểu Ngư** | Nữ Hiệp | Ảnh Sát | Lướt Sóng (railcraft, wind) | Vẹt Quấy Cơ (drift) | Hải Tặc Cướp Bi (displace, decoy) |
| 4 | **Thuyền Nương Lưu Hương** | Nữ Hiệp | Thần Xạ | Thuận Phong Chỉnh Mạn (railcraft, wind) | Viễn Kính Chỉ Mục (called) | Hạm Trưởng Tái Chinh (rewind, reveal) |
| 5 | **Đông Hải Long Vương** | Yêu Tộc | Chú Sư | Thủy Triều (railcraft, wind) | Hải Triều Hoán Vị (swap) | Long Vương Hải Khiếu (quake) |

- **Thiết Neo Lão Kình.** Lão thuỷ thủ to như cá voi, đã gác neo về hưu, giờ ngồi đầu bến đón khách. Lão đánh chậm, phạm lỗi cũng chẳng sợ; ai khinh lão thì cây neo thả xuống bàn sẽ dạy lại. *“Biển không vội. Ta cũng thế.”*
- **Sa Đại Đao.** Gã hải tặc răng cá mập, đao to như mái chèo. Hắn nhe răng một cái là tay đối thủ run, vây cá mập lượn qua là nỉ cuộn sóng kéo lệch đầu cơ. *“Ngoạm!”*
- **Tiểu Ngư.** Cô bé hải tặc mười bốn tuổi lướt sóng giỏi nhất Hải Long. Con vẹt trên vai em làm lệch cơ người ta, rồi sà xuống cướp quả bi sát lỗ, để lại mấy quả bi giả thay vào. *“Vẹt ơi, kêu to lên!”*
- **Thuyền Nương Lưu Hương.** Thuyền trưởng tóc xoăn đỏ, ống nhòm luôn trong tay. Nàng chỉ một bi là cả bàn phải nghe, và đi sai đường thì quay mũi tàu chạy lại từ đầu. *“Gió đã thuận. Nhổ neo!”*
- **Đông Hải Long Vương.** Long Vương Đông Hải, giữ sổ âm thu phí qua cửa của các hồn trôi ra biển. Ông gọi thuỷ triều đổi chỗ bi, và khi nổi giận thì nghiêng cả mặt bàn như sóng thần. *“Biển cả không thua ai bao giờ.”*

### U Minh Đảo (`uminh`)

- **Dấu ấn (5/5 tướng):** Cặp cổng vật lý.
- **Tuyệt chiêu bậc 5:** U Minh Song Quan: đổi chỗ hai bi và phong ấn miệng lỗ trong 3 cú.

Hòn đảo của vong hồn trên dòng sông lãng quên. Người chết vẫn chơi bida ở đây, và các lỗ bàn đôi khi mở, đôi khi bị quỷ khí phong kín.

- **Linh Đài:** Gỗ đen xương. Nỉ xám tro, không đặc tính. Nỉ `#3f4a44`.
- **Thiên Tượng (Quỷ Môn):** Một lỗ bị quỷ khí phong kín trong cú này.
- **Biểu tượng:** a jade ghost lantern with a soul flame. **Màu:** #2fd6a7 / #9dffe3.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Vong Xuyên Bà Bà** | Tinh Linh | Luân Hồi | Vong Xuyên Độ Khẩu (bumper) | Đèn Đò Soi Bến (reveal) | Cầu Luân Hồi (blind, chill) |
| 2 | **Cốt Kiếm** | Tinh Linh | Ảnh Sát | Cốt Ảnh (bumper) | Xương Vụn Ghim Tay (freeze) | Đầu Lâu Giả Châu (decoy) |
| 3 | **Đăng Hồn Đồng Tử** | Tinh Linh | Chú Sư | Hồn Đăng Khai Môn (bumper) | Dẫn Hồn (drift) | Bách Quỷ Dạ Hành (called, blind) |
| 4 | **Câu Hồn Sứ** | Tinh Linh | Chú Sư | Xích Câu Hồn (bumper) | Xích Câu Kéo Châu (displace) | Câu Hồn Đoạt Phách (counter, drain) |
| 5 | **U Minh Quỷ Đế** | Tinh Linh | Cuồng Chiến | Quỷ Trượng Khai Quan (bumper) | Quỷ Môn Di Hồn (teleport) | U Minh Song Quan (swap, seal) |

- **Vong Xuyên Bà Bà.** Bà lão chèo đò sông Vong Xuyên, người vớt khách lạ lên từ nước. Ngọn đèn trên mái chèo của bà soi rõ đường bi, còn bát canh của bà làm người ta quên đường ngắm và lạnh tay. *“Uống bát canh đã, rồi hẵng cầm cơ.”*
- **Cốt Kiếm.** Kiếm sĩ xương đội nón lá, vẫn luyện cơ dù đã chết trăm năm. Hắn quên tên mình nhưng chưa quên chiêu nào, kể cả trò xếp đầu lâu thành bi giả. *“Xương cốt cũ, chiêu thức mới.”*
- **Đăng Hồn Đồng Tử.** Tiểu quỷ cầm đèn trông như đứa trẻ, nhưng đã giữ đèn ở bến hồn cả nghìn năm. Đèn của nó dẫn lệch đầu cơ người sống, và soi vào bi nào thì đối thủ phải đánh bi ấy trong bóng tối. *“Đi theo đèn nhé, đừng lạc.”*
- **Câu Hồn Sứ.** Sứ giả câu hồn nửa đen nửa trắng của Âm Ty. Xích của hắn kéo bi khỏi miệng lỗ, rồi nằm cuộn chờ sẵn: chiêu nào đối thủ tung ra cũng bị câu mất, cùng phần linh lực. *“Chiêu của ngươi… ta câu được rồi.”*
- **U Minh Quỷ Đế.** Đế vương cõi âm không già đi từ ngày lên ngôi. Hắn tự xưng là luật: đặt bi cái ở đâu tuỳ hắn, đổi chỗ bi tuỳ hắn, đóng cửa lỗ nào cũng tuỳ hắn. *“Ở đây, ta là luật.”*

### Tinh Tú Thần Sơn (`tinhtu`)

- **Dấu ấn (5/5 tướng):** Giếng hút.
- **Tuyệt chiêu bậc 5:** Đẩu Chuyển Tinh Di: đổi chỗ hai bi và kích hoạt trọng lực hút bi.

Đài quan tinh trên đỉnh núi cao nhất. Các tinh quan đọc đường bi trong chòm sao và tin rằng mỗi cú đánh đã được viết sẵn trên trời.

- **Linh Đài:** Đá núi khắc chòm sao. Bi trượt lâu hơn trước khi lăn. Nỉ `#453f63`.
- **Thiên Tượng (Tinh Lực):** Sao băng rơi xuống bàn: bi lăn gần tâm sao bị hút cong đường.
- **Biểu tượng:** a seven-star constellation around a moon disc. **Màu:** #8a7cf0 / #ffe9a3.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Lạc Lạc Tinh Linh** | Tinh Linh | Pháp Tu | Tinh Điểm (well) | Sao Băng Dẫn (spin) | Tinh Vân Mờ Mịt (blind, chill) |
| 2 | **Tinh Quan Thủ Vệ** | Hiệp Khách | Hộ Pháp | Đẩu Thuẫn Hấp Châu (well) | Chòm Sao Trấn Lực (freeze) | Bày Sao Giả Trận (decoy, sand) |
| 3 | **Nguyệt Hoa Tiên Tử** | Tinh Linh | Thần Xạ | Nguyệt Cung Quy Tâm (well) | Nguyệt Ảnh Song Châu (decoy) | Mãn Nguyệt Tiễn (called, seal) |
| 4 | **Nhật Diệu Chiến Thần** | Tinh Linh | Cuồng Chiến | Nhật Luân Quy Châu (well) | Liệt Dương Hất Châu (displace) | Thái Dương Hồi Quang (rewind, blast) |
| 5 | **Tinh Đế Thiên Xu** | Tinh Linh | Pháp Tu | Ngân Hà Quy Tụ (well) | Thiên Tinh Phản Chiếu (counter) | Đẩu Chuyển Tinh Di (swap, gravity) |

- **Lạc Lạc Tinh Linh.** Tinh linh tí hon da xanh phát sáng, đôi cánh chuồn chuồn trong suốt. Cô rải bụi sao làm mờ mắt đối thủ, và cái lạnh của tinh vân khiến tay họ run. *“Hihi, sao rơi kìa!”*
- **Tinh Quan Thủ Vệ.** Kỵ sĩ canh đài quan tinh ba trăm năm chưa từng chợp mắt. Anh bày sao giả lên bàn như bày trận Bắc Đẩu, và bi đối thủ lăn qua bụi sao thì chậm hẳn. *“Không bi nào qua được chòm Bắc Đẩu.”*
- **Nguyệt Hoa Tiên Tử.** Tiên tử ánh trăng với vầng nguyệt trên trán, canh gốc quế chờ một vì sao không bao giờ rơi. Bóng trăng của nàng hoá bi giả; mũi tên trăng tròn ghim một quả bi và khép một miệng lỗ. *“Trăng soi tới đâu, bi tới đó.”*
- **Nhật Diệu Chiến Thần.** Chiến thần mặt trời tóc lửa, giáp đĩa mặt trời rực sáng. Nàng hất bi đối thủ khỏi miệng lỗ bằng sức nóng, và cú nào hỏng thì vầng dương của nàng quay ngược lại. *“Ha! Ánh dương không biết lùi bước!”*
- **Tinh Đế Thiên Xu.** Thần sao mang hình hài cậu bé, đôi mắt già hơn cả các vì sao. Người phản chiếu mọi chiêu nhắm vào mình, rồi đổi chỗ bi như đổi chỗ các chòm sao. *“Sao đổi chỗ, bi cũng đổi chỗ.”*

### Kim Sa Hoàng Triều (`kimsa`)

- **Dấu ấn (5/5 tướng):** Vùng cát.
- **Tuyệt chiêu bậc 5:** Thái Dương Bất Lặn: quay ngược thời gian ván đấu và mở điểm hút miệng lỗ.

Hoàng triều sa mạc dưới mặt trời không bao giờ tắt. Nỉ phủ cát nặng làm bi đi chậm, và kẻ thiếu kiên nhẫn thua trước khi kịp hiểu vì sao.

- **Linh Đài:** Sa thạch khảm vàng. Nỉ cát nặng, ma sát cao. Nỉ `#846e47`.
- **Thiên Tượng (Bão Cát):** Gió cát thổi ngang và cát phủ dày làm bi chậm.
- **Biểu tượng:** a golden sun disc with turquoise wings. **Màu:** #e8b84a / #4fe0d0.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Sa Hồ** | Yêu Tộc | Ảnh Sát | Sa Ảnh (sand) | Hồ Bộ Tái Hành (second) | Bão Cát Mù Trời (blind, wind) |
| 2 | **Thạch Tượng Hộ Lăng** | Linh Tượng | Hộ Pháp | Sư Tượng Sa Vực (sand) | Thạch Nhãn Hoá Đá (freeze) | Thạch Châu Trấn Lăng (decoy) |
| 3 | **Kim Nhãn Tế Ti** | Hiệp Khách | Chú Sư | Tế Nhật Sa Đàn (sand) | Kim Nhãn Mê Hướng (drift) | Nhật Thực (blind, seal) |
| 4 | **Sa Vương Kim Giáp** | Hiệp Khách | Cuồng Chiến | Vương Thổ Sa Trì (sand) | Vương Lệnh Chỉ Châu (called) | Sa Vương Đoạt Địa (swap, displace) |
| 5 | **Thái Dương Nữ Hoàng** | Nữ Hiệp | Thần Xạ | Đế Miện Sa Chướng (sand) | Thiên Nhãn (teleport, reveal) | Thái Dương Bất Lặn (rewind, maw) |

- **Sa Hồ.** Tiểu đạo chích tai cáo sa mạc, khăn vàng che mặt. Cô gọi bão cát mù trời đẩy bi người khác lệch đi, và trượt một cú thì được đánh lại như chưa có gì. *“Của ngươi? Giờ là của ta rồi.”*
- **Thạch Tượng Hộ Lăng.** Tượng sư tử đá canh lăng mộ, sống dậy khi có kẻ xâm phạm. Nó nhìn ai là tay người ấy hoá đá, và những tượng con quanh lăng cuộn lại thành bi đá giả. *“…(tiếng đá nghiến)…”*
- **Kim Nhãn Tế Ti.** Lão tế ti trọc đầu với mặt nạ mắt vàng che nửa mặt. Ông dắt lệch đầu cơ người đối diện bằng ánh mắt, rồi gọi nhật thực che mắt họ và đóng luôn một miệng lỗ. *“Mặt trời đã thấy hết, con ạ.”*
- **Sa Vương Kim Giáp.** Sa Vương râu quai nón trong giáp vảy cá sấu vàng. Lệnh vua chỉ bi nào thì đối thủ đánh bi ấy; còn trên bàn, ông chiếm đất bằng cách đổi chỗ và dời bi của người khác. *“Cát vàng này là lãnh thổ của ta!”*
- **Thái Dương Nữ Hoàng.** Nữ hoàng mặt trời, người giữ vầng dương đứng giữa trời ba trăm năm để dân không chết rét. Mặt trời của bà không lặn, nên cú nào bà đánh hỏng cũng được đánh lại dưới ánh sáng ấy. *“Quỳ xuống trước ánh dương.”*

### Vạn Thú Lâm (`vanthu`)

- **Dấu ấn (5/5 tướng):** Rễ vật chắn chữ V.
- **Tuyệt chiêu bậc 5:** Thanh Long Thụ Giới: đổi chỗ hai bi và rải sa trận hãm bi trong 3 cú.

Rừng cổ thụ của linh thú và thần điểu. Rễ cây có thể trồi lên mặt bàn bất cứ lúc nào, và thú ở đây đánh bằng bản năng.

- **Linh Đài:** Vỏ cổ thụ. Băng mềm, bi nảy ít hơn. Nỉ `#394f3e`.
- **Thiên Tượng (Rễ Cổ Thụ):** Rễ cây trồi lên nỉ: bi chạm rễ bật lại như chạm băng.
- **Biểu tượng:** a leaf crown with a beast claw mark. **Màu:** #3fae6a / #ffb04d.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Mộc Linh** | Tinh Linh | Pháp Tu | Sồi Non Phân Rễ (bumper) | Diệp Toàn Quyết (spin) | Tiểu Linh Khai Lâm (spinwash, second) |
| 2 | **Báo Nữ A Man** | Yêu Tộc | Ảnh Sát | Liệp Trảo Mộc Chướng (bumper) | Báo Hống Kinh Hồn (chill) | Báo Vương Vờn Mồi (drift, blind) |
| 3 | **Thạch Quy Lão** | Yêu Tộc | Hộ Pháp | Mai Rùa (bumper) | Đá Cuội Giả Châu (decoy) | Huyền Vũ Trấn Châu (called, freeze) |
| 4 | **Lôi Ưng Vũ Vương** | Yêu Tộc | Thần Xạ | Dực Căn Trấn Lộ (bumper) | Lôi Ưng Quắp Châu (displace) | Lôi Ưng Giáng Không (teleport, spin) |
| 5 | **Thụ Mẫu Thanh Long** | Tinh Linh | Chú Sư | Dây Leo Trói (bumper) | Thụ Linh Phản Phệ (counter) | Thanh Long Thụ Giới (swap, sand) |

- **Mộc Linh.** Tiểu mộc linh da lá xanh, đội mũ quả sồi, sinh ra từ một hạt giống rơi trên Linh Đài. Lá nó rắc lên nỉ làm bi mất xoáy, còn hạt giống thì luôn cho nó thêm một lần thử. *“Lá rơi… bi cũng rơi!”*
- **Báo Nữ A Man.** Nữ thợ săn tai báo của Vạn Thú Lâm. Nàng gầm một tiếng là con mồi run tay, rồi vờn đầu cơ đối thủ trong bóng lá cho tới khi họ đánh lệch. *“Đứng im. Ta đang săn.”*
- **Thạch Quy Lão.** Lão rùa đá mai rêu, sống lâu hơn cả khu rừng. Ông lăn mấy hòn cuội tròn lên bàn cho giống bi, và mai rùa đè lên bi nào thì đối thủ phải chậm rãi chạm bi ấy trước. *“Chậm mà chắc, cháu ạ.”*
- **Lôi Ưng Vũ Vương.** Vũ Vương đầu ưng cánh sấm. Ông quắp bi đối thủ khỏi miệng lỗ, rồi từ trên cao thả bi cái xuống bất cứ đâu, xoáy theo ý mình. *“Từ trên cao, mọi thứ đều rõ.”*
- **Thụ Mẫu Thanh Long.** Thụ Mẫu da vỏ cây, tóc tán lá, thanh long cuộn quanh vai, mẹ của cả khu rừng đang lún dần vào Hư Không. Rễ bà phản lại mọi chiêu, đổi chỗ bi dưới đất và giữ chân bi đối thủ trong cát. *“Rễ của ta ăn sâu hơn ngươi tưởng.”*

### Hư Không Uyên (`hukhong`)

- **Dấu ấn (5/5 tướng):** Hút miệng lỗ; giếng trên nỉ ở bàn phăng.
- **Tuyệt chiêu bậc 5:** Thôn Thiên: đổi chỗ hai bi, mở điểm hút miệng lỗ và kích hoạt trọng lực.

Vực sâu nơi hiện thực bị xé rách. Mọi thứ đến gần đều bị nuốt, kể cả ánh sáng; miệng lỗ của Linh Đài Hư Không phập phồng như đang thở.

- **Linh Đài:** Hắc thạch nứt vỡ. Miệng lỗ rộng hơn một chút. Nỉ `#543d5b`.
- **Thiên Tượng (Hư Không Thở):** Miệng lỗ phình to hoặc co hẹp trong cú này.
- **Biểu tượng:** a single void eye inside a cracked ring. **Màu:** #b44fe0 / #ff5fe0.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Hư Trùng** | Ma Vật | Ảnh Sát | Đào Hư Không (well) | Thoát Xác Tái Hành (second) | Bầy Hư Trùng (chill, spin) |
| 2 | **Phệ Hồn Thú** | Ma Vật | Cuồng Chiến | Phệ Khẩu Hấp Châu (well) | Phệ Hồn Hút Khí (drain) | Nuốt Phách Lệch Cơ (drift, sand) |
| 3 | **Vô Diện Khách** | Tinh Linh | Luân Hồi | Vô Tướng Dẫn Uyên (well) | Mặt Nạ Phân Ảnh (decoy) | Vô Diện Tha Châu (displace, blind) |
| 4 | **Hư Không Mẫu Hoàng** | Yêu Tộc | Chú Sư | Tam Nhãn Nhiếp Châu (well) | Mẫu Hoàng Hấp Lỗ (gravity) | Vạn Trùng Hoán Ảnh (swap, decoy) |
| 5 | **Thôn Thiên Ma Vương** | Ma Vật | Cuồng Chiến | Cự Uyên Hấp Tinh (well) | Hư Không Thổ Châu (teleport) | Thôn Thiên (swap, maw, gravity) |

- **Hư Trùng.** Con bọ hư không nhỏ xíu, mắt hồng phát sáng, đào hang xuyên qua hiện thực. Trượt cú nào nó chui hang ra đánh lại, và cả bầy rỉ rả bên tai làm đối thủ run tay. *“Kẹt kẹt kẹt!”*
- **Phệ Hồn Thú.** Quái thú hư không có cái miệng răng nanh giữa bụng. Nó nuốt linh lực đối thủ, và khi há miệng hút phách, đầu cơ người ta lệch về phía nó. *“GRRRAAAH!”*
- **Vô Diện Khách.** Lữ khách không mặt, chiếc mặt nạ trơn phản chiếu bầu trời sao. Mặt nạ tách thành những quả bi không thật, và bàn tay vô hình của hắn tha bi đối thủ khỏi miệng lỗ trong bóng tối. *“Ta là không ai cả.”*
- **Hư Không Mẫu Hoàng.** Mẫu Hoàng ba mắt, giáp kitin tím, sinh ra cả bầy hư trùng. Ánh mắt bà hút bi vào miệng lỗ, còn bầy con thì đổi chỗ bi và bỏ lại những vỏ bi rỗng. *“Con của ta đói rồi.”*
- **Thôn Thiên Ma Vương.** Cơn đói của chính miệng lỗ thế giới, mang hình hài ma vương vì quá lâu không được ăn. Hắn nuốt bi cái rồi nhổ ra chỗ khác, và khi há miệng thì cả bàn trôi về phía hắn. *“Mọi thứ… đều sẽ bị nuốt.”*

### Thiên Hương Các (`thienhuong`)

- **Dấu ấn (5/5 tướng):** Dòng xoáy.
- **Tuyệt chiêu bậc 5:** Khuynh Quốc Khuynh Thành: điều khiển cú đánh kế tiếp của đối thủ bằng chính bi cái của họ.

Lầu các lụa hồng giữa hồ trăng, nơi các mỹ nhân luyện mị thuật bằng vũ điệu, tiếng đàn và hương thơm. Kẻ đến thách đấu thường mất hồn trước khi mất ván.

- **Linh Đài:** Gỗ sơn son khảm mẫu đơn. Nỉ lụa, bi trượt êm hơn. Nỉ `#5e3a4d`.
- **Thiên Tượng (Lụa Trải):** Lụa trải trên nỉ: bi lướt qua lụa trượt êm và lăn xa hơn.
- **Biểu tượng:** a folding fan open over a peony. **Màu:** #d6407a / #ffd1a8.

| Bậc | Tướng | Loại | Hệ | Chiêu 1 | Chiêu 2 | Tuyệt chiêu |
|---|---|---|---|---|---|---|
| 1 | **Hồng Liên** | Nữ Hiệp | Ảnh Sát | Vũ Ảnh (vortex) | Liếc Mắt Đưa Tình (blind) | Hồng Liên Loạn Vũ (chill) |
| 2 | **Tử Trinh** | Nữ Hiệp | Chú Sư | Mê Hương (vortex) | Phấn Hương Mê Lộ (sand) | Tử Vụ Mê Thành (decoy) |
| 3 | **Ngân Cầm** | Nữ Hiệp | Pháp Tu | Ngân Huyền Toàn Khúc (vortex) | Hồi Mâu Nhất Tiếu (drift) | Đường Cong Mê Hồn (silk) |
| 4 | **Kim Phượng** | Nữ Hiệp | Cuồng Chiến | Song Phiến Toàn Phong (vortex) | Phượng Nhãn Câu Hồn (called) | Kim Phượng Nghịch Vũ (swap, drift) |
| 5 | **Mị Cơ Các Chủ** | Nữ Hiệp | Luân Hồi | Kính Hoa Thuỷ Nguyệt (vortex) | Đắm Đuối (counter) | Khuynh Quốc Khuynh Thành (puppet) |

- **Hồng Liên.** Vũ cơ tay áo dài của Thiên Hương Các, người ra đón khách ở bến lầu. Liếc một cái là đối thủ mất đường ngắm, múa một vòng là tay họ run tới hai lượt. *“Nhìn theo tay áo ta này…”*
- **Tử Trinh.** Nữ điều hương nhỏ nhắn của Thiên Hương Các, nốt ruồi dưới mắt, cười lên là má đỏ hây hây. Nàng rắc phấn hương hãm bi khách, rồi cười khúc khích khi họ đánh nhầm bi giả. *“Đoán xem bi nào thật nào?”*
- **Ngân Cầm.** Cầm sư tóc bạch kim, cây đàn tranh không rời lưng; mỗi dây đàn là tên một người đã mất. Nàng ngoảnh lại cười là đầu cơ đối thủ ngoảnh theo, và kẻ mê đường cong của nàng quá lâu thì thành một sợi dây trên đàn. *“Nghe kỹ… bi đang hát đấy.”*
- **Kim Phượng.** Đao phiến khách tóc lửa, mỹ nhân duy nhất của Thiên Hương thích đánh trực diện. Mắt phượng điểm bi nào đối thủ phải chạm bi ấy, còn đôi quạt thép phẩy ngược là hai quả bi đổi chỗ. *“Mê ta à? Thử đỡ cú này trước đã.”*
- **Mị Cơ Các Chủ.** Các chủ Thiên Hương, nhan sắc khuynh quốc khuynh thành, người giữ sổ tên những ai bị Hư Không nuốt. Chiêu nào nhắm vào nàng cũng tan trong ánh mắt nàng, và kẻ nhìn thẳng vào nàng sẽ tự tay đánh một cú cho nàng. *“Ngươi thua rồi, từ lúc nhìn thấy ta.”*

## Địa Thế (chế độ Tiên Đạo)

Mỗi Linh Đài có đặc tính riêng (ma sát, độ nảy băng, miệng lỗ). Thỉnh thoảng đầu lượt nổi Thiên Tượng của môn
phái, kéo dài một cú, được báo trước và vẽ lên bàn; Thiên Tượng là lực và ma sát thật trong mô phỏng. Gió giữ
một hướng suốt lượt và có sức nhẹ, vừa hoặc mạnh.

**Địa Lợi:** tướng đánh trên Linh Đài của môn phái mình được thêm năng lượng và không gặp Thiên Tượng.

## Phong cách hình ảnh

Thuỷ Mặc: giấy dó, mực đen, một màu son; tướng giữ tạo hình anime màu sắc. Chi tiết:
[guides/art-pipeline.md](../guides/art-pipeline.md) và `.claude/skills/game-art/references/style-bible.md`.
