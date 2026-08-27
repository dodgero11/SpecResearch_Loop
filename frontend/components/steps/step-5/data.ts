import { CheckCircle2, FileText, FlaskConical, Sparkles, Target, type LucideIcon } from 'lucide-react'

export type SpecItem = { title: string; detail: string; fullContent: string[] }

export const SPEC_ITEMS: SpecItem[] = [
  {
    title: 'Problem Statement',
    detail: 'Mô tả vấn đề và bối cảnh nghiên cứu.',
    fullContent: [
      'Prompt thủ công để trích xuất thông tin từ paper khoa học thường không ổn định, dễ khiến LLM tạo ra thông tin không có trong tài liệu nguồn (hallucination).',
      'Cần một phương pháp tối ưu prompt tự động qua nhiều vòng, có khả năng kiểm tra claim với evidence rõ ràng thay vì chỉ dựa vào điểm tổng.',
    ],
  },
  {
    title: 'Research Gap',
    detail: 'Khoảng trống nghiên cứu cần giải quyết.',
    fullContent: [
      'OPRO, PromptBreeder, TextGrad và DSPy đều tối ưu prompt bằng điểm tổng hoặc textual feedback ở mức toàn cục.',
      'Chưa có phương pháp nào tách output thành từng claim, kiểm tra evidence độc lập cho từng claim và dùng lỗi claim-level làm tín hiệu feedback trong cùng ngân sách inference.',
    ],
  },
  {
    title: 'Contributions',
    detail: 'Những đóng góp chính của paper.',
    fullContent: [
      '1. Framework tối ưu prompt nhiều vòng dựa trên evidence feedback.',
      '2. Verifier phân loại claim có / thiếu / mâu thuẫn với evidence.',
      '3. Thực nghiệm so sánh scalar feedback, textual feedback và claim-level feedback.',
      '4. Cấu hình khả thi chạy được với ngân sách GPU giới hạn (RTX 3090).',
    ],
  },
  {
    title: 'Claim–Evidence Matrix',
    detail: 'Bảng ánh xạ claim và bằng chứng.',
    fullContent: [
      'Claim: giảm tỉ lệ claim không có bằng chứng so với baseline Zero-shot CoT (GPT-4o).',
      'Metric: tỉ lệ unsupported claims (%). Evidence: giảm ≥ 20% trên val set (300 mẫu), p < 0.05.',
      'Điều kiện bác bỏ: không đạt cải thiện ≥ 10% hoặc không có ý nghĩa thống kê.',
    ],
  },
  {
    title: 'Experimental Protocol',
    detail: 'Thiết kế thí nghiệm & chi tiết thực thi.',
    fullContent: [
      'TN1 So sánh baseline · TN2 Đánh giá chất lượng · TN3 Ablation study · TN4 Generalization · TN5 Efficiency study.',
      'Tất cả thí nghiệm dùng cùng model, dataset và token budget để đảm bảo so sánh công bằng.',
    ],
  },
  {
    title: 'Compute Budget',
    detail: 'Ngân sách compute & tài nguyên.',
    fullContent: [
      'Model 7B–8B (4-bit) · 5 seed prompts · 10 candidates/vòng · 10 vòng.',
      'Ước tính ~20 GB VRAM, 12–18 giờ chạy, 3–6 triệu token trên RTX 3090.',
    ],
  },
]

export type JudgeInfo = { label: string; title: string; detail: string; icon: LucideIcon }

export const JUDGES: JudgeInfo[] = [
  {
    label: 'Judge 1:',
    title: 'Gap Judge',
    detail: 'Đánh giá khoảng trống & tính cần thiết của nghiên cứu.',
    icon: Target,
  },
  {
    label: 'Judge 2:',
    title: 'Contribution Judge',
    detail: 'Đánh giá đóng góp mới & mức độ khác biệt của paper.',
    icon: Sparkles,
  },
  {
    label: 'Judge 3:',
    title: 'Experiment Judge',
    detail: 'Đánh giá thiết kế thí nghiệm & độ đáng tin cậy.',
    icon: FlaskConical,
  },
  {
    label: 'Judge 4:',
    title: 'Evidence Judge',
    detail: 'Đánh giá bằng chứng, phân tích & kết quả hỗ trợ claim.',
    icon: FileText,
  },
  {
    label: 'Judge 5:',
    title: 'Conference Readiness',
    detail: 'Đánh giá tính phù hợp & khả năng chấp nhận của conference.',
    icon: CheckCircle2,
  },
]

export type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR'

export type IssueChoice = { letter: string; label: string; understanding: string }

export type JudgeIssue = {
  severity: Severity
  title: string
  description: string
  suggestion: string
  flaggedBy: string
  choices: IssueChoice[]
}

