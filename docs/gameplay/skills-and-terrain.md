# Chiêu, nội tại và địa thế

Tất cả chỉ có hiệu lực trong **Tiên Đạo**. Cổ Điển, Luyện Cơ và Luyện thế tắt chiêu, nội tại và Thiên Tượng.

## Nguyên tắc

- Không chạy bi theo kịch bản khi bi đang lăn và không đổi kết quả sau khi cú chốt. Khi mọi bi đứng yên, chiêu có thể
  tạo thay đổi trạng thái rời rạc, tất định; vật thể mô phỏng và hiệu ứng thông tin cũng được dùng chung cho trận,
  đường dự đoán và AI.
- Lực đều (nghiêng, gió) luôn dưới lực cản lăn, nên bi đứng yên không trôi. Ngoại lệ duy nhất là tuyệt chiêu
  Địa Chấn bậc 5: 1,6 × lực cản lăn trong 1,2 giây đầu và luôn báo trước.
- Một hiệu ứng chỉ được thêm khi trận thật, đường dự đoán và AI dùng chung nó qua `Match.simulationWorld()`.

Lý do: [decisions/real-physics.md](../decisions/real-physics.md).

## Chiêu

- Mỗi tướng có ba chiêu: **slot 0 và 1 là chiêu cơ bản**, **slot 2 là tuyệt chiêu**. Không suy ra slot từ bậc.
- Mỗi chiêu là một danh sách nhóm cơ chế (`kinds`). Danh sách nhóm là `SkillKind` trong
  `src/game/content/sects.ts`; hồi chiêu theo nhóm đầu tiên (`KIND_COOLDOWN`), sức mạnh theo bậc ở cùng file.
  Tuyệt chiêu cần đầy năng lượng và mạnh hơn bậc tướng.
- **Thang bậc:** `KIND_RANK` (cùng file) xếp mỗi nhóm vào một nấc: 1 tự thân hoặc thông tin, 2 quấy một cú,
  3 điều khiển nhẹ đối thủ, 4 ép luật và dời bi, 5 bẻ luật. Nấc của chiêu là nấc cao nhất trong `kinds`. Chiêu 2
  đúng nấc của bậc tướng, tuyệt chiêu cao hơn một nấc (trần 5); `tests/roster-kits.test.ts` giữ luật này. Bảng nấc
  chi tiết: [world/world-bible.md](../world/world-bible.md#kỹ-năng).
- **Mười nhóm đặt trên bàn** (`slick`, `sand`, `bumper`, `railcraft`, `wind`, `well`, `spinwash`, `vortex`,
  `silk`, `quake`) nhận một `SkillCast` (`src/game/skill-cast.ts`): tâm, hướng, đoạn băng, chiều xoáy, băng
  mềm/cứng. Bỏ trống thì `buildCast` chọn mặc định hợp lệ (trong nỉ, không đè bi, vật chắn tránh bi và lỗ).
  Ý nghĩa từng nhóm: [world/world-bible.md](../world/world-bible.md#kỹ-năng).
- Mọi nhóm đặt bàn giữ cùng hợp đồng, để trận, dự đoán và AI dùng nhóm nào cũng được mà không rẽ nhánh.
- `target: opponent` lưu hiệu ứng cho cú của đối thủ (ví dụ bẫy cát); `target: both` áp cho cả hai bên; mặc định áp
  cho bên dùng. `turns` cho biết hiệu ứng kéo dài bao nhiêu cú của bên nhận, tối đa 2 (3 chỉ cho tuyệt chiêu tướng
  bậc 5). Hiệu ứng hết sau đúng số cú của bên nhận (`Match.activeEffects`).
- **Hex** (`chill`, `freeze`, `seal`, `blind`, `drift`) nằm trong `Match.hexes`, mỗi loại một tầng cho mỗi bên;
 _cast lại chỉ làm mới thời gian. `called` chỉ định bi phải chạm trước, sai là lỗi và đối thủ được đặt bi bất kỳ.
- **Outplay** gồm `displace`, `swap`, `decoy`, `counter`, `puppet`: dời/đổi chỗ bi khi bàn đứng yên, đặt bi giả,
  đặt úp phản chiêu, hoặc đánh thay một cú của đối thủ mà không tính lỗi.
- `ult` chọn hình học riêng của tuyệt chiêu bậc 5 theo môn phái; `shape` chọn cổng, rễ chữ V hoặc hút miệng lỗ.
- **Bàn phăng không có lỗ**: `Match.effectiveKind` đổi các nhóm chỉ có nghĩa với lỗ sang hiệu ứng tương đương.
  Kiểm tra mỗi thay đổi chiêu trên cả bàn lỗ và bàn phăng, cùng bước đặt/huỷ.
- Tranh: ba icon riêng mỗi tướng (`skillIconUrl`), vùng đặt ở `public/art/table/skills/`, VFX theo môn phái.

Kiểm thử: `tests/skill-cast.test.ts`, `ultimate-geometry.test.ts`, `roster-kits.test.ts`, `skill-usage.test.ts`.

## Nội tại

- `cls` của tướng chọn một trong bảy hệ: Thần Xạ, Cuồng Chiến, Pháp Tu, Hộ Pháp, Chú Sư, Ảnh Sát, Luân Hồi.
- `cls` độc lập với `kind` (sáu loại tạo hình).
- Hành vi nằm trong `match/match.ts` (`passive`, `spinReach`, `lockAim`, `choosePassive`, `useGuard`) và đi qua cùng
  `Match` cho người và AI.
- Mô tả cho người chơi: [world-bible.md](../world/world-bible.md#hệ-lớp-và-nội-tại).
- Kiểm thử: `tests/class-passives.test.ts`.

## Linh Đài và Thiên Tượng

- Mỗi môn phái có Linh Đài riêng: màu nỉ, ma sát, độ nảy băng, miệng lỗ (`TABLE_LOOK` trong `sects.ts`). Màu
  nỉ phải qua `tests/sect-contrast.test.ts`.
- Đầu lượt có xác suất `OMEN_CHANCE` nổi Thiên Tượng của môn phái, kéo dài một cú, được báo trước và vẽ lên bàn
  (`src/game/terrain.ts`, `src/render/omen-art.ts`).
- **Gió giữ một chiều suốt lượt**; cơn giật chỉ làm gió yếu đi, không đảo chiều. Sức gió (nhẹ, vừa, mạnh) được
  báo và vẽ bằng mũi tên mực to/nhanh theo sức. Kiểm thử: `tests/terrain-wind.test.ts`. Sóng lừng của Hải
  Long cố ý nghiêng bàn qua lại.
- **Địa Lợi**: tướng đánh trên Linh Đài môn phái mình được thưởng năng lượng và không gặp Thiên Tượng
  (`Match.homeSide`).

## Thêm mới

Thêm nhóm chiêu, Thiên Tượng hay môn phái bằng dữ liệu hoặc một mục đăng ký, không rải `if (kind === …)` qua
nhiều file. Quy trình thêm tướng/môn phái: [guides/add-champion.md](../guides/add-champion.md).
