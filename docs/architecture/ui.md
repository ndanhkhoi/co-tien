# Giao diện (`src/ui`, `src/styles`)

Màn hình là DOM phủ trên canvas PixiJS. `src/ui/app.ts` giữ ngăn xếp màn hình, phông nền (`setBackdrop`) và
chuyển cảnh.

## Bản đồ

| File | Sở hữu |
|---|---|
| `screens/splash.ts`, `home.ts`, `profile.ts` | Màn mở đầu, trang chủ, hồ sơ cơ thủ |
| `screens/setup.ts` | Thiết lập Luận Cơ và Song Đấu |
| `screens/collection.ts`, `settings.ts` | Tàng Các, Cài đặt |
| `screens/career.ts`, `challenge-start.ts` | Trận Hành trình, mở một thử thách Luyện Cơ |
| `screens/journey.ts` | Bản đồ Hành trình 16:9 phủ kín khung, thanh trên cùng nổi trên tranh, không cuộn; mốc lấy thứ tự từ `CHAPTERS`; trận trở về mở đúng vùng đất vừa đánh. Hộp thoại vùng đất xếp bốn cao thủ bậc 1–4 thành 2×2, trùm bậc 5 nằm riêng một hàng |
| `screens/champion-page.ts` | Trang tướng duy nhất: Chiêu thức, Tiểu sử, Tranh; chiêu mộ hoặc chọn đại diện |
| `screens/library.ts` | Trang môn phái và tab Luật của Tàng Các |
| `screens/challenges.ts` | Luyện Cơ |
| `screens/practice/` | Luyện thế: `index.ts` chọn thế, `desk.ts` bảng bên bàn |
| `screens/story.ts` | Đọc Cơ Tiên Truyện (chunk riêng, chỉ tải khi mở) |
| `screens/match/` | Màn trận: `index.ts` là `matchScreen`, `wiring.ts` nối các phần dùng chung `MatchCtx` (`context.ts`); mỗi phần một file: HUD, herald, dock chiêu, áp phê, ngắm, bắn, điều khiển, chạm bàn, lượt AI, hộp thoại, menu tạm dừng, vòng khung hình. `controller.ts` re-export người điều khiển cú đánh; `hex-chips.ts` tạo chip ảnh hưởng trên thẻ |
| `screens/loading.ts`, `install-gate.ts` | Màn tải tranh, màn bắt cài PWA (xem [platform.md](platform.md)) |
| `finisher.ts`, `skill-cutin.ts` | Kết liễu, cut-in tuyệt chiêu |
| `hints.ts`, `intro.ts`, `scroll-hint.ts` | Hướng dẫn người mới, gợi ý cuộn |
| `viewport-guard.ts` | Bắt xoay ngang, cảnh báo cửa sổ quá nhỏ |
| `icons.ts`, `avatar.ts`, `dom.ts` | Icon tranh `icon(name)`, chân dung, tiện ích DOM dùng chung (`h`, `hex6`, `uiOrigin`, `uiScale`) |
| `widgets.ts`, `swipe.ts` | Widget màn hình dùng chung (thanh tiêu đề, ví, chip, thẻ và bộ chọn tướng), cử chỉ vuốt |

Tìm trong `dom.ts` và `widgets.ts` trước khi viết tiện ích mới.

## Một khung 16:9

DOM có một khung thiết kế **844×475**. `installUiScale()` trong `src/main.ts`:

- scale đều khung này to nhất có thể trong vùng màn hình đã trừ safe area, tối đa 2,2;
- căn giữa khung và đặt nó trong khung bình phong vẽ;
- để phần thừa hiện phông tranh, không bao giờ là màu phẳng.

Chỉ màn cài app dùng kích thước thật. Lý do: [decisions/one-16x9-frame.md](../decisions/one-16x9-frame.md).

Hệ quả phải giữ:

- Bên trong khung **không có media query, `vw` hay `vh`**; mọi thứ co dãn theo khung, không theo cửa sổ.
- Safe area chỉ được trừ một lần, ở khung ngoài. Token vùng chạm trong `base.css` bù ngược `--ui-scale` để
  vùng chạm hiển thị luôn ≥ 44 px.
- Bố cục bàn canvas quy đổi biên HUD và độ lệch khung DOM sang pixel màn hình; sự kiện `cotien:ui-resize`
  báo khung đổi kích thước.
- Mã chạy mỗi khung hình không được đọc layout (`getBoundingClientRect`, `offsetWidth`); dùng `uiOrigin()` /
  `uiScale()` và đo một lần khi bố cục đổi.
- Khung nine-slice (`border-image`) giữ viền 1px trong suốt: WebKit không vẽ ảnh viền trên viền dày 0.
- Trong trận (`body.playing`) phông và sương dừng trôi, vì chuyển động sau canvas trong suốt làm bàn giật trên
  điện thoại.

## CSS

`src/main.ts` nạp năm file theo thứ tự; mỗi khai báo chỉ ở một file:

| File | Sở hữu |
|---|---|
| `base.css` | Màu, chữ, nền đọc, safe area, token vùng chạm |
| `kit.css` | Thành phần dùng chung: nút, thẻ chọn, hộp thoại |
| `screens.css` | Bố cục các màn hình |
| `match.css` | Bố cục giao diện trận |
| `skin.css` | Nạp cuối: lớp tranh vẽ (khung, nút dấu son, chuyển trang, màn xuất hiện tướng) |