export const JUDGE_ISSUES: JudgeIssue[] = [
  {
    severity: 'CRITICAL',
    title: 'Thiếu hidden test',
    description: 'Thiếu đánh giá tổng quát trên dữ liệu unseen.',
    suggestion: 'Bổ sung tập đánh giá trên dữ liệu chưa từng dùng khi tối ưu (hidden/unseen set).',
    flaggedBy: 'J1, J3, J4',
    choices: [
      {
        letter: 'A',
        label: 'Bổ sung hidden test',
        understanding:
          'Hệ thống hiểu rằng bạn muốn thêm 1 tập đánh giá hoàn toàn chưa dùng khi tối ưu, để kiểm tra khả năng tổng quát thật sự trước khi kết luận.',
      },
      {
        letter: 'B',
        label: 'Ghi rõ giới hạn phạm vi',
        understanding:
          'Hệ thống hiểu rằng bạn muốn giữ nguyên thí nghiệm hiện có, nhưng nêu rõ trong Risks & Limitations rằng chưa đánh giá trên hidden test.',
      },
      {
        letter: 'C',
        label: 'Hoãn kết luận tổng quát',
        understanding:
          'Hệ thống hiểu rằng bạn muốn chuyển claim tổng quát hiện tại thành open question, chờ có hidden test mới kết luận.',
      },
      { letter: 'D', label: 'Other', understanding: '' },
    ],
  },
  {
    severity: 'MAJOR',
    title: 'Claim tổng quát quá rộng',
    description: 'Claim hiện tại bao phủ quá nhiều khía cạnh.',
    suggestion: 'Thu hẹp claim hoặc bổ sung thêm domain ngoài paper khoa học.',
    flaggedBy: 'J1, J2, J5',
    choices: [
      {
        letter: 'A',
        label: 'Thu hẹp claim',
        understanding:
          'Hệ thống hiểu rằng bạn muốn thu hẹp claim để tập trung vào phạm vi hẹp hơn trong domain paper-science, loại bỏ các khía cạnh ngoài phạm vi.',
      },
      {
        letter: 'B',
        label: 'Mở rộng thí nghiệm',
        understanding:
          'Hệ thống hiểu rằng bạn muốn bổ sung thêm thí nghiệm (VD domain tài chính hoặc bất động sản) để hỗ trợ claim hiện tại thay vì thu hẹp phạm vi.',
      },
      {
        letter: 'C',
        label: 'Chuyển thành research question',
        understanding:
          'Hệ thống hiểu rằng bạn muốn hạ claim xuống thành câu hỏi nghiên cứu mở, chưa khẳng định chắc chắn trước khi có thêm bằng chứng.',
      },
      { letter: 'D', label: 'Other', understanding: '' },
    ],
  },
  {
    severity: 'MAJOR',
    title: 'Thiếu baseline TextGrad',
    description: 'Cần bổ sung baseline TextGrad để so sánh.',
    suggestion: 'Thêm TextGrad làm baseline so sánh trong TN1 (So sánh baseline).',
    flaggedBy: 'J3, J4',
    choices: [
      {
        letter: 'A',
        label: 'Thêm baseline TextGrad',
        understanding: 'Hệ thống hiểu rằng bạn muốn bổ sung TextGrad vào TN1 để so sánh công bằng với baseline khác.',
      },
      {
        letter: 'B',
        label: 'Giải thích lý do bỏ qua',
        understanding:
          'Hệ thống hiểu rằng bạn muốn giữ nguyên TN1, nhưng ghi rõ lý do không so sánh TextGrad (VD khác điều kiện thí nghiệm).',
      },
      {
        letter: 'C',
        label: 'Thay bằng baseline khác',
        understanding: 'Hệ thống hiểu rằng bạn muốn dùng 1 baseline khác thay thế nếu TextGrad không phù hợp.',
      },
      { letter: 'D', label: 'Other', understanding: '' },
    ],
  },
  {
    severity: 'MINOR',
    title: 'Chưa ghi rõ token budget',
    description: 'Chưa nêu rõ giới hạn token cho từng mô hình.',
    suggestion: 'Ghi rõ giới hạn token cho từng model trong phần Compute Budget.',
    flaggedBy: 'J3, J5',
    choices: [
      {
        letter: 'A',
        label: 'Bổ sung số liệu',
        understanding: 'Hệ thống hiểu rằng bạn muốn ghi rõ giới hạn token cho từng model trong phần Compute Budget.',
      },
      {
        letter: 'B',
        label: 'Dùng giá trị mặc định',
        understanding:
          'Hệ thống hiểu rằng bạn muốn áp dụng token budget mặc định của model, ghi chú rõ trong spec thay vì tự đặt số riêng.',
      },
      {
        letter: 'C',
        label: 'Để mở, theo dõi thực tế',
        understanding: 'Hệ thống hiểu rằng bạn không muốn giới hạn cứng, sẽ theo dõi token thực tế khi chạy thí nghiệm.',
      },
      { letter: 'D', label: 'Other', understanding: '' },
    ],
  },
]
