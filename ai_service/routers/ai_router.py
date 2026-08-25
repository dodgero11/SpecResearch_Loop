import os
from fastapi import APIRouter, HTTPException, Depends
from schemas.spec_schemas import (
    ClarifyRequest, ClarifyResponse, ClarifyQuestion, QuestionOption, SpecCardSchema, SpecCardType, SpecCardStatus,
    RelatedWorksRequest, RelatedWorksResponse, RelatedWorkItem, ProposedGapOption,
    SpecExperimentRequest, SpecExperimentResponse, ClaimCardSchema, ExperimentSchema, FeasibilityEstimation,
    JudgesPanelRequest, JudgesPanelResponse, JudgeResultSchema, IssueSchema, SeverityEnum, VerdictEnum,
    FinalSpecRequest, FinalSpecResponse
)
from services.llm_service import LlmService
from services.arxiv_service import ArxivService
from typing import List

router = APIRouter(prefix="/ai/v1", tags=["AI Processing Core"])

# Environment configuration
USE_MOCK_AI = os.getenv("USE_MOCK_AI", "True").lower() in ("true", "1", "yes")

# Dependency Injectors
def get_llm_service():
    return LlmService()

def get_arxiv_service():
    return ArxivService()

# --- Vòng 1: Clarify & Decompose ---
@router.post("/clarify", response_model=ClarifyResponse)
async def clarify_idea(payload: ClarifyRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Vòng 1: Làm rõ và phân rã ý tưởng nghiên cứu sơ khởi thành các thẻ Spec Cards và đặt các câu hỏi làm rõ.
    Sử dụng Gemini API thật nếu USE_MOCK_AI=False.
    """
    if not USE_MOCK_AI:
        try:
            return llm.process_step1_clarify(payload.idea)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini API error during clarify: {str(e)}")

    # Fallback/Mock data logic matching constraints in GEMINI.md
    clarified = f"Hệ thống hóa ý tưởng nghiên cứu về: '{payload.idea}' thành các thẻ phân rã có bằng chứng thực tế và cấu trúc kiểm tra tính khả thi."
    
    questions = [
        ClarifyQuestion(
            question="Mô hình LLM nào sẽ làm baseline chính cho nghiên cứu này?",
            example="Llama-3-8B-Instruct hoặc GPT-4o-mini",
            options=QuestionOption(
                options=["GPT-4o-mini", "Llama-3-8B-Instruct", "Mistral-7B-Instruct"],
                allow_other=True
            )
        ),
        ClarifyQuestion(
            question="Tác vụ chính cần đánh giá hiệu năng và độ chính xác là gì?",
            example="Xác minh tuyên bố và trích dẫn khoa học tự động",
            options=QuestionOption(
                options=["Text Summarization", "Evidence Verification", "Code Generation"],
                allow_other=True
            )
        )
    ]
    
    cards = [
        SpecCardSchema(
            type=SpecCardType.PROBLEM,
            content=f"Đánh giá và hoàn thiện ý tưởng nghiên cứu: {payload.idea}",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.RESEARCH_QUESTION,
            content="Làm thế nào để kết hợp Multi-Agent AI System và vòng lặp xác nhận của con người nhằm giảm thiểu citations ảo?",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.GAP_CANDIDATE,
            content="Các hệ thống AI hiện tại chưa tối ưu tài nguyên VRAM/Token cho việc đánh giá chất lượng spec tự động trên GPU cá nhân.",
            status=SpecCardStatus.PROPOSED
        )
    ]
    
    return ClarifyResponse(
        clarified_idea=clarified,
        questions=questions,
        cards=cards
    )

# --- Vòng 2: Related Works & Gap Analysis ---
@router.post("/related-works", response_model=RelatedWorksResponse)
async def related_works(
    payload: RelatedWorksRequest, 
    arxiv_srv: ArxivService = Depends(get_arxiv_service),
    llm: LlmService = Depends(get_llm_service)
):
    """
    Vòng 2: Tự động gọi ArXiv API để tìm paper liên quan, lập bảng đối sánh và đề xuất Research Gap.
    Sử dụng Gemini API thật nếu USE_MOCK_AI=False.
    """
    search_query = payload.keywords[0] if (payload.keywords and len(payload.keywords) > 0) else payload.research_question

    if not USE_MOCK_AI:
        try:
            # Call arXiv for raw metadata (title, summary, authors, url)
            papers = arxiv_srv.search_raw_papers(query=search_query, max_results=3)
            if not papers:
                raise HTTPException(status_code=404, detail="No relevant papers found on arXiv.")
            # Process using Gemini
            return llm.process_step2_related_works(
                problem=payload.problem,
                research_question=payload.research_question,
                papers=papers
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini API error during related-works: {str(e)}")

    # Fallback/Mock data logic matching constraints in GEMINI.md
    papers = arxiv_srv.search_papers(query=search_query, max_results=3)
    proposed_gaps = [
        ProposedGapOption(
            gap_title="Tối ưu hóa tài nguyên GPU cá nhân (1x RTX 3090) bằng cơ chế Stale-Fresh Invalidation",
            description="Tập trung thiết kế đồ thị phụ thuộc để tránh tính toán lại toàn bộ spec khi chỉnh sửa một node.",
            example_selection="Đồng ý hướng tối ưu tài nguyên",
            options=QuestionOption(
                options=["Đồng ý chọn Gap này", "Bác bỏ", "Cần điều chỉnh thêm"],
                allow_other=True
            )
        ),
        ProposedGapOption(
            gap_title="Xác minh nguồn tài liệu thực tế không sinh ảo (No-Hallucination Evidence)",
            description="Liên kết chặt chẽ từng Claim với paper metadata thực tế từ ArXiv/Semantic Scholar.",
            example_selection="Đồng ý hướng loại bỏ citation ảo",
            options=QuestionOption(
                options=["Đồng ý chọn Gap này", "Bác bỏ"],
                allow_other=True
            )
        )
    ]
    
    return RelatedWorksResponse(
        related_works=papers,
        proposed_gaps=proposed_gaps
    )

# --- Vòng 3: Claim-Evidence & Experiments ---
@router.post("/spec-experiment", response_model=SpecExperimentResponse)
async def spec_experiment(payload: SpecExperimentRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Vòng 3: Thiết kế đóng góp, Claims, Kế hoạch thí nghiệm và ước tính tính khả thi phần cứng (GPU/VRAM).
    """
    contributions = [
        "Đề xuất cơ chế Multi-Agent Loop kết hợp phản hồi từ người dùng (Human-in-the-loop) để tối ưu spec.",
        "Thiết kế thuật toán Dependency Invalidation để tránh chạy lại các phần không bị ảnh hưởng."
    ]
    
    claims = [
        ClaimCardSchema(
            claim="Cơ chế Multi-Agent Loop giúp giảm thiểu 30% citation ảo so với Single-prompt.",
            baseline="Single-prompt generation",
            metric="Tỷ lệ trích dẫn ảo (Hallucination citation rate)",
            evidence="Kết quả đối sánh với paper metadata thực tế từ ArXiv API.",
            rejection_condition="Nếu tỷ lệ citation ảo không giảm hoặc tăng lên."
        ),
        ClaimCardSchema(
            claim="Thuật toán Dependency Invalidation giảm 50% thời gian tính toán lại spec trên GPU RTX 3090.",
            baseline="Recompute-All strategy",
            metric="Thời gian thực thi (Execution time in seconds)",
            evidence="Thời gian chạy đo được trên card RTX 3090 24GB VRAM.",
            rejection_condition="Thời gian chạy chênh lệch không đáng kể (< 5%)."
        )
    ]
    
    experiments = [
        ExperimentSchema(
            name="TN1: Baseline - Single-prompt",
            protocol="Chạy sinh spec bằng single prompt, trích xuất tất cả citation và đối chiếu với cơ sở dữ liệu thật để tính tỷ lệ ảo.",
            expected_outcome="Tỷ lệ citation ảo khoảng 25-35%."
        ),
        ExperimentSchema(
            name="TN2: Đánh giá chất lượng - Multi-Agent Loop",
            protocol="Chạy quy trình 5 vòng lặp, đưa qua 5 Judges đánh giá độc lập trước khi hoàn thiện.",
            expected_outcome="Tỷ lệ citation ảo giảm xuống dưới 5%."
        ),
        ExperimentSchema(
            name="TN3: Ablation study - Dependency Invalidation",
            protocol="Chỉnh sửa một node ngẫu nhiên và đo thời gian recompute khi bật/tắt Dependency Invalidation.",
            expected_outcome="Khi bật thuật toán, thời gian recompute giảm tối thiểu 50%."
        )
    ]
    
    feasibility = FeasibilityEstimation(
        model_name="Llama-3-8B-Instruct",
        seed_prompts_count=10,
        candidates_count=3,
        vram_needed_gb=16.5,
        tokens_estimated=45000,
        gpu_time_hours=0.5,
        is_feasible=True,
        explanation="Mô hình Llama-3-8B chạy lượng prompt và candidate ước tính chiếm khoảng 16.5GB VRAM, hoàn toàn nằm trong giới hạn 24GB VRAM của card NVIDIA RTX 3090."
    )
    
    return SpecExperimentResponse(
        contributions=contributions,
        claims=claims,
        experiments=experiments,
        feasibility_estimation=feasibility
    )

# --- Vòng 4: Judges Panel ---
@router.post("/judges/panel", response_model=JudgesPanelResponse)
async def run_judges_panel(payload: JudgesPanelRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Vòng 4: Chạy hội đồng phản biện gồm 5 AI Judges độc lập.
    """
    judges = [
        JudgeResultSchema(
            type="gap",
            verdict=VerdictEnum.ACCEPT,
            issues=[]
        ),
        JudgeResultSchema(
            type="contribution",
            verdict=VerdictEnum.REVIEW_REQUIRED,
            issues=[
                IssueSchema(
                    severity=SeverityEnum.MAJOR,
                    description="Đóng góp nghiên cứu số 1 hơi phóng đại về mặt kết quả đạt được.",
                    suggestion="Nên diễn đạt lại là 'tính khả thi cao' thay vì khẳng định chắc chắn 100%."
                )
            ]
        ),
        JudgeResultSchema(
            type="experiment",
            verdict=VerdictEnum.ACCEPT,
            issues=[]
        ),
        JudgeResultSchema(
            type="evidence",
            verdict=VerdictEnum.REVIEW_REQUIRED,
            issues=[
                IssueSchema(
                    severity=SeverityEnum.MINOR,
                    description="Bằng chứng hỗ trợ cho Claim 1 chưa nêu rõ liên kết với nguồn paper metadata nào trong Related Work.",
                    suggestion="Bổ sung mã định danh ArXiv (e.g. arXiv:2400.00000) vào mô tả bằng chứng."
                )
            ]
        ),
        JudgeResultSchema(
            type="conference-readiness",
            verdict=VerdictEnum.ACCEPT,
            issues=[]
        )
    ]
    
    has_major_or_critical = any(
        any(issue.severity in [SeverityEnum.CRITICAL, SeverityEnum.MAJOR] for issue in judge.issues)
        for judge in judges
    )
    
    status = "PARTIAL_FAILURE" if has_major_or_critical else "COMPLETED"
    
    return JudgesPanelResponse(
        spec_version_used=1,
        status=status,
        judges=judges
    )

# --- Vòng 5: Final Spec & Export ---
@router.post("/final-spec", response_model=FinalSpecResponse)
async def generate_final_spec(payload: FinalSpecRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Vòng 5: Tổng hợp toàn bộ nhật ký quyết định và nội dung đã phê duyệt để xuất bản Research Spec Markdown/JSON.
    """
    markdown = f"""# Research Specification: {payload.project_title}

## 1. Problem Statement
{payload.problem}

## 2. Research Gap
{payload.gap}

## 3. Related Works Comparison
"""
    for item in payload.related_work:
        markdown += f"- **{item.paper_title}** ({item.authors}, {item.year}):\n"
        markdown += f"  - *Công việc đã làm:* {item.what_they_did}\n"
        markdown += f"  - *Phản biện:* {item.feedback}\n"
        markdown += f"  - *Điểm thiếu sót:* {item.missing_points}\n"
        markdown += f"  - *Nguồn:* [{item.source_url}]({item.source_url})\n\n"

    markdown += f"""## 4. Proposed Contribution
{payload.contribution}

## 5. Claim-Evidence Cards
"""
    for c in payload.claims:
        markdown += f"- **Claim:** {c.claim}\n"
        markdown += f"  - *Baseline:* {c.baseline}\n"
        markdown += f"  - *Metric:* {c.metric}\n"
        markdown += f"  - *Evidence:* {c.evidence}\n"
        markdown += f"  - *Rejection Condition:* {c.rejection_condition}\n\n"

    markdown += "## 6. Experiment Protocol\n"
    for e in payload.experiments:
        markdown += f"### {e.name}\n"
        markdown += f"**Quy trình:** {e.protocol}\n\n"
        markdown += f"**Kết quả kỳ vọng:** {e.expected_outcome}\n\n"

    spec_json = {
        "title": payload.project_title,
        "problem": payload.problem,
        "gap": payload.gap,
        "contribution": payload.contribution,
        "claims": [c.dict() for c in payload.claims],
        "experiments": [e.dict() for e in payload.experiments]
    }
    
    return FinalSpecResponse(
        markdown_content=markdown,
        spec_json=spec_json
    )
