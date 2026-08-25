import os
import json
import google.generativeai as genai
from typing import Dict, Any, Optional, List
from schemas.spec_schemas import (
    ClarifyResponse, RelatedWorksResponse, SpecExperimentResponse,
    JudgesPanelResponse, FinalSpecResponse
)

class LlmService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        else:
            self.model_name = None

    def call_gemini_structured(self, prompt: str, response_schema: Any) -> Any:
        """
        Call Gemini API and return parsed Pydantic schema response.
        """
        if not self.api_key or not self.model_name:
            raise ValueError("GEMINI_API_KEY is not set or model is not configured.")
            
        try:
            model = genai.GenerativeModel(self.model_name)
            
            # Request structured JSON format conforming to the Pydantic schema
            generation_config = {
                "response_mime_type": "application/json",
                "response_schema": response_schema
            }
            
            response = model.generate_content(
                prompt,
                generation_config=generation_config
            )
            
            # Parse the JSON response into Pydantic model
            data = json.loads(response.text)
            return response_schema.model_validate(data)
        except Exception as e:
            print(f"Error in Gemini structured call: {e}")
            raise e

    def process_step1_clarify(self, idea: str) -> ClarifyResponse:
        """
        Vòng 1: Clarifier Agent. Takes raw idea, refines it, decomposes it into cards, 
        and creates 2-3 confirmation questions.
        """
        prompt = f"""
System Instructions:
You are the Clarifier Agent in the SpecResearch Loop system. Your goal is to take a raw/vague research idea in Vietnamese and clarify it.
Perform the following:
1. Rephrase/clarify the idea in simple, clear, and formal Vietnamese academic language (for clarified_idea).
2. Decompose the idea into spec cards of types: PROBLEM, RESEARCH_QUESTION, GAP_CANDIDATE. 
   - PROBLEM: The core problem statement.
   - RESEARCH_QUESTION: The main research question to answer.
   - GAP_CANDIDATE: Possible candidates for research gaps.
   Each card has 'type', 'content' (Vietnamese), 'status', and optionally 'metadata'.
3. Generate 2 to 3 Vietnamese multiple-choice confirmation questions (ClarifyQuestion) to clarify user assumptions, goals, and constraints. Each question must have a 'question' string, an 'example' answer string, and 'options' containing 'options' (list of strings) and 'allow_other': true.

Write the output conforming strictly to the ClarifyResponse JSON schema.

Raw Research Idea:
"{idea}"
"""
        return self.call_gemini_structured(prompt, ClarifyResponse)

    def process_step2_related_works(self, problem: str, research_question: str, papers: List[Dict[str, Any]]) -> RelatedWorksResponse:
        """
        Vòng 2: Related Work & Gap Finder. Takes problem, research question, and raw papers list,
        then synthesizes comparative analysis and proposed research gaps.
        """
        papers_context = ""
        for i, p in enumerate(papers, 1):
            papers_context += f"""
Paper #{i}:
- Title: {p.get('title')}
- Authors: {p.get('authors')}
- Year: {p.get('year')}
- Summary/Abstract: {p.get('summary')}
- URL: {p.get('url')}
"""

        prompt = f"""
System Instructions:
You are the Related Work & Gap Finder Agent. You are given a research problem, a research question, and a list of real academic papers retrieved from arXiv.
Perform the following:
1. For each paper in the list, write a RelatedWorkItem in Vietnamese:
   - paper_title: The exact title of the paper.
   - authors: List of authors.
   - year: Year published.
   - what_they_did: Explain in Vietnamese what they proposed or did in that paper (summarize based on abstract).
   - feedback: Criticize or comment on their methodology or results in Vietnamese.
   - missing_points: State what is missing or limitations they had in Vietnamese, especially regarding VRAM/Token hardware resource constraints, modern LLM agent verification, or human-in-the-loop workflows.
   - source_url: The exact source URL from the paper metadata. (No hallucinations!)
2. Propose 3 to 4 research gap candidates (ProposedGapOption) in Vietnamese:
   - gap_title: Short descriptive title of the research gap.
   - description: Detailed description of this research gap.
   - example_selection: Suggestion of what user selection might look like.
   - options: Standard option structure {{{{ 'options': ['Đồng ý chọn Gap này', 'Bác bỏ', 'Cần điều chỉnh thêm'], 'allow_other': True }}}} in Vietnamese.

Write the output conforming strictly to the RelatedWorksResponse JSON schema.

Research Context:
- Problem: {problem}
- Research Question: {research_question}

Retrieved Papers:
{papers_context}
"""
        return self.call_gemini_structured(prompt, RelatedWorksResponse)

    def process_step3_experiment(self, problem: str, gap: str) -> SpecExperimentResponse:
        """
        Vòng 3: Contribution, Claim-Evidence & Kế hoạch thí nghiệm.
        Generates scientific contributions, claim cards, detailed experiment protocols,
        and feasibility checks on RTX 3090 resources.
        """
        prompt = f"""
System Instructions:
You are the Experiment Designer Agent in the SpecResearch Loop system.
Given a research problem and the chosen gap, perform the following:
1. Propose 2 to 3 scientific contributions (contributions) in Vietnamese.
2. Design 2 to 3 Claim-Evidence Cards (claims):
   - claim: Scientific claim in Vietnamese.
   - baseline: Baseline method for comparison.
   - metric: Metric for evaluation.
   - evidence: Support evidence details.
   - rejection_condition: Rejection condition (falsification).
3. Design 3 detailed experiments (experiments) from baseline to ablation studies.
4. Estimate hardware feasibility (feasibility_estimation) for a single consumer GPU (NVIDIA RTX 3090, 24GB VRAM). Ensure VRAM needed is within 24GB VRAM and explain details in Vietnamese.

Write the output conforming strictly to the SpecExperimentResponse JSON schema.

Problem: {problem}
Gap: {gap}
"""
        return self.call_gemini_structured(prompt, SpecExperimentResponse)

    def process_step4_judges(self, problem: str, gap: str, contribution: str, claims_text: str, experiments_text: str) -> JudgesPanelResponse:
        """
        Vòng 4: Panel Judge Độc Lập & Phản Biển (Multi-Judge Review).
        Evaluates the spec using 5 independent judges.
        """
        prompt = f"""
System Instructions:
You are the independent Multi-Judge Review Panel. You must evaluate the proposed research spec on 5 independent aspects:
1. gap: Check if the gap is supported by literature.
2. contribution: Check if the contribution is new and not exaggerated.
3. experiment: Check if the experiments support the claims.
4. evidence: Check if citations and evidences are in the correct context.
5. conference-readiness: Score originality, soundness, clarity, and reproducibility.

For each judge, output a JudgeResultSchema:
- type: 'gap', 'contribution', 'experiment', 'evidence', or 'conference-readiness'.
- verdict: 'ACCEPT', 'REVIEW_REQUIRED', or 'REJECT'.
- issues: List of Issues (severity, description in Vietnamese, suggestion in Vietnamese).

Write the output conforming strictly to the JudgesPanelResponse JSON schema.

Research Spec details:
- Problem: {problem}
- Gap: {gap}
- Contribution: {contribution}
- Claims: {claims_text}
- Experiments: {experiments_text}
"""
        return self.call_gemini_structured(prompt, JudgesPanelResponse)

    def process_step5_final_spec(self, project_title: str, problem: str, gap: str, contribution: str, claims_text: str, experiments_text: str, judges_text: str) -> FinalSpecResponse:
        """
        Vòng 5: Tổng hợp toàn bộ Decision Log và nội dung đã qua kiểm duyệt thành bản Research Spec hoàn chỉnh.
        """
        prompt = f"""
System Instructions:
You are the Final Spec Generator. Synthesize the entire research spec into a structured, publication-ready Markdown document in Vietnamese. Also construct the final JSON structure representation of the spec.

Write the output conforming strictly to the FinalSpecResponse JSON schema.

Project: {project_title}
Problem: {problem}
Gap: {gap}
Contribution: {contribution}
Claims: {claims_text}
Experiments: {experiments_text}
Judges Feedback: {judges_text}
"""
        return self.call_gemini_structured(prompt, FinalSpecResponse)
