import { FlaskConical, Loader2 } from 'lucide-react'
import type { ExperimentRow } from './data'

type ExperimentPanelProps = {
  rows: ExperimentRow[]
  selectedContributionIds: string[]
  generatingLabel?: string
}

export function ExperimentPanel({ rows, selectedContributionIds, generatingLabel }: ExperimentPanelProps) {
  return (
    <section className="mini-panel experiment-panel">
      <h2 className="mini-title green-text">
        <FlaskConical size={20} />
        Kế hoạch thí nghiệm
      </h2>
      {rows.map((row) => {
        const isGeneral = row.relatedContributionIds.length === 0
        const isActive = isGeneral || row.relatedContributionIds.some((id) => selectedContributionIds.includes(id))

        return (
          <article className={isActive ? 'experiment-row' : 'experiment-row is-inactive'} key={row.code}>
            <span className="test-code">{row.code}</span>
            <strong>{row.title}</strong>
            <ul>
              {row.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            {!isActive && (
              <p className="experiment-row-note">
                Contribution liên quan đã bị bỏ chọn — có thể không cần chạy thí nghiệm này nữa.
              </p>
            )}
          </article>
        )
      })}
      {generatingLabel && (
        <article className="experiment-row experiment-row-generating">
          <span className="test-code">
            <Loader2 size={16} className="spin-icon" />
          </span>
          <strong>Đang tạo thí nghiệm...</strong>
          <p className="experiment-row-note">Hệ thống đang sinh thí nghiệm kiểm chứng cho "{generatingLabel}".</p>
        </article>
      )}
    </section>
  )
}
