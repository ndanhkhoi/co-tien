---
name: anti-slop
description: Viết và soát chữ cho Cơ Tiên (copy trong game, Cơ Tiên Truyện, lore tướng, docs, README) để không mang dấu vết văn máy - ký tự kiểu AI (gạch dài chen câu, mũi tên, emoji, ký tự vô hình), cụm từ sáo, cấu trúc rập khuôn - và giữ giọng văn, xưng hô, mạch truyện khớp với world bible. Dùng trước khi viết chữ người đọc thấy, khi viết hay biên tập chương truyện, khi audit văn bản, hoặc khi được nhờ "chống AI slop".
---

# Chống văn máy

Văn máy dễ nhận ra qua ba thứ: ký tự lạ mà người gõ tay hiếm dùng, cụm từ đúng cho mọi chủ đề, và nhịp câu
lặp khuôn. Skill này có một script bắt phần máy móc (ký tự) và các bảng để người viết tự soát phần còn lại.

Đọc trước khi viết:

- `references/characters.md`: ký tự nào cấm, ký tự nào được dùng và dùng ở đâu
- `references/phrases.md`: cụm từ và cấu trúc cần tránh, tiếng Việt và tiếng Anh
- `references/story.md`: khi viết truyện, tiểu sử hay câu nói tướng. Gồm nguồn sự thật, dữ liệu `story.json`,
  giọng văn, thoại, xưng hô, biên tập từng câu và kiểm tra liên tục

## Quét

```bash
node .claude/skills/anti-slop/scripts/scan.mjs            # lỗi ký tự, thoát mã 1 nếu còn
node .claude/skills/anti-slop/scripts/scan.mjs --warn     # thêm cảnh báo cụm từ
node .claude/skills/anti-slop/scripts/scan.mjs docs/x.md  # chỉ quét file hoặc thư mục chỉ định
```

Mặc định script quét README, CONTRIBUTING, AGENTS, `index.html`, `docs/` và `src/`. Script chỉ đọc phần chữ: chuỗi trong `.ts`, giá trị chuỗi trong `.json`, văn bản ngoài code
block, code span và link trong `.md`. Comment và tên biến không bị quét.

Lỗi (`error`) là ký tự sai luật, sửa hết. Cảnh báo (`warn`) là cụm từ cần đọc lại cả câu: giữ nếu nó mang
nghĩa thật (lời thoại nhân vật, thuật ngữ), bỏ nếu nó chỉ lấp chỗ.

## Quy trình audit

1. Chạy `scan.mjs --warn`, gom kết quả theo file.
2. Sửa tay từng câu, không thay hàng loạt bằng `sed`. Gạch dài có nhiều cách sửa (dấu phẩy, hai chấm,
   ngoặc đơn, tách câu); chọn cách giữ đúng nghĩa và nhịp của câu đó.
3. Đọc lại đoạn đã sửa theo `references/phrases.md`: cấu trúc, nhịp câu, xưng hô. Script không bắt được phần này.
4. Chạy lại `scan.mjs` tới khi không còn lỗi, rồi `npm test` và `npm run build` nếu đã sửa chuỗi trong code.
5. Nếu chuỗi đã sửa xuất hiện trên một màn có ảnh chụp trong README hoặc docs, chụp lại đúng ảnh đó theo
   `docs/guides/testing.md`.

## Giữ nguyên

- Tên riêng, tên chiêu, tên môn phái: chỉ sửa dấu câu quanh chúng, không đổi chữ.
- Lời thoại trong `story.json`: gạch đầu dòng thoại và gạch dẫn lời ("— Đi đi. — Bà nói.") là quy ước văn
  xuôi tiếng Việt, script đã cho phép.
- Giọng từng nhân vật: câu cụt, từ cổ, tiếng kêu là chủ ý, không "chuẩn hoá".
- `challenges.json` sinh bằng `npm run gen:challenges`; sửa nguồn, không sửa file sinh ra.
