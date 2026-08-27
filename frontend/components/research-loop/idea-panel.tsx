'use client'

import { useState } from 'react'
import { BarChart3, Check, Lightbulb, Loader2, Pencil, Tag } from 'lucide-react'
import { DEFAULT_IDEA, IDEA_TAGS } from './data'

type AnalysisStatus = 'idle' | 'analyzing' | 'done'

type IdeaPanelProps = {
  onAnalyzed: (done: boolean) => void
}

export function IdeaPanel({ onAnalyzed }: IdeaPanelProps) {
  const [idea, setIdea] = useState(DEFAULT_IDEA)
  const [focused, setFocused] = useState(false)
  const [status, setStatus] = useState<AnalysisStatus>('idle')

  function handleIdeaChange(value: string) {
    setIdea(value)
    if (status !== 'idle') {
      setStatus('idle')
      onAnalyzed(false)
    }
  }

  function handleAnalyze() {
    setStatus('analyzing')
    setTimeout(() => {
      setStatus('done')
      onAnalyzed(true)
    }, 1600)
  }

  return (
    <section className="panel idea-panel">
      <h2 className="panel-title blue">
        <span className="icon-box blue-soft">
          <Lightbulb size={25} />
        </span>
        Ý tưởng ban đầu
      </h2>
      <div className="idea-input-wrap">
        <textarea
          aria-label="Ý tưởng nghiên cứu"
          value={focused ? idea : `“  ${idea}  ”`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => handleIdeaChange(e.target.value)}
        />
        <Pencil className="edit-icon" size={21} />
      </div>
      <div className="tags">
        {IDEA_TAGS.map((tag) => (
          <button className="tag" type="button" key={tag}>
            <Tag size={16} />
            {tag}
          </button>
        ))}
      </div>
      {status === 'done' && (
        <div className="analysis-done-banner" role="status">
          <Check size={18} />
          Đã phân tích xong ý tưởng của bạn.
        </div>
      )}
      <button
        className={`primary-action ${status === 'done' ? 'is-done' : ''}`}
        type="button"
        disabled={status === 'analyzing'}
        onClick={handleAnalyze}
      >
        {status === 'idle' && (
          <>
            <BarChart3 size={23} />
            Phân tích ý tưởng
          </>
        )}
        {status === 'analyzing' && (
          <>
            <Loader2 className="spin-icon" size={23} />
            Đang phân tích...
          </>
        )}
        {status === 'done' && (
          <>
            <Check size={23} />
            Đã phân tích xong
          </>
        )}
      </button>
    </section>
  )
}
