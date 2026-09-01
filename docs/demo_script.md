# KỊCH BẢN VIDEO DEMO — SPECRESEARCH LOOP
**Dự án:** SpecResearch Loop — Hệ thống hoàn thiện ý tưởng nghiên cứu bằng bằng chứng và vòng lặp xác nhận  
**Thời lượng mục tiêu:** 3:30 – 4:30 phút  
**Ngôn ngữ thuyết minh:** Tiếng Việt  
**Chất lượng video:** 1080p 60fps  

---

## 🎬 TỔNG QUAN TIMELINE VIDEO

| Mốc thời gian | Phân cảnh | Nội dung chính |
| :---: | :--- | :--- |
| **0:00 – 0:30** | Giới thiệu & Vấn đề | Đặt vấn đề nghiên cứu mơ hồ, hallucination citation, quá tải tài nguyên |
| **0:30 – 1:15** | Bước 1 & Bước 2 | Nhập ý tưởng, Clarification Q&A, Phân rã 8 Seed Cards, Graph View |
| **1:15 – 2:00** | Bước 3 | Tra cứu ArXiv thật, Bảng đối sánh Related Works, Chọn Gap A/B/C/D |
| **2:00 – 2:45** | Bước 4 | Contribution & Claim-Evidence Matrix, 5 Experiments, Tính VRAM RTX 3090 |
| **2:45 – 3:30** | Bước 5 | Multi-Judge Review (5 AI Judges), Xử lý Issues & Chốt spec |
| **3:30 – 4:15** | Bước 6 & Lịch sử | Bản Spec hoàn chỉnh 10 phần, Xuất PDF / MD / JSON, Xem Diff phiên bản |
| **4:15 – 4:30** | Kết luận | Tổng kết giá trị hệ thống và Baseline benchmark vượt trội |

---

## 🎙️ KỊCH BẢN CHI TIẾT TỪNG PHÂN CẢNH

### 📍 Phân cảnh 1: Mở đầu & Giới thiệu bài toán (0:00 – 0:30)
- **Hình ảnh hiển thị trên màn hình:**
  - Slide tiêu đề / Logo dự án **SpecResearch Loop**.
  - Trực tiếp chuyển vào giao diện Web App tại `http://localhost:3001`.
- **Lời thoại thuyết minh:**
  > *"Xin chào thầy cô và các bạn. Trong nghiên cứu khoa học, việc chuyển một ý tưởng ban đầu còn mơ hồ thành một bản đặc tả nghiên cứu chi tiết, có cơ sở lý thuyết vững chắc, thiết kế thí nghiệm khả thi trên phần cứng tiêu dùng và không bị hallucination citation là một thách thức rất lớn.*  
  > *Hôm nay, nhóm xin trình bày hệ thống **SpecResearch Loop** — nền tảng Multi-Agent kết hợp cơ chế Human-in-the-loop giúp tự động hóa và tinh chỉnh toàn diện ý tưởng nghiên cứu qua 5 vòng lặp khép kín."*

---

### 📍 Phân cảnh 2: Vòng 1 & 2 — Làm rõ ý tưởng & Phân rã 8 Thẻ (0:30 – 1:15)
- **Thao tác trên màn hình:**
  - Nhập ý tưởng: *"Tự động tối ưu prompt nhiều vòng để giảm hallucination khi LLM trích xuất thông tin từ paper"*.
  - Bấm nút **"Phân tích ý tưởng"** $\rightarrow$ Hệ thống diễn giải `Clarified Idea`, bóc tách 4 `Key Issues`, hiển thị điểm `Confidence Score`.
  - Chọn đáp án trắc nghiệm ở bảng câu hỏi làm rõ $\rightarrow$ Bấm **"Xác nhận & Lưu câu trả lời"**.
  - Bấm **"Tiếp tục sang bước 2"** $\rightarrow$ Hiển thị 8 thẻ hạt giống (Seed Cards) $\rightarrow$ Chuyển sang tab **Graph View** để xem biểu đồ quan hệ giữa các thẻ.
- **Lời thoại thuyết minh:**
  > *"Bắt đầu tại Bước 1, người dùng chỉ cần nhập một ý tưởng thô sơ. Agent Clarifier sẽ phân tích, chuẩn hóa lại ý tưởng và đặt ra các câu hỏi trắc nghiệm để xác định chính xác mục tiêu của người dùng.*  
  > *Sau khi xác nhận, hệ thống tự động phân rã ý tưởng thành 8 thẻ đặc tả cốt lõi bao gồm Problem, Research Question, Gap, Contribution, Claim, Evidence, Constraint và Open Question. Người dùng có thể chỉnh sửa nội dung hoặc xem trực quan dưới dạng đồ thị liên kết Graph View."*

---

### 📍 Phân cảnh 3: Vòng 2 — Tra cứu ArXiv & Định vị Research Gap (1:15 – 2:00)
- **Thao tác trên màn hình:**
  - Bấm chuyển sang Bước 3 $\rightarrow$ Hệ thống tự động gọi **ArXiv API thật** để lấy các paper liên quan.
  - Cuộn xem **Bảng đối sánh Related Works** 5 cột (Paper, Đã làm gì, Feedback phản biện, Điểm còn thiếu, Nguồn trích dẫn).
  - Di chuyển xuống phần **Research Gap** $\rightarrow$ Xem 4 hướng giải pháp A, B, C, D do LLM phân tích $\rightarrow$ Click chọn Hướng B.
  - Xem bảng kiểm tra xung đột Claim - Evidence.
