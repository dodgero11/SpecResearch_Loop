import { Check } from 'lucide-react'

const STEPS = ['Nhập ý tưởng', 'Làm rõ', 'Nghiên cứu', 'Contribution & Kế hoạch thí nghiệm', 'Judge', 'Spec cuối']

function Logo() {
  return (
    <div className="brand-mark" aria-label="SpecResearch Loop">
      <span className="loop loop-left" />
      <span className="loop loop-right" />
    </div>
  )
}

export function FinalStepper() {
  return (
    <div className="final-stepper">
      <div className="final-brand">
        <Logo />
        <span>SpecResearch Loop</span>
      </div>
      <div className="final-steps">
        {STEPS.map((label, index) => (
          <div className={index === STEPS.length - 1 ? 'final-step active' : 'final-step'} key={label}>
            <span>{index === STEPS.length - 1 ? STEPS.length : <Check size={14} />}</span>
            {index + 1}. {label}
          </div>
        ))}
      </div>
    </div>
  )
}
