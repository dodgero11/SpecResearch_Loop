from pydantic import BaseModel, Field, model_validator, ConfigDict
from typing import Any, List, Optional, Dict
from enum import Enum

# --- Shared Options & Card schemas ---

class SpecCardType(str, Enum):
    PROBLEM = "PROBLEM"
    RESEARCH_QUESTION = "RESEARCH_QUESTION"
    GAP_CANDIDATE = "GAP_CANDIDATE"
    CONTRIBUTION = "CONTRIBUTION"
    CLAIM = "CLAIM"
    EVIDENCE = "EVIDENCE"
    CONSTRAINT = "CONSTRAINT"
    OPEN_QUESTION = "OPEN_QUESTION"

class SpecCardStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    PROPOSED = "PROPOSED"
    MISSING = "MISSING"
    AMBIGUOUS = "AMBIGUOUS"
    UNSUPPORTED = "UNSUPPORTED"
    CONFLICT = "CONFLICT"

class QuestionOption(BaseModel):
    options: List[str] = Field(description="Danh sách các lựa chọn (bằng tiếng Việt)")
    allow_other: bool = Field(default=True, description="Cho phép người dùng tự điền lựa chọn khác")

class ClarifyQuestion(BaseModel):
    question: str = Field(description="Câu hỏi làm rõ ý tưởng nghiên cứu")
    example: Optional[str] = Field(default=None, description="Ví dụ minh họa cho câu trả lời")
    options: QuestionOption = Field(description="Lựa chọn trắc nghiệm")

class SpecCardSchema(BaseModel):
    type: SpecCardType = Field(description="Loại thẻ đặc tả")
    content: str = Field(description="Nội dung thẻ")
    status: SpecCardStatus = Field(default=SpecCardStatus.PROPOSED, description="Trạng thái thẻ")
    metadata: Optional[Dict[str, str]] = Field(default=None, description="Metadata đi kèm thẻ")

# --- Vòng 1: Clarify & Decompose ---

class ClarifyUnderstandRequest(BaseModel):
    idea: str = Field(description="Ý tưởng nghiên cứu sơ khởi")
    feedback: Optional[str] = Field(default=None, description="Nhận xét bổ sung từ người dùng")

class ClarifyUnderstandResponse(BaseModel):
    clarified_idea: str = Field(description="Ý tưởng sau khi được diễn giải lại")
    key_issues: List[str] = Field(default_factory=list, description="Các vấn đề/khoảng trống cần làm rõ")
    confidence: Optional[float] = Field(default=0.8, description="Độ tin cậy của phân tích")

class ClarifyQuestionsRequest(BaseModel):
    clarified_idea: str = Field(description="Ý tưởng đã được làm rõ")

class QuestionItem(BaseModel):
    question: str = Field(description="Nội dung câu hỏi")
    example: Optional[str] = Field(default=None, description="Ví dụ minh họa")
    options: List[str] = Field(default_factory=list, description="Danh sách lựa chọn (kèm Other ở cuối)")

class ClarifyQuestionsResponse(BaseModel):
    questions: List[QuestionItem] = Field(default_factory=list, description="Danh sách câu hỏi làm rõ")

class DecomposeRequest(BaseModel):
    idea: Optional[str] = Field(default=None, description="Ý tưởng ban đầu")
    clarifiedIdea: Optional[str] = Field(default=None, description="Ý tưởng đã làm rõ")
    answers: Optional[List[Any]] = Field(default=None, description="Các câu trả lời làm rõ")

class DecomposeResponse(BaseModel):
    cards: List[SpecCardSchema] = Field(description="8 thẻ đặc tả cố định")

# Legacy Clarify models (backward compatibility)
class ClarifyRequest(BaseModel):
    idea: str = Field(description="Ý tưởng nghiên cứu sơ khởi")

class ClarifyResponse(BaseModel):
    clarified_idea: str = Field(description="Ý tưởng nghiên cứu sau khi được diễn giải lại")
    questions: List[ClarifyQuestion] = Field(description="Danh sách các câu hỏi làm rõ")
    cards: List[SpecCardSchema] = Field(description="Các thẻ đặc tả được phân rã")

# --- Vòng 2: Related Works & Gap Analysis ---

