# Vẽ bàn (`src/render`)

| File | Sở hữu |
|---|---|
| `table-view.ts` | Bàn, bi, cơ, đường ngắm, bi ảo, Thiên Tượng, lớp hiệu ứng; quyết định khi nào cần vẽ lại |
| `ball-mesh.ts` | Shader cầu của bi, lăn theo vận tốc góc thật |
| `ball-warmup.ts` | Biên dịch sẵn shader lúc mở stage, trước khi bàn trượt vào |
| `table-art.ts` | Tải tranh phủ bàn qua `Assets` và giải phóng hết khi đóng stage |
| `skill-fx.ts` | Ghép nét mực VFX môn phái theo nhóm cơ chế, flipbook tuyệt chiêu |
| `omen-art.ts` | Tranh phủ Thiên Tượng và chiêu đặt trên bàn (lưới gió, dải lụa, vật chắn) |
| `art.ts` | Hình vẽ bằng canvas một lần rồi đưa lên texture: mặt bàn, cơ, atlas số bi, bóng |

## Quyết định

- **PixiJS WebGL cho bàn, DOM cho mọi thứ khác** (xem [decisions/pixi-and-dom.md](../decisions/pixi-and-dom.md)).
- **Chỉ vẽ lại khi hình đổi.** Mỗi khung `TableView` gom mọi biến đổi, texture, hướng xoay bi và lệnh vẽ đường
  ngắm thành một dãy số và so với khung trước; `App` tắt render tự động của ticker và màn trận chỉ gọi
  `app.pixi.render()` khi `shouldRender()` đúng (cộng vài khung bắt buộc sau đổi kích thước, quay lại ứng dụng,
  khôi phục WebGL). Bàn đứng yên lúc ngắm hay chờ AI vì thế không tốn GPU, điều quan trọng với pin điện thoại.
- **Đường đi của Thần Nhãn / Luyện thế mọc dần** trong ngân sách `EAGLE_BUDGET_MS` mỗi khung, nên kéo ngắm vẫn mượt.
- **Giới hạn mật độ canvas** ở 2× và khoảng 3,6 MP (`src/ui/stage.ts`) vì canvas phủ cả cửa sổ; MSAA chỉ bật khi
  màn hình kém nét.
- **Renderer chỉ sống trong trận** (`src/ui/stage.ts`): factory của màn trận mang cờ `stage`, `App.show()` mở
  renderer (tạo context, biên dịch sẵn shader) rồi mới dựng màn; về menu thì giải phóng tranh phủ bàn, huỷ
  renderer và trả context bằng `WEBGL_lose_context`. Đấu lại (`replace`) giữ nguyên renderer. Menu là DOM thuần
  nên không giữ context nào: GPU process có reset khi cuộn menu (máy yếu, raster ở mật độ cao) thì trang chỉ vẽ
  lại, không còn bàn chết phía sau bảng "đồ hoạ ngừng hoạt động", và bộ nhớ của trận trước (buffer, shader,
  texture) không đè lên menu. Mở stage tốn khoảng 35–85 ms, trong lúc đó màn cũ ngừng nhận chạm. Kích thước
  buffer đổi theo window bằng tay, không dùng `resizeTo`, để resize không tự vẽ ngoài vòng khung của màn trận.
  Menu mở hộp thoại cũng đóng băng backdrop sống và thả lớp sương (`skin.css`).
- **Giữ ít lớp GPU trên menu** (`skin.css`, `kit.css`): hiệu ứng vào màn, hộp thoại và thẻ chỉ `fill`
  `backwards`, vì animation đã xong mà còn `both`/`forwards` giữ phần tử trên một lớp GPU riêng suốt lúc nó còn
  trên màn. Hộp thoại và thẻ trong hộp thoại không dùng `filter`: filter ở tổ tiên vùng cuộn bắt GPU dựng lại cả
  bề mặt mỗi khung cuộn. Ở bảng vùng đất 932×430 @3x, hai điều này hạ từ 21 lớp (~142 MB) xuống 13 lớp (~98 MB).
- **Texture canvas thuộc về một `TableView`**: vẽ lại thì huỷ bản cũ, `destroy()` huỷ hết cùng shader bi, nên
  vào ra trận bao nhiêu lần bộ nhớ GPU vẫn như cũ. Tranh phủ bàn tải qua `Assets` dùng chung trong một lần mở
  stage và được giải phóng khi stage đóng; trận sau đọc lại từ cache HTTP.
- **Mất WebGL**: chỉ có thể xảy ra trong trận. PixiJS tự dựng lại khi trình duyệt trả context; quá 3 giây thì
  `stage.ts` hiện bảng "Đồ hoạ bị gián đoạn" với nút Tải lại, và bảng tự gỡ khi người chơi rời trận. Không mở được
  WebGL lúc vào trận (trình duyệt chặn sau nhiều lần reset) thì người chơi ở lại menu và cũng thấy bảng đó.
- **Cây cơ tranh được phóng theo bề dày thân phía đầu cơ** (đo một lần từ kênh alpha), nên tua rua hay chạm
  khắc ở đuôi không làm thân teo lại.
- **Ảnh bi cho nhãn DOM** (`TableView.ballPortrait`) dựng bằng chính shader bi, để nhãn và bàn luôn cùng màu.

## Code vẽ và tranh vẽ

- Code/shader chỉ được dựng **vật thể mô phỏng**: hình học bàn và bi, số/sọc, màu, ánh sáng, xoay theo vật lý.
- Tranh, icon và trang trí UI luôn là tranh vẽ qua pipeline ([guides/art-pipeline.md](../guides/art-pipeline.md)).
  Ngoại lệ vật thể mô phỏng không áp dụng cho chúng.
- Màu nỉ mới phải qua `tests/sect-contrast.test.ts` để bi luôn dễ nhìn.
- Tranh vùng đặt lấy kích thước từ terrain thật: dải lụa của Đường Cong Mê Hồn phủ đúng ba xoáy theo bậc chiêu,
  kèm dấu chiều xoáy ở từng xoáy.
