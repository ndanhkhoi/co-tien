# Tài liệu Cơ Tiên

Code là nguồn sự thật cho *cái gì* và *làm thế nào*; tài liệu ở đây giữ *vì sao* và *ở đâu*: quyết định,
ràng buộc, thuật ngữ, và chỉ đường tới đúng file. Khi tài liệu và code lệch nhau, sửa tài liệu theo code
(hoặc sửa code nếu tài liệu ghi một quyết định).

## Đọc theo việc cần làm

| Việc | Đọc |
|---|---|
| Hiểu tổng thể, các lớp và chiều phụ thuộc | [architecture/overview.md](architecture/overview.md) |
| Công nghệ đã chọn và vì sao, cách deploy | [architecture/tech-stack.md](architecture/tech-stack.md) |
| Sửa vật lý, kích thước bàn, luật, chấm điểm cú | [architecture/physics-and-rules.md](architecture/physics-and-rules.md) |
| Sửa trận đấu, chế độ, năng lượng, hồ sơ, Luyện thế | [architecture/match-and-modes.md](architecture/match-and-modes.md) |
| Sửa AI đối thủ | [architecture/ai.md](architecture/ai.md) |
| Sửa bàn PixiJS, shader bi, hiệu ứng | [architecture/rendering.md](architecture/rendering.md) |
| Sửa màn hình, CSS, khung 16:9, chuyển động | [architecture/ui.md](architecture/ui.md) |
| Sửa PWA, cập nhật, tải tranh, màn cài app | [architecture/platform.md](architecture/platform.md) |
| Sửa điều khiển trong trận | [gameplay/controls.md](gameplay/controls.md) |
| Sửa chiêu, nội tại, Thiên Tượng | [gameplay/skills-and-terrain.md](gameplay/skills-and-terrain.md) |
| Thế giới, môn phái, tướng, chiêu (đồng bộ với dữ liệu) | [world/world-bible.md](world/world-bible.md) |
| Cốt truyện Cơ Tiên Truyện | [world/story.md](world/story.md) |
| Thêm tướng hoặc môn phái | [guides/add-champion.md](guides/add-champion.md) |
| Vẽ và duyệt tranh | [guides/art-pipeline.md](guides/art-pipeline.md) |
| Chạy test, kiểm tra trên thiết bị, chụp ảnh README | [guides/testing.md](guides/testing.md) |
| Vì sao chọn cách hiện tại | [decisions/](decisions/README.md) |

Quy trình đóng góp và nguyên tắc code: [CONTRIBUTING.md](../CONTRIBUTING.md). Quy tắc cho AI agent:
[AGENTS.md](../AGENTS.md). Ảnh chụp màn hình cho README nằm ở `screenshots/`.

## Giữ tài liệu đúng

- Trỏ tới file và tên hàm/hằng thay vì chép lại con số hay đoạn code; con số đổi thì chỉ code đổi.
- Thay đổi hành vi người chơi thấy, hợp đồng dữ liệu hay quyết định kiến trúc thì cập nhật đúng một file
  sở hữu nó trong bảng trên.
- Báo cáo, audit và kế hoạch là bản ghi theo thời điểm: để trong `plans/`, không để trong `docs/`.
