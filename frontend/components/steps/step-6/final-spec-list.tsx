import { CheckCircle2, FileText, Target } from 'lucide-react'
import { SPEC_CHECKLIST } from './data'

type FinalSpecListProps = {
  goal: string
}

export function FinalSpecList({ goal }: FinalSpecListProps) {
  return (
    <section className="mini-panel spec-document">
      <h2 className="final-panel-title">
        <FileText size={20} />
        Bản đặc tả nghiên cứu cuối
      </h2>
      <div className="final-section-list">
        {SPEC_CHECKLIST.map((item, index) => (
          <div key={item}>
            <CheckCircle2 size={17} />
            <span>
              {index + 1}. &nbsp;{item}
            </span>
          </div>
        ))}
      </div>
      <div className="final-focus">
        <Target size={28} />
        <p>{goal || 'Chưa có contribution nào được chọn ở Bước 4.'}</p>
      </div>
    </section>
  )
}
