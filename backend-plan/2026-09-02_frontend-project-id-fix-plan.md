# Kế hoạch sửa lỗi Frontend — Quản lý Project ID & Tạo dự án mới

> **Ngày:** 2026-09-02
> **Phạm vi:** Frontend (Next.js) — sửa lỗi project ID bị lưu trữ (localStorage), thêm khả năng tạo dự án mới, và xử lý các vấn đề liên quan.

---

## 1. Bối cảnh & Vấn đề gốc

Frontend lưu project ID vào **localStorage** dưới key `specresearch:projectId` (`frontend/lib/project.ts`):

```ts
const STORAGE_KEY = 'specresearch:projectId'
export function getProjectId(): string | null {
  return window.localStorage.getItem(STORAGE_KEY)
}
export function setProjectId(id: string): void {
  window.localStorage.setItem(STORAGE_KEY, id)
}
```

**Vấn đề:** Khi database bị xóa (ví dụ `TRUNCATE`), project ID đã lưu trở thành **stale** (trỏ tới project không còn tồn tại). Frontend vẫn tiếp tục dùng ID đó → mọi API call thất bại với lỗi "id didn't exist". Người dùng **không có cách nào** tạo dự án mới từ UI.

---

## 2. Danh sách vấn đề phát hiện

| # | Vấn đề | Mức độ | File |
|---|--------|--------|------|
| 1 | Không có nút "Tạo dự án mới"; ID stale không được kiểm tra | ❌ Cao | `components/research-loop/index.tsx` |
| 2 | Trang `/projects` chỉ là placeholder "Coming Soon" | ❌ Cao | `app/projects/page.tsx` |
| 3 | Các trang bước 2–6 thất bại âm thầm khi ID stale | ⚠️ Trung bình | `components/steps/step-{2..6}/index.tsx` |
| 4 | Trang lịch sử gặp cùng lỗi ID stale | ⚠️ Trung bình | `components/history/index.tsx` |
| 5 | Nút "profile" trong header không có chức năng | 🟡 Thấp | `components/research-loop/header.tsx` |
| 6 | Không có khả năng chuyển đổi giữa nhiều dự án | 🟡 Thấp | Toàn bộ app |

---

## 3. Kế hoạch triển khai

### Bước 1 — Kiểm tra & tự phục hồi ID stale (ưu tiên cao nhất)

**File:** `frontend/lib/project.ts` + `frontend/components/research-loop/index.tsx`

- Thêm hàm `clearProjectId()` trong `lib/project.ts` (gọi `localStorage.removeItem`).
- Trong `ensureProject()` (trang chủ): sau khi đọc `getProjectId()`, **xác thực** ID bằng cách gọi `GET /projects/:id` (hoặc `/projects/:id/summary`).
  - Nếu trả về **404** (project không tồn tại) → gọi `clearProjectId()` và tạo project mới.
  - Nếu thành công → giữ nguyên ID.
- Bọc logic trong `try/catch` để phân biệt lỗi 404 (stale) với lỗi mạng (không kết nối được server).

**Tiêu chí hoàn thành:**
- [ ] Xóa DB → mở lại trang chủ → tự tạo project mới, không còn lỗi "id didn't exist".
- [ ] Không phá vỡ luồng hiện tại khi project hợp lệ.

### Bước 2 — Thêm nút "Tạo dự án mới" trên trang chủ

**File:** `frontend/components/research-loop/index.tsx`

- Thêm nút "Tạo dự án mới" (ví dụ cạnh tiêu đề hoặc trong `ProgressSummary`).
- Khi bấm:
  1. Gọi `clearProjectId()`.
  2. Gọi `POST /projects` để tạo project mới.
  3. Gọi `saveProjectId(newId)`.
  4. Reset toàn bộ state (`flow`, `idea`, `understanding`, `questions`) về trạng thái ban đầu.
- Có xác nhận (confirm) trước khi tạo mới để tránh mất dữ liệu hiện tại.

**Tiêu chí hoàn thành:**
- [ ] Bấm nút → tạo project mới, reset UI, bắt đầu lại từ Bước 1.

### Bước 3 — Xây dựng trang `/projects` (quản lý dự án)

**File:** `frontend/app/projects/page.tsx` (thay thế `ComingSoon`)

- Gọi `GET /projects` để liệt kê danh sách dự án (backend đã hỗ trợ).
- Hiển thị: tiêu đề, ngày tạo/cập nhật, số phiên bản spec.
- Nút **"Tạo dự án mới"** → tạo project, lưu ID vào localStorage, chuyển về trang chủ.
- Click vào một dự án → `saveProjectId(id)` rồi chuyển về trang chủ (hoặc trang bước tương ứng).

**Tiêu chí hoàn thành:**
- [ ] Trang `/projects` liệt kê được các dự án từ backend.
- [ ] Tạo mới và chọn dự án hoạt động đúng.

### Bước 4 — Xử lý ID stale ở các trang bước 2–6 & lịch sử

**File:** `components/steps/step-{2..6}/index.tsx`, `components/history/index.tsx`

- Hiện tại các trang này chỉ hiện thông báo "Chưa có dự án nào" khi `projectId === null`.
- Thêm xử lý: nếu API trả về **404** (project không tồn tại) → hiển thị thông báo rõ ràng kèm link "Tạo dự án mới" (về trang chủ hoặc `/projects`).
- Có thể tạo một helper dùng chung (ví dụ `isNotFound(err)`) để nhận diện lỗi 404 từ `ApiError`.

**Tiêu chí hoàn thành:**
- [ ] Vào trang bước với ID stale → thấy thông báo hướng dẫn tạo dự án mới, không còn lỗi kỹ thuật khó hiểu.

### Bước 5 — (Tùy chọn) Nút profile trong header

**File:** `frontend/components/research-loop/header.tsx`

- Gắn `onClick` cho nút profile hoặc ẩn nó nếu chưa có chức năng.

---

## 4. Rủi ro & Lưu ý

- **Không phá vỡ luồng hiện tại:** Việc xác thực ID phải phân biệt rõ lỗi 404 (stale) với lỗi mạng — nếu server không kết nối được, **không được** tự ý xóa ID và tạo project mới.
- **Mất dữ liệu:** Nút "Tạo dự án mới" sẽ reset toàn bộ tiến trình — cần xác nhận trước khi thực hiện.
- **Backend đã sẵn sàng:** `GET /projects` và `POST /projects` đã tồn tại, không cần thay đổi backend cho các bước 1–4.

---

## 5. Thứ tự ưu tiên đề xuất

1. **Bước 1** (tự phục hồi ID stale) — giải quyết ngay vấn đề chặn người dùng.
2. **Bước 2** (nút tạo dự án mới) — cho phép bắt đầu lại thủ công.
3. **Bước 3** (trang `/projects`) — quản lý nhiều dự án.
4. **Bước 4** (xử lý 404 ở các trang bước) — cải thiện trải nghiệm lỗi.
5. **Bước 5** (profile) — dọn dẹp UI.