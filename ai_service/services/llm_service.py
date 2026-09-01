import os
import json
import time
import re
from typing import Dict, Any, Optional, List
from google import genai
from google.genai import types
from google.genai.errors import APIError
from schemas.spec_schemas import (
    ClarifyUnderstandResponse, ClarifyQuestionsResponse, QuestionItem,
    DecomposeResponse, SpecCardSchema, SpecCardType, SpecCardStatus,
    RelatedWorksResponse, RelatedWorkItem, ProposedGapOption,
    GapAnalysisResponse, DirectionOption,
    SpecExperimentResponse, ClaimCardSchema, ExperimentSchema, FeasibilityEstimation, FeasibilityRequest,
    SingleClaimExperimentResponse, ConflictCheckResponse, ConflictItem,
    JudgesPanelResponse, JudgeResultSchema, IssueSchema, IssueChoice, SeverityEnum, VerdictEnum,
    FinalSpecResponse, ClarifyResponse, ClarifyQuestion, QuestionOption
)

class LlmService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip(' "\'')
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip(' "\'')
        self.fallback_models = [
            self.model_name,
            "gemini-3.7-flash",
            "gemini-1.5-flash",
        ]
        self.client: Optional[genai.Client] = None
        
        if self.api_key and len(self.api_key) > 10:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"[Warning] Failed to initialize Google GenAI Client: {e}")

    def _clean_json_text(self, text: str) -> str:
        """Strip markdown fences and whitespace from LLM response."""
        text = text.strip()
        # Remove markdown code blocks if present
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        # Regex search for the outermost JSON object or array
        match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
        if match:
            return match.group(1)
        return text

    def call_gemini_structured(self, prompt: str, response_schema: Any, max_retries: int = 2) -> Any:
        """
        Call Gemini API using google-genai SDK and return parsed Pydantic schema response with fast retry & model fallback.
        """
        if not self.api_key or len(self.api_key) < 10:
            raise ValueError("GEMINI_API_KEY is not set or invalid.")
        if not self.client:
            self.client = genai.Client(api_key=self.api_key)
            
        # Deduplicate candidate models
        seen = set()
        models_to_try = [m for m in self.fallback_models if m and not (m in seen or seen.add(m))]
        last_error = None

        for model_candidate in models_to_try:
            for attempt in range(max_retries):
                try:
                    try:
                        # Attempt native structured output via GenerateContentConfig
                        config = types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=response_schema,
                            temperature=0.2,
                        )
                        response = self.client.models.generate_content(
                            model=model_candidate,
                            contents=prompt,
                            config=config,
                        )
                        raw_text = self._clean_json_text(response.text or "")
                        data = json.loads(raw_text)
                        return response_schema.model_validate(data)
                    except Exception as inner_e:
                        inner_str = str(inner_e).lower()
                        # If 404 or 429 quota error, re-raise immediately to break to next model
                        if "404" in inner_str or "429" in inner_str or "quota" in inner_str or "resourceexhausted" in inner_str or "not_found" in inner_str:
                            raise inner_e
                            
                        # Fallback to prompt-guided JSON generation if schema mode throws an exception
                        print(f"[Warning] Native schema generation failed on {model_candidate} ({inner_e}), trying prompt-guided JSON parse...")
                        json_prompt = f"{prompt}\n\nIMPORTANT: Return ONLY a valid JSON object matching the required schema. Do not add any markdown formatting or commentary."
                        config = types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.2,
                        )
                        response = self.client.models.generate_content(
                            model=model_candidate,
                            contents=json_prompt,
                            config=config,
                        )
                        raw_text = self._clean_json_text(response.text or "")
                        data = json.loads(raw_text)
                        return response_schema.model_validate(data)
                        
                except Exception as e:
                    last_error = e
                    err_str = str(e).lower()
                    print(f"[Attempt {attempt + 1}/{max_retries} with {model_candidate}] Error in Gemini structured call: {e}")
                    
                    # If 404 NOT_FOUND or 429 QUOTA EXCEEDED, immediately switch to next model without waiting
                    if "404" in err_str or "not_found" in err_str or "429" in err_str or "quota" in err_str or "resourceexhausted" in err_str:
                        print(f"[Notice] Model '{model_candidate}' returned 404/429. Switching immediately to next fallback candidate...")
                        break
                    
                    # If transient 503 server unavailable, quick 1s backoff for 1 retry max
                    if "503" in err_str or "unavailable" in err_str:
                        if attempt < max_retries - 1:
                            time.sleep(1)
                        else:
                            break
                    elif attempt < max_retries - 1:
                        time.sleep(1)
                    else:
                        break

        raise last_error or RuntimeError("Gemini structured call failed across all candidate models.")

    # ==========================================
    # VÒNG 1: CLARIFY & DECOMPOSE
    # ==========================================

    def process_step1_understand(self, idea: str, feedback: Optional[str] = None) -> ClarifyUnderstandResponse:
        """Step 1a: Understand the idea, identify key issues and compute confidence."""
        prompt = f"""
System: You are an expert AI Research Assistant.
Analyze the following raw research idea in Vietnamese.
1. Rephrase and clarify the research idea clearly and formally (clarified_idea in Vietnamese).
2. Identify 2-4 key issues, open questions, or missing aspects that need clarification (key_issues in Vietnamese).
3. Assign a confidence score from 0.0 to 1.0 (confidence).

Raw Idea: "{idea}"
User Feedback (if any): "{feedback or ''}"
"""
        return self.call_gemini_structured(prompt, ClarifyUnderstandResponse)

    def process_step1_questions(self, clarified_idea: str) -> ClarifyQuestionsResponse:
        """Step 1b: Generate multiple-choice confirmation questions with 'Other' option."""
        prompt = f"""
System: You are an expert AI Research Assistant.
Given the clarified research idea, generate 2 to 3 Vietnamese multiple-choice confirmation questions to clarify assumptions, tasks, and constraints.
Each question MUST have:
- question: Clear question in Vietnamese
- example: Short example answer
- options: List of 2-3 specific options in Vietnamese, with the LAST element always being "Other"

Clarified Idea: "{clarified_idea}"
"""
        return self.call_gemini_structured(prompt, ClarifyQuestionsResponse)

    def process_step2_decompose(self, context: dict) -> DecomposeResponse:
        """Step 2: Decompose idea into exactly 8 fixed seed cards (all PROPOSED)."""
        prompt = f"""
System: Decompose the clarified research idea into exactly 8 spec cards (one for each type):
Types: PROBLEM, RESEARCH_QUESTION, GAP_CANDIDATE, CONTRIBUTION, CLAIM, EVIDENCE, CONSTRAINT, OPEN_QUESTION.
Each card has:
- type: One of the 8 types above
- content: Detailed description in Vietnamese
- status: "PROPOSED"

Context:
Idea: {context.get('idea', '')}
Clarified: {context.get('clarifiedIdea', '')}
Answers: {json.dumps(context.get('answers', []), ensure_ascii=False)}
"""
        return self.call_gemini_structured(prompt, DecomposeResponse)

    # ==========================================
    # VÒNG 2: RELATED WORKS & GAP ANALYSIS
    # ==========================================

    def process_step2_related_works(self, problem: str, research_question: str, papers: List[Dict[str, Any]]) -> RelatedWorksResponse:
        """Step 3a: Synthesize comparative related works analysis and gap options."""
        papers_context = ""
        for i, p in enumerate(papers, 1):
            papers_context += f"""
Paper #{i}:
- Title: {p.get('title')}
- Authors: {p.get('authors')}
- Year: {p.get('year')}
- Summary: {p.get('summary')}
- URL: {p.get('url')}
"""
        prompt = f"""
System: You are the Related Work & Gap Finder Agent.
Given the research problem, research question, and papers retrieved from arXiv, generate a RelatedWorksResponse.
1. For each paper, provide:
   - paper_title: Title
   - authors: Author list
   - year: Year
   - what_they_did: Description in Vietnamese
   - feedback: Critical feedback in Vietnamese
   - missing_points: Limitations in Vietnamese
   - source_url: URL link
   - source_type: "proceedings" or "peer-reviewed"
2. Propose 3-4 gap directions (ProposedGapOption) with gap_title, description, and Vietnamese options with allow_other=True.

Problem: {problem}
Research Question: {research_question}
Papers:
{papers_context}
"""
        return self.call_gemini_structured(prompt, RelatedWorksResponse)

    def process_step2_gap_analysis(self, gap_candidate: str, related_works: List[Any]) -> GapAnalysisResponse:
        """Step 3b: Gap analysis + 4 focus directions A, B, C, D."""
        prompt = f"""
System: Analyze the research gap candidate against related works and generate 4 specific directions (A, B, C, D).
Fields:
- what_was_done (Vietnamese)
- limitation (Vietnamese)
- why_it_matters (Vietnamese)
- testable_with (Vietnamese)
- directions: exactly 4 items with letter ('A','B','C','D'), label, and description in Vietnamese.

Gap Candidate: "{gap_candidate}"
Related Works: {json.dumps(related_works, ensure_ascii=False)}
"""
        return self.call_gemini_structured(prompt, GapAnalysisResponse)

    def process_step3_conflicts(self, pairs: List[Any], related_works: List[Any]) -> ConflictCheckResponse:
        """Detect conflicts between claim-evidence pairs and related works."""
        prompt = f"""
System: Check for potential conflicts or weak support between claim-evidence pairs and the cited literature.
Return a list of ConflictItem (claim_card_id, evidence_card_id, linked_sources, reason in Vietnamese).

Pairs: {json.dumps(pairs, ensure_ascii=False)}
Related Works: {json.dumps(related_works, ensure_ascii=False)}
"""
        return self.call_gemini_structured(prompt, ConflictCheckResponse)

    # ==========================================
    # VÒNG 3: CONTRIBUTIONS, CLAIMS & EXPERIMENTS
    # ==========================================

    def process_step3_experiment(self, problem: str, gap: str, direction: Optional[str] = None) -> SpecExperimentResponse:
        """Step 4: Design contributions, claims, experiments, and RTX 3090 feasibility."""
        prompt = f"""
System: You are the Experiment Designer Agent in SpecResearch Loop.
1. Propose 2-3 scientific contributions in Vietnamese.
2. Design 2-3 ClaimCardSchema (claim, baseline, metric, evidence, rejection_condition).
3. Design 3 detailed ExperimentSchema (name e.g. 'TN1: Baseline', 'TN2: Đánh giá chất lượng', 'TN3: Ablation study', protocol in Vietnamese, expected_outcome in Vietnamese).
4. Estimate FeasibilityEstimation for a consumer GPU (NVIDIA RTX 3090, 24GB VRAM). Ensure is_feasible is True and vram_needed_gb <= 24.0.

Problem: {problem}
Gap: {gap}
Direction: {direction or ''}
"""
        return self.call_gemini_structured(prompt, SpecExperimentResponse)

    def process_step3_feasibility(self, req: FeasibilityRequest) -> FeasibilityEstimation:
        """Dedicated hardware feasibility calculation constrained to single consumer GPU (RTX 3090)."""
        prompt = f"""
System: Calculate hardware feasibility and VRAM estimation for running LLM evaluation on a single consumer GPU (NVIDIA RTX 3090, 24GB VRAM).
Model: {req.model_name}
Seed Prompts: {req.seed_prompts_count}
Candidates count: {req.candidates_count}
Context Length: {req.context_length}
Target GPU: {req.gpu_target}

Return FeasibilityEstimation:
- model_name
- seed_prompts_count
- candidates_count
- vram_needed_gb (must be estimated realistically; if >24GB, is_feasible=False; if <=24GB, is_feasible=True)
- tokens_estimated
- gpu_time_hours
- is_feasible (True if vram_needed_gb <= 24.0 else False)
- explanation in Vietnamese
"""
        return self.call_gemini_structured(prompt, FeasibilityEstimation)

    def process_step3_single_claim(self, claim_evidence: dict) -> SingleClaimExperimentResponse:
        """Generate one experiment for a single claim-evidence card."""
        prompt = f"""
System: Design a single scientific experiment (name, protocol in Vietnamese, expected_outcome in Vietnamese) to test the following claim:
Claim: {claim_evidence.get('claim', '')}
Baseline: {claim_evidence.get('baseline', '')}
Metric: {claim_evidence.get('metric', '')}
Evidence: {claim_evidence.get('evidence', '')}
Rejection Condition: {claim_evidence.get('rejectionCondition', '') or claim_evidence.get('rejection_condition', '')}
"""
        return self.call_gemini_structured(prompt, SingleClaimExperimentResponse)

    # ==========================================
    # VÒNG 4: 5 JUDGES PANEL
    # ==========================================

    def process_step4_judges(self, problem: str, gap: str, contribution: str, claims_text: str, experiments_text: str) -> JudgesPanelResponse:
        """Step 5: Run 5 independent judges panel."""
        prompt = f"""
System: You are the independent Multi-Judge Review Panel. Evaluate the research spec on 5 independent aspects:
1. 'gap': Checks if the research gap is well-grounded in literature.
2. 'contribution': Checks if contributions are novel, clearly scoped, and not exaggerated.
3. 'experiment': Checks if experiment protocols (TN1-TN5) adequately prove the claims and metric comparisons.
4. 'evidence': Checks if citations and evidence are correctly mapped without hallucinations.
5. 'conference-readiness': Evaluates Overall Originality, Soundness, Clarity, and Reproducibility for top conferences (ACL/EMNLP/NeurIPS).

For each of the 5 judges, output JudgeResultSchema:
- type: 'gap' | 'contribution' | 'experiment' | 'evidence' | 'conference-readiness'
- verdict: 'ACCEPT' | 'REVIEW_REQUIRED' | 'REJECT'
- issues: List of IssueSchema (severity 'CRITICAL'|'MAJOR'|'MINOR', title, description in Vietnamese, suggestion in Vietnamese, flagged_by, choices with letter/label/understanding in Vietnamese).

Problem: {problem}
Gap: {gap}
Contribution: {contribution}
Claims: {claims_text}
Experiments: {experiments_text}
"""
        res = self.call_gemini_structured(prompt, JudgesPanelResponse)
        # Ensure all 5 judge types exist
        existing_types = {j.type for j in res.judges}
        expected_types = ["gap", "contribution", "experiment", "evidence", "conference-readiness"]
        for exp_type in expected_types:
            if exp_type not in existing_types:
                res.judges.append(JudgeResultSchema(type=exp_type, verdict=VerdictEnum.ACCEPT, issues=[]))
        return res

    # ==========================================
    # VÒNG 5: FINAL SPEC & EXPORT
    # ==========================================

    def process_step5_final_spec(self, project_title: str, problem: str, gap: str, contribution: str, claims_text: str, experiments_text: str, judges_text: str) -> FinalSpecResponse:
        """Step 6: Synthesize final research spec markdown and JSON."""
        prompt = f"""
System: Synthesize the finalized research spec into structured publication-ready Markdown in Vietnamese, and return the final JSON representation.
The markdown document must contain all 10 core sections:
1. Tiêu đề & Tổng quan (Metadata & Executive Summary)
2. Bối cảnh & Vấn đề nghiên cứu (Problem Formulation)
3. Câu hỏi nghiên cứu & Giả thuyết (Research Questions & Hypotheses)
4. Tổng quan tài liệu & Bảng đối sánh Related Works (Related Works Matrix)
5. Khoảng trống nghiên cứu & Đóng góp mới (Research Gap & Novelty)
6. Phương pháp tiếp cận & Kiến trúc kỹ thuật (Technical Approach)
7. Ma trận Claim - Evidence (Claim-Evidence Matrix)
8. Kế hoạch thí nghiệm chi tiết (TN1 -> TN5 Experiment Protocols)
9. Đánh giá tính khả thi phần cứng (Hardware Feasibility on RTX 3090)
10. Báo cáo phản biện của 5 AI Judges & Quyết định chốt (Judges Report & Decision Log)

Project: {project_title}
Problem: {problem}
Gap: {gap}
Contribution: {contribution}
Claims: {claims_text}
Experiments: {experiments_text}
Judges Summary: {judges_text}
"""
        return self.call_gemini_structured(prompt, FinalSpecResponse)
