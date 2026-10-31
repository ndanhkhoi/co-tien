# Chiêu và địa thế là lực thật

## Bối cảnh

Game là bida có thật cộng thêm chiêu tu tiên. Nếu chiêu "dịch chuyển bi" bằng script, đường dự đoán, AI và
trận thật sẽ lệch nhau, và người chơi mất niềm tin vào vật lý.

## Quyết định

- Không chạy bi theo kịch bản khi bi đang lăn và không đổi kết quả sau khi cú đã chốt.
- Khi mọi bi đứng yên, chiêu có thể tạo một thay đổi trạng thái rời rạc, tất định (dời bi, đổi chỗ, đánh dấu bi);
  vật thể mô phỏng và hiệu ứng thông tin cũng được phép nếu trận, đường dự đoán và AI cùng thấy nó.
- Trận, dự đoán và AI dùng chung một world (`Match.simulationWorld()`).
- Lực đều (nghiêng, gió) luôn dưới lực cản lăn μr·g ≈ 0,108 m/s², để bi đứng yên không trôi. Ngoại lệ duy nhất là
  tuyệt chiêu Địa Chấn bậc 5: nghiêng 1,6 × μr·g trong đúng 1,2 giây đầu, có báo hướng và sức trước cú.
- Gió giữ một chiều suốt lượt và luôn báo sức gió, để người chơi tính được cú.
- Giếng hút và dòng xoáy (cả dải lụa) là **độ cong**, không phải lực đẩy: chúng bẻ hướng bi đang lăn một góc theo
  quãng đường đi trong vùng (`curve`, radian mỗi mét), bằng lực vuông góc với chiều lăn. Bi đứng yên không chịu lực
  và tốc độ không đổi, nên luật "bi đứng yên không trôi" vẫn giữ, còn góc bẻ gần như không phụ thuộc lực đánh.
  Lực đẩy dưới lực cản lăn chỉ lệch bi chừng 1 cm khi đi qua một vùng nhỏ, người chơi không thấy được.

## Phương án bị loại

Hiệu ứng theo kịch bản khi bi đang lăn (bi tự bay vào lỗ, đổi kết quả sau cú): dễ làm, nhưng không dự đoán được
và AI không dùng được.

## Hệ quả

- Một hiệu ứng mới phải mô tả được bằng vật lý trước khi làm.
- Giới hạn lực được chặn trong `src/core/physics/terrain.ts` và kiểm thử ở `tests/terrain-wind.test.ts`; độ cong
  của giếng và xoáy kiểm thử ở `tests/skill-effects.test.ts`.
