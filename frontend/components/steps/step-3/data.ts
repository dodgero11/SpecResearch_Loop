export type SourceType = 'peer-reviewed' | 'proceedings' | 'author' | 'survey'

export type RelatedWork = {
  name: string
  year: string
  whatItDid: string
  feedbackType: string
  missingGap: string
  url: string
  sourceType: SourceType
}

export const relatedWorks: RelatedWork[] = [
  {
    name: 'OPRO',
    year: '2023',
    whatItDid: 'Tối ưu prompt bằng search + score tự động để tăng chất lượng trả lời.',
    feedbackType: 'Score tổng tự động',
    missingGap: 'Không tách claim; không kiểm tra evidence độc lập',
    url: 'https://arxiv.org/abs/2309.03409',
    sourceType: 'proceedings',
  },
  {
    name: 'PromptBreeder',
    year: '2023',
    whatItDid: 'Tiến hóa prompt với LLM để tìm prompt tốt hơn.',
    feedbackType: 'Score tổng tự động',
    missingGap: 'Vẫn dựa trên điểm tổng; chưa dùng tín hiệu ở mức claim',
    url: 'https://arxiv.org/abs/2309.16797',
    sourceType: 'peer-reviewed',
  },
  {
    name: 'TextGrad',
    year: '2024',
    whatItDid: 'Tối ưu prompt bằng gradient (textual) từ LLM.',
    feedbackType: 'Textual feedback',
    missingGap: 'Textual feedback khó đo lường chính xác',
    url: 'https://arxiv.org/abs/2406.07496',
    sourceType: 'peer-reviewed',
  },
  {
    name: 'DSPy',
    year: '2024',
    whatItDid: 'Framework tối ưu & dịch prompt cho các tác vụ.',
    feedbackType: 'Score/metric tự động',
    missingGap: 'Chưa có bước xác minh evidence; chưa thấy human-in-the-loop',
    url: 'https://arxiv.org/abs/2310.03714',
    sourceType: 'proceedings',
  },
]

export const DEFAULT_KEYWORDS = ['prompt optimization', 'hallucination', 'claim evidence', 'paper extraction']

export type PrioritySource = {
  key: SourceType
  label: string
}

export const PRIORITY_SOURCES: PrioritySource[] = [
  { key: 'peer-reviewed', label: 'Paper peer-reviewed' },
  { key: 'proceedings', label: 'Proceedings chính thức' },
  { key: 'author', label: 'Tài liệu tác giả' },
  { key: 'survey', label: 'Survey có nguồn rõ ràng' },
]

export type GapDirection = {
  letter: string
  label: string
}

export const GAP_DIRECTIONS: GapDirection[] = [
  { letter: 'A', label: 'Thuật toán tối ưu prompt' },
  { letter: 'B', label: 'Claim–evidence verifier' },
  { letter: 'C', label: 'Human-in-the-loop' },
  { letter: 'D', label: 'Kết hợp' },
  { letter: 'E', label: 'Other' },
]

export const BASE_GAP_DIRECTIONS = GAP_DIRECTIONS.filter((direction) => ['A', 'B', 'C'].includes(direction.letter))

export type ConflictExample = {
  claim: string
  evidence: string
  linkedSources: string[]
  reason: string
}

export const CONFLICT_EXAMPLE: ConflictExample = {
  claim: 'Phương pháp giảm unsupported claim',
  evidence: 'Kết quả thực nghiệm trên held-out data (đo bằng điểm tổng)',
  linkedSources: ['OPRO', 'TextGrad'],
  reason:
    'Claim này đã được xác nhận (CONFIRMED) ở Bước 2 dựa trên đánh giá nội bộ. Nhưng OPRO và TextGrad — 2 nghiên cứu vừa tìm được — đều chỉ ra rằng cách đo bằng "điểm tổng" không tách được lỗi theo từng claim và dễ bị bias, nên evidence hiện tại có thể chưa đủ chặt chẽ để giữ nguyên claim như cũ.',
}

export type ConflictResolution = {
  letter: string
  label: string
  description: string
}

export const CONFLICT_RESOLUTIONS: ConflictResolution[] = [
  { letter: 'A', label: 'Thu hẹp claim', description: 'Chỉ khẳng định phạm vi hẹp hơn, tránh claim quá rộng so với evidence hiện có.' },
  { letter: 'B', label: 'Đổi cách đo evidence', description: 'Chuyển sang đo ở mức claim-level thay vì điểm tổng để tránh đúng vấn đề đã bị chỉ ra.' },
  { letter: 'C', label: 'Hủy claim này', description: 'Không giữ claim này nữa, chuyển thành open question để xem xét sau.' },
  { letter: 'D', label: 'Other', description: 'Tự nhập hướng xử lý riêng.' },
]
