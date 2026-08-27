export const SPEC_CHECKLIST = [
  'Problem statement',
  'Research questions',
  'Related-work matrix',
  'Research gap',
  'Proposed approach',
  'Expected contributions',
  'Claim – evidence matrix',
  'Experimental protocol',
  'Baselines và metrics',
  'Ablation plan',
  'Compute budget',
  'Risks và limitations',
  'Open issues',
  'Decision history',
]

export const SPEC_GOAL =
  'Đề tài tập trung vào tối ưu prompt bằng feedback claim-level để giảm unsupported claim khi trích xuất thông tin từ paper khoa học.'

export const LLM_SUMMARY_STEPS = [
  'Chọn contribution chính.',
  'Đối sánh với prior work để tìm khoảng trống nghiên cứu.',
  'Thiết kế thí nghiệm và chọn baseline phù hợp.',
  'Xác nhận với Judge và người dùng trước khi chốt spec.',
]

export const BEFORE_AFTER_EXAMPLE = {
  before: 'Tối ưu prompt tốt hơn.',
  after:
    'Giảm unsupported claim bằng feedback claim-level, so sánh với OPRO và self-refine dưới cùng ngân sách inference.',
}
