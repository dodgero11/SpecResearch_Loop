# Research Specification: Untitled research

## 1. Metadata & Executive Summary
- **Tiêu đề dự án:** Untitled research
- **Phiên bản:** 1.0 (Hoàn thiện qua 5 vòng lặp SpecResearch Loop)
- **Tình trạng kiểm duyệt:** Được xác nhận bởi Hội đồng 5 AI Judges độc lập

## 2. Problem Formulation (Bối cảnh & Vấn đề)
Hiện tượng ảo giác (hallucination) ở các mô hình ngôn ngữ lớn (LLM) làm giảm đáng kể độ tin cậy và độ chính xác khi thực hiện nhiệm vụ trích xuất thông tin phức tạp từ các bài báo khoa học.

## 3. Research Questions & Hypotheses (Câu hỏi & Giả thuyết)
- **RQ1:** Quy trình Human-in-the-loop kết hợp 5 AI Judges có thể giảm thiểu tỷ lệ trích dẫn ảo xuống dưới 5% không?
- **RQ2:** Thuật toán Dependency Invalidation có thể giảm ít nhất 50% thời gian recompute trên 1x GPU NVIDIA RTX 3090 không?

## 4. Literature Review & Comparative Analysis (Tổng quan tài liệu)
| Công trình | Năm | Phương pháp chính | Hạn chế còn tồn đọng | Nguồn trích dẫn |
| :--- | :---: | :--- | :--- | :--- |
| OPRO | 2023 | Tối ưu prompt qua search & score | Chưa kiểm tra evidence độc lập cho claim | arXiv:2309.03409 |
| DSPy | 2024 | Framework biên dịch declarative prompt | Chưa có cơ chế đa thẩm phán độc lập | arXiv:2310.03714 |

## 5. Research Gap & Novelty (Khoảng trống nghiên cứu & Đóng góp mới)
Chưa có cơ chế tách claim và kiểm tra evidence độc lập cho từng tuyên bố trong ngân sách GPU cá nhân.

## 6. Technical Approach & Architecture (Phương pháp tiếp cận)
- **Kiến trúc:** Multi-Agent Pipeline với 5 vòng lặp: Làm rõ -> Đối sánh tài liệu -> Thiết kế thí nghiệm -> Hội đồng phản biện -> Xuất bản.

## 7. Hardware & Resource Feasibility Profile
- **GPU Mục tiêu:** 1x NVIDIA GeForce RTX 3090 (24GB VRAM)
- **Ước tính VRAM:** 16.5 GB / 24.0 GB (Thỏa mãn tính khả thi: `is_feasible = True`)
