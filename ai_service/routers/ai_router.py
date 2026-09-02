import os
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional

from schemas.spec_schemas import (
    ClarifyUnderstandRequest, ClarifyUnderstandResponse,
    ClarifyQuestionsRequest, ClarifyQuestionsResponse, QuestionItem,
    DecomposeRequest, DecomposeResponse, SpecCardSchema, SpecCardType, SpecCardStatus,
    RelatedWorksRequest, RelatedWorksOnlyResponse, RelatedWorkItem, RelatedWorksResponse, ProposedGapOption,
    GapAnalysisRequest, GapAnalysisResponse, DirectionOption,
    ConflictCheckRequest, ConflictCheckResponse, ConflictItem,
    SpecExperimentRequest, SpecExperimentResponse, ClaimCardSchema, ExperimentSchema,
    FeasibilityRequest, FeasibilityEstimation, SingleClaimExperimentResponse,
    JudgesPanelRequest, JudgesPanelResponse, JudgeResultSchema, IssueSchema, IssueChoice, SeverityEnum, VerdictEnum,
    ReviseSectionRequest, ReviseSectionResponse,
    FinalSpecRequest, FinalSpecResponse, ClarifyRequest, ClarifyResponse, ClarifyQuestion, QuestionOption
)
from services.llm_service import LlmService
from services.arxiv_service import ArxivService

router = APIRouter(prefix="/ai/v1", tags=["AI Processing Core"])

def get_use_mock_ai() -> bool:
    val = os.getenv("USE_MOCK_AI", "False").strip().lower()
    return val in ("true", "1", "yes")

def get_llm_service() -> LlmService:
    return LlmService()

def get_arxiv_service() -> ArxivService:
    return ArxivService()

def ensure_llm(llm: Any) -> LlmService:
    return llm if isinstance(llm, LlmService) else get_llm_service()

def ensure_arxiv(arxiv_srv: Any) -> ArxivService:
    return arxiv_srv if isinstance(arxiv_srv, ArxivService) else get_arxiv_service()

# ==========================================
# VÒNG 1: CLARIFY & DECOMPOSE
# ==========================================

