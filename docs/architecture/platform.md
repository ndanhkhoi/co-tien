# Nền tảng: PWA, cập nhật, tải tranh (`src/platform`)

| File | Sở hữu |
|---|---|
| `preload.ts` | Kho tranh `art`: tải lần đầu, tải bù, kiểm tra trước trận |
| `install.ts` | Bắt `beforeinstallprompt`, `mustInstall()` (điện thoại phải cài app) |
| `device.ts` | Rung, giữ màn hình sáng, chặn cử chỉ trình duyệt ngoài vùng cuộn, chặn pinch zoom |

Cấu hình service worker và manifest tranh nằm trong `vite.config.ts`; đăng ký và kiểm tra cập nhật ở
`src/main.ts`; áp dụng bản mới ở `src/ui/app.ts`.

## Tải tranh

Tranh (~100 MB) không đi qua precache của service worker mà nằm trong một kho Cache Storage lâu dài tên `art`.
`vite.config.ts` sinh `virtual:art-manifest` ghi đường dẫn, dung lượng và mã nội dung của từng file; mỗi file
trong kho mang header `x-art-rev`. Service worker chỉ phục vụ kho này (CacheFirst).

- **Lần đầu** (`ui/screens/loading.ts`) tải trọn bộ để sau đó không bao giờ phải chờ ảnh. Bản build có tranh đổi
  chỉ tải lại file có mã nội dung đổi; bản chỉ sửa code không hiện màn tải (`__ART_VERSION__` không đổi).
- **Tiết kiệm dữ liệu** chỉ tải phần cốt lõi; ở menu, phần thiếu được tải bù lúc rảnh.
- **Trận** kiểm tra và giải mã trước tranh của hai tướng và môn phái của bàn.
- Tải đủ xong, file không còn trong manifest bị xoá và game xin `navigator.storage.persist()`.
- Lỗi mạng không chặn khởi động: ảnh tải theo nhu cầu, lần mở sau thử lại. `?loading` giữ màn tải để xem.

**Không bao giờ khoá cache tranh theo bản build**: mỗi bản build sẽ bắt người chơi tải lại 100 MB. Tranh mới
phải nằm trong đường dẫn manifest nhận.

## Cập nhật bản mới

Bản production kiểm tra bản mới định kỳ, khi ứng dụng quay lại phía trước, khi có mạng lại và khi bấm "Kiểm
tra" trong Cài đặt (`src/main.ts`).

- **Ngoài trận:** ngay khi bản mới bắt đầu tải (`updatefound`), menu bị chặn bằng tấm "Đang tải bản mới…", để
  không ai tiếp tục chơi bản cũ; tải lỗi thì tấm tự gỡ. Tải xong thì áp dụng ngay.
- **Trong trận:** chờ tới khi rời màn trận. Không bao giờ tải lại giữa ván.

## Bắt cài app

Trên điện thoại game chỉ chạy khi đã cài (`mustInstall()`), vì toàn màn hình và xoay ngang chỉ ổn định trong
chế độ standalone. Màn cài (`ui/screens/install-gate.ts`) có hướng dẫn cho iPhone/iPad và Android, mở sẵn đúng
hệ máy, và nút cài một chạm khi trình duyệt hỗ trợ. Màn này dùng kích thước CSS thật, hiện trước cả khi máy
đang dọc. Xem bằng `npm run dev` rồi thêm `?gate`.

## Bản build

`vite.config.ts` lược các trường chỉ dùng cho vẽ tranh khỏi `roster.json` (`look`, `pose`, `expr`, `icon`,
`motifs`, `emblem`, `element`). Code game không được đọc các trường này.
