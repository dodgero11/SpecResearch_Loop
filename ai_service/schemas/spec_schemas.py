from pydantic import BaseModel, Field
from typing import Any, List, Optional
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
    allow_other: bool = Field(description="Cho phép người dùng tự điền lựa chọn khác")

class ClarifyQuestion(BaseModel):
    question: str = Field(description="Câu hỏi làm rõ ý tưởng nghiên cứu")
    example: Optional[str] = Field(description="Ví dụ minh họa cho câu trả lời")
    options: QuestionOption = Field(description="Lựa chọn trắc nghiệm")

class SpecCardSchema(BaseModel):
    type: SpecCardType = Field(description="Loại thẻ đặc tả")
    content: str = Field(description="Nội dung thẻ")
    status: SpecCardStatus = Field(description="Trạng thái thẻ")
    metadata: Optional[dict] = Field(description="Metadata đi kèm thẻ")

# --- Vòng 1: Clarify & Decompose ---

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
    keywords: Optional[List[str]] = Field(None, description="Các từ khóa tìm kiếm (tùy chọn)")

class RelatedWorkItem(BaseModel):
    paper_title: str = Field(description="Tên bài báo khoa học")
    authors: str = Field(description="Danh sách tác giả")
    year: int = Field(description="Năm xuất bản")
    what_they_did: str = Field(description="Nội dung họ đã thực hiện (tiếng Việt)")
    feedback: str = Field(description="Nhận xét phản biện về công trình đó (tiếng Việt)")
    missing_points: str = Field(description="Điểm còn thiếu/hạn chế của bài báo (tiếng Việt)")
    source_url: str = Field(description="Nguồn/Link liên kết thực tế (ArXiv/Semantic Scholar)")

class ProposedGapOption(BaseModel):
    gap_title: str = Field(description="Tên hướng khoảng trống nghiên cứu")
    description: str = Field(description="Mô tả chi tiết hướng gap (tiếng Việt)")
    example_selection: str = Field(description="Ví dụ minh họa lựa chọn")
    options: QuestionOption = Field(description="Lựa chọn đồng ý/bác bỏ hoặc tùy chọn khác")

class RelatedWorksResponse(BaseModel):
    related_works: List[RelatedWorkItem] = Field(description="Bảng đối sánh Related Works")
    proposed_gaps: List[ProposedGapOption] = Field(description="Các hướng Research Gap đề xuất")

# --- Vòng 3: Claim-Evidence & Experiments ---

class SpecExperimentRequest(BaseModel):
    problem: str = Field(description="Vấn đề nghiên cứu")
    gap: str = Field(description="Research Gap đã chọn")

class ClaimCardSchema(BaseModel):
    claim: str = Field(description="Tuyên bố khoa học (Claim)")
    baseline: str = Field(description="Phương pháp so sánh (Baseline)")
    metric: str = Field(description="Số đo đánh giá (Metric)")
    evidence: str = Field(description="Bằng chứng hỗ trợ")
    rejection_condition: str = Field(description="Điều kiện bác bỏ claim (Falsification condition)")

class ExperimentSchema(BaseModel):
    name: str = Field(description="Tên thí nghiệm (Ví dụ: TN1: Baseline, TN2: Đánh giá chất lượng)")
    protocol: str = Field(description="Quy trình thí nghiệm từng bước chi tiết")
    expected_outcome: str = Field(description="Kết quả kỳ vọng")

class FeasibilityEstimation(BaseModel):
    model_name: str = Field(description="Tên mô hình đề xuất (ví dụ: GPT-4o, Llama-3-70B)")
    seed_prompts_count: int = Field(description="Số lượng seed prompt sử dụng")
    candidates_count: int = Field(description="Số lượng candidates sinh ra")
    vram_needed_gb: float = Field(description="Lượng VRAM ước tính (GB)")
    tokens_estimated: int = Field(description="Số lượng tokens ước tính")
    gpu_time_hours: float = Field(description="Thời gian chạy trên GPU ước tính (giờ, ví dụ trên RTX 3090)")
    is_feasible: bool = Field(description="Đánh giá tính khả thi có khớp với tài nguyên 1x RTX 3090 (24GB VRAM)")
    explanation: str = Field(description="Giải thích lý do khả thi hoặc không khả thi")

class SpecExperimentResponse(BaseModel):
    contributions: List[str] = Field(description="Danh sách đóng góp khoa học (Contributions)")
    claims: List[ClaimCardSchema] = Field(description="Danh sách thẻ Claim-Evidence")
    experiments: List[ExperimentSchema] = Field(description="Kế hoạch thí nghiệm chi tiết")
    feasibility_estimation: FeasibilityEstimation = Field(description="Đánh giá tính khả thi tài nguyên")

# --- Vòng 4: Judges Panel ---

class JudgesPanelRequest(BaseModel):
    problem: str = Field(description="Vấn đề nghiên cứu")
    gap: str = Field(description="Research Gap")
    related_work: List[RelatedWorkItem] = Field(description="Danh sách Related Works")
    contribution: str = Field(description="Đóng góp khoa học")
    claims: List[ClaimCardSchema] = Field(description="Danh sách Claims")
    experiments: List[ExperimentSchema] = Field(description="Kế hoạch thí nghiệm")
    evidence: Optional[List[str]] = Field(None, description="Bằng chứng/citations đi kèm")

class SeverityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"

class VerdictEnum(str, Enum):
    ACCEPT = "ACCEPT"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    REJECT = "REJECT"

class IssueSchema(BaseModel):
    severity: SeverityEnum = Field(description="Mức độ nghiêm trọng của vấn đề")
    description: str = Field(description="Mô tả vấn đề phát hiện (tiếng Việt)")
    suggestion: str = Field(description="Gợi ý hướng sửa đổi cụ thể (tiếng Việt)")

class JudgeResultSchema(BaseModel):
    type: str = Field(description="Loại Judge (gap, contribution, experiment, evidence, conference-readiness)")
    verdict: VerdictEnum = Field(description="Phán quyết của Judge")
    issues: List[IssueSchema] = Field(description="Danh sách các vấn đề phát hiện")

class JudgesPanelResponse(BaseModel):
    spec_version_used: int = Field(description="Phiên bản spec được đánh giá")
    status: str = Field(description="Trạng thái panel (COMPLETED / PARTIAL_FAILURE)")
    judges: List[JudgeResultSchema] = Field(description="Kết quả chi tiết từ 5 Judges độc lập")

# --- Vòng 5: Final Spec ---

class FinalSpecRequest(BaseModel):
    project_title: str = Field(description="Tiêu đề dự án nghiên cứu")
    problem: str = Field(description="Vấn đề nghiên cứu")
    gap: str = Field(description="Research Gap")
    related_work: List[RelatedWorkItem] = Field(description="Danh sách Related Works")
    contribution: str = Field(description="Đóng góp khoa học")
    claims: List[ClaimCardSchema] = Field(description="Danh sách Claims")
    experiments: List[ExperimentSchema] = Field(description="Kế hoạch thí nghiệm")
    judges_summary: List[JudgeResultSchema] = Field(description="Tóm tắt phản biện từ hội đồng")
    decision_log: Optional[List[dict]] = Field(None, description="Lịch sử các quyết định của người dùng")

class FinalSpecResponse(BaseModel):
    markdown_content: str = Field(description="Toàn văn bản Research Spec bằng định dạng Markdown")
    spec_json: dict = Field(description="Bản spec lưu dưới dạng JSON chuẩn")
