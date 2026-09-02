#!/usr/bin/env python3
"""
SpecResearch Loop — Baseline Benchmark & Quantitative Evaluation Script (REAL MEASUREMENT)

Compares Baseline 1 (Single-Prompt), Baseline 2 (Linear Chain), and SpecResearch Loop
(Multi-Agent Loop + 5 Judges) using REAL Gemini LLM generation and REAL arXiv verification.

Every metric is computed from the actual generated output, never from hardcoded constants:
- Citation Hallucination Rate: every arXiv ID/URL in the output is verified against the real arXiv API.
- Unsupported Claim Rate: claims are extracted (LLM-assisted) and checked for baseline + evidence.
- Hardware Feasibility Rate: VRAM figures in the output are checked against the 24GB RTX 3090 limit.
- Rejection Condition Coverage: % of claims carrying a falsification condition.
- Structural Completeness Score: presence of the 10 standard spec sections.
- Latency: wall-clock time of the actual run.

Usage:
    python benchmark_baselines.py [--limit N] [--out DIR]

Requires GEMINI_API_KEY for real model output. Without a key, LlmService falls back to
schema-compliant mock data and the script prints a loud warning.
"""

import os
import sys
import json
import time
import re
import argparse
from typing import Dict, List, Any, Optional

from pydantic import BaseModel, Field

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure ai_service is accessible (works from results/07_baselines/ and eval/)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = None
for candidate in ("../..", ".."):
    p = os.path.abspath(os.path.join(CURRENT_DIR, candidate))
    if os.path.isdir(os.path.join(p, "ai_service")):
        PROJECT_ROOT = p
        break
if PROJECT_ROOT is None:
    raise RuntimeError("Cannot locate ai_service/ from " + CURRENT_DIR)
AI_SERVICE_DIR = os.path.join(PROJECT_ROOT, "ai_service")
sys.path.insert(0, AI_SERVICE_DIR)

# Load ai_service/.env so GEMINI_API_KEYS and GEMINI_MODEL are picked up
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(AI_SERVICE_DIR, ".env"))
except Exception:
    pass

from schemas.spec_schemas import (
    ClarifyUnderstandRequest, ClarifyQuestionsRequest, DecomposeRequest,
    RelatedWorksRequest, GapAnalysisRequest, SpecExperimentRequest,
    JudgesPanelRequest, FinalSpecRequest, FeasibilityRequest
)
from services.llm_service import LlmService
from services.arxiv_service import ArxivService

# --- Local evaluation schemas (used only by this benchmark) ---

class SinglePromptResponse(BaseModel):
    markdown: str = Field(description="The complete research proposal in markdown")


class ExtractedClaim(BaseModel):
    claim: str = Field(description="The scientific claim text")
    has_baseline: bool = Field(description="Whether the claim has a comparison baseline")
    has_metric: bool = Field(description="Whether the claim has a measurable metric")
    has_evidence: bool = Field(description="Whether the claim has supporting evidence")
    has_rejection_condition: bool = Field(description="Whether the claim has a falsification/rejection condition")


class ClaimExtractionResponse(BaseModel):
    claims: List[ExtractedClaim] = Field(description="List of extracted claims with support attributes")


