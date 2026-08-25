
# Project Context: SpecResearch Loop (Đồ án Công nghệ mới trong PT PM)

## 1. Tổng Quan Dự Án (Project Overview)

- **Tên dự án:** SpecResearch Loop - Hệ thống hoàn thiện ý tưởng nghiên cứu bằng bằng chứng và vòng lặp xác nhận.
- **Mục tiêu:** Chuyển một ý tưởng nghiên cứu mơ hồ thành bản đặc tả nghiên cứu (Research Specification) rõ ràng, có bằng chứng, kế hoạch thí nghiệm khả thi (khống chế tài nguyên GPU/Token) và được kiểm chứng bởi nhiều Multi-Judge độc lập.
- **Tư tưởng cốt lõi:** Human-in-the-loop kết hợp Multi-Agent AI System. AI không tự quyết định hết mà đưa ra giải thích + lựa chọn (A/B/C/D/Other) để người dùng chốt qua từng vòng.

---

## 2. Quy Trình 5 Vòng Lặp Cốt Lõi (Core Pipeline)

### Vòng 1 — Nhập Ý Tưởng & Làm Rõ (Clarify & Decompose)

- **Nhiệm vụ:** Diễn giải lại ý tưởng bằng ngôn ngữ dễ hiểu. Đặt 2–3 câu hỏi trắc nghiệm (lựa chọn + ví dụ + tùy chọn Other) để làm rõ tác vụ, mục đích, giả định.
- **Phân rã:** Tách ý tưởng thành các thẻ: `Problem`, `Research Question`, `Gap Candidate`, `Contribution`, `Claim`, `Evidence`, `Constraint`, `Open Question`.
- **Trạng thái thẻ:** `CONFIRMED`, `PROPOSED`, `MISSING`, `AMBIGUOUS`, `UNSUPPORTED`, `CONFLICT`.

### Vòng 2 — Nghiên Cứu Liên Quan & Tìm Research Gap

- **Nhiệm vụ:** Trích xuất từ khóa, tự động gọi API (ArXiv/Semantic Scholar) để tìm paper liên quan.
- **Đầu ra:** Lập Bảng đối sánh Related Work (Nghiên cứu | Đã làm gì | Feedback | Điểm còn thiếu | Nguồn).
- **Phân tích Gap:** Đề xuất 3–4 hướng Gap khả thi kèm ví dụ để người dùng chọn.

### Vòng 3 — Contribution, Claim-Evidence & Kế Hoạch Thí Nghiệm

- **Nhiệm vụ:** Biến Research Gap thành Contribution & Claim-Evidence Cards (Claim, Baseline, Metric, Evidence, Điều kiện bác bỏ).
- **Thí nghiệm:** Thiết kế Protocol từng bước (TN1: Baseline, TN2: Đánh giá chất lượng, TN3: Ablation study, TN4: Generalization, TN5: Efficiency).
- **Kiểm tra tính khả thi:** Ước tính phần cứng (Model, Seed prompts, Candidates, VRAM, Token, Thời gian trên GPU như RTX 3090).

### Vòng 4 — Panel Judge Độc Lập & Phản Biển (Multi-Judge Review)

- **Nhiệm vụ:** Đưa bản Spec qua 5 AI Judge độc lập (không xem nhận xét của nhau):
  1. `Gap Judge`: Kiểm tra gap có thực sự được tài liệu hỗ trợ.
  2. `Contribution Judge`: Kiểm tra contribution có mới và bị phóng đại không.
  3. `Experiment Judge`: Kiểm tra thiết kế thí nghiệm có đủ chứng minh claim không.
  4. `Evidence Judge`: Kiểm tra citation có đúng context hỗ trợ không.
  5. `Conference Readiness Judge`: Đánh giá Originality, Soundness, Clarity, Reproducibility.
- **Đầu ra:** Bảng tổng hợp Issues theo mức độ (`CRITICAL`, `MAJOR`, `MINOR`) và đưa ra gợi ý sửa đổi cho người dùng bấm chốt.

### Vòng 5 — Bản Spec Cuối & Export

- **Nhiệm vụ:** Tổng hợp toàn bộ Decision Log và nội dung đã qua kiểm duyệt thành bản Research Spec hoàn chỉnh.
- **Đầu ra:** Hỗ trợ xem Diff, xuất file Markdown / PDF / JSON.

---

## 3. Kiến Trúc Công Nghệ & Phân Công (Tech Stack & Architecture)

- **Frontend:** Next.js / React + TailwindCSS / Shadcn UI (Giao diện Wizard 5 bước dạng Stepper).
- **Backend:** FastAPI (Python) hoặc ExpressJS (Node.js) - Quản lý Session State, Database & REST API Endpoints.
- **AI/LLM Engine:** Multi-Agent System (LangChain / LangGraph / Gemini API / OpenAI API).
- **Search API:** ArXiv API / Semantic Scholar API / Tavily Search.
- **Database/Storage:** PostgreSQL / SQLite (Lưu trữ Project State, Versioning & Decision Logs).

---

## 4. Các Yêu Cầu Bàn Giao Cần Lưu Ý (Deliverables Checklist)

1. Website chạy được (UI dạng Wizard 5 bước).
2. Source code + Tài liệu kiến trúc hệ thống.
3. Dataset / 2-3 Use cases thử nghiệm mẫu.
4. System Prompts của Generator và 5 Judges.
5. Cơ chế kiểm tra Citation / Evidence Verification.
6. **Ít nhất 2 Baseline** để so sánh (Single-prompt vs Multi-agent loop).
7. Báo cáo đánh giá hệ thống + Video Demo 3-5 phút.
8. File Research Spec hoàn chỉnh xuất từ hệ thống.

---

## 5. Quy Tắc Dành Cho AI Code Assistant (Gemini Guidelines)

When generating code, schemas, or prompts for this repository:

1. **Strict JSON Output:** All AI Agents (Clarifier, Gap Analyzer, Judges) MUST return strictly formatted Pydantic/JSON schemas to prevent backend integration crashes.
2. **Human-in-the-loop First:** Always structure options as `{ "options": [...], "allow_other": true }` to allow explicit user selection.
3. **Hardware Constraint:** Default GPU feasibility estimations must fit single consumer GPUs (e.g., NVIDIA RTX 3090, 24GB VRAM).
4. **No Hallucinated Citations:** Citation mappings must explicitly link to fetched paper metadata.
5. **Language:** Write code, comments, and schemas in English; write UI texts, options, and explanations in Vietnamese.