class RelatedWorksRequest(BaseModel):
    problem: str = Field(description="Vấn đề nghiên cứu")
    research_question: str = Field(description="Câu hỏi nghiên cứu")
    keywords: Optional[List[str]] = Field(default=None, description="Các từ khóa tìm kiếm (tùy chọn)")

class RelatedWorkItem(BaseModel):
    paper_title: str = Field(description="Tên bài báo khoa học")
    authors: str = Field(default="", description="Danh sách tác giả")
    year: int = Field(default=2024, description="Năm xuất bản")
    what_they_did: str = Field(default="", description="Nội dung họ đã thực hiện (tiếng Việt)")
    feedback: str = Field(default="", description="Nhận xét phản biện về công trình đó (tiếng Việt)")
    missing_points: str = Field(default="", description="Điểm còn thiếu/hạn chế của bài báo (tiếng Việt)")
    source_url: str = Field(default="", description="Nguồn/Link liên kết thực tế (ArXiv/Semantic Scholar)")
    source_type: Optional[str] = Field(default="proceedings", description="Loại nguồn")

class RelatedWorksOnlyResponse(BaseModel):
    related_works: List[RelatedWorkItem] = Field(description="Danh sách các bài báo liên quan")

class ProposedGapOption(BaseModel):
    gap_title: str = Field(description="Tên hướng khoảng trống nghiên cứu")
    description: str = Field(description="Mô tả chi tiết hướng gap (tiếng Việt)")
    example_selection: str = Field(default="", description="Ví dụ minh họa lựa chọn")
    options: QuestionOption = Field(description="Lựa chọn đồng ý/bác bỏ hoặc tùy chọn khác")

class RelatedWorksResponse(BaseModel):
    related_works: List[RelatedWorkItem] = Field(description="Bảng đối sánh Related Works")
    proposed_gaps: List[ProposedGapOption] = Field(description="Các hướng Research Gap đề xuất")

# class GapAnalysisRequest(BaseModel):
#     gap_candidate: str = Field(description="Khoảng trống nghiên cứu sơ bộ")
#     related_works: Optional[List[Any]] = Field(default=None, description="Danh sách related works")
class GapAnalysisRequest(BaseModel):
    gap_candidate: str = Field(description="Khoảng trống nghiên cứu sơ bộ")
    related_works: Optional[List[Any]] = Field(default=None, description="Danh sách related works")
    revision_instruction: Optional[str] = Field(default=None, description="Vấn đề cần sửa lại, nếu đây là lần regenerate sau khi bị Judge chê")
    
class DirectionOption(BaseModel):
    letter: str = Field(description="Mã chữ cái (A, B, C, D)")
    label: str = Field(description="Tên hướng đi")
    description: str = Field(description="Mô tả chi tiết hướng đi")

class GapAnalysisResponse(BaseModel):
    what_was_done: str = Field(description="Các nghiên cứu trước đã làm gì")
    limitation: str = Field(description="Hạn chế còn tồn đọng")
    why_it_matters: str = Field(description="Tại sao giải quyết hạn chế này lại quan trọng")
    testable_with: str = Field(description="Cách kiểm chứng thực nghiệm")
    directions: List[DirectionOption] = Field(description="Các hướng nghiên cứu đề xuất (A/B/C/D)")

class ConflictCheckRequest(BaseModel):
    claim_evidence_pairs: Optional[List[Any]] = Field(default=None, description="Các cặp Claim-Evidence")
    related_works: Optional[List[Any]] = Field(default=None, description="Danh sách bài báo liên quan")

class ConflictItem(BaseModel):
    claim_card_id: str = Field(description="ID thẻ Claim")
    evidence_card_id: str = Field(description="ID thẻ Evidence")
    linked_sources: List[Any] = Field(default_factory=list, description="Các nguồn liên quan gây xung đột")
    reason: str = Field(description="Lý do xung đột")

class ConflictCheckResponse(BaseModel):
    conflicts: List[ConflictItem] = Field(default_factory=list, description="Danh sách xung đột phát hiện được")

# --- Vòng 3: Claim-Evidence & Experiments ---

class SpecExperimentRequest(BaseModel):
    problem: str = Field(description="Vấn đề nghiên cứu")
    gap: str = Field(description="Research Gap đã chọn")
    direction: Optional[str] = Field(default=None, description="Hướng gap đã chọn")

