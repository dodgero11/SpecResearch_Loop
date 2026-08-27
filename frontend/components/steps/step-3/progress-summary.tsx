import Link from 'next/link'
import { ArrowRight, Check, FileText, Sparkles } from 'lucide-react'

type ProgressSummaryProps = {
  hasResults: boolean
  hasDirection: boolean
  hasConflictResolved: boolean
}

export function ProgressSummary({ hasResults, hasDirection, hasConflictResolved }: ProgressSummaryProps) {
  const currentDone = hasResults && hasDirection && hasConflictResolved

  return (
    <section className="related-summary">
      <div className="summary-title">
        <span className="icon-box blue-soft">
          <FileText size={27} />
        </span>
        <strong>Tóm tắt sau vòng 3</strong>
      </div>
      <div className="steps">
        <div className="step done">
          <span>
            <Check size={22} />
          </span>
          <label>Ý tưởng</label>
        </div>
        <div className="connector done-line" />
        <div className="step done">
          <span>
            <Check size={22} />
          </span>
          <label>Làm rõ</label>
        </div>
        <div className={`connector ${currentDone ? 'done-line' : 'active-line'}`} />
        <div className={`step ${currentDone ? 'done' : 'current'}`}>
          <span>{currentDone ? <Check size={22} /> : '3&4'}</span>
          <label>
            Nghiên cứu liên quan
            <br />
            &amp; tìm Research Gap
          </label>
        </div>
        <div className={`connector ${currentDone ? 'active-line' : 'future-line'}`} />
        <div className={`step ${currentDone ? 'current' : 'future'}`}>
          <span>4</span>
          <label>Sang bước tiếp theo</label>
        </div>
      </div>
      {currentDone ? (
        <Link href="/step-4" className="next-step-cta compact">
          Xác nhận &amp; sang Bước 4
          <ArrowRight size={18} />
        </Link>
      ) : (
        <div className="hint">
          <Sparkles size={18} />
          <span>
            Chọn hướng tập trung và xử lý xong xung đột phát hiện được để mở khóa bước tiếp theo.
          </span>
        </div>
      )}
    </section>
  )
}