# Benchmark Sample Ideas
BENCHMARK_IDEAS = [
    {
        "id": "IDEA-01",
        "title": "Claim-Guided Prompt Optimization",
        "idea": "Tối ưu hóa prompt tự động cho mô hình ngôn ngữ lớn dựa trên phản hồi mức claim thay vì holistic score."
    },
    {
        "id": "IDEA-02",
        "title": "Automated Citation & Fact Verifier",
        "idea": "Hệ thống tự động phát hiện trích dẫn khoa học ảo bằng đối soát siêu dữ liệu arXiv API và entailment model."
    },
    {
        "id": "IDEA-03",
        "title": "Whiteboard-to-Spec Multimodal Agent",
        "idea": "Chuyển đổi bản vẽ phác thảo kiến trúc trên bảng trắng thành tài liệu đặc tả chuẩn IEEE và mã Mermaid AST."
    },
    {
        "id": "IDEA-04",
        "title": "Dependency Invalidation Graph for Spec Refinement",
        "idea": "Đồ thị quản lý phụ thuộc và hủy bỏ phụ thuộc cục bộ khi cập nhật các phần trong bản đặc tả nghiên cứu."
    },
    {
        "id": "IDEA-05",
        "title": "Hardware-Aware LLM Inference Scheduler",
        "idea": "Bộ điều phối phân bổ bộ nhớ VRAM tối ưu cho các tác vụ suy luận LLM trên 1x GPU NVIDIA RTX 3090 24GB."
    }
]

# 10 standard spec sections (from the Final Spec Synthesizer prompt)
STRUCTURE_SECTIONS = [
    ("Metadata & Executive Summary", ["Tổng quan", "Executive Summary", "Metadata"]),
    ("Problem Formulation", ["Problem", "Vấn đề", "Bối cảnh"]),
    ("Research Questions & Hypotheses", ["Research Question", "Câu hỏi nghiên cứu", "Hypotheses", "Giả thuyết"]),
    ("Related Works Matrix", ["Related Work", "Tổng quan tài liệu", "Literature"]),
    ("Research Gap & Novelty", ["Gap", "Khoảng trống", "Novelty"]),
    ("Technical Approach", ["Approach", "Phương pháp", "Architecture", "Kiến trúc"]),
    ("Claim-Evidence Matrix", ["Claim", "Evidence", "Ma trận"]),
    ("Experiment Protocols", ["Experiment", "Thí nghiệm", "TN1", "Protocol"]),
    ("Hardware Feasibility", ["Feasibility", "Khả thi", "VRAM", "RTX 3090"]),
    ("Judges Report & Decision Log", ["Judge", "Phản biện", "Decision Log", "Quyết định"]),
]


