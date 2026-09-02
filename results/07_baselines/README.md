# Baselines — Đối Sánh Ít Nhất Hai Baseline

> **Nguồn gốc:** `eval/` trong repository gốc.
> **Yêu cầu đề bài:** Ít nhất hai baseline. Hệ thống cung cấp **2 baseline** đối sánh với SpecResearch Loop.

## Các phương pháp được so sánh

| Phương pháp | Mô tả |
| :--- | :--- |
| **Baseline 1 — Single-Prompt Generation** | Một prompt duy nhất yêu cầu LLM (`gemini-3.5-flash-lite`) viết toàn bộ đề xuất nghiên cứu trong 1 lần. Không tra cứu API ngoài, không HITL, không phản biện. |
| **Baseline 2 — Linear Chain Generation** | Chuỗi prompt tuần tự 5 bước nhưng **không** có tra cứu API ngoài, **không** có can thiệp con người, **không** có thẩm phán phản biện. |
| **SpecResearch Loop (Ours)** | Quy trình 5 vòng lặp Multi-Agent: xác thực arXiv, Dependency Invalidation Graph, 5 AI Judges độc lập, HITL. |

## Files

- `benchmark_baselines.py` — script đánh giá định lượng 3 phương pháp trên **5 ý tưởng mẫu** (`BENCHMARK_IDEAS`), tính trung bình các chỉ số và xuất kết quả ra Markdown + JSON.
- `benchmark_results.md` — bảng kết quả định lượng đã chạy (2026-09-03).
- `benchmark_results.json` — dữ liệu thô đầy đủ (từng ý tưởng + trung bình).

## Chỉ số đánh giá

| Chỉ số | Baseline 1 | Baseline 2 | SpecResearch Loop |
| :--- | :---: | :---: | :---: |
| Unsupported Claim Rate (↓) | 100.0% | 0.0% | **0.0%** |
| Citation Hallucination Rate (↓) | 0.0% | 0.0% | **0.0%** |
| Hardware Feasibility Rate (↑) | 80.0% | 100.0% | **100.0%** |
| Rejection Condition Coverage (↑) | 20.0% | 100.0% | **100.0%** |
| Structural Completeness (/10) (↑) | 8.8 | 10.0 | **10.0** |
| End-to-End Latency | 6.9s | 20.9s | 52.0s |

## Cách chạy lại

```powershell
cd D:\GitHub\SpecResearch_Loop\results\07_baselines
python benchmark_baselines.py
```

Script tự ghi đè `benchmark_results.md` và `benchmark_results.json` trong thư mục `results/07_baselines/`.

> **Lưu ý:** Script đo lường thực tế bằng lời gọi Gemini (`gemini-3.5-flash-lite`) và xác thực trích dẫn qua arXiv API thật — không dùng hằng số mô phỏng. Chi tiết phân tích xem `../08_evaluation_report/evaluation_report.md`.