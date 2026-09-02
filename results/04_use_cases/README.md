# Dataset / Tập Use Case Thử Nghiệm

> **Nguồn gốc:** `data/use_cases/` trong repository gốc.
> **Mục đích:** Bộ dữ liệu thử nghiệm (test use cases) dùng để chạy và đánh giá hệ thống SpecResearch Loop.

## Danh sách 3 use case

| File | ID | Lĩnh vực | Đề tài |
| :--- | :---: | :--- | :--- |
| `prompt_optimization_loop.json` | UC-001 | Prompt Engineering & Automated Optimization | Claim-Guided Prompt Optimization Loop for Complex LLM Reasoning |
| `citation_verifier_agent.json` | UC-002 | Scientific Evidence Verification & Fact Checking | Multi-Agent Verification Pipeline for Eliminating Hallucinated Citations |
| `multimodal_spec_generator.json` | UC-003 | Multimodal AI & Architectural Specification Synthesis | Multi-Modal Research Specification & Interactive Architecture Diagram Generation |

## Cấu trúc mỗi use case

Mỗi file JSON ghi lại **toàn bộ vòng lặp 5 bước** của hệ thống cho một ý tưởng nghiên cứu:

- `use_case_id`, `domain`, `project_title`, `raw_idea` — thông tin đầu vào.
- `round_1_clarification` — ý tưởng đã làm rõ, key issues, confidence score, câu hỏi trắc nghiệm + đáp án, **8 seed cards** (PROBLEM, RESEARCH_QUESTION, GAP_CANDIDATE, CONTRIBUTION, CLAIM, EVIDENCE, CONSTRAINT, OPEN_QUESTION).
- `round_2_related_works` — bảng đối sánh các công trình liên quan (kèm `source_url` arXiv thật) và hướng Gap đã chọn (A/B/C/D).
- Các vòng tiếp theo (experiment, judges, final spec) — theo luồng chuẩn của hệ thống.

## Cách dùng

- **Chạy benchmark:** `../07_baselines/benchmark_baselines.py` dùng các ý tưởng mẫu tương tự để đối sánh 3 phương pháp.
- **Demo thủ công:** Nhập `raw_idea` của từng use case vào website (Bước 1) và đi theo luồng 6 bước để tái tạo kết quả.
- **Kiểm thử AI pipeline:** `ai_service/test_ai_pipeline.py` (chạy với `USE_MOCK_AI=True`).