import { Sparkles } from 'lucide-react'
import { LLM_SUMMARY_STEPS } from './data'

export function LlmSummaryPanel() {
  return (
    <div className="mini-panel summary-method">
      <h2 className="final-panel-title green-text">
        <Sparkles size={20} />
        LLM tóm tắt cách làm
      </h2>
      {LLM_SUMMARY_STEPS.map((item, index) => (
        <div className="method-row" key={item}>
          <b>{index + 1}</b>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}
