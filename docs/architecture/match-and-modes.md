# Trận đấu, chế độ và dữ liệu (`src/game`)

## Bản đồ

| File | Sở hữu |
|---|---|
| `match/` | Máy trạng thái một trận (`Phase`: `aim → rolling → option / rack-over / match-over`), năng lượng, hồi chiêu, nội tại, Thiên Tượng, Địa Lợi, đánh lại. Trong thư mục: `match.ts` giữ lớp `Match`, `shot.ts` lo đánh, mô phỏng và kết liễu, `skills.ts` lo chiêu, `energy.ts` lo năng lượng và Ảnh Sát, `omen.ts` lo Thiên Tượng, `practice.ts` lo Luyện thế, `types.ts` chứa kiểu dùng chung |
| `skill-cast.ts` | `SkillCast` và `buildCast`: vị trí, hướng, đoạn băng, chiều xoáy của chiêu đặt bàn |
| `terrain.ts` | Thiên Tượng của từng môn phái (`rollOmen`, `OMEN_INFO`, `OMEN_CHANCE`) |
| `practice.ts` | Thế mẫu Luyện thế (`PRACTICE_DRILLS`), Thế của tôi (`sanitizeSaved`), kiểm tra chỗ đặt bi (`canRest`) |
| `profile.ts` | Hồ sơ người chơi, `sanitize`, mã chia sẻ |
| `content/roster.json` | **Nguồn sự thật** cho môn phái, hệ, tướng và tên chiêu |
| `content/lore.json` | Truyện thế giới, môn phái, tiểu sử và câu nói của tướng |
| `content/story.json` | Cơ Tiên Truyện: `chapters`, `scenes` (đề bài tranh), `cast` |
| `content/sects.ts` | Kiểu dữ liệu, sức mạnh và hồi chiêu theo bậc, bàn và cơ của môn phái, đường dẫn tranh |
| `content/career.ts` | Tuyến Hành trình (`CHAPTERS`) |
| `content/challenges.json` | Thử thách Luyện Cơ, sinh bởi `npm run gen:challenges` (`tools/gen-challenges.ts`) |
| `content/gear.ts`, `rules-text.ts`, `stat-text.ts` | Pháp Cơ/Linh Đài, văn bản luật và nhãn chỉ số tiếng Việt |

## Chế độ

| Tên | Là gì | Chiêu, nội tại, Thiên Tượng | Kết liễu |
|---|---|---|---|
| Hành trình | Bản đồ 13 vùng, thách cao thủ để chiêu mộ, mở chương truyện | theo lựa chọn luật | có |
| Luận Cơ | Đấu nhanh với máy; Đổi đối thủ bốc lại tướng AI trong bậc của cấp độ | theo lựa chọn luật | có |
| Song Đấu | Hai người chung máy; mỗi bên tên, tướng đã sở hữu (không trùng), cơ riêng | theo lựa chọn luật | có |
| Luyện Cơ | Thử thách có lời giải, chấm sao | tắt | không |
| Luyện thế | Bày thế rồi đánh tự do, không luật | tắt | không |

**Tiên Đạo / Cổ Điển** là lựa chọn trong thiết lập trận, độc lập với thể loại 8/9/10 bi hoặc phăng:

- **Tiên Đạo** bật chiêu, nội tại và Thiên Tượng.
- **Cổ Điển** là bida thuần.
- Chế độ đọc cờ trong `MatchSetup` (`classic`, `judge`, `practice`); đừng rải `if (mode === …)` qua nhiều file.

Tên menu là quyết định đã chốt: [decisions/menu-names.md](../decisions/menu-names.md).

## Năng lượng (Tiên Đạo)

Các hằng nằm trong `match/energy.ts`:

- Mỗi cú được `ENERGY_PER_SHOT`, cộng `ENERGY_PER_VALUE` cho mỗi điểm cú đánh (điểm từ `src/core/shot-score.ts`).
- Tổng được nhân theo chỉ số năng lượng của cơ và Địa Lợi.
- Đối thủ phạm lỗi thì bên kia được thêm năng lượng.
- Trần là `ENERGY_MAX`; tuyệt chiêu cần đầy thanh.
- Cổ Điển không cộng năng lượng.
- `Match` phát sự kiện `energy` với phần tăng thực tế sau giới hạn.

Kiểm thử: `tests/skill-usage.test.ts`.

Vì sao chấm theo độ khó thay vì đếm bi:

- Người chơi giỏi được thưởng vì đánh đẹp, không chỉ vì đánh nhiều.
- Ảnh Sát (`ASSASSIN_RUN`, `ASSASSIN_VALUE`) đòi một chuỗi có chất lượng, không chỉ chuỗi dài.

## Kết liễu

Ván thắng bằng chính cú sạch của người thắng mở màn Kết liễu (`src/ui/finisher.ts`) với tranh
`champions/{id}/finisher.webp` (thiếu thì dùng cut-out), ở mọi chế độ trừ Luyện Cơ và Luyện thế.

## Luyện thế

- Màn chọn thế liệt kê thế mẫu và Thế của tôi.
- Bàn tập dùng `Match` thật với luật tắt.
- **Đánh lại** dùng `Match.undoShot` (ảnh chụp trước cú).
- **Đường đi** bật `Match.sight` để mô phỏng đường của mọi bi.
- Giao diện: `src/ui/screens/practice/` (`index.ts`, `desk.ts`). Kiểm thử: `tests/practice.test.ts`.

## Lưu dữ liệu

- Hồ sơ ở khoá `thancong.profile.v1`. **Không bao giờ đổi tên khoá này** (giữ từ tên cũ của game để không
  mất save). Mọi trường mới đi qua mặc định trong `sanitize`; `sanitize` cũng lọc ID tướng/trang bị không còn
  hợp lệ. Mã chia sẻ giữ tiền tố `TC1.` và cũng qua `sanitize` khi nhập.
- Thế đã lưu của Luyện thế ở khoá riêng `cotien.practice.v1`, đọc qua `sanitizeSaved`.

Xem [decisions/save-keys.md](../decisions/save-keys.md).

## Cheat khi phát triển

Bản dev (hoặc `?dev`) có `cotien.cheat(name, ...args)` trong console; danh sách lệnh ở `src/dev/cheats.ts`.
Không có giao diện cheat.
