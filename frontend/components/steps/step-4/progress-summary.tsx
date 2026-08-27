import Link from 'next/link'
import { ArrowRight, Check, FileText, Sparkles } from 'lucide-react'

type ProgressSummaryProps = {
  planConfirmed: boolean
}

export function ProgressSummary({ planConfirmed }: ProgressSummaryProps) {
  return (
    <section className="experiment-summary">
      <div className="summary-title">
        <span className="icon-box blue-soft">
          <FileText size={27} />
        </span>
        <strong>Tóm tắt sau vòng 4</strong>
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
        <div className={`connector ${planConfirmed ? 'done-line' : 'active-line'}`} />
        <div className={`step ${planConfirmed ? 'done' : 'current'}`}>
          <span>{planConfirmed ? <Check size={22} /> : '4'}</span>
          <label>
            Contribution
            <br />
            &amp; Kế hoạch thí nghiệm
          </label>
        </div>
        <div className={`connector ${planConfirmed ? 'active-line' : 'future-line'}`} />
        <div className={`step ${planConfirmed ? 'current' : 'future'}`}>
          <span>5</span>
          <label>Sang bước tiếp theo</label>
        </div>
      </div>
      {planConfirmed ? (
        <Link href="/step-5" className="next-step-cta compact">
          Xác nhận &amp; sang Bước 5
          <ArrowRight size={18} />
        </Link>
      ) : (
        <div className="hint">
          <Sparkles size={22} />
          <span>
            <strong>Gợi ý:</strong> Mỗi contribution nên gắn với ít nhất một thí nghiệm cụ thể.
          </span>
        </div>
      )}
    </section>
  )
}