- **Lời thoại thuyết minh:**
  > *"Bước sang Vòng 2, hệ thống tự động trích xuất từ khóa và truy vấn API ArXiv thời gian thực để tìm các bài báo khoa học liên quan nhất. Toàn bộ tài liệu được tổng hợp thành bảng đối sánh chi tiết, loại bỏ hoàn toàn nguy cơ trích dẫn bài báo giả định.*  
  > *Từ đó, Agent phân tích và đề xuất 4 hướng Research Gap khả thi kèm ví dụ cụ thể để người dùng chủ động lựa chọn hướng nghiên cứu trọng tâm."*

---

### 📍 Phân cảnh 4: Vòng 3 — Contribution, Kế hoạch Thí nghiệm & GPU Feasibility (2:00 – 2:45)
- **Thao tác trên màn hình:**
  - Chuyển sang Bước 4 $\rightarrow$ Hiển thị danh sách Contribution và **Ma trận Claim - Evidence** (Claim, Baseline, Metric, Evidence, Điều kiện bác bỏ).
  - Xem quy trình 5 bước thực nghiệm chuẩn: **TN1 Baseline, TN2 Đánh giá chất lượng, TN3 Ablation Study, TN4 Khả năng tổng quát hóa, TN5 Hiệu năng tính toán**.
  - Xem bảng ước tính phần cứng **NVIDIA RTX 3090 (24GB VRAM)** $\rightarrow$ Hiển thị VRAM ước tính, số Token và số giờ chạy.
  - Bấm **"Xác nhận kế hoạch"**.
- **Lời thoại thuyết minh:**
  > *"Tại Vòng 3, khoảng trống nghiên cứu được cụ thể hóa thành các Đóng góp khoa học và Ma trận Claim - Evidence với tiêu chí bác bỏ rõ ràng.*  
  > *Điểm đặc biệt của hệ thống là khả năng tự động thiết kế bộ 5 giao thức thí nghiệm hoàn chỉnh, đồng thời ước tính ngân sách tính toán thực tế, đảm bảo toàn bộ quy trình có thể chạy khả thi trên một GPU tiêu dùng duy nhất như RTX 3090 24GB."*

---

### 📍 Phân cảnh 5: Vòng 4 — Hội đồng 5 AI Judges phản biện độc lập (2:45 – 3:30)
- **Thao tác trên màn hình:**
  - Chuyển sang Bước 5 $\rightarrow$ Bấm **"Chạy đánh giá Judge"**.
  - Hiển thị phản biện từ **5 Judges độc lập**: *Gap Judge, Contribution Judge, Experiment Judge, Evidence Judge, Conference Readiness Judge*.
  - Bấm mở các issue được gắn nhãn `CRITICAL` / `MAJOR` $\rightarrow$ Chọn phương án khắc phục được gợi ý $\rightarrow$ Hệ thống cập nhật trạng thái issue.
  - Bấm **"Chốt bản đặc tả sau Judge"**.
- **Lời thoại thuyết minh:**
  > *"Điểm đột phá của SpecResearch Loop là Hội đồng 5 AI Judges độc lập tại Vòng 4. Các Giám khảo đánh giá chéo spec từ tính hợp lệ của Gap, sự mới mẻ của Contribution, tính chặt chẽ của Thí nghiệm cho đến khả năng sẵn sàng xuất bản tại các hội nghị hàng đầu.*  
  > *Các vấn đề được phân loại theo mức độ nghiêm trọng và gợi ý giải pháp cụ thể để người nghiên cứu chốt phương án sửa đổi."*

---

### 📍 Phân cảnh 6: Vòng 5 — Bản Spec cuối cùng, Export 3 định dạng & Diff (3:30 – 4:30)
- **Thao tác trên màn hình:**
  - Chuyển sang Bước 6 $\rightarrow$ Xem bản Spec hoàn chỉnh 10 phần chuẩn hội nghị khoa học.
  - Bấm **"Xác nhận spec"**.
  - Lần lượt bấm:
    1. **"Xuất PDF"** $\rightarrow$ Mở file `spec.pdf` vừa tải về với định dạng layout trang chuyên nghiệp.
    2. **"Xuất Markdown"** $\rightarrow$ Tải file `spec.md`.
    3. **"Xuất JSON"** $\rightarrow$ Tải file `spec.json`.
  - Click vào menu **"Lịch sử"** $\rightarrow$ Hiển thị Version Diff so sánh sự thay đổi qua từng bước.
- **Lời thoại thuyết minh:**
  > *"Cuối cùng tại Bước 6, toàn bộ Decision Log và nội dung đã qua kiểm duyệt được tổng hợp thành bản Research Specification hoàn chỉnh gồm 10 phần chuẩn mực.*  
  > *Hệ thống hỗ trợ xuất đa định dạng bao gồm PDF nhị phân chuyên nghiệp, Markdown và JSON cấu trúc. Ngoài ra, giao diện Lịch sử phiên bản cho phép theo dõi chi tiết từng thay đổi theo thời gian.*  
  > *Kết quả benchmark trên các use cases thực nghiệm cho thấy SpecResearch Loop vượt trội hơn hẳn so với Single-prompt và Linear Chain về cả tính khả thi lẫn độ chuẩn xác khoa học. Xin trân trọng cảm ơn thầy cô và các bạn đã theo dõi!"*

---

## 🎯 DANH SÁCH CHECKLIST TRƯỚC KHI QUAY
- [x] Chạy đủ 3 server: FastAPI (8000), NestJS (3000), Next.js (3001).
- [x] Xóa cache hoặc tạo project mới để luồng đi từ Bước 1 mượt mà.
- [x] Phóng to trình duyệt ở mức 100% hoặc 110% cho rõ text.
- [x] Chuẩn bị sẵn thư mục Downloads để mở file PDF và JSON ngay khi bấm xuất.