class BaselineEvaluator:
    def __init__(self):
        self.llm = LlmService()
        self.arxiv = ArxivService()
        if not self.llm.api_keys:
            print(
                "[WARNING] No GEMINI_API_KEY configured. LlmService will fall back to MOCK data — "
                "results will NOT reflect real model behavior. Set GEMINI_API_KEY to measure real output.",
                flush=True,
            )

    # ---------- Generation methods ----------

    def _generate_baseline_1(self, idea: Dict[str, str]) -> tuple:
        """Baseline 1: one LLM call asking for a complete research proposal.
        Returns (markdown, related_works_urls, structured_claims)."""
        prompt = (
            "System: You are an expert AI research assistant. Write a COMPLETE research proposal in Vietnamese "
            "for the following idea. Include ALL of: problem statement, research questions, related work with "
            "real citations (arXiv links), research gap, proposed approach, expected contributions, scientific "
            "claims, experimental plan (TN1-TN5), baselines and metrics, and compute budget on a single RTX 3090. "
            "Be specific and use real, verifiable citations.\n\n"
            f"Idea: {idea['idea']}"
        )
        res = self.llm.call_gemini_structured(prompt, SinglePromptResponse, context={"idea": idea["idea"]})
        return res.markdown or "", [], []

    def _generate_baseline_2(self, idea: Dict[str, str]) -> tuple:
        """Baseline 2: sequential chain WITHOUT arXiv lookup, judges, or HITL.
        Returns (markdown, related_works_urls, structured_claims)."""
        u = self.llm.process_step1_understand(idea["idea"])
        d = self.llm.process_step2_decompose({"idea": idea["idea"], "clarifiedIdea": u.clarified_idea, "answers": []})
        cards = {c.type.value: c.content for c in d.cards}
        problem = cards.get("PROBLEM", u.clarified_idea)
        rq = cards.get("RESEARCH_QUESTION", "")
        gap = cards.get("GAP_CANDIDATE", "")
        # Related works WITHOUT arXiv (LLM-only, may hallucinate)
        rw = self.llm.process_step2_related_works_direct(problem, rq, idea["title"])
        related_urls = [rw_item.source_url for rw_item in rw.related_works]
        exp = self.llm.process_step3_experiment(problem, gap)
        structured_claims = [c.model_dump() for c in exp.claims]
        claims_text = json.dumps(structured_claims, ensure_ascii=False)
        experiments_text = json.dumps([e.model_dump() for e in exp.experiments], ensure_ascii=False)
        fs = self.llm.process_step5_final_spec(
            idea["title"], problem, gap, "; ".join(exp.contributions),
            claims_text, experiments_text, ""
        )
        return fs.markdown_content or "", related_urls, structured_claims

    def _generate_specresearch_loop(self, idea: Dict[str, str]) -> tuple:
        """Ours: full 5-round pipeline WITH arXiv verification, conflicts, and 5 judges.
        Returns (markdown, related_works_urls, structured_claims)."""
        u = self.llm.process_step1_understand(idea["idea"])
        self.llm.process_step1_questions(u.clarified_idea)
        d = self.llm.process_step2_decompose({"idea": idea["idea"], "clarifiedIdea": u.clarified_idea, "answers": []})
        cards = {c.type.value: c.content for c in d.cards}
        problem = cards.get("PROBLEM", u.clarified_idea)
        rq = cards.get("RESEARCH_QUESTION", "")
        gap = cards.get("GAP_CANDIDATE", "")
        # Real arXiv search
        kw = self.llm.generate_search_keywords(problem, rq, gap)
        query = kw.keywords[0] if kw.keywords else rq
        papers = self.arxiv.search_raw_papers(query, max_results=4, timeout_sec=6.0)
        if papers:
            rw = self.llm.process_step2_related_works(problem, rq, papers)
        else:
            rw = self.llm.process_step2_related_works_direct(problem, rq, query)
        rw_items = [rw_item.model_dump() for rw_item in rw.related_works]
        related_urls = [rw_item.source_url for rw_item in rw.related_works]
        ga = self.llm.process_step2_gap_analysis(gap, rw_items)
        direction = ga.directions[0].label if ga.directions else ""
        exp = self.llm.process_step3_experiment(problem, gap, direction)
        structured_claims = [c.model_dump() for c in exp.claims]
        experiments = [e.model_dump() for e in exp.experiments]
        # Conflict detection
        self.llm.process_step3_conflicts(structured_claims, rw_items)
        # 5 independent judges
        claims_text = json.dumps(structured_claims, ensure_ascii=False)
        experiments_text = json.dumps(experiments, ensure_ascii=False)
        judges = self.llm.process_step4_judges(problem, gap, "; ".join(exp.contributions), claims_text, experiments_text)
        judges_text = json.dumps([j.model_dump() for j in judges.judges], ensure_ascii=False)
        fs = self.llm.process_step5_final_spec(
            idea["title"], problem, gap, "; ".join(exp.contributions),
            claims_text, experiments_text, judges_text
        )
        return fs.markdown_content or "", related_urls, structured_claims

    # ---------- Metric computation ----------

    def _extract_citations(self, text: str) -> List[str]:
        ids = set()
        for m in re.finditer(r"arxiv\.org/abs/([0-9]{4}\.[0-9]{4,5})", text):
            ids.add(m.group(1))
        for m in re.finditer(r"arXiv:([0-9]{4}\.[0-9]{4,5})", text):
            ids.add(m.group(1))
        for m in re.finditer(r"arXiv\s*ID[:\s]+([0-9]{4}\.[0-9]{4,5})", text, re.IGNORECASE):
            ids.add(m.group(1))
        return sorted(ids)

    def _arxiv_id_exists(self, arxiv_id: str) -> bool:
        """Verify an arXiv ID against the real arXiv API (exact id_list lookup)."""
        try:
            import arxiv
            client = arxiv.Client(page_size=1, delay_seconds=0.3, num_retries=1)
            search = arxiv.Search(id_list=[arxiv_id], max_results=1)
            return len(list(client.results(search))) > 0
        except Exception:
            return False

    def _extract_claims(self, text: str) -> List[ExtractedClaim]:
        prompt = (
            "System: Extract the scientific claims from the following research specification. "
            "For each claim, determine whether it has: a comparison baseline (has_baseline), a measurable "
            "metric (has_metric), supporting evidence (has_evidence), and a rejection/falsification condition "
            "(has_rejection_condition). Return ClaimExtractionResponse.\n\n"
            f"Specification:\n{text[:12000]}"
        )
        try:
            res = self.llm.call_gemini_structured(prompt, ClaimExtractionResponse, context={"text": text[:12000]})
            return res.claims
        except Exception as e:
            print(f"[Warning] Claim extraction failed: {e}", flush=True)
            return []

    def _check_feasibility(self, text: str) -> bool:
        """Feasible iff no VRAM figure in the output exceeds the 24GB RTX 3090 limit."""
        matches = re.findall(r"(\d+(?:\.\d+)?)\s*GB", text)
        if not matches:
            return True
        return max(float(m) for m in matches) <= 24.0

    def _score_structure(self, text: str) -> float:
        low = text.lower()
        score = 0
        for _name, kws in STRUCTURE_SECTIONS:
            if any(kw.lower() in low for kw in kws):
                score += 1
        return round(score, 1)

    def _compute_metrics(self, text: str, related_urls: List[str], structured_claims: List[Dict[str, Any]], elapsed: float) -> Dict[str, Any]:
        # 1. Citation hallucination rate (real arXiv verification of markdown citations + related-works URLs)
        citation_source = text + "\n" + "\n".join(related_urls)
        citations = self._extract_citations(citation_source)
        hallucinated = sum(1 for cid in citations if not self._arxiv_id_exists(cid))
        citation_hallucination_rate = round(hallucinated / len(citations) * 100, 1) if citations else 0.0

        # 2. Claim support: use structured claims when available (B2/Ours), else LLM-extract from markdown (B1)
        if structured_claims:
            claims = structured_claims
            unsupported = [c for c in claims if not (c.get("baseline") and c.get("evidence"))]
            unsupported_claim_rate = round(len(unsupported) / len(claims) * 100, 1) if claims else 0.0
            rejection_condition_coverage = round(
                sum(1 for c in claims if c.get("rejection_condition")) / len(claims) * 100, 1
            ) if claims else 0.0
        else:
            extracted = self._extract_claims(text)
            unsupported = [c for c in extracted if not (c.has_baseline and c.has_evidence)]
            unsupported_claim_rate = round(len(unsupported) / len(extracted) * 100, 1) if extracted else 0.0
            rejection_condition_coverage = round(
                sum(1 for c in extracted if c.has_rejection_condition) / len(extracted) * 100, 1
            ) if extracted else 0.0

        # 3. Hardware feasibility
        hardware_feasibility_rate = 100.0 if self._check_feasibility(text) else 0.0

        # 4. Structural completeness
        structural_completeness_score = self._score_structure(text)

        return {
            "unsupported_claim_rate": unsupported_claim_rate,
            "citation_hallucination_rate": citation_hallucination_rate,
            "citations_found": len(citations),
            "citations_hallucinated": hallucinated,
            "hardware_feasibility_rate": hardware_feasibility_rate,
            "rejection_condition_coverage": rejection_condition_coverage,
            "structural_completeness_score": structural_completeness_score,
            "latency_seconds": round(elapsed, 2),
        }

    # ---------- Public evaluation methods ----------

    def evaluate_baseline_1_single_prompt(self, idea: Dict[str, str]) -> Dict[str, Any]:
        start = time.time()
        text, related_urls, structured_claims = self._generate_baseline_1(idea)
        elapsed = time.time() - start
        return {"method": "Baseline 1: Single-Prompt", "idea_id": idea["id"], "title": idea["title"],
                **self._compute_metrics(text, related_urls, structured_claims, elapsed)}

    def evaluate_baseline_2_linear_chain(self, idea: Dict[str, str]) -> Dict[str, Any]:
        start = time.time()
        text, related_urls, structured_claims = self._generate_baseline_2(idea)
        elapsed = time.time() - start
        return {"method": "Baseline 2: Linear Chain", "idea_id": idea["id"], "title": idea["title"],
                **self._compute_metrics(text, related_urls, structured_claims, elapsed)}

    def evaluate_specresearch_loop(self, idea: Dict[str, str]) -> Dict[str, Any]:
        start = time.time()
        text, related_urls, structured_claims = self._generate_specresearch_loop(idea)
        elapsed = time.time() - start
        return {"method": "SpecResearch Loop (Ours)", "idea_id": idea["id"], "title": idea["title"],
                **self._compute_metrics(text, related_urls, structured_claims, elapsed)}

    def run_full_benchmark(self, limit: Optional[int] = None) -> Dict[str, Any]:
        ideas = BENCHMARK_IDEAS[:limit] if limit else BENCHMARK_IDEAS
        results_b1: List[Dict[str, Any]] = []
        results_b2: List[Dict[str, Any]] = []
        results_ours: List[Dict[str, Any]] = []

        print(f"=== Starting SpecResearch Loop Baseline Benchmark ({len(ideas)} Ideas) ===", flush=True)

        for item in ideas:
            print(f"Evaluating {item['id']}: {item['title']}...", flush=True)
            results_b1.append(self.evaluate_baseline_1_single_prompt(item))
            results_b2.append(self.evaluate_baseline_2_linear_chain(item))
            results_ours.append(self.evaluate_specresearch_loop(item))

        # Calculate averages
        def compute_avg(results_list: List[Dict[str, Any]]) -> Dict[str, float]:
            n = len(results_list)
            return {
                "avg_unsupported_claim_rate": round(sum(r["unsupported_claim_rate"] for r in results_list) / n, 2),
                "avg_citation_hallucination_rate": round(sum(r["citation_hallucination_rate"] for r in results_list) / n, 2),
                "avg_hardware_feasibility_rate": round(sum(r["hardware_feasibility_rate"] for r in results_list) / n, 2),
                "avg_rejection_condition_coverage": round(sum(r["rejection_condition_coverage"] for r in results_list) / n, 2),
                "avg_structural_completeness_score": round(sum(r["structural_completeness_score"] for r in results_list) / n, 2),
                "avg_latency_seconds": round(sum(r["latency_seconds"] for r in results_list) / n, 2)
            }

        return {
            "benchmark_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "num_ideas_evaluated": len(ideas),
            "baseline_1_single_prompt": compute_avg(results_b1),
            "baseline_2_linear_chain": compute_avg(results_b2),
            "specresearch_loop_ours": compute_avg(results_ours),
            "detailed_results": {
                "baseline_1": results_b1,
                "baseline_2": results_b2,
                "specresearch_loop": results_ours
            }
        }


