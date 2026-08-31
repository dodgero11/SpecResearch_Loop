'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, Check, Lightbulb, Loader2, Pencil, Tag } from 'lucide-react'
import { DEFAULT_IDEA, IDEA_TAGS } from './data'
import type { Understanding } from './types'

type AnalysisStatus = 'idle' | 'analyzing' | 'done'

type IdeaPanelProps = {
  onAnalyze: (idea: string) => Promise<Understanding>
  /** Called when the user unlocks the box to edit an already-analyzed idea — the
   * parent should clear the now-stale understanding/questions built from the old text. */
  onEditAgain?: () => void
  /** Idea text + analyzed flag restored from GET /summary, once that finishes loading. */
  restoredIdea?: string
  restoredAnalyzed?: boolean
}

export function IdeaPanel({ onAnalyze, onEditAgain, restoredIdea, restoredAnalyzed }: IdeaPanelProps) {
  const [idea, setIdea] = useState(DEFAULT_IDEA)
  const [focused, setFocused] = useState(false)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (restoredIdea) setIdea(restoredIdea)
    if (restoredAnalyzed) setStatus('done')
    // Only meant to run once, right after the summary finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredIdea, restoredAnalyzed])

  async function handleAnalyze() {
    setStatus('analyzing')
    setError(null)
    try {
      await onAnalyze(idea)
      setStatus('done')
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Phân tích ý tưởng thất bại, thử lại.')
    }
  }

  function handleEditAgain() {
    setStatus('idle')
    setError(null)
    onEditAgain?.()
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
          disabled={status === 'done'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setIdea(e.target.value)}
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
      {error && (
        <div className="lock-note" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
      {status === 'done' ? (
        <button className="edit-action" type="button" onClick={handleEditAgain}>
          <Pencil size={16} />
          Phân tích lại
        </button>
      ) : (
        <button
          className="primary-action"
          type="button"
          disabled={status === 'analyzing' || idea.trim().length === 0}
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
        </button>
      )}
    </section>
  )
}
