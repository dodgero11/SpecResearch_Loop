import Link from 'next/link'
import { ArrowRight, Check, FileText, Sparkles } from 'lucide-react'

type ProgressSummaryProps = {
  specConfirmed: boolean
}

export function ProgressSummary({ specConfirmed }: ProgressSummaryProps) {
  return (
    <section className="judge-summary">
      <div className="summary-title">
        <span className="icon-box blue-soft">
          <FileText size={27} />
        </span>
        <strong>Tóm tắt sau vòng 5</strong>
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
        <div className="connector done-line" />
        <div className="step done">
          <span>
            <Check size={22} />
          </span>
          <label>Xác nhận</label>
        </div>
        <div className={`connector ${specConfirmed ? 'done-line' : 'active-line'}`} />
        <div className={`step ${specConfirmed ? 'done' : 'current'}`}>
          <span>{specConfirmed ? <Check size={22} /> : '5'}</span>
          <label>Judge độc lập</label>
        </div>
        <div className={`connector ${specConfirmed ? 'active-line' : 'future-line'}`} />
        <div className={`step ${specConfirmed ? 'current' : 'future'}`}>
          <span>6</span>
          <label>Hoàn tất</label>
        </div>
      </div>
      {specConfirmed ? (
        <Link href="/step-6" className="next-step-cta compact">
          Xác nhận &amp; sang Bước 6
          <ArrowRight size={18} />
        </Link>
      ) : (
        <div className="hint">
          <Sparkles size={22} />
          <span>
            <strong>Gợi ý:</strong> Judge giúp phản biện độc lập; người dùng vẫn là người quyết định cuối cùng.
          </span>
        </div>
      )}
    </section>
  )
}
