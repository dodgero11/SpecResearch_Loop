import { Fragment } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, FileText, Sparkles } from 'lucide-react'
import type { FlowState } from './types'

type StepStatus = 'done' | 'current' | 'future'

function connectorClass(a: StepStatus, b: StepStatus) {
  if (a === 'done' && b === 'done') return 'connector done-line'
  if (a === 'done' && b === 'current') return 'connector active-line'
  return 'connector future-line'
}

export function ProgressSummary({ flow }: { flow: FlowState }) {
  const ideaStatus: StepStatus = flow.ideaAnalyzed ? 'done' : 'current'
  const understandingStatus: StepStatus = flow.understandingConfirmed
    ? 'done'
    : flow.ideaAnalyzed
      ? 'current'
      : 'future'
  const questionsStatus: StepStatus = flow.questionsConfirmed
    ? 'done'
    : flow.understandingConfirmed
      ? 'current'
      : 'future'
  const nextStepStatus: StepStatus = flow.questionsConfirmed ? 'current' : 'future'

  const steps: { label: string; status: StepStatus }[] = [
    { label: 'Ý tưởng', status: ideaStatus },
    { label: 'Làm rõ', status: understandingStatus },
    { label: 'Xác nhận', status: questionsStatus },
    { label: 'Sang bước tiếp theo', status: nextStepStatus },
  ]

  return (
    <section className="summary">
      <div className="summary-title">
        <span className="icon-box blue-soft">
          <FileText size={27} />
        </span>
        <strong>Tóm tắt sau vòng 1</strong>
      </div>
      <div className="steps">
        {steps.map((step, index) => (
          <Fragment key={step.label}>
            <div className={`step ${step.status === 'future' ? '' : step.status}`}>
              <span>{step.status === 'done' ? <Check size={22} /> : index + 1}</span>
              <label>{step.label}</label>
            </div>
            {index < steps.length - 1 && (
              <div className={connectorClass(step.status, steps[index + 1].status)} />
            )}
          </Fragment>
        ))}
      </div>
      {nextStepStatus === 'current' ? (
        <Link href="/step-2" className="next-step-cta">
          Xác nhận &amp; sang Bước 2
          <ArrowRight size={20} />
        </Link>
      ) : (
        <div className="hint">
          <Sparkles size={22} />
          <span>
            <strong>Gợi ý:</strong> Có thể chỉnh sửa ngay trong từng mục ở trên (bấm "Chỉnh sửa") nếu thấy chưa đúng —
            mục này chỉ hiển thị tiến độ, không dùng để sửa nội dung.
          </span>
        </div>
      )}
    </section>
  )
}
