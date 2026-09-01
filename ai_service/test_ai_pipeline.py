import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure ai_service root is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from schemas.spec_schemas import SpecCardType, SpecCardStatus, SeverityEnum, VerdictEnum

client = TestClient(app)

# ==========================================
# 1. HEALTH & ROOT ENDPOINT TESTS
# ==========================================

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "SpecResearch Loop AI Engine"
    assert data["status"] == "online"

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

# ==========================================
# 2. VÒNG 1: CLARIFY & DECOMPOSE TESTS
# ==========================================

def test_clarify_understand():
    payload = {
        "idea": "Xây dựng hệ thống tối ưu prompt tự động cho mô hình ngôn ngữ lớn dựa trên phản hồi của thẩm phán.",
        "feedback": "Cần tập trung vào bài toán sinh đặc tả nghiên cứu."
    }
    response = client.post("/ai/v1/clarify/understand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "clarified_idea" in data
    assert len(data["clarified_idea"]) > 10
    assert isinstance(data["key_issues"], list)
    assert len(data["key_issues"]) >= 2
    assert 0.0 <= data["confidence"] <= 1.0

def test_clarify_questions():
    payload = {
        "clarified_idea": "Hệ thống tối ưu prompt tự động kết hợp Human-in-the-loop và Multi-Agent evaluation."
    }
    response = client.post("/ai/v1/clarify/questions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "questions" in data
    assert len(data["questions"]) >= 2
    for q in data["questions"]:
        assert "question" in q
        assert "options" in q
        assert len(q["options"]) >= 2
        # Check that the last option includes Other/Khác
        last_opt = q["options"][-1].lower()
        assert "other" in last_opt or "khác" in last_opt

def test_decompose_into_8_seed_cards():
    payload = {
        "idea": "Hệ thống tối ưu prompt tự động cho AI research",
        "clarifiedIdea": "Hệ thống tối ưu hóa đặc tả nghiên cứu bằng multi-agent feedback loop",
        "answers": ["Llama-3-8B-Instruct", "Evidence Verification", "Research Proposal"]
    }
    response = client.post("/ai/v1/decompose", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "cards" in data
    cards = data["cards"]
    assert len(cards) == 8, f"Expected exactly 8 seed cards, got {len(cards)}"
    
    card_types = [c["type"] for c in cards]
    expected_types = [
        "PROBLEM", "RESEARCH_QUESTION", "GAP_CANDIDATE", "CONTRIBUTION",
        "CLAIM", "EVIDENCE", "CONSTRAINT", "OPEN_QUESTION"
    ]
    for exp_t in expected_types:
        assert exp_t in card_types, f"Missing card type {exp_t}"
    
    for c in cards:
        assert c["status"] == "PROPOSED"
        assert len(c["content"]) > 5

# ==========================================
# 3. VÒNG 2: RELATED WORKS & GAP ANALYSIS TESTS
# ==========================================

def test_related_works_endpoint():
    payload = {
        "problem": "Mô hình LLM sinh ra trích dẫn ảo trong nghiên cứu khoa học",
        "research_question": "Làm thế nào để xác thực trích dẫn tự động bằng Multi-Agent?",
        "keywords": ["prompt optimization", "citation verification"]
    }
    response = client.post("/ai/v1/related-works", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "related_works" in data
    assert len(data["related_works"]) >= 1
    rw = data["related_works"][0]
    assert "paper_title" in rw
    assert "what_they_did" in rw
    assert "feedback" in rw
    assert "missing_points" in rw
    assert "source_url" in rw

def test_gap_analysis_endpoint():
    payload = {
        "gap_candidate": "Chưa có cơ chế tách claim và kiểm tra evidence độc lập trên GPU cá nhân.",
        "related_works": [
            {"paper_title": "OPRO", "what_they_did": "Tối ưu prompt bằng search + score"}
        ]
    }
    response = client.post("/ai/v1/gap-analysis", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "what_was_done" in data
    assert "limitation" in data
    assert "why_it_matters" in data
    assert "testable_with" in data
    assert "directions" in data
    assert len(data["directions"]) == 4
    letters = [d["letter"] for d in data["directions"]]
    assert letters == ["A", "B", "C", "D"]

def test_conflicts_check_endpoint():
    payload = {
        "claim_evidence_pairs": [
            {"claimCardId": "card-1", "evidenceCardId": "card-2"}
        ],
        "related_works": [
            {"paper_title": "OPRO", "source_url": "https://arxiv.org/abs/2309.03409"}
        ]
    }
    response = client.post("/ai/v1/conflicts/check", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "conflicts" in data
    assert isinstance(data["conflicts"], list)

# ==========================================
# 4. VÒNG 3: EXPERIMENT & FEASIBILITY TESTS
# ==========================================

def test_spec_experiment_with_rtx3090_feasibility():
    payload = {
        "problem": "Sinh đặc tả nghiên cứu thiếu kiểm chứng",
        "gap": "Thiếu cơ chế xác thực claim độc lập",
        "direction": "D"
    }
    response = client.post("/ai/v1/spec-experiment", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "contributions" in data and len(data["contributions"]) >= 2
    assert "claims" in data and len(data["claims"]) >= 2
    for cl in data["claims"]:
        assert "claim" in cl
        assert "baseline" in cl
        assert "metric" in cl
        assert "evidence" in cl
        assert "rejection_condition" in cl
    
    assert "experiments" in data and len(data["experiments"]) >= 2
    for exp in data["experiments"]:
        assert "name" in exp
        assert "protocol" in exp
        assert "expected_outcome" in exp
        
    assert "feasibility_estimation" in data
    feas = data["feasibility_estimation"]
    assert feas["vram_needed_gb"] <= 24.0, f"VRAM {feas['vram_needed_gb']}GB exceeds RTX 3090 24GB limit"
    assert feas["is_feasible"] is True
    assert feas["tokens_estimated"] > 0
    assert feas["gpu_time_hours"] > 0

def test_standalone_feasibility_endpoint():
    # 8B Model - should fit in RTX 3090
    payload_8b = {
        "model_name": "Llama-3-8B-Instruct",
        "seed_prompts_count": 5,
        "candidates_count": 3,
        "context_length": 4096,
        "gpu_target": "NVIDIA RTX 3090 (24GB VRAM)"
    }
    response = client.post("/ai/v1/feasibility", json=payload_8b)
    assert response.status_code == 200
    data = response.json()
    assert data["is_feasible"] is True
    assert data["vram_needed_gb"] <= 24.0

    # 70B Model - should exceed single RTX 3090
    payload_70b = {
        "model_name": "Llama-3-70B-Instruct",
        "seed_prompts_count": 5,
        "candidates_count": 3,
        "context_length": 4096,
        "gpu_target": "NVIDIA RTX 3090 (24GB VRAM)"
    }
    response = client.post("/ai/v1/feasibility", json=payload_70b)
    assert response.status_code == 200
    data_70b = response.json()
    assert data_70b["is_feasible"] is False
    assert data_70b["vram_needed_gb"] > 24.0

def test_single_claim_experiment():
    payload = {
        "claim": "Tối ưu hóa prompt theo từng claim giảm 30% citation ảo",
        "baseline": "Single-prompt baseline",
        "metric": "Hallucination rate %",
        "evidence": "ArXiv API metadata verification",
        "rejectionCondition": "Tỷ lệ citation ảo không giảm"
    }
    response = client.post("/ai/v1/spec-experiment/single-claim", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "experiment" in data
    exp = data["experiment"]
    assert "name" in exp
    assert "protocol" in exp
    assert "expected_outcome" in exp

# ==========================================
# 5. VÒNG 4: 5 INDEPENDENT JUDGES PANEL TESTS
# ==========================================

def test_judges_panel_5_judges():
    payload = {
        "problem": "Trích dẫn ảo trong đề xuất nghiên cứu",
        "gap": "Thiếu cơ chế xác thực đa thẩm phán độc lập",
        "contribution": "Đề xuất quy trình 5 vòng lặp SpecResearch Loop",
        "claims": [
            {
                "claim": "Giảm 30% citation ảo",
                "baseline": "Single prompt",
                "metric": "Hallucination %",
                "evidence": "Metadata đối chiếu arXiv",
                "rejection_condition": "Không giảm"
            }
        ],
        "experiments": [
            {
                "name": "TN1: Baseline",
                "protocol": "Chạy single prompt",
                "expected_outcome": "Tỷ lệ ảo 30%"
            }
        ]
    }
    response = client.post("/ai/v1/judges/panel", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "judges" in data
    judges = data["judges"]
    assert len(judges) == 5, f"Expected 5 judges, got {len(judges)}"
    
    judge_types = [j["type"] for j in judges]
    expected_judge_types = ["gap", "contribution", "experiment", "evidence", "conference-readiness"]
    for jt in expected_judge_types:
        assert jt in judge_types, f"Missing judge type {jt}"
    
    for j in judges:
        assert j["verdict"] in ["ACCEPT", "REVIEW_REQUIRED", "REJECT"]
        assert isinstance(j["issues"], list)
        for issue in j["issues"]:
            assert issue["severity"] in ["CRITICAL", "MAJOR", "MINOR"]
            assert "description" in issue
            assert "suggestion" in issue

# ==========================================
# 6. VÒNG 5: FINAL SPEC GENERATION TESTS
# ==========================================

def test_final_spec_generation():
    payload = {
        "project_title": "SpecResearch Loop: Multi-Agent Automated Research Specification",
        "problem": "LLMs hallucinate citations and ungrounded claims in research proposals.",
        "gap": "Lack of claim-level verification and hardware-budgeted experiment design.",
        "contribution": "5-round iterative loop with 5 independent AI judges and Dependency Invalidation Graph.",
        "claims": [
            {
                "claim": "Reduces hallucinated citations by 30%",
                "baseline": "Single-prompt GPT-4o-mini",
                "metric": "Hallucination rate %",
                "evidence": "Cross-verification with ArXiv API metadata",
                "rejection_condition": "Hallucination rate delta <= 0%"
            }
        ],
        "experiments": [
            {
                "name": "TN1: Baseline Comparison",
                "protocol": "Run single-prompt proposal generation vs SpecResearch Loop on 50 seed prompts.",
                "expected_outcome": "SpecResearch Loop reduces hallucinations from 28% to under 4%."
            }
        ],
        "judges_summary": [
            {"type": "gap", "verdict": "ACCEPT"},
            {"type": "contribution", "verdict": "ACCEPT"},
            {"type": "experiment", "verdict": "ACCEPT"},
            {"type": "evidence", "verdict": "ACCEPT"},
            {"type": "conference-readiness", "verdict": "ACCEPT"}
        ]
    }
    response = client.post("/ai/v1/final-spec", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "markdown_content" in data
    assert len(data["markdown_content"]) > 100
    assert "spec_json" in data
    assert data["spec_json"]["title"] == payload["project_title"]

# ==========================================
# 7. END-TO-END PIPELINE CHAIN TEST
# ==========================================

def test_e2e_pipeline_chain():
    """Test full sequential data flow from Vòng 1 to Vòng 5."""
    # Step 1a: Understand
    res1a = client.post("/ai/v1/clarify/understand", json={"idea": "Tự động tối ưu prompt nghiên cứu"})
    assert res1a.status_code == 200
    clarified = res1a.json()["clarified_idea"]
    
    # Step 1b: Questions
    res1b = client.post("/ai/v1/clarify/questions", json={"clarified_idea": clarified})
    assert res1b.status_code == 200
    
    # Step 2: Decompose
    res2 = client.post("/ai/v1/decompose", json={"clarifiedIdea": clarified})
    assert res2.status_code == 200
    cards = res2.json()["cards"]
    assert len(cards) == 8
    
    # Step 3: Related Works & Gap
    res3a = client.post("/ai/v1/related-works", json={"problem": cards[0]["content"], "research_question": cards[1]["content"]})
    assert res3a.status_code == 200
    
    res3b = client.post("/ai/v1/gap-analysis", json={"gap_candidate": cards[2]["content"]})
    assert res3b.status_code == 200
    
    # Step 4: Experiment & Feasibility
    res4 = client.post("/ai/v1/spec-experiment", json={"problem": cards[0]["content"], "gap": cards[2]["content"], "direction": "D"})
    assert res4.status_code == 200
    exp_data = res4.json()
    
    # Step 5: Judges Panel
    res5 = client.post("/ai/v1/judges/panel", json={
        "problem": cards[0]["content"],
        "gap": cards[2]["content"],
        "contribution": exp_data["contributions"][0],
        "claims": exp_data["claims"],
        "experiments": exp_data["experiments"]
    })
    assert res5.status_code == 200
    assert len(res5.json()["judges"]) == 5
    
    # Step 6: Final Spec
    res6 = client.post("/ai/v1/final-spec", json={
        "project_title": "E2E Test Spec",
        "problem": cards[0]["content"],
        "gap": cards[2]["content"],
        "contribution": exp_data["contributions"][0],
        "claims": exp_data["claims"],
        "experiments": exp_data["experiments"]
    })
    assert res6.status_code == 200
    assert len(res6.json()["markdown_content"]) > 50

if __name__ == "__main__":
    print("Running AI Pipeline Tests...")
    pytest.main(["-v", __file__])
