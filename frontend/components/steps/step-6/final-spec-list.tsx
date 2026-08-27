import { CheckCircle2, FileText, Target } from 'lucide-react'
import { SPEC_CHECKLIST, SPEC_GOAL } from './data'

export function FinalSpecList() {
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
        <p>{SPEC_GOAL}</p>
      </div>
    </section>
  )
}
