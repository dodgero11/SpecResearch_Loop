# SpecResearch Loop — Bàn Giao Kết Quả (Deliverables)

> **Dự án:** SpecResearch Loop — Hệ thống hoàn thiện ý tưởng nghiên cứu bằng bằng chứng và vòng lặp xác nhận Multi-Agent
> **Môn học:** Đồ án Công nghệ mới trong Phát triển Phần mềm
> **Ngày bàn giao:** 2026-09-03

Thư mục `results/` này tập hợp **toàn bộ các sản phẩm bàn giao** theo đúng danh mục yêu cầu của đề bài. Mỗi mục tương ứng với một thư mục con, kèm tài liệu giải thích và đường dẫn tới mã nguồn gốc trong repository.

---

## Danh mục bàn giao (Deliverables Checklist)

| STT | Yêu cầu bàn giao | Trạng thái | Vị trí trong `results/` | Mã nguồn gốc |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Tài liệu kiến trúc** | ✅ Hoàn thành | [`03_architecture/`](03_architecture/) | `docs/general/*.md`, `docs/backend/*.md` |
| 2 | **Dataset / tập use case thử nghiệm** | ✅ Hoàn thành (3 use cases) | [`04_use_cases/`](04_use_cases/) | `data/use_cases/*.json` |
| 3 | **Prompt của Generator và các Judge** | ✅ Hoàn thành | [`05_prompts/`](05_prompts/) | `docs/system_prompts.md` |
| 4 | **Cơ chế kiểm tra citation / evidence** | ✅ Hoàn thành | [`06_citation_evidence/`](06_citation_evidence/) | `ai_service/services/arxiv_service.py` + Evidence Judge |
| 5 | **Ít nhất hai baseline** | ✅ Hoàn thành (2 baselines) | [`07_baselines/`](07_baselines/) | `07_baselines/benchmark_baselines.py` |
| 6 | **Báo cáo đánh giá hệ thống** | ✅ Hoàn thành | [`08_evaluation_report/`](08_evaluation_report/) | `docs/evaluation_report.md` |
| 7 | **Research spec hoàn chỉnh do hệ thống tạo ra** | ✅ Hoàn thành | [`10_sample_spec/`](10_sample_spec/) | `examples/sample_research_specification.md` |

---

## Tóm tắt từng mục

### 1. Tài liệu kiến trúc — [`03_architecture/`](03_architecture/)
- `architecture.md` — kiến trúc tổng thể (frontend → backend → AI service → PostgreSQL)
- `ai-api.md` — hợp đồng AI gateway (2 typed ports: `LlmPort` + `AiGateway`)
- `ai_service_contract.md` — hợp đồng HTTP wire-level của Python `ai_service`
- `frontend-api.md` — hợp đồng HTTP mà frontend tiêu thụ
- `requirements.md`, `acceptance-criteria.md` — yêu cầu & tiêu chí chấp nhận

### 2. Dataset / use case thử nghiệm — [`04_use_cases/`](04_use_cases/)
3 use case mẫu hoàn chỉnh (mỗi file JSON ghi lại toàn bộ vòng lặp: clarify → seed cards → related works → gap direction):
- `UC-001` — Claim-Guided Prompt Optimization Loop
- `UC-002` — Multi-Agent Citation & Fact Verifier
- `UC-003` — Multimodal Spec Generator

### 3. Prompt của Generator và các Judge — [`05_prompts/`](05_prompts/)
`system_prompts.md` đặc tả toàn bộ system prompt của 12 agent: Clarifier, Decomposer, Related Works, Gap Analyzer, Experiment Designer, Conflict Checker, **5 AI Judges** (Gap, Contribution, Experiment, Evidence, Conference Readiness) và Final Spec Synthesizer.

### 4. Cơ chế kiểm tra citation / evidence — [`06_citation_evidence/`](06_citation_evidence/)
- `citation_evidence_mechanism.md` — tài liệu mô tả cơ chế 3 lớp chống trích dẫn ảo (arXiv metadata verification → Evidence Judge → Conflict Checker)
- `arxiv_service.py` — mã nguồn tra cứu arXiv thời gian thực (timeout 6s + fallback)

### 5. Baselines — [`07_baselines/`](07_baselines/)
- `benchmark_baselines.py` — script đối sánh **Baseline 1 (Single-Prompt)** và **Baseline 2 (Linear Chain)** với SpecResearch Loop trên 5 ý tưởng mẫu
- `benchmark_results.md` / `.json` — kết quả định lượng đã chạy

### 6. Báo cáo đánh giá hệ thống — [`08_evaluation_report/`](08_evaluation_report/)
`evaluation_report.md` — báo cáo đánh giá toàn diện: thiết kế thực nghiệm, bảng đối sánh định lượng, phân tích hiệu quả 5 Judges, đánh giá khống chế GPU RTX 3090, và bảng đối chiếu danh mục bàn giao.

### 7. Research spec hoàn chỉnh — [`10_sample_spec/`](10_sample_spec/)
`sample_research_specification.md` — bản đặc tả nghiên cứu 10 phần chuẩn hội nghị, được sinh tự động qua 5 vòng lặp và phê duyệt bởi 5 AI Judges (`APPROVED`).

---

## Ghi chú bàn giao

- **Website, Source code, Video demo:** Không nằm trong phạm vi bàn giao này (đã có sẵn trong repository gốc: `frontend/`, `backend/`, `ai_service/`; kịch bản demo tại `docs/demo_script.md`).
- **Cơ chế citation/evidence (mục 4):** Tài liệu chi tiết tại `06_citation_evidence/citation_evidence_mechanism.md`.