@router.post("/clarify/understand", response_model=ClarifyUnderstandResponse)
async def clarify_understand(payload: ClarifyUnderstandRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Step 1a: Phân tích và diễn giải lại ý tưởng nghiên cứu sơ khởi.
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step1_understand(payload.idea, payload.feedback)
        except Exception as e:
            print(f"[Fallback to Mock] understand failed with Gemini: {e}")

    # Fallback / Mock
    return ClarifyUnderstandResponse(
        clarified_idea=f"Hệ thống hóa và tối ưu hóa ý tưởng nghiên cứu về: '{payload.idea}'. Thiết kế quy trình thực nghiệm có kiểm chứng chặt chẽ, tối ưu tài nguyên và loại bỏ citation ảo.",
        key_issues=[
            "Cần xác định baseline rõ ràng để so sánh định lượng",
            "Cần thiết lập giới hạn tài nguyên GPU/VRAM cho môi trường kiểm thử thực tế",
            "Cần cơ chế Human-in-the-loop để xác thực các giả định cốt lõi"
        ],
        confidence=0.85
    )

@router.post("/clarify/questions", response_model=ClarifyQuestionsResponse)
async def clarify_questions(payload: ClarifyQuestionsRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Step 1b: Tạo 2-3 câu hỏi trắc nghiệm làm rõ (kèm lựa chọn Other).
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step1_questions(payload.clarified_idea)
        except Exception as e:
            print(f"[Fallback to Mock] questions failed with Gemini: {e}")

    # Fallback / Mock
    return ClarifyQuestionsResponse(
        questions=[
            QuestionItem(
                question="Mô hình LLM nào sẽ được chọn làm baseline chính cho nghiên cứu?",
                example="Ví dụ: Llama-3-8B-Instruct hoặc GPT-4o-mini",
                options=["GPT-4o-mini", "Llama-3-8B-Instruct", "Mistral-7B-Instruct", "Other"]
            ),
            QuestionItem(
                question="Tác vụ chính cần đánh giá độ chính xác và hiệu năng là gì?",
                example="Ví dụ: Xác minh trích dẫn tài liệu khoa học tự động",
                options=["Evidence Verification", "Prompt Optimization Loop", "Information Extraction", "Other"]
            ),
            QuestionItem(
                question="Bản đặc tả cuối cùng sẽ được định hướng sử dụng cho mục đích nào?",
                example="Ví dụ: Viết proposal hội nghị hoặc triển khai code prototype",
                options=["Viết Research Proposal", "Phát triển Code Prototype", "Thực nghiệm Benchmark", "Other"]
            )
        ]
    )

@router.post("/decompose", response_model=DecomposeResponse)
async def decompose_idea(payload: DecomposeRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Step 2: Phân rã ý tưởng thành đúng 8 Thẻ đặc tả cố định (status=PROPOSED).
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step2_decompose(payload.model_dump())
        except Exception as e:
            print(f"[Fallback to Mock] decompose failed with Gemini: {e}")

    idea_text = payload.clarifiedIdea or payload.idea or "Nghiên cứu khoa học"
    cards = [
        SpecCardSchema(
            type=SpecCardType.PROBLEM,
            content=f"Vấn đề cốt lõi: {idea_text}",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.RESEARCH_QUESTION,
            content="Làm thế nào để kết hợp Multi-Agent AI và xác nhận của con người để tối ưu chất lượng đặc tả nghiên cứu?",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.GAP_CANDIDATE,
            content="Các hệ thống AI hiện tại chưa có cơ chế kiểm chứng claim độc lập và tối ưu tài nguyên trên GPU cá nhân.",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.CONTRIBUTION,
            content="Đề xuất quy trình 5 vòng lặp xác thực kết hợp Dependency Invalidation Graph.",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.CLAIM,
            content="Quy trình Multi-Agent Loop giúp giảm thiểu ít nhất 25% lỗi trích dẫn ảo so với Single-prompt.",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.EVIDENCE,
            content="Kết quả đối sánh thực tế với siêu dữ liệu từ arXiv API và Semantic Scholar.",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.CONSTRAINT,
            content="Tài nguyên thực thi giới hạn trong 1x GPU NVIDIA RTX 3090 (24GB VRAM).",
            status=SpecCardStatus.PROPOSED
        ),
        SpecCardSchema(
            type=SpecCardType.OPEN_QUESTION,
            content="Khả năng mở rộng của thuật toán khi áp dụng cho các mô hình lớn hơn 70B tham số?",
            status=SpecCardStatus.PROPOSED
        )
    ]
    return DecomposeResponse(cards=cards)

# Backward-compatible legacy endpoint
@router.post("/clarify", response_model=ClarifyResponse)
async def clarify_legacy(payload: ClarifyRequest, llm: LlmService = Depends(get_llm_service)):
    understand_res = await clarify_understand(ClarifyUnderstandRequest(idea=payload.idea), llm)
    questions_res = await clarify_questions(ClarifyQuestionsRequest(clarified_idea=understand_res.clarified_idea), llm)
    decompose_res = await decompose_idea(DecomposeRequest(idea=payload.idea, clarifiedIdea=understand_res.clarified_idea), llm)
    
    clarify_questions_list = [
        ClarifyQuestion(
            question=q.question,
            example=q.example,
            options=QuestionOption(options=q.options, allow_other=True)
        )
        for q in questions_res.questions
    ]
    return ClarifyResponse(
        clarified_idea=understand_res.clarified_idea,
        questions=clarify_questions_list,
        cards=decompose_res.cards
    )

# ==========================================
# VÒNG 2: RELATED WORKS & GAP ANALYSIS
# ==========================================

@router.post("/related-works", response_model=RelatedWorksOnlyResponse)
async def get_related_works(
    payload: RelatedWorksRequest,
    arxiv_srv: ArxivService = Depends(get_arxiv_service),
    llm: LlmService = Depends(get_llm_service)
):
    """
    Step 3a: Tải và tổng hợp danh sách bài báo khoa học liên quan từ arXiv API (timeout 6s)
    hoặc tự động chuyển sang LLM-guided synthesis nếu ArXiv API chậm/nghẽn mạng.
    """
    arxiv_srv = ensure_arxiv(arxiv_srv)
    llm = ensure_llm(llm)

    # Ask Gemini to generate targeted arXiv search keywords from the full context
    # (problem + research_question + gap) instead of passing a raw sentence to arXiv.
    search_query = payload.research_question
    if not get_use_mock_ai() and llm.api_key:
        try:
            kw = llm.generate_search_keywords(payload.problem, payload.research_question, payload.gap)
            if kw.keywords:
                search_query = kw.keywords[0]
        except Exception as e:
            print(f"[Warning] Keyword generation failed ({e}), using research_question as query...", flush=True)

    raw_papers = []
    if not get_use_mock_ai():
        try:
            raw_papers = arxiv_srv.search_raw_papers(query=search_query, max_results=4, timeout_sec=6.0)
        except Exception as e:
            print(f"[Warning] ArXiv query error ({e}), falling back to direct LLM synthesis...", flush=True)
            raw_papers = []

    # If raw_papers found from arXiv, synthesize them with LLM
    if raw_papers and llm.api_key and not get_use_mock_ai():
        try:
            res = llm.process_step2_related_works(payload.problem, payload.research_question, raw_papers)
            return RelatedWorksOnlyResponse(related_works=res.related_works)
        except Exception as e:
            print(f"[Warning] LLM processing of arXiv papers failed ({e}). Trying direct synthesis...", flush=True)

    # If ArXiv failed/timed out OR raw_papers is empty, synthesize real seminal papers directly with Gemini
    if llm.api_key and not get_use_mock_ai():
        try:
            print("[Notice] Synthesizing related works directly via LLM...", flush=True)
            res = llm.process_step2_related_works_direct(payload.problem, payload.research_question, search_query)
            return RelatedWorksOnlyResponse(related_works=res.related_works)
        except Exception as e:
            print(f"[Fallback to Mock] direct related-works synthesis failed: {e}", flush=True)

    # Final Fallback / Mock
    return RelatedWorksOnlyResponse(
        related_works=[
            RelatedWorkItem(
                paper_title="OPRO: Optimization by PROmpting",
                authors="Yang et al.",
                year=2023,
                what_they_did="Tối ưu prompt bằng search + score tự động để tăng chất lượng trả lời.",
                feedback="Phương pháp tốt nhưng chưa tách claim và chưa kiểm tra evidence độc lập.",
                missing_points="Không dùng tín hiệu claim-level.",
                source_url="https://arxiv.org/abs/2309.03409",
                source_type="proceedings"
            ),
            RelatedWorkItem(
                paper_title="PromptBreeder: Self-Referential Self-Improvement Via Prompt Evolution",
                authors="Fernando et al.",
                year=2023,
                what_they_did="Tiến hóa prompt với LLM để tìm prompt tốt hơn qua nhiều thế hệ.",
                feedback="Vẫn dựa trên điểm tổng tự động, chưa dùng tín hiệu ở mức claim.",
                missing_points="Thiếu cơ chế xác thực nguồn trích dẫn thật.",
                source_url="https://arxiv.org/abs/2309.16797",
                source_type="peer-reviewed"
            ),
            RelatedWorkItem(
                paper_title="TextGrad: Automatic Differentiation via Text",
                authors="Yuksekgonul et al.",
                year=2024,
                what_they_did="Tối ưu prompt bằng gradient ngôn ngữ tự nhiên từ LLM feedback.",
                feedback="Textual feedback mang tính định tính, khó đo lường chính xác trên GPU nhỏ.",
                missing_points="Chưa tối ưu ngân sách inference và VRAM.",
                source_url="https://arxiv.org/abs/2406.07496",
                source_type="peer-reviewed"
            ),
            RelatedWorkItem(
                paper_title="DSPy: Compiling Declarative Language Model Calls",
                authors="Khattab et al.",
                year=2024,
                what_they_did="Framework tối ưu hóa và biên dịch prompt cho các hệ thống LM phức tạp.",
                feedback="Thiếu vòng xác minh bằng chứng độc lập và sự can thiệp của con người.",
                missing_points="Chưa có cơ chế Human-in-the-loop đa thẩm phán.",
                source_url="https://arxiv.org/abs/2310.03714",
                source_type="proceedings"
            )
        ]
    )

# @router.post("/gap-analysis", response_model=GapAnalysisResponse)
# async def gap_analysis(payload: GapAnalysisRequest, llm: LlmService = Depends(get_llm_service)):
#     """
#     Step 3b: Phân tích khoảng trống nghiên cứu và đề xuất 4 hướng A, B, C, D.
#     """
#     llm = ensure_llm(llm)
#     if not get_use_mock_ai() and llm.api_key:
#         try:
#             return llm.process_step2_gap_analysis(payload.gap_candidate, payload.related_works or [])
#         except Exception as e:
#             print(f"[Fallback to Mock] gap-analysis failed with Gemini: {e}")
@router.post("/gap-analysis", response_model=GapAnalysisResponse)
async def gap_analysis(payload: GapAnalysisRequest, llm: LlmService = Depends(get_llm_service)):
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step2_gap_analysis(payload.gap_candidate, payload.related_works or [], payload.revision_instruction)  # ← thêm tham số cuối
        except Exception as e:
            print(f"[Fallback to Mock] gap-analysis failed with Gemini: {e}")
    # Fallback / Mock
    return GapAnalysisResponse(
        what_was_done="Các nghiên cứu trước (OPRO, DSPy, TextGrad) đã tối ưu prompt bằng điểm tổng hoặc gradient ngôn ngữ.",
        limitation="Chưa có cơ chế tách claim và kiểm tra evidence độc lập cho từng tuyên bố trong ngân sách GPU cá nhân.",
        why_it_matters="Giúp loại bỏ hoàn toàn các trích dẫn ảo (hallucinated citations) và giảm tải tài nguyên tính toán.",
        testable_with="So sánh tỷ lệ unsupported claims và thời gian recompute trên cùng tập dữ liệu benchmark.",
        directions=[
            DirectionOption(letter="A", label="Thuật toán tối ưu prompt dựa trên Claim-Level", description="Tối ưu prompt theo vòng lặp bằng tín hiệu phản hồi từ từng claim riêng lẻ."),
            DirectionOption(letter="B", label="Claim–Evidence Verifier độc lập", description="Xây dựng bộ xác thực liên kết trực tiếp với metadata thực tế từ arXiv."),
            DirectionOption(letter="C", label="Human-in-the-loop Multi-Judge", description="Kết hợp hội đồng 5 AI Judges với các lựa chọn can thiệp từ người dùng."),
            DirectionOption(letter="D", label="Kết hợp toàn diện & Tối ưu GPU", description="Tích hợp cả 3 hướng trên với cơ chế Dependency Invalidation trên 1x RTX 3090.")
        ]
    )

@router.post("/conflicts/check", response_model=ConflictCheckResponse)
async def check_conflicts(payload: ConflictCheckRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Step 3c: Kiểm tra xung đột giữa các cặp Claim-Evidence và Related Works.
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step3_conflicts(payload.claim_evidence_pairs or [], payload.related_works or [])
        except Exception as e:
            print(f"[Fallback to Mock] conflicts check failed: {e}")

    pairs = payload.claim_evidence_pairs or []
    conflicts = []
    for pair in pairs:
        if isinstance(pair, dict):
            conflicts.append(ConflictItem(
                claim_card_id=str(pair.get("claimCardId") or pair.get("claim_card_id") or ""),
                evidence_card_id=str(pair.get("evidenceCardId") or pair.get("evidence_card_id") or ""),
                linked_sources=payload.related_works[:1] if payload.related_works else [],
                reason="Bằng chứng hiện tại chưa đủ để xác nhận claim, có nguy cơ mâu thuẫn với kết quả trong related works."
            ))
    return ConflictCheckResponse(conflicts=conflicts)

# ==========================================
# VÒNG 3: CONTRIBUTIONS, CLAIMS & EXPERIMENTS
# ==========================================

@router.post("/spec-experiment", response_model=SpecExperimentResponse)
async def spec_experiment(payload: SpecExperimentRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Step 4: Thiết kế đóng góp, Claims, Kế hoạch thí nghiệm (TN1-TN5) và Feasibility trên RTX 3090.
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step3_experiment(payload.problem, payload.gap, payload.direction)
        except Exception as e:
            print(f"[Fallback to Mock] spec-experiment failed with Gemini: {e}")

    return SpecExperimentResponse(
        contributions=[
            "Đề xuất kiến trúc SpecResearch Loop kết hợp Human-in-the-loop và Multi-Agent AI System.",
            "Thiết kế thuật toán Dependency Invalidation Graph giúp giảm 50% thời gian recompute trên GPU cá nhân."
        ],
        claims=[
            ClaimCardSchema(
                claim="Cơ chế Multi-Agent Loop giúp giảm thiểu 30% citation ảo so với Single-prompt.",
                baseline="Single-prompt GPT-4o-mini",
                metric="Tỷ lệ trích dẫn ảo (Hallucination rate %)",
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
        ],
        experiments=[
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
        ],
        feasibility_estimation=FeasibilityEstimation(
            model_name="Llama-3-8B-Instruct",
            seed_prompts_count=5,
            candidates_count=3,
            vram_needed_gb=16.5,
            tokens_estimated=45000,
            gpu_time_hours=0.5,
            is_feasible=True,
            explanation="Mô hình Llama-3-8B chạy lượng prompt và candidate ước tính chiếm khoảng 16.5GB VRAM, hoàn toàn nằm trong giới hạn 24GB VRAM của card NVIDIA RTX 3090."
        )
    )

@router.post("/feasibility", response_model=FeasibilityEstimation)
async def estimate_feasibility(payload: FeasibilityRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Dedicated hardware feasibility calculation constrained to single consumer GPU (NVIDIA RTX 3090, 24GB VRAM).
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step3_feasibility(payload)
        except Exception as e:
            print(f"[Fallback to Mock] feasibility failed with Gemini: {e}")

    # Standard formula-based estimation for single consumer GPU
    model = payload.model_name or "Llama-3-8B-Instruct"
    seed = payload.seed_prompts_count or 5
    cand = payload.candidates_count or 3
    ctx = payload.context_length or 4096

    # Heuristic estimation: 8B models ~16GB in fp16/int8, 70B models ~40GB (not feasible on 1x 24GB)
    if "70b" in model.lower() or "70-b" in model.lower():
        vram = 42.0
        feasible = False
        exp = f"Mô hình {model} yêu cầu khoảng {vram}GB VRAM, vượt quá dung lượng 24GB của NVIDIA RTX 3090."
    elif "3b" in model.lower() or "mini" in model.lower():
        vram = 8.5
        feasible = True
        exp = f"Mô hình {model} chạy gọn gàng trên RTX 3090, chỉ chiếm {vram}GB VRAM."
    else:
        vram = 16.5
        feasible = True
        exp = f"Mô hình {model} cùng context {ctx} tokens và {seed*cand} candidates cần khoảng {vram}GB VRAM, hoàn toàn nằm trong giới hạn 24GB VRAM của NVIDIA RTX 3090."

    tokens = seed * cand * ctx
    time_h = round((tokens / 100000) * 0.4, 2)

    return FeasibilityEstimation(
        model_name=model,
        seed_prompts_count=seed,
        candidates_count=cand,
        vram_needed_gb=vram,
        tokens_estimated=tokens,
        gpu_time_hours=max(time_h, 0.2),
        is_feasible=feasible,
        explanation=exp
    )

@router.post("/spec-experiment/single-claim", response_model=SingleClaimExperimentResponse)
async def single_claim_experiment(claim_evidence: dict, llm: LlmService = Depends(get_llm_service)):
    """
    Step 4: Sinh thí nghiệm cho 1 claim mới được thêm thủ công.
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step3_single_claim(claim_evidence)
        except Exception as e:
            print(f"[Fallback to Mock] single-claim experiment failed: {e}")

    claim_name = claim_evidence.get("claim", "Claim mới")
    return SingleClaimExperimentResponse(
        experiment=ExperimentSchema(
            name=f"TN: Kiểm chứng {claim_name[:30]}",
            protocol="Đo lường sự thay đổi của metric theo baseline được thiết lập trên tập dữ liệu kiểm thử độc lập.",
            expected_outcome="Đạt cải thiện rõ rệt và vượt qua điều kiện bác bỏ."
        )
    )

# ==========================================
# VÒNG 4: 5 JUDGES PANEL
# ==========================================

@router.post("/judges/panel", response_model=JudgesPanelResponse)
async def run_judges_panel(payload: JudgesPanelRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Step 5: Chạy hội đồng phản biện gồm 5 AI Judges độc lập:
    1. gap: Kiểm tra gap có thực sự được tài liệu hỗ trợ.
    2. contribution: Kiểm tra contribution có mới và bị phóng đại không.
    3. experiment: Kiểm tra thiết kế thí nghiệm có đủ chứng minh claim không.
    4. evidence: Kiểm tra citation có đúng context hỗ trợ không.
    5. conference-readiness: Đánh giá Originality, Soundness, Clarity, Reproducibility.
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step4_judges(
                problem=payload.problem,
                gap=payload.gap,
                contribution=payload.contribution or "",
                claims_text=str(payload.claims),
                experiments_text=str(payload.experiments)
            )
        except Exception as e:
            print(f"[Fallback to Mock] judges panel failed: {e}")

    judges = [
        JudgeResultSchema(type="gap", verdict=VerdictEnum.ACCEPT, issues=[]),
        JudgeResultSchema(
            type="contribution",
            verdict=VerdictEnum.REVIEW_REQUIRED,
            issues=[
                IssueSchema(
                    severity=SeverityEnum.MAJOR,
                    title="Đóng góp nghiên cứu chưa nêu rõ giới hạn",
                    description="Đóng góp số 1 hơi phóng đại về mặt kết quả đạt được trong mọi điều kiện.",
                    suggestion="Nên bổ sung ghi chú phạm vi và điều kiện thực nghiệm.",
                    flagged_by="contribution",
                    choices=[
                        IssueChoice(letter="A", label="Thu hẹp phạm vi đóng góp", understanding="Giới hạn đóng góp trong phạm vi tập dữ liệu benchmark đã chọn."),
                        IssueChoice(letter="B", label="Bổ sung thêm thí nghiệm chứng minh", understanding="Thêm thí nghiệm trên tập dữ liệu thứ hai."),
                        IssueChoice(letter="C", label="Other", understanding="Tự nhập phương án xử lý.")
                    ]
                )
            ]
        ),
        JudgeResultSchema(type="experiment", verdict=VerdictEnum.ACCEPT, issues=[]),
        JudgeResultSchema(
            type="evidence",
            verdict=VerdictEnum.REVIEW_REQUIRED,
            issues=[
                IssueSchema(
                    severity=SeverityEnum.MINOR,
                    title="Bằng chứng cần thêm mã arXiv",
                    description="Bằng chứng hỗ trợ cho Claim 1 chưa nêu rõ liên kết với nguồn paper metadata nào trong Related Work.",
                    suggestion="Bổ sung mã định danh ArXiv (e.g. arXiv:2309.03409) vào mô tả bằng chứng.",
                    flagged_by="evidence",
                    choices=[
                        IssueChoice(letter="A", label="Bổ sung mã ArXiv vào evidence", understanding="Gắn mã bài báo cụ thể vào thẻ Evidence."),
                        IssueChoice(letter="B", label="Giữ nguyên mô tả hiện tại", understanding="Chấp nhận mô tả tổng quát."),
                        IssueChoice(letter="C", label="Other", understanding="Tự nhập phương án xử lý.")
                    ]
                )
            ]
        ),
        JudgeResultSchema(type="conference-readiness", verdict=VerdictEnum.ACCEPT, issues=[])
    ]

    has_major_or_critical = any(
        any(issue.severity in [SeverityEnum.CRITICAL, SeverityEnum.MAJOR] for issue in judge.issues)
        for judge in judges
    )
    status = "PARTIAL_FAILURE" if has_major_or_critical else "COMPLETED"
    return JudgesPanelResponse(spec_version_used=1, status=status, judges=judges)

@router.post("/revise-section", response_model=ReviseSectionResponse)
async def revise_section(payload: ReviseSectionRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Revise a spec section (contribution | experiment | evidence | conference-readiness)
    based on the user's resolution instruction. Returns the revised content in the
    same shape as the input so the backend can write it back into the spec.
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.revise_section(
                section_type=payload.section_type,
                current_content=payload.current_content,
                instruction=payload.instruction,
                context=payload.context or {}
            )
        except Exception as e:
            print(f"[Fallback to Mock] revise-section failed: {e}")

    # Fallback / Mock
    return ReviseSectionResponse(
        revised_content=payload.current_content,
        summary="Mock: nội dung đã được sửa theo yêu cầu."
    )

# ==========================================
# VÒNG 5: FINAL SPEC & EXPORT
# ==========================================

@router.post("/final-spec", response_model=FinalSpecResponse)
async def generate_final_spec(payload: FinalSpecRequest, llm: LlmService = Depends(get_llm_service)):
    """
    Step 6: Tổng hợp toàn bộ bản đặc tả hoàn chỉnh 10 phần dưới dạng Markdown & JSON.
    """
    llm = ensure_llm(llm)
    if not get_use_mock_ai() and llm.api_key:
        try:
            return llm.process_step5_final_spec(
                project_title=payload.project_title or "Research Specification",
                problem=payload.problem or "",
                gap=payload.gap or "",
                contribution=payload.contribution or "",
                claims_text=str(payload.claims),
                experiments_text=str(payload.experiments),
                judges_text=str(payload.judges_summary)
            )
        except Exception as e:
            print(f"[Fallback to Mock] final-spec failed: {e}")

    markdown = f"""# Research Specification: {payload.project_title or 'SpecResearch Loop Project'}

## 1. Metadata & Executive Summary
- **Tiêu đề dự án:** {payload.project_title or 'Tối ưu hóa đặc tả nghiên cứu khoa học'}
- **Phiên bản:** 1.0 (Hoàn thiện qua 5 vòng lặp SpecResearch Loop)
- **Tình trạng kiểm duyệt:** Được xác nhận bởi Hội đồng 5 AI Judges độc lập

## 2. Problem Formulation (Bối cảnh & Vấn đề)
{payload.problem or 'Các mô hình AI sinh văn bản thường tạo ra các bản đề xuất nghiên cứu thiếu tính khả thi, chứa trích dẫn ảo và không có kế hoạch thực nghiệm khống chế tài nguyên phần cứng.'}

## 3. Research Questions & Hypotheses (Câu hỏi & Giả thuyết)
- **RQ1:** Quy trình Human-in-the-loop kết hợp 5 AI Judges có thể giảm thiểu tỷ lệ trích dẫn ảo xuống dưới 5% không?
- **RQ2:** Thuật toán Dependency Invalidation có thể giảm ít nhất 50% thời gian recompute trên 1x GPU NVIDIA RTX 3090 không?

## 4. Literature Review & Comparative Analysis (Tổng quan tài liệu)
| Công trình | Năm | Phương pháp chính | Hạn chế còn tồn đọng | Nguồn trích dẫn |
| :--- | :---: | :--- | :--- | :--- |
| OPRO | 2023 | Tối ưu prompt qua search & score | Chưa kiểm tra evidence độc lập cho claim | arXiv:2309.03409 |
| PromptBreeder | 2023 | Tiến hóa prompt tự động qua LLM | Thiếu xác thực nguồn trích dẫn thật | arXiv:2309.16797 |
| TextGrad | 2024 | Tối ưu bằng gradient văn bản | Chưa tối ưu ngân sách inference và VRAM | arXiv:2406.07496 |
| DSPy | 2024 | Framework biên dịch declarative prompt | Chưa có cơ chế đa thẩm phán độc lập | arXiv:2310.03714 |

## 5. Research Gap & Novelty (Khoảng trống nghiên cứu & Đóng góp mới)
{payload.gap or 'Thiếu một hệ sinh thái khép kín kết hợp xác minh bằng chứng từ arXiv, hội đồng thẩm phán đa góc nhìn và tối ưu tài nguyên thực thi trên GPU cá nhân.'}

## 6. Technical Approach & Architecture (Phương pháp tiếp cận)
- **Kiến trúc:** Multi-Agent Pipeline với 5 vòng lặp: Làm rõ (Clarify) -> Đối sánh tài liệu (Related Works) -> Thiết kế thí nghiệm (Experiment) -> Hội đồng phản biện (5 Judges) -> Xuất bản (Final Spec).
- **Cơ chế xác thực:** Dependency Invalidation Graph đảm bảo cập nhật nhất quán giữa các tầng phụ thuộc.

## 7. Claim-Evidence Matrix (Ma trận Tuyên bố - Bằng chứng)
"""
    for c in (payload.claims or []):
        if isinstance(c, dict):
            markdown += f"- **Claim:** {c.get('claim', '')}\n"
            markdown += f"  - *Baseline:* {c.get('baseline', '')}\n"
            markdown += f"  - *Metric:* {c.get('metric', '')}\n"
            markdown += f"  - *Evidence:* {c.get('evidence', '')}\n"
            markdown += f"  - *Rejection Condition:* {c.get('rejection_condition', '')}\n\n"

    markdown += "## 8. Comprehensive Experiment Protocol (Kế hoạch thí nghiệm)\n"
    for e in (payload.experiments or []):
        if isinstance(e, dict):
            markdown += f"### {e.get('name', '')}\n"
            markdown += f"- **Quy trình:** {e.get('protocol', '')}\n"
            markdown += f"- **Kết quả kỳ vọng:** {e.get('expected_outcome', '')}\n\n"

    markdown += """## 9. Hardware & Resource Feasibility Profile (Đánh giá khả thi phần cứng)
- **Mô hình mục tiêu:** Llama-3-8B-Instruct (Quantized int8/fp16)
- **GPU Mục tiêu:** 1x NVIDIA GeForce RTX 3090 (24GB VRAM)
- **Ước tính VRAM:** 16.5 GB / 24.0 GB (Thỏa mãn tính khả thi: `is_feasible = True`)
- **Ước tính Token Budget:** 45,000 tokens / run
- **Thời gian thực thi:** ~0.5 giờ trên 1 GPU

## 10. Multi-Judge Peer Review Report & Human Decision Log
- **Gap Judge:** ACCEPT - Khoảng trống nghiên cứu được minh chứng rõ qua 4 công trình đối sánh.
- **Contribution Judge:** ACCEPT - Đóng góp được xác định cụ thể và giới hạn phạm vi rõ ràng.
- **Experiment Judge:** ACCEPT - Quy trình 5 bước bao quát từ baseline đến ablation study.
- **Evidence Judge:** ACCEPT - 100% trích dẫn đã được kiểm tra và liên kết với mã định danh arXiv hợp lệ.
- **Conference Readiness Judge:** ACCEPT - Bản đặc tả đạt chuẩn cấu trúc cho đề tài nghiên cứu công nghệ mới.
"""

    spec_json = {
        "title": payload.project_title or "SpecResearch Loop Project",
        "problem": payload.problem,
        "gap": payload.gap,
        "contribution": payload.contribution,
        "claims": payload.claims or [],
        "experiments": payload.experiments or [],
        "feasibility": {
            "target_gpu": "NVIDIA RTX 3090 (24GB)",
            "vram_gb": 16.5,
            "is_feasible": True
        },
        "decision_log": payload.decision_log or []
    }

    return FinalSpecResponse(
        markdown_content=markdown,
        markdownContent=markdown,
        spec_json=spec_json,
        specJson=spec_json,
        before=str(payload.problem or "Ý tưởng nghiên cứu"),
        after=str(payload.contribution or "Bản đặc tả nghiên cứu hoàn thiện")
    )
