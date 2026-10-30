# AI đối thủ (`src/ai`)

| File | Sở hữu |
|---|---|
| `brain.ts` | Tìm cú đánh và chọn chiêu (`chooseSkill`) |
| `ai-worker.ts` | Web Worker chạy `brain.ts` |
| `ai-client.ts` | Phía giao diện: gửi yêu cầu, huỷ worker khi rời trận |
| `types.ts` | Gói dữ liệu gửi worker; `AiProfile` (cấp 1–4, lối đánh) định nghĩa ở `game/ai-profile.ts` |

## Quyết định

- **AI dùng chính bộ mô phỏng**, không dùng heuristic hình học riêng: liệt kê đường ăn thẳng và đánh băng, thử
  biến thể lực và áp phê, chấm theo vị trí bi cái cho cú sau, chọn phòng thủ khi rủi ro. Nó nhận cùng bàn,
  Thiên Tượng và hiệu ứng chiêu như người chơi (`Match.aiView()`), nên không bao giờ "ăn gian" hay lệch với
  vật lý thật.
- **Chạy trong Web Worker** để không giật hình. Rời trận khi AI còn tính thì worker bị thay mới thay vì chạy nốt.
- **Chiêu ở mọi cấp, kể cả cấp 1**, nhưng chỉ chọn trong các chiêu đang dùng được. Sau khi chọn chiêu, AI dựng
  lại gói hiệu ứng rồi tìm lại cú; chiêu dời bi dùng vị trí mà trận thật chấp nhận.
- **Bi trong tay ở cấp cao** xét nhanh mọi vị trí rồi chỉ tìm đầy đủ ở vài vị trí hứa hẹn nhất (`shortlist`),
  để giữ thời gian suy nghĩ trong giới hạn trên điện thoại.
- **Diễn cho người xem:** mỗi lượt máy nghĩ, xoay cơ, nạp lực khoảng 1–2 giây ở phía UI
  (`src/ui/screens/match-screen.ts`), tách khỏi thời gian tìm kiếm thật.

## Kiểm thử

`tests/ai.test.ts`, `ai-skill-planning.test.ts`, `skill-usage.test.ts`.
