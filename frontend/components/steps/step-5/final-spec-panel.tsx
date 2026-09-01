import { CheckCircle2 } from 'lucide-react'
import type { JudgeIssue } from './data'

type FinalSpecPanelProps = {
  issues: JudgeIssue[]
  resolvedIds: string[]
  confirmed: boolean
  onConfirm: () => void
}

export function FinalSpecPanel({ issues, resolvedIds, confirmed, onConfirm }: FinalSpecPanelProps) {
  const total = issues.length
  const resolvedCount = resolvedIds.length
  const allResolved = resolvedCount === total
  const resolvedIssues = issues.filter((issue) => resolvedIds.includes(issue.id))

  return (
    <div className="mini-panel final-spec">
      <h2 className="mini-title green-text">
        <CheckCircle2 size={20} />
        Spec cuối cùng
      </h2>
      <p className="final-spec-progress">
        Đã xử lý {resolvedCount}/{total} issue
      </p>
      {resolvedIssues.length === 0 ? (
        <p className="final-spec-empty">
          {total === 0 ? 'Chưa có issue nào — có thể xác nhận spec cuối ngay.' : 'Chưa xử lý issue nào — chọn hướng xử lý ở khung bên trên rồi bấm xác nhận.'}
        </p>
      ) : (
        <ul>
          {resolvedIssues.map((issue) => (
            <li key={issue.id}>{issue.title}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="confirm-action"
        disabled={!allResolved}
        title={!allResolved ? 'Cần xử lý hết tất cả issue trước khi xác nhận spec cuối' : undefined}
        onClick={onConfirm}
      >
        <CheckCircle2 size={17} />
        {confirmed ? 'Đã xác nhận Spec cuối' : 'Xác nhận & xuất Spec cuối'}
      </button>
    </div>
  )
}
