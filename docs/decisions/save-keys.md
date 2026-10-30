# Khoá save

**Bối cảnh.** Game đã đổi tên trong quá trình phát triển; người chơi đã có save trong `localStorage`. Mất save
là lỗi nặng nhất với người chơi.

**Quyết định.** Hồ sơ giữ khoá `thancong.profile.v1` mãi mãi. Mọi đọc, nhập mã chia sẻ (`TC1.`) và trường mới
đều đi qua `sanitize` trong `src/game/profile.ts`: thêm mặc định, lọc ID không còn hợp lệ, bỏ trường cũ. Dữ
liệu riêng của Luyện thế ở khoá `cotien.practice.v1`, qua `sanitizeSaved` trong `src/game/practice.ts`.

**Loại bỏ.** Đổi khoá theo tên game mới, hoặc tăng `v1` và viết bước chuyển đổi: rủi ro mất save mà không
được gì.

**Hệ quả.** Không bao giờ đọc `localStorage` hồ sơ trực tiếp ngoài `profile.ts`.
