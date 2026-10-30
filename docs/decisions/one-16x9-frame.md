# Một khung 16:9

## Bối cảnh

Game chạy trên điện thoại ngang (nhiều tỉ lệ, có tai thỏ), tablet và màn hình máy tính. Bố cục responsive theo
từng cửa sổ làm HUD xô lệch và nhân số trường hợp phải thử.

## Quyết định

- DOM có một khung thiết kế 844×475.
- `src/main.ts` scale đều khung này to nhất trong vùng an toàn (tối đa 2,2) và căn giữa.
- Phần thừa là phông tranh vẽ, không phải màu phẳng; khi lề đủ rộng, tướng đứng hai bên.
- Chỉ màn cài app dùng kích thước thật.

## Phương án bị loại

Media query theo cửa sổ và đơn vị `vw`/`vh` bên trong khung.

## Hệ quả

- Chỉ cần thử ba cỡ: 932×430 cảm ứng, 1536×864 chuột (lề hẹp) và 2560×1440 chuột (scale tối đa, tướng hai bên).
- Vùng chạm phải bù scale (token trong `base.css`) để vẫn ≥ 44 px trên điện thoại.
- Safe area chỉ trừ một lần, ở khung ngoài.
