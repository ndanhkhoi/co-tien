# Vẽ bàn (`src/render`)

| File | Sở hữu |
|---|---|
| `table-view.ts` | Bàn, bi, cơ, đường ngắm, bi ảo, Thiên Tượng, lớp hiệu ứng; quyết định khi nào cần vẽ lại |
| `ball-mesh.ts` | Shader cầu của bi, lăn theo vận tốc góc thật |
| `ball-warmup.ts` | Biên dịch sẵn shader trước trận |
| `skill-fx.ts` | Ghép nét mực VFX môn phái theo nhóm cơ chế, flipbook tuyệt chiêu |
| `omen-art.ts` | Lưới mũi tên mực của gió, to và nhanh theo sức gió |
| `art.ts` | Hình vẽ bằng canvas một lần rồi đưa lên texture: mặt bàn, cơ, atlas số bi, bóng |

## Quyết định

- **PixiJS WebGL cho bàn, DOM cho mọi thứ khác** (xem [decisions/pixi-and-dom.md](../decisions/pixi-and-dom.md)).
- **Chỉ vẽ lại khi hình đổi.** Mỗi khung `TableView` gom mọi biến đổi, texture, hướng xoay bi và lệnh vẽ đường
  ngắm thành một dãy số và so với khung trước; `App` tắt render tự động của ticker và màn trận chỉ gọi
  `app.pixi.render()` khi `shouldRender()` đúng (cộng vài khung bắt buộc sau đổi kích thước, quay lại ứng dụng,
  khôi phục WebGL). Bàn đứng yên lúc ngắm hay chờ AI vì thế không tốn GPU, điều quan trọng với pin điện thoại.
- **Đường đi của Thần Nhãn / Luyện thế mọc dần** trong ngân sách `EAGLE_BUDGET_MS` mỗi khung, nên kéo ngắm vẫn mượt.
- **Giới hạn mật độ canvas** ở 2× và khoảng 3,6 MP (`src/ui/app.ts`) vì canvas phủ cả cửa sổ; MSAA chỉ bật khi
  màn hình kém nét.
- **Texture canvas thuộc về một `TableView`**: vẽ lại thì huỷ bản cũ, `destroy()` huỷ hết cùng shader bi, nên
  vào ra trận bao nhiêu lần bộ nhớ GPU vẫn như cũ. Ảnh tải qua `Assets` dùng chung và không bị huỷ.
- **Mất WebGL**: PixiJS tự dựng lại khi trình duyệt trả context; quá lâu thì `app.ts` hiện bảng "Đồ hoạ bị gián
  đoạn" với nút Tải lại.
- **Cây cơ tranh được phóng theo bề dày thân phía đầu cơ** (đo một lần từ kênh alpha), nên tua rua hay chạm
  khắc ở đuôi không làm thân teo lại.
- **Ảnh bi cho nhãn DOM** (`TableView.ballPortrait`) dựng bằng chính shader bi, để nhãn và bàn luôn cùng màu.

## Code vẽ và tranh vẽ

- Code/shader chỉ được dựng **vật thể mô phỏng**: hình học bàn và bi, số/sọc, màu, ánh sáng, xoay theo vật lý.
- Tranh, icon và trang trí UI luôn là tranh vẽ qua pipeline ([guides/art-pipeline.md](../guides/art-pipeline.md)).
  Ngoại lệ vật thể mô phỏng không áp dụng cho chúng.
- Màu nỉ mới phải qua `tests/sect-contrast.test.ts` để bi luôn dễ nhìn.
