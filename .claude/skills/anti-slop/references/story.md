# Viết truyện và lore

Dùng khi viết hoặc sửa Cơ Tiên Truyện (`src/game/content/story.json`), tiểu sử và câu nói tướng
(`roster.json`, `lore.json`), mô tả chương trên Hành trình.

## Nguồn sự thật

Đọc trước khi viết, theo thứ tự:

1. `docs/world/story.md`: nguyên tắc viết, dàn ý 13 chương, luật thế giới, bảng lối mòn cần tránh.
2. `docs/world/world-bible.md`: môn phái, tướng (ngoại hình, tính cách, câu nói), Thiên Tượng.
3. Chương liền trước và liền sau chương đang viết trong `story.json`, để nối mạch và giữ manh mối đã gieo.

Truyện đổi một sự thật (ai biết gì, chuyện gì xảy ra lúc nào, luật Hư Không) thì sửa `story.md` trong cùng thay
đổi. Câu nói hay tiểu sử tướng đổi thì sửa `world-bible.md` cho khớp `roster.json`/`lore.json`.

## Dữ liệu

- `chapters[]`: `id`, `title` dạng `Chương N · Tên`, `land`, `unlock`, `pages[]`.
- Mỗi trang là `{ art?, text }`. Đoạn văn cách nhau bằng `\n\n`; màn đọc tách đoạn theo đúng ký tự đó.
- Trang hiện có dài khoảng 750–1.150 ký tự. Giữ trong khoảng ấy để trang vừa khung đọc trên điện thoại mà không
  phải cuộn nhiều.
- `art` là khoá trong `scenes` (đề bài tranh, tiếng Anh) và `cast` (id tướng xuất hiện trong tranh). Trang không
  có `art` dùng tranh của trang gần nhất phía trước. Thêm cảnh mới thì thêm cả `scenes` và `cast`, rồi vẽ bằng
  `game-art`.

## Giọng văn

- Câu ngắn, hình ảnh mực và nước. Tả bằng vật cụ thể (bậc đá, ván thuyền mục, chiếc mũ lặn bằng đồng), không
  bằng tính từ chung chung.
- Hài hước đến từ nhân vật: con vẹt của Tiểu Ngư, tiếng "Ngoạm!" tắt ngấm. Không chêm câu đùa của người kể.
- Trận đấu tả bằng bida thật: phá cụm, đi theo, đánh thủ, đá hai băng, băng mềm nuốt lực. Người đọc biết chơi
  bida phải thấy cú đánh hợp lý. Chiêu thức là lực trên bàn, không phải phép làm bi tự bay.
- Cảm xúc lớn thì cho nhân vật làm gì đó; cảm xúc nhỏ mới được gọi tên. "Ông chỉ gõ đốt ngón tay dọc thành
  bàn" hơn "ông rất kiên nhẫn".

## Thoại

- Lời thoại là một đoạn riêng, mở bằng `— `. Dẫn lời nằm cùng đoạn, ngăn bằng gạch dài:
  `— Ở lại đây, — nàng nói, — và ngươi sẽ có một cái tên.`
- Tiếng kêu hay câu cửa miệng chen trong lời kể thì dùng nháy cong: `Tiếng “Ngoạm!” đã lên tới môi hắn`.
- Dẫn lời chủ yếu bằng "nói", "hỏi", hoặc thay bằng một hành động. Không dùng trạng từ kiểu "nói một cách
  giận dữ"; cho thấy cơn giận bằng việc nhân vật làm.
- Nhân vật hiếm khi nói thẳng điều mình nghĩ. Để phần chưa nói làm việc của nó.

## Xưng hô

Xưng hô cổ trang: `ta`/`ngươi` là mặc định giữa người lạ và đối thủ. Mỗi tướng có dấu riêng lấy từ câu nói
trong `world-bible.md` (`bổn vương` của Long Vương, `tớ` của Ngũ Độc Đồng Tử, `cháu ngoan` của Độc Thủ Lão
Quái). Không dùng `tôi`, `anh`, `em` kiểu hiện đại trong lời nhân vật. Một cặp nhân vật giữ một cặp xưng hô
suốt chương, trừ khi việc đổi xưng hô chính là một nhịp truyện.

## Biên tập từng câu

| Lỗi | Ví dụ | Sửa |
|---|---|---|
| Động từ lọc | "Vô Danh thấy bi cái lao ngang bàn" | "Bi cái lao ngang bàn" |
| Danh hoá | "đưa ra quyết định" | "quyết" |
| Thừa chữ | "gật đầu cái đầu", "tự mình tự tay" | Bỏ phần lặp |
| Chồng tính từ | "cây cơ gỗ cũ kỹ, mòn vẹt, sẫm màu" | Giữ một chi tiết đắt nhất |
| Kể thay cho tả ở khoảnh khắc lớn | "Nàng đau lòng." | Một hành động hoặc một câu thoại né tránh |
| Câu cần đọc hai lần | Mệnh đề lồng mệnh đề | Tách thành hai câu |

Nhịp: đổi độ dài câu theo nhịp cảnh. Câu ngắn cho cú đánh và lúc căng, câu dài cho cảnh và lúc thở.

## Kiểm tra liên tục

Sau khi viết một chương, rà các điểm sau với `story.md` và `world-bible.md`:

- **Ai biết gì, từ lúc nào.** Nhân vật không được nhắc tới điều mình chưa biết. Người chơi chỉ biết tên
  thật Tạ Thanh Ca từ chương 12.
- **Manh mối.** Mỗi cú ngoặt đã có ít nhất hai manh mối ở các chương trước (bảng "Các cú ngoặt").
- **Luật thế giới.** Thời gian dưới Hư Không, Ma Tôn chỉ lùi được ba nhịp thở, ký ức về người rơi lỗ mờ dần.
- **Ngoại hình và đồ vật.** Sẹo, vũ khí, trang phục khớp `world-bible.md` và tranh tướng.
- **Lối mòn.** Đối chiếu bảng "Tự rà lối mòn" trong `story.md`.

Xong thì chạy `scan.mjs --warn` như mọi văn bản khác.
