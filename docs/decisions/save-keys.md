# Khoá save

## Bối cảnh

Game đã đổi tên trong quá trình phát triển, và người chơi đã có save trong `localStorage`. Mất save là lỗi nặng
nhất với người chơi.

## Quyết định

- Hồ sơ giữ khoá `thancong.profile.v1` mãi mãi.
- Mọi lần đọc, nhập mã chia sẻ (`TC1.`) và trường mới đều đi qua `sanitize` trong `src/game/profile.ts`:
  thêm mặc định, lọc ID không còn hợp lệ, bỏ trường cũ.
- Dữ liệu riêng của Luyện thế ở khoá `cotien.practice.v1`, đi qua `sanitizeSaved` trong `src/game/practice.ts`.

## Phương án bị loại

- Đổi khoá theo tên game mới.
- Tăng `v1` và viết bước chuyển đổi.

Cả hai đều có rủi ro mất save mà không được gì.

## Hệ quả

Không đọc hồ sơ trong `localStorage` trực tiếp ở bất kỳ đâu ngoài `profile.ts`.
