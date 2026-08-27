export type ClaimEvidence = {
  claim: string
  baseline: string
  metric: string
  evidence: string
  rejectionCondition: string
}

export type ContributionItem = {
  id: string
  label: string
  claimEvidence: ClaimEvidence
}

export const CONTRIBUTIONS: ContributionItem[] = [
  {
    id: 'c1',
    label: 'Framework tối ưu prompt nhiều vòng',
    claimEvidence: {
      claim: 'Giảm tỉ lệ claim không có bằng chứng so với baseline.',
      baseline: 'Zero-shot CoT (GPT-4o)',
      metric: 'Tỉ lệ unsupported claims (%)',
      evidence: 'Tỉ lệ unsupported giảm ≥ 20% trên val set (300 mẫu) với p < 0.05.',
      rejectionCondition: 'Không đạt cải thiện ≥ 10% hoặc không có ý nghĩa thống kê.',
    },
  },
  {
    id: 'c2',
    label: 'Verifier claim–evidence',
    claimEvidence: {
      claim: 'Verifier phân loại đúng claim có / thiếu / mâu thuẫn với evidence.',
      baseline: 'Gán nhãn thủ công bởi con người (human annotator)',
      metric: 'Accuracy phân loại 3 lớp (có / thiếu / mâu thuẫn)',
      evidence: 'Accuracy ≥ 85% trên tập test 200 claim đã gán nhãn.',
      rejectionCondition: 'Accuracy thấp hơn baseline theo lớp đa số (majority-class).',
    },
  },
  {
    id: 'c3',
    label: 'So sánh scalar vs textual vs claim-level feedback',
    claimEvidence: {
      claim: 'Claim-level feedback giúp giảm unsupported claim nhiều hơn scalar/textual feedback.',
      baseline: 'Scalar feedback (điểm tổng) và Textual feedback (gradient dạng chữ)',
      metric: 'Chênh lệch tỉ lệ unsupported claims giữa 3 phương pháp',
      evidence: 'Claim-level feedback giảm unsupported claims nhiều hơn ≥ 15% so với 2 baseline còn lại.',
      rejectionCondition: 'Không có khác biệt có ý nghĩa thống kê giữa 3 phương pháp.',
    },
  },
  {
    id: 'c4',
    label: 'Cấu hình khả thi với ngân sách giới hạn',
    claimEvidence: {
      claim: 'Hệ thống vẫn đạt hiệu quả tốt khi giảm số vòng/candidate để phù hợp ngân sách hạn chế.',
      baseline: 'Cấu hình đầy đủ (10 vòng, 10 candidate/vòng)',
      metric: 'Tỉ lệ giảm hiệu quả (%) khi cắt giảm cấu hình',
      evidence: 'Hiệu quả giảm không quá 10% khi giảm còn 5 vòng, 5 candidate/vòng.',
      rejectionCondition: 'Hiệu quả giảm hơn 10% khi cắt giảm cấu hình.',
    },
  },
]

export type FieldRow = { label: string; value: string }

export type ExperimentRow = { code: string; title: string; bullets: string[]; relatedContributionIds: string[] }

export const EXPERIMENT_ROWS: ExperimentRow[] = [
  {
    code: 'TN1',
    title: 'So sánh baseline',
    bullets: [
      'So sánh hệ thống đề xuất với 3 baseline.',
      'Đo tỉ lệ unsupported claims và factual accuracy.',
      'Kiểm định ý nghĩa thống kê.',
    ],
    relatedContributionIds: ['c1'],
  },
  {
    code: 'TN2',
    title: 'Đánh giá chất lượng',
    bullets: [
      'Đánh giá trên dev và val set.',
      'Tính đủ 2 metric: unsupported claims & factual accuracy.',
      'Phân tích theo từng chủ đề/dataset.',
    ],
    relatedContributionIds: [],
  },
  {
    code: 'TN3',
    title: 'Ablation study',
    bullets: [
      'Loại bỏ verifier (−V) để đo tác động.',
      'So sánh scalar vs textual vs claim-level feedback.',
      'Đo hiệu quả theo số vòng (3, 5, 10, 15).',
    ],
    relatedContributionIds: ['c2', 'c3'],
  },
  {
    code: 'TN4',
    title: 'Generalization',
    bullets: [
      'Thử trên 2–3 domain/dataset ngoài benchmark.',
      'Kiểm tra zero-shot và few-shot.',
      'Đánh giá khả năng chuyển miền.',
    ],
    relatedContributionIds: [],
  },
  {
    code: 'TN5',
    title: 'Efficiency study',
    bullets: [
      'Đo thời gian, token và VRAM theo số vòng & candidate.',
      'So sánh cấu hình 4-bit vs 8-bit.',
      'Tối ưu cấu hình cho ngân sách giới hạn.',
    ],
    relatedContributionIds: ['c4'],
  },
]

export function buildExperimentRowForContribution(contribution: ContributionItem, existingCount: number): ExperimentRow {
  return {
    code: `TN${existingCount + 1}`,
    title: `Kiểm chứng: ${contribution.label}`,
    bullets: [
      `So sánh có và không có "${contribution.label}" để đo tác động.`,
      'Dùng cùng model, dataset và token budget với các thí nghiệm khác.',
      'Đo theo đúng metric đã khai báo trong Claim–Evidence Card tương ứng.',
    ],
    relatedContributionIds: [contribution.id],
  }
}

export const BASE_FEASIBILITY_CONFIG = {
  model: '7B–8B, 4-bit',
  seedPrompts: 5,
  candidatesPerRound: 10,
  rounds: 10,
  devSet: 50,
  valSet: 300,
  topK: 5,
  vramGb: 20,
  hoursLow: 12,
  hoursHigh: 18,
  tokensLowM: 3,
  tokensHighM: 6,
}
