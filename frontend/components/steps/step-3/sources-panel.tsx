import { CircleHelp } from 'lucide-react'
import { PRIORITY_SOURCES, type SourceType } from './data'

type SourcesPanelProps = {
  activeSources: SourceType[]
  onToggle: (source: SourceType) => void
}

export function SourcesPanel({ activeSources, onToggle }: SourcesPanelProps) {
  return (
    <div className="mini-panel sources-panel">
      <h2 className="mini-title">
        <span className="stack-icon">◆</span>
        Nguồn ưu tiên <CircleHelp size={14} />
      </h2>
      {PRIORITY_SOURCES.map((source) => (
        <label className="source-row" key={source.key}>
          <input type="checkbox" checked={activeSources.includes(source.key)} onChange={() => onToggle(source.key)} />
          {source.label}
        </label>
      ))}
    </div>
  )
}
