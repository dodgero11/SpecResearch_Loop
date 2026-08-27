export type CardStatus = 'CONFIRMED' | 'PROPOSED' | 'MISSING' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'CONFLICT'

export const CARD_STATUSES: CardStatus[] = [
  'CONFIRMED',
  'PROPOSED',
  'MISSING',
  'AMBIGUOUS',
  'UNSUPPORTED',
  'CONFLICT',
]

export type DecompositionCard = {
  id: string
  type: string
  content: string
  status: CardStatus
  isSeed: boolean
  linkedIds: string[]
  reason: string
}

export const SUGGESTED_CARD_TYPES = [
  'Problem',
  'Research question',
  'Gap candidate',
  'Contribution',
  'Claim',
  'Evidence',
  'Constraint',
  'Open question',
]

export const initialCards: DecompositionCard[] = [
  {
    id: 'problem',
    type: 'Problem',
    content: 'Prompt thủ công có thể không ổn định',
    status: 'CONFIRMED',
    isSeed: true,
    linkedIds: [],
    reason: '',
  },
  {
    id: 'research-question',
    type: 'Research question',
    content: 'Tối ưu nhiều vòng có giảm unsupported claims không?',
    status: 'PROPOSED',
    isSeed: true,
    linkedIds: [],
    reason: '',
  },
  {
    id: 'gap-candidate',
    type: 'Gap candidate',
    content: 'Các phương pháp hiện tại chưa tối ưu trực tiếp ở mức claim–evidence',
    status: 'AMBIGUOUS',
    isSeed: true,
    linkedIds: [],
    reason:
      'Chưa rõ "tối ưu trực tiếp ở mức claim–evidence" nghĩa là gì cụ thể — cần làm rõ đây là đổi thuật toán tối ưu hay chỉ thêm bước hậu xử lý.',
  },
  {
    id: 'contribution',
    type: 'Contribution',
    content: 'Framework tối ưu prompt dựa trên evidence feedback',
    status: 'PROPOSED',
    isSeed: true,
    linkedIds: [],
    reason: '',
  },
  {
    id: 'claim',
    type: 'Claim',
    content: 'Phương pháp giảm unsupported claim',
    status: 'UNSUPPORTED',
    isSeed: true,
    linkedIds: [],
    reason: '',
  },
  {
    id: 'evidence',
    type: 'Evidence',
    content: 'Kết quả thực nghiệm trên held-out data',
    status: 'MISSING',
    isSeed: true,
    linkedIds: [],
    reason: '',
  },
  {
    id: 'constraint',
    type: 'Constraint',
    content: 'Chạy được trên RTX 3090',
    status: 'CONFIRMED',
    isSeed: true,
    linkedIds: [],
    reason: '',
  },
  {
    id: 'open-question',
    type: 'Open question',
    content: 'Tối ưu một prompt hay cả pipeline?',
    status: 'CONFLICT',
    isSeed: true,
    linkedIds: [],
    reason:
      'Mâu thuẫn với Contribution đang mô tả "framework tối ưu prompt" (ngụ ý chỉ 1 prompt), trong khi câu hỏi này đặt vấn đề có thể là tối ưu cả pipeline.',
  },
]