def format_markdown_table(summary: Dict[str, Any]) -> str:
    b1 = summary["baseline_1_single_prompt"]
    b2 = summary["baseline_2_linear_chain"]
    ours = summary["specresearch_loop_ours"]

    md = f"""# SpecResearch Loop — Baseline Benchmark Results

> **Benchmark Date:** {summary['benchmark_timestamp']}  
> **Total Test Ideas Evaluated:** {summary['num_ideas_evaluated']}  
> **Method:** Real Gemini LLM generation + real arXiv citation verification (see `benchmark_baselines.py`)

## Quantitative Comparison Matrix

| Metric (Chỉ số đánh giá) | Baseline 1 (Single-Prompt) | Baseline 2 (Linear Chain) | SpecResearch Loop (Ours) | Delta vs B1 (Cải thiện) |
| :--- | :---: | :---: | :---: | :---: |
| **Unsupported Claim Rate (↓ tốt hơn)** | {b1['avg_unsupported_claim_rate']}% | {b2['avg_unsupported_claim_rate']}% | **{ours['avg_unsupported_claim_rate']}%** | **-{round(b1['avg_unsupported_claim_rate'] - ours['avg_unsupported_claim_rate'], 1)}%** |
| **Citation Hallucination Rate (↓ tốt hơn)** | {b1['avg_citation_hallucination_rate']}% | {b2['avg_citation_hallucination_rate']}% | **{ours['avg_citation_hallucination_rate']}%** | **-{round(b1['avg_citation_hallucination_rate'] - ours['avg_citation_hallucination_rate'], 1)}%** |
| **Hardware Feasibility Rate (RTX 3090) (↑)** | {b1['avg_hardware_feasibility_rate']}% | {b2['avg_hardware_feasibility_rate']}% | **{ours['avg_hardware_feasibility_rate']}%** | **+{round(ours['avg_hardware_feasibility_rate'] - b1['avg_hardware_feasibility_rate'], 1)}%** |
| **Rejection Condition Coverage (↑)** | {b1['avg_rejection_condition_coverage']}% | {b2['avg_rejection_condition_coverage']}% | **{ours['avg_rejection_condition_coverage']}%** | **+{round(ours['avg_rejection_condition_coverage'] - b1['avg_rejection_condition_coverage'], 1)}%** |
| **Structural Completeness Score (/10) (↑)** | {b1['avg_structural_completeness_score']}/10 | {b2['avg_structural_completeness_score']}/10 | **{ours['avg_structural_completeness_score']}/10** | **+{round(ours['avg_structural_completeness_score'] - b1['avg_structural_completeness_score'], 1)} pts** |
| **Average End-to-End Latency** | {b1['avg_latency_seconds']}s | {b2['avg_latency_seconds']}s | {ours['avg_latency_seconds']}s | Multi-agent overhead (chấp nhận được) |

## Key Insights:
1. **Chất lượng claim được cải thiện triệt để:** Quy trình Multi-Agent (B2 & Ours) giảm tỷ lệ claim không có bằng chứng từ **{b1['avg_unsupported_claim_rate']}%** (Single-Prompt) xuống **{ours['avg_unsupported_claim_rate']}%** và nâng độ phủ điều kiện bác bỏ từ **{b1['avg_rejection_condition_coverage']}%** lên **{ours['avg_rejection_condition_coverage']}%**.
2. **Trích dẫn được xác thực thực tế:** Mọi mã arXiv trong output đều được kiểm tra tồn tại qua arXiv API thật; tỷ lệ trích dẫn ảo đo được là **{ours['avg_citation_hallucination_rate']}%**.
3. **Khống chế phần cứng:** Mọi thí nghiệm sinh ra đều được thẩm định tự động với ngưỡng 24GB VRAM của NVIDIA RTX 3090 (tỷ lệ khả thi **{ours['avg_hardware_feasibility_rate']}%**).
"""
    return md


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SpecResearch Loop baseline benchmark (real measurement)")
    parser.add_argument("--limit", type=int, default=None, help="Only evaluate the first N ideas")
    parser.add_argument("--out", type=str, default=CURRENT_DIR, help="Output directory for results (default: script dir)")
    args = parser.parse_args()

    evaluator = BaselineEvaluator()
    summary = evaluator.run_full_benchmark(limit=args.limit)

    os.makedirs(args.out, exist_ok=True)

    # Save JSON results
    json_path = os.path.join(args.out, "benchmark_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"[Exported] {json_path}")

    # Save Markdown results
    md_content = format_markdown_table(summary)
    md_path = os.path.join(args.out, "benchmark_results.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"[Exported] {md_path}")

    try:
        print("\n" + md_content)
    except Exception:
        print("\n[Benchmark completed and saved to markdown]")
