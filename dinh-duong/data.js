// Hồ sơ mặc định + thư viện món nạp sẵn (ước lượng cho món Việt).
const DEFAULT_SETTINGS = {
  name: 'Phước',
  gender: 'Nam',
  age: 32,
  startWeight: 76.8,
  startDate: '2026-10-02',
  bmr: 1628,
  tdee: 2400,
  kcalTarget: 2100,
  protein: 150,
  carb: 210,
  fat: 60,
  startBodyFat: 25.4,
  startMuscle: 53.7,
  visceralFat: 9.5,
  goalBodyFat: '15–18',
  minKcal: 1500,
  lunchProteinMin: 35,
};

// Mỗi món: [tên, kcal, đạm (g), nhóm]
const DEFAULT_FOODS = [
  ['Bánh mì chả cá 40k (2 lạng chả cá)', 550, 28, 'Bữa sáng'],
  ['Bánh mì ốp la 4 trứng (2 ổ)', 800, 35, 'Bữa sáng'],
  ['Bánh mì ốp la 2 trứng (1 ổ)', 450, 20, 'Bữa sáng'],
  ['Cơm sườn trứng ốp la (ít mỡ hành)', 600, 32, 'Bữa sáng'],
  ['Bánh bao 2 trứng cút', 250, 10, 'Bữa sáng'],
  ['Bánh bao Đài Loan nhân tôm chiên sốt mayo', 350, 15, 'Bữa sáng'],
  ['Bánh bao gạo lứt gà xé phô mai (1 cái)', 150, 6, 'Bữa sáng'],
  ['Xôi hộp lớn', 500, 10, 'Bữa sáng'],
  ['Cà phê sữa pha máy ít sữa', 90, 1, 'Bữa sáng'],

  ['Cơm trắng (1 chén)', 200, 4, 'Cơm & tinh bột'],
  ['Cơm trắng (nửa chén)', 100, 2, 'Cơm & tinh bột'],
  ['Cơm chiên Dương Châu (1 chén, ít dầu)', 300, 9, 'Cơm & tinh bột'],

  ['Ức gà 100g', 120, 23, 'Đạm chính'],
  ['Tôm viên 200g (1 bịch)', 250, 44, 'Đạm chính'],
  ['Xúc xích ức gà phô mai (1 cây ~50g)', 81, 12, 'Đạm chính'],
  ['Xúc xích ức gà phô mai (3 cây)', 245, 37, 'Đạm chính'],
  ['Cá kho nghệ (1 con vừa)', 65, 9, 'Đạm chính'],
  ['Cá hú/cá rô phi kho (1 khứa)', 140, 16, 'Đạm chính'],
  ['Trứng luộc (1 quả)', 70, 6, 'Đạm chính'],
  ['Trứng chiên (1 miếng)', 100, 7, 'Đạm chính'],
  ['Sữa Vinamilk Green Farm cao đạm không đường (250ml)', 135, 12.5, 'Đạm chính'],
  ['Sữa TH True Milk không đường (1 hộp)', 120, 6, 'Đạm chính'],
  ['Sữa Fami đậu nành (1 hộp)', 120, 7, 'Đạm chính'],
  ['Thịt heo luộc (3-4 miếng nhỏ)', 150, 18, 'Đạm chính'],
  ['Lươn xào xả (4-5 miếng)', 150, 18, 'Đạm chính'],

  ['Phở nạm gầu ít nước béo', 450, 30, 'Món nước'],
  ['Phở nạm tái gân đặc biệt làm canh (bỏ bánh)', 350, 45, 'Món nước'],
  ['Hủ tiếu Nam Vang khô (tôm-thịt-trứng cút, bỏ nội tạng)', 600, 40, 'Món nước'],
  ['Hủ tiếu gà (bỏ nước béo, đùi luộc)', 450, 32, 'Món nước'],
  ['Bún riêu làm canh (bỏ bún, riêu cua + chả lụa)', 300, 25, 'Món nước'],
  ['Udon bò curry + trứng', 700, 30, 'Món nước'],
  ['Bánh canh cua (tô thường)', 350, 20, 'Món nước'],

  ['Tacos gà phô mai 250g (cả bánh + khoai)', 500, 25, 'Ăn chơi'],
  ['Pizza 9 inch', 950, 40, 'Ăn chơi'],
  ['Lẩu dê (thịt dê nạc + sườn, ăn vừa)', 400, 55, 'Ăn chơi'],
  ['Cá viên chiên + đùi gà (bỏ bột/da, mỗi thứ 1 cục)', 420, 30, 'Ăn chơi'],
  ['Mì ăn liền (1 tô)', 570, 21, 'Ăn chơi'],
  ['Chuối (1 trái)', 100, 1, 'Ăn chơi'],
  ['Quẩy (1 cây)', 120, 2, 'Ăn chơi'],

  ['Rau luộc/xào (1 đĩa)', 40, 2, 'Rau'],
  ['Bắp cải xào', 50, 2, 'Rau'],
];

const FOOD_CATEGORIES = ['Bữa sáng', 'Cơm & tinh bột', 'Đạm chính', 'Món nước', 'Ăn chơi', 'Rau', 'Món tự thêm'];

const MEALS = [
  { key: 'sang', label: 'Sáng', icon: '🌅' },
  { key: 'trua', label: 'Trưa', icon: '☀️' },
  { key: 'xe', label: 'Xế', icon: '🍌' },
  { key: 'toi', label: 'Tối', icon: '🌙' },
  { key: 'phu', label: 'Phụ / khuya', icon: '🍪' },
];
