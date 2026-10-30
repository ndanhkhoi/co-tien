# PixiJS cho bàn, DOM cho giao diện

**Bối cảnh.** Bàn bi cần 60 khung hình, shader cầu và hiệu ứng; menu, truyện và HUD cần chữ tiếng Việt đẹp,
cuộn, trợ năng và CSS.

**Quyết định.** PixiJS 8 (WebGL) chỉ vẽ bàn, bi, cơ, đường ngắm và hiệu ứng. Mọi giao diện khác là DOM phủ trên
canvas. Canvas chỉ vẽ lại khi hình đổi.

**Loại bỏ.** Đổi sang một game engine hoặc vẽ cả UI trong canvas: không tự giải quyết letterbox, bố cục hay
trạng thái điều khiển, mà mất CSS, chữ và trợ năng của trình duyệt.

**Hệ quả.** Bố cục bàn phải quy đổi theo khung DOM (`uiOrigin()`, `cotien:ui-resize`). Mã mỗi khung hình
không được đọc layout DOM.
