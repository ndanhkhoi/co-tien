# Đóng góp cho Cơ Tiên

Cảm ơn bạn muốn mở rộng Cơ Tiên. Trước thay đổi lớn, đọc [docs/README.md](docs/README.md) để tìm tài liệu
đúng phần mình sửa.

## Cài đặt

```bash
npm install
npm run dev        # http://localhost:5173 (thêm ?gate để xem màn cài app)
```

Lệnh test và kiểm tra trên thiết bị: [docs/guides/testing.md](docs/guides/testing.md).

## Quy tắc của dự án

- **Vật lý thật.** Chiêu và Thiên Tượng là lực, ma sát, vật chắn hoặc kích thước lỗ trong mô phỏng; lực đều
  dưới lực cản lăn. Xem [docs/decisions/real-physics.md](docs/decisions/real-physics.md).
- **Chỉ nội dung nguyên bản.** Không dùng tên, tranh, chiêu thức hay biểu tượng của game hay tác phẩm nào khác.
- **Tranh vẽ qua pipeline.** Tranh, icon và trang trí UI là tranh vẽ riêng qua
  [docs/guides/art-pipeline.md](docs/guides/art-pipeline.md); không ảnh internet, SVG tự vẽ, emoji hay thư
  viện icon. Code/shader chỉ dựng vật thể mô phỏng (bi, bàn).
- **Thuỷ Mặc và tiếng Việt.** Giấy, mực, một màu son, không phát sáng; mọi chữ người chơi thấy là tiếng Việt.
  Xem [docs/architecture/ui.md](docs/architecture/ui.md).
- **Bi dễ nhìn.** Màu nỉ mới phải qua `tests/sect-contrast.test.ts`.
- **Một khung 16:9.** Không media query hay `vw`/`vh` trong khung; vùng chạm ≥ 44 px.
- **Save là bất khả xâm phạm.** Không đổi khoá `thancong.profile.v1`; trường mới đi qua `sanitize`.
- **Dữ liệu trước.** Tướng, môn phái, chiêu là dữ liệu trong `src/game/content/`; giữ
  [docs/world/world-bible.md](docs/world/world-bible.md) khớp với `roster.json` và `lore.json`.

## Nguyên tắc code (bắt buộc)

Mọi tính năng mới và mọi thay đổi theo **DRY, KISS, YAGNI, SOLID**. Người duyệt trả lại code vi phạm; "code cũ
cũng làm vậy" không phải lý do. Khi sửa vào chỗ đã vi phạm, không làm tệ thêm, và gỡ luôn nếu sửa được tại chỗ.

- **DRY.** Mỗi sự thật một nguồn: luật, con số, nhãn tiếng Việt, dữ liệu môn phái, khai báo CSS. Tìm hàm/hằng có
  sẵn trước khi viết mới (`src/ui/dom.ts`, `src/core/*`, `src/game/content/*`). Logic xuất hiện lần hai thì tách
  ra dùng chung. Cùng thuộc tính CSS cho cùng selector ở hai file thì một bên là code chết: bố cục ở
  `base/kit/screens/match`, lớp tranh vẽ ở `skin`.
- **KISS.** Code đơn giản nhất mà vẫn đúng; ưu tiên hàm và dữ liệu hơn class, cờ và tầng trung gian. Hàm dưới
  khoảng 80 dòng, file dưới khoảng 500 dòng. Code mới cho file đã vượt ngưỡng (`match-screen.ts`, `match.ts`,
  `menus.ts`, `table-view.ts`, `brain.ts`) đặt vào module mới, nhỏ, rồi gọi từ file lớn.
- **YAGNI.** Chỉ làm thứ yêu cầu hiện tại cần: không tuỳ chọn, tham số, export hay "móc để sau". Xoá code không
  ai dùng (một `export` không nơi import là code chết, trừ khi test dùng).
- **SOLID.**
  - *Một trách nhiệm:* mỗi module một lý do để sửa. Không nhồi việc mới vào `Match` hay closure `matchScreen`.
  - *Mở rộng bằng dữ liệu:* thêm môn phái, tướng, nhóm chiêu, Thiên Tượng hay chế độ bằng dữ liệu hoặc mục đăng
    ký, không rải `if (mode === …)` / `kind === …` qua nhiều file.
  - *Thay thế được:* mọi `RuleSet` và mọi nhóm chiêu đặt bàn giữ cùng hợp đồng.
  - *Giao diện hẹp:* truyền đúng kiểu nơi nhận cần (`Pick<Match, …>`, view model), không cả `Match` hay `App`.
  - *Chiều phụ thuộc:* `core` → `game` → `ai`/`render` → `ui`; `platform`, `audio` là lá. Không import ngược.
    Xem [docs/architecture/overview.md](docs/architecture/overview.md).

## Quy trình

1. Sửa code và tài liệu sở hữu phần đó trong cùng thay đổi (bảng ở [docs/README.md](docs/README.md)).
2. Đổi màn hình có ảnh trong README thì chụp lại đúng ảnh đó ([docs/guides/testing.md](docs/guides/testing.md)).
3. Chạy `npm test` và `npm run build`; cả hai phải qua.
4. Commit theo Conventional Commits (`feat:`, `fix:`, `docs:`, `perf:`…), mỗi commit một việc.

Thêm tướng hoặc môn phái: [docs/guides/add-champion.md](docs/guides/add-champion.md).
