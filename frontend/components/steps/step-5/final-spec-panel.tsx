import { CheckCircle2 } from 'lucide-react'
import { JUDGE_ISSUES } from './data'

type FinalSpecPanelProps = {
  resolvedTitles: string[]
  confirmed: boolean
  onConfirm: () => void
}

export function FinalSpecPanel({ resolvedTitles, confirmed, onConfirm }: FinalSpecPanelProps) {
  const total = JUDGE_ISSUES.length
  const resolvedCount = resolvedTitles.length
  const allResolved = resolvedCount === total

  return (
    <div className="mini-panel final-spec">
      <h2 className="mini-title green-text">
        <CheckCircle2 size={20} />
        Spec cuối cùng
      </h2>
      <p className="final-spec-progress">
        Đã xử lý {resolvedCount}/{total} issue
      </p>
      {resolvedTitles.length === 0 ? (
        <p className="final-spec-empty">Chưa xử lý issue nào — chọn hướng xử lý ở khung bên trên rồi bấm xác nhận.</p>
      ) : (
        <ul>
          {resolvedTitles.map((title) => (
            <li key={title}>{title}</li>
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