Bố cục ở bốn file đầu, lớp tranh vẽ ở `skin.css`. Cùng một thuộc tính cho cùng selector ở hai file nghĩa là một
bên là code chết.

## Phong cách Thuỷ Mặc

- Giấy, mực đen, **một** màu son nhấn.
- Chữ tiêu đề Noto Serif, chữ thân Be Vietnam Pro.
- Không phát sáng, không chữ vàng 3D.
- Tướng giữ tạo hình anime màu sắc trên nền giấy.
- Mọi chữ người chơi thấy là tiếng Việt.
- Icon và trang trí là tranh vẽ; không SVG, emoji hay thư viện icon.

Khung chữ trong trận là ba tranh co giãn kiểu chín lát, hoa văn chỉ ở hai đầu để chữ không đè lên:

- `ui/frame/band.webp`: thông báo;
- `plate.webp`: bảng tên;
- `scroll.webp`: ô mục tiêu, nhãn bi, lời nhắc.

Nút hành động trong ván là tranh tròn có chữ thư pháp; tên thao tác nằm trong `aria-label`.

Tab và lựa chọn ở màn thiết lập Luận Cơ, Song Đấu không dùng viên thuốc. Đó là chữ serif trên giấy, ngăn nhau
bằng nét mực `ui/ink-tick.webp`; mục đang chọn chuyển màu son và nằm trên nét cọ `ui/tap-stroke.webp`.

## Hiệu ứng trận và tay điều khiển

- `src/game/match/controller.ts` là nguồn duy nhất cho “ai đang điều khiển cú đánh”: khi `puppeteer` còn bật,
  người thi triển Khuynh thành điều khiển, còn luật vẫn thấy bên đang tới lượt. UI và render đọc helper này,
  không soi `Match.current`.
- `hex-chips.ts` gom `hexes`, `activeEffects` và `called` thành chip cho từng thẻ. Chiêu phản đang úp chỉ
  hiện “một chiêu đang úp”.
- `render/decoy-balls.ts` dựng Bi Giả bằng shader bi thật và bóng bi; `render/ball-slides.ts` chạy nét mực
  dời/đổi bi, tôn trọng giảm chuyển động. Rewind/ván mới gọi `TableView.clearTransient()` nên mọi lớp
  trình diễn tạm đều về trạng thái luật.
- Đường bi mục tiêu tắt khi Bi Giả đang tác dụng; vòng son bi chỉ định và dòng mục tiêu lấy trực tiếp
  `calledNow`.

## Chuyển động

- Chuyển màn trong `app.ts` có hướng tiến/lùi/đặt lại; màn cũ thành `inert` rồi được gỡ khi chuyển xong.
  `turnPage` giữ một bản sao không tương tác của nội dung cũ trong lúc nội dung thật đổi ngay.
- Không đo layout trong vòng animation; bấm liên tiếp huỷ animation cũ.
- Mọi chuyển động tôn trọng `prefers-reduced-motion`: trang cập nhật tức thời, Kết liễu hiện tĩnh, không rung.
- Thời lượng và keyframe nằm trong `src/styles/skin.css` và `src/ui/finisher.ts`; đó là nguồn duy nhất.

## Tàng Các

- Bốn tab: Tướng, Pháp Cơ, Linh Đài, Luật. Mỗi tướng, môn phái, Pháp Cơ và Linh Đài chỉ có nội dung ở một chỗ;
  chỗ khác dẫn link tới, không chép lại thẻ.
- Tab Tướng chia nhóm theo môn phái, có hàng chip lọc theo Hệ; chọn một hệ thì nội tại của hệ hiện ở dòng ghi chú.
  Tiêu đề nhóm mở trang môn phái.
- Trang môn phái gồm lời dẫn, dấu ấn, Thiên Tượng và ba link sang nhóm tướng, thẻ Linh Đài, thẻ Pháp Cơ của phái
  (đổi tab, cuộn tới thẻ và đánh dấu một nhịp). Thẻ Linh Đài và Pháp Cơ thuộc phái có link ngược về trang môn phái.
- Tab Luật mở đầu bằng Cơ Tiên Giới, sau đó là luật từng lối chơi và Tiên Đạo.
- Mỗi tướng có một trang với ba mục ở chân trang: Chiêu thức, Tiểu sử, Tranh. Chạm tranh tướng hoặc một tranh
  trong mục Tranh mở khung xem trọn tranh.
- Trang tướng có ba nút icon chiêu riêng của tướng (`skillIconUrl(champion.id, slot)`). Chạm mở thẻ chi tiết
  trước, không dùng ngay.
- Tiểu sử chỉ mở với tướng đã gặp hoặc đã sở hữu; Tranh chỉ mở khi đã chiêu mộ. "Đã gặp" không tính Luận Cơ và
  Song Đấu (đối thủ bốc ngẫu nhiên), chỉ tính các trận có đối thủ định sẵn như Hành trình.
- Xem trước bàn giữ đúng tỉ lệ bàn WPA gồm cả viền.