class ClaimCardSchema(BaseModel):
    claim: str = Field(description="Tuyên bố khoa học (Claim)")
    baseline: str = Field(default="", description="Phương pháp so sánh (Baseline)")
    metric: str = Field(default="", description="Số đo đánh giá (Metric)")
    evidence: str = Field(default="", description="Bằng chứng hỗ trợ")
    rejection_condition: str = Field(default="", description="Điều kiện bác bỏ claim (Falsification condition)")

class ExperimentSchema(BaseModel):
    name: str = Field(description="Tên thí nghiệm (Ví dụ: TN1: Baseline, TN2: Đánh giá chất lượng)")
    protocol: str = Field(description="Quy trình thí nghiệm từng bước chi tiết")
    expected_outcome: str = Field(description="Kết quả kỳ vọng")

class FeasibilityEstimation(BaseModel):
    model_name: str = Field(description="Tên mô hình đề xuất (ví dụ: GPT-4o, Llama-3-8B-Instruct, Llama-3-70B)")
    seed_prompts_count: int = Field(default=5, description="Số lượng seed prompt sử dụng")
    candidates_count: int = Field(default=3, description="Số lượng candidates sinh ra")
    vram_needed_gb: float = Field(default=16.5, description="Lượng VRAM ước tính (GB)")
    tokens_estimated: int = Field(default=45000, description="Số lượng tokens ước tính")
    gpu_time_hours: float = Field(default=0.5, description="Thời gian chạy trên GPU ước tính (giờ, ví dụ trên RTX 3090)")
    is_feasible: bool = Field(default=True, description="Đánh giá tính khả thi có khớp với tài nguyên 1x RTX 3090 (24GB VRAM)")
    explanation: str = Field(default="", description="Giải thích lý do khả thi hoặc không khả thi")

class FeasibilityRequest(BaseModel):
    model_name: Optional[str] = Field(default="Llama-3-8B-Instruct", description="Tên mô hình dự kiến sử dụng")
    seed_prompts_count: Optional[int] = Field(default=5, description="Số lượng seed prompts")
    candidates_count: Optional[int] = Field(default=3, description="Số lượng candidates mỗi prompt")
    context_length: Optional[int] = Field(default=4096, description="Độ dài ngữ cảnh (tokens)")
    gpu_target: Optional[str] = Field(default="NVIDIA RTX 3090 (24GB VRAM)", description="Phần cứng GPU mục tiêu")

class SpecExperimentResponse(BaseModel):
    contributions: List[str] = Field(description="Danh sách đóng góp khoa học (Contributions)")
    claims: List[ClaimCardSchema] = Field(description="Danh sách thẻ Claim-Evidence")
    experiments: List[ExperimentSchema] = Field(description="Kế hoạch thí nghiệm chi tiết")
    feasibility_estimation: FeasibilityEstimation = Field(description="Đánh giá tính khả thi tài nguyên")

class SingleClaimExperimentResponse(BaseModel):
    experiment: ExperimentSchema = Field(description="Thí nghiệm sinh cho 1 claim")

# --- Vòng 4: Judges Panel ---

class SeverityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"

class VerdictEnum(str, Enum):
    ACCEPT = "ACCEPT"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    REJECT = "REJECT"

class IssueChoice(BaseModel):
    letter: str = Field(description="Mã lựa chọn (A, B, C, D)")
    label: str = Field(description="Nhãn lựa chọn")
    understanding: str = Field(default="", description="Giải thích ý nghĩa lựa chọn")

class IssueSchema(BaseModel):
    severity: SeverityEnum = Field(description="Mức độ nghiêm trọng của vấn đề")
    title: Optional[str] = Field(default=None, description="Tiêu đề vấn đề")
    description: str = Field(description="Mô tả vấn đề phát hiện (tiếng Việt)")
    suggestion: str = Field(description="Gợi ý hướng sửa đổi cụ thể (tiếng Việt)")
    flagged_by: Optional[str] = Field(default=None, description="Judge nào phát hiện")
    choices: Optional[List[IssueChoice]] = Field(default=None, description="Lựa chọn khắc phục")

