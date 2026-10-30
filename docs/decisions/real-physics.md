# Chiêu và địa thế là lực thật

**Bối cảnh.** Game là bida có thật cộng thêm chiêu tu tiên. Nếu chiêu "dịch chuyển bi" bằng script, đường dự
đoán, AI và trận thật sẽ lệch nhau, và người chơi mất niềm tin vào vật lý.

**Quyết định.** Mọi chiêu và Thiên Tượng chỉ được là lực, vùng ma sát, vật chắn hoặc kích thước lỗ trong
`src/core/physics.ts`. Trận, dự đoán và AI dùng chung một world (`Match.simulationWorld()`). Lực đều (nghiêng,
gió) luôn dưới lực cản lăn μr·g ≈ 0,108 m/s² để bi đứng yên không trôi. Gió giữ một chiều suốt lượt và luôn
báo sức gió, để người chơi tính được cú.

**Loại bỏ.** Hiệu ứng theo kịch bản (bi tự bay vào lỗ, đổi kết quả sau cú): dễ làm nhưng không dự đoán được và
AI không học được.

**Hệ quả.** Một hiệu ứng mới phải mô tả được bằng vật lý trước khi làm. Giới hạn lực được kiểm thử
(`tests/terrain-wind.test.ts`) và chặn trong `physics.ts`.
