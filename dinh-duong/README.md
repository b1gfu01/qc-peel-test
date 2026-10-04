# App theo dõi dinh dưỡng & cân nặng — Phước

Web app tĩnh (HTML + CSS + JS thuần), không cần server, không cần cài gì. Dữ liệu lưu trong `localStorage` của trình duyệt.

## Cách chạy

**Trên máy tính:** mở file `index.html` bằng Chrome/Edge/Safari là dùng được.

**Trên điện thoại (cách khuyên dùng):**
1. Bật GitHub Pages cho repo (Settings → Pages → chọn branch, thư mục root) rồi mở `https://<user>.github.io/<repo>/dinh-duong/` trên điện thoại.
2. Trong trình duyệt điện thoại chọn **"Thêm vào màn hình chính"** → dùng như app.

Cách khác (cùng mạng Wi-Fi): trong thư mục `dinh-duong` chạy `python3 -m http.server 8000`, rồi trên điện thoại mở `http://<IP-máy-tính>:8000`.

> ⚠️ Dữ liệu nằm riêng trong từng trình duyệt/thiết bị. Dùng chính trên điện thoại, và vào **Cài đặt → Xuất JSON** định kỳ để sao lưu. Muốn chuyển máy thì **Nhập JSON** ở máy mới.

## Cấu trúc
- `index.html` — giao diện 4 tab: Hôm nay | Cân nặng | Tổng kết | Cài đặt
- `style.css` — giao diện mobile-first, tự đổi theo chế độ sáng/tối
- `data.js` — hồ sơ mặc định + thư viện món nạp sẵn
- `app.js` — toàn bộ logic

## Ghi chú
- Gõ tìm món không cần dấu (vd `xuc xich`, `pho`).
- Chạm vào tên món đã nhập để sửa số lượng.
- Bên dưới mỗi bữa có nút "+" nhanh cho những món hay ăn nhất ở bữa đó.
- Cân nặng: xem **trung bình 7 ngày**, đường xanh trên biểu đồ.
- Tổng kết tuần tính Thứ 2 → Chủ nhật; thâm hụt = TDEE × số ngày có nhập − tổng calo; 7.700 kcal ≈ 1 kg mỡ.