class JudgeResultSchema(BaseModel):
    type: str = Field(description="Loại Judge (gap, contribution, experiment, evidence, conference-readiness)")
    verdict: VerdictEnum = Field(description="Phán quyết của Judge")
    issues: List[IssueSchema] = Field(default_factory=list, description="Danh sách các vấn đề phát hiện")

class JudgesPanelRequest(BaseModel):
    problem: str = Field(default="", description="Vấn đề nghiên cứu")
    gap: str = Field(default="", description="Research Gap")
    related_work: Optional[List[Any]] = Field(default_factory=list, description="Danh sách Related Works")
    contribution: Optional[str] = Field(default="", description="Đóng góp khoa học")
    claims: Optional[List[Any]] = Field(default_factory=list, description="Danh sách Claims")
    experiments: Optional[List[Any]] = Field(default_factory=list, description="Kế hoạch thí nghiệm")
    evidence: Optional[List[str]] = Field(default_factory=list, description="Bằng chứng/citations đi kèm")

class JudgesPanelResponse(BaseModel):
    spec_version_used: int = Field(default=1, description="Phiên bản spec được đánh giá")
    status: str = Field(default="COMPLETED", description="Trạng thái panel (COMPLETED / PARTIAL_FAILURE)")
    judges: List[JudgeResultSchema] = Field(description="Kết quả chi tiết từ 5 Judges độc lập")

# --- Vòng 5: Final Spec ---

class FinalSpecRequest(BaseModel):
    project_title: Optional[str] = Field(default="Research Specification", description="Tiêu đề dự án nghiên cứu")
    problem: Optional[str] = Field(default="", description="Vấn đề nghiên cứu")
    gap: Optional[str] = Field(default="", description="Research Gap")
    related_work: Optional[List[Any]] = Field(default_factory=list, description="Danh sách Related Works")
    contribution: Optional[str] = Field(default="", description="Đóng góp khoa học")
    claims: Optional[List[Any]] = Field(default_factory=list, description="Danh sách Claims")
    experiments: Optional[List[Any]] = Field(default_factory=list, description="Kế hoạch thí nghiệm")
    judges_summary: Optional[List[Any]] = Field(default_factory=list, description="Tóm tắt phản biện từ hội đồng")
    decision_log: Optional[List[dict]] = Field(default_factory=list, description="Lịch sử các quyết định của người dùng")

class FinalSpecResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    markdown_content: str = Field(default="")
    markdownContent: Optional[str] = Field(default=None)
    spec_json: dict = Field(default_factory=dict)
    specJson: Optional[dict] = Field(default=None)
    before: str = ""
    after: str = ""

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        # Extract markdown_content or markdownContent
        markdown = data.get("markdown_content") or data.get("markdownContent") or ""
        spec = data.get("spec_json") or data.get("specJson")

        # If spec_json is missing or if Gemini returned a flat object
        if spec is None or not isinstance(spec, dict):
            spec = {
                k: v for k, v in data.items()
                if k not in ("markdown_content", "markdownContent", "spec_json", "specJson", "before", "after")
            }

        # Normalize title and core keys inside spec
        title = (
            spec.get("title")
            or spec.get("project_title")
            or spec.get("project")
            or data.get("title")
            or data.get("project_title")
            or "Research Specification"
        )
        spec["title"] = title
        if "problem" not in spec and "problem" in data:
            spec["problem"] = data["problem"]
        if "gap" not in spec and "gap" in data:
            spec["gap"] = data["gap"]
        if "contribution" not in spec and "contribution" in data:
            spec["contribution"] = data["contribution"]

        # If markdown_content is missing, render basic markdown from spec fields
        if not markdown:
            problem = spec.get("problem") or data.get("problem") or ""
            gap = spec.get("gap") or data.get("gap") or ""
            contribution = spec.get("contribution") or data.get("contribution") or ""
            markdown = f"# {title}\n\n## 1. Problem Formulation\n{problem}\n\n## 2. Research Gap & Novelty\n{gap}\n\n## 3. Key Contribution\n{contribution}\n"

        return {
            "markdown_content": markdown,
            "markdownContent": markdown,
            "spec_json": spec,
            "specJson": spec,
            "before": str(data.get("before", "")),
            "after": str(data.get("after", ""))
        }

