import { AiGateway, AiGatewayResponse } from "./ai-gateway.port";

/**
 * In-process mock AiGateway for tests and local development when the Python
 * AI service is not running. Returns deterministic canned responses matching
 * the documented ai_service shapes.
 */
export class LocalAiGateway implements AiGateway {
  async understandIdea(
    idea: string,
    feedback?: string,
  ): Promise<AiGatewayResponse> {
    return {
      output: {
        clarified_idea: `Hệ thống hiểu ý tưởng: ${idea}`,
        key_issues: ["Cần làm rõ phạm vi", "Cần xác định baseline"],
        confidence: 0.7,
      },
      inputTokens: idea.length + (feedback?.length ?? 0),
      outputTokens: 3,
    };
  }

  async generateQuestions(clarifiedIdea: string): Promise<AiGatewayResponse> {
    return {
      output: {
        questions: [
          {
            question: "Tác vụ chính là gì?",
            example: "Ví dụ: trích xuất thông tin từ paper.",
            options: ["Trích xuất thông tin", "Tóm tắt tài liệu", "Other"],
          },
          {
            question: "Spec cuối dùng để làm gì?",
            example: "Ví dụ: đủ rõ để giao cho nhóm dev triển khai.",
            options: ["Làm prototype", "Triển khai thật", "Other"],
          },
        ],
      },
      inputTokens: clarifiedIdea.length,
      outputTokens: 2,
    };
  }

  async decompose(
    context: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    const types = [
      "PROBLEM",
      "RESEARCH_QUESTION",
      "GAP_CANDIDATE",
      "CONTRIBUTION",
      "CLAIM",
      "EVIDENCE",
      "CONSTRAINT",
      "OPEN_QUESTION",
    ];
    return {
      output: {
        cards: types.map((type) => ({
          type,
          content: `Nội dung thẻ ${type}`,
          status: "PROPOSED",
        })),
      },
      inputTokens: JSON.stringify(context).length,
      outputTokens: 8,
    };
  }

  async relatedWorks(
    problem: string,
    researchQuestion: string,
    keywords?: string[],
  ): Promise<AiGatewayResponse> {
    return {
      output: {
        related_works: [
          {
            paper_title: "OPRO",
            authors: "Yang et al.",
            year: 2023,
            what_they_did: "Tối ưu prompt bằng search + score tự động.",
            feedback: "Chưa tách claim, chưa kiểm tra evidence độc lập.",
            missing_points: "Không dùng tín hiệu claim-level.",
            source_url: "https://arxiv.org/abs/2309.03409",
            source_type: "proceedings",
          },
        ],
      },
      inputTokens:
        problem.length +
        researchQuestion.length +
        (keywords?.join(",").length ?? 0),
      outputTokens: 1,
    };
  }

  // async gapAnalysis(gapCandidate: string, relatedWorks: unknown[]): Promise<AiGatewayResponse> {
  async gapAnalysis(
    gapCandidate: string,
    relatedWorks: unknown[],
    revisionInstruction?: string,
  ): Promise<AiGatewayResponse> {
    return {
      output: {
        what_was_done:
          "Các nghiên cứu trước đã tiếp cận vấn đề theo hướng tổng quát.",
        limitation: "Chưa tối ưu ở mức claim–evidence.",
        why_it_matters: "Giảm hallucination khi trích xuất thông tin từ paper.",
        testable_with:
          "So sánh tỉ lệ unsupported claims trên cùng tập dữ liệu.",
        directions: [
          {
            letter: "A",
            label: "Thuật toán tối ưu prompt",
            description: "Tối ưu prompt theo vòng lặp.",
          },
          {
            letter: "B",
            label: "Claim–evidence verifier",
            description: "Xác minh claim với evidence.",
          },
          {
            letter: "C",
            label: "Human-in-the-loop",
            description: "Kết hợp xác nhận của người dùng.",
          },
          {
            letter: "D",
            label: "Kết hợp",
            description: "Kết hợp các hướng trên.",
          },
        ],
      },
      inputTokens: gapCandidate.length + JSON.stringify(relatedWorks).length,
      outputTokens: 4,
    };
  }

  async specExperiment(
    problem: string,
    gap: string,
    direction?: string,
  ): Promise<AiGatewayResponse> {
    return {
      output: {
        contributions: ["Đóng góp 1", "Đóng góp 2"],
        claims: [
          {
            claim: "Claim 1",
            baseline: "Baseline 1",
            metric: "Metric 1",
            evidence: "Evidence 1",
            rejection_condition: "Điều kiện bác bỏ 1",
          },
          {
            claim: "Claim 2",
            baseline: "Baseline 2",
            metric: "Metric 2",
            evidence: "Evidence 2",
            rejection_condition: "Điều kiện bác bỏ 2",
          },
        ],
        experiments: [
          {
            name: "TN1",
            protocol: "So sánh baseline",
            expected_outcome: "Giảm unsupported claims",
          },
        ],
        feasibility_estimation: {
          model_name: "Llama-3-8B-Instruct",
          seed_prompts_count: 5,
          candidates_count: 3,
          vram_needed_gb: 16.5,
          tokens_estimated: 45000,
          gpu_time_hours: 0.5,
          is_feasible: true,
          explanation: "Nằm trong giới hạn 24GB VRAM của RTX 3090.",
        },
      },
      inputTokens: problem.length + gap.length + (direction?.length ?? 0),
      outputTokens: 5,
    };
  }

  async singleClaimExperiment(
    claimEvidence: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return {
      output: {
        experiment: {
          name: "TN: Claim mới",
          protocol: "Đo lường theo baseline/metric của claim.",
          expected_outcome: "Kết quả kỳ vọng.",
        },
      },
      inputTokens: JSON.stringify(claimEvidence).length,
      outputTokens: 1,
    };
  }

  async finalSpec(
    payload: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return {
      output: {
        markdown_content: `# Research Specification\n\n## Problem\n${String(payload.problem ?? "")}\n`,
        spec_json: payload,
      },
      inputTokens: JSON.stringify(payload).length,
      outputTokens: 1,
    };
  }

  async conflicts(
    claimEvidencePairs: unknown[],
    relatedWorks: unknown[],
  ): Promise<AiGatewayResponse> {
    const pairs = Array.isArray(claimEvidencePairs) ? claimEvidencePairs : [];
    const conflicts = pairs.map((pair) => {
      const record = pair as Record<string, unknown>;
      return {
        claim_card_id: String(record.claimCardId ?? ""),
        evidence_card_id: String(record.evidenceCardId ?? ""),
        linked_sources:
          Array.isArray(relatedWorks) && relatedWorks.length > 0
            ? [relatedWorks[0]]
            : [],
        reason:
          "Bằng chứng hiện tại chưa đủ để xác nhận claim, có nguy cơ mâu thuẫn với related work.",
      };
    });
    return {
      output: { conflicts },
      inputTokens: JSON.stringify(claimEvidencePairs).length,
      outputTokens: conflicts.length,
    };
  }
}
