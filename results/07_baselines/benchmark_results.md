# SpecResearch Loop — Baseline Benchmark Results

> **Benchmark Date:** 2026-09-03 05:59:19  
> **Total Test Ideas Evaluated:** 5  
> **Method:** Real Gemini LLM generation + real arXiv citation verification (see `benchmark_baselines.py`)

## Quantitative Comparison Matrix

| Metric (Chỉ số đánh giá) | Baseline 1 (Single-Prompt) | Baseline 2 (Linear Chain) | SpecResearch Loop (Ours) | Delta vs B1 (Cải thiện) |
| :--- | :---: | :---: | :---: | :---: |
| **Unsupported Claim Rate (↓ tốt hơn)** | 100.0% | 0.0% | **0.0%** | **-100.0%** |
| **Citation Hallucination Rate (↓ tốt hơn)** | 0.0% | 0.0% | **0.0%** | **-0.0%** |
| **Hardware Feasibility Rate (RTX 3090) (↑)** | 80.0% | 100.0% | **100.0%** | **+20.0%** |
| **Rejection Condition Coverage (↑)** | 20.0% | 100.0% | **100.0%** | **+80.0%** |
| **Structural Completeness Score (/10) (↑)** | 8.8/10 | 10.0/10 | **10.0/10** | **+1.2 pts** |
| **Average End-to-End Latency** | 6.9s | 20.86s | 52.04s | Multi-agent overhead (chấp nhận được) |

## Key Insights:
1. **Chất lượng claim được cải thiện triệt để:** Quy trình Multi-Agent (B2 & Ours) giảm tỷ lệ claim không có bằng chứng từ **100.0%** (Single-Prompt) xuống **0.0%** và nâng độ phủ điều kiện bác bỏ từ **20.0%** lên **100.0%**.
2. **Trích dẫn được xác thực thực tế:** Mọi mã arXiv trong output đều được kiểm tra tồn tại qua arXiv API thật; tỷ lệ trích dẫn ảo đo được là **0.0%**.
3. **Khống chế phần cứng:** Mọi thí nghiệm sinh ra đều được thẩm định tự động với ngưỡng 24GB VRAM của NVIDIA RTX 3090 (tỷ lệ khả thi **100.0%**).
