'use client'

import { useState } from 'react'
import { AlertTriangle, Check, CircleHelp, Lightbulb, Loader2 } from 'lucide-react'
import type { GapAnalysisResult } from './data'

const OTHER_LETTER = 'D'

type GapPanelProps = {
  gapAnalysis: GapAnalysisResult | null
  onSelectDirection: (letter: string, customDirection?: string) => Promise<void>
}

export function GapPanel({ gapAnalysis, onSelectDirection }: GapPanelProps) {
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOtherInput, setShowOtherInput] = useState(false)
  const [customDirection, setCustomDirection] = useState('')

  const otherDirection = gapAnalysis?.directions.find((d) => d.letter === OTHER_LETTER)

  async function handlePick(letter: string) {
    setShowOtherInput(false) // picking a real direction cancels any half-typed "Other" entry
    setSelecting(letter)
    setError(null)
    try {
      await onSelectDirection(letter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chọn hướng thất bại, thử lại.')
    } finally {
      setSelecting(null)
    }
  }

  async function handleConfirmOther() {
    const trimmed = customDirection.trim()
    if (!trimmed) return
    setSelecting(OTHER_LETTER)
    setError(null)
    try {
      await onSelectDirection(OTHER_LETTER, trimmed)
      setShowOtherInput(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chọn hướng thất bại, thử lại.')
    } finally {
      setSelecting(null)
    }
  }

  return (
    <section className="gap-panel">
      <div className="gap-card">
        <h2 className="mini-title purple-text">
          <Lightbulb size={17} />
          Research gap đề xuất
        </h2>
        {gapAnalysis ? (
          <dl className="gap-qa">
            <dt>Nghiên cứu trước đã làm được gì?</dt>
            <dd>{gapAnalysis.whatWasDone}</dd>
            <dt>Điểm nào vẫn còn hạn chế?</dt>
            <dd>{gapAnalysis.limitation}</dd>
            <dt>Vì sao hạn chế đó quan trọng?</dt>
            <dd>{gapAnalysis.whyItMatters}</dd>
            <dt>Có thể kiểm nghiệm bằng thí nghiệm nào?</dt>
            <dd>{gapAnalysis.testableWith}</dd>
          </dl>
        ) : (
          <p>Chưa có đủ nghiên cứu liên quan để xác định research gap — hãy tìm kiếm thêm ở bảng bên trái trước.</p>
        )}
      </div>
      <div className="direction-card">
        <h2 className="mini-title purple-text">
          <CircleHelp size={17} />
          Bạn muốn tập trung vào hướng nào?
        </h2>

        {!gapAnalysis || gapAnalysis.directions.length === 0 ? (
          <p className="direction-locked">
            Cần có ít nhất 1 nghiên cứu liên quan trong bảng đối sánh mới đủ căn cứ để chọn hướng tập trung.
          </p>
        ) : (
          <>
            <div className="direction-options">
              {gapAnalysis.directions
                .filter((direction) => direction.letter !== OTHER_LETTER)
                .map((direction) => (
                  <button
                    key={direction.letter}
                    type="button"
                    className={direction.selected ? 'direction-option selected' : 'direction-option'}
                    disabled={selecting !== null}
                    title={direction.description}
                    onClick={() => handlePick(direction.letter)}
                  >
                    {selecting === direction.letter ? <Loader2 className="spin-icon" size={14} /> : null}
                    {direction.letter}. {direction.label}
                  </button>
                ))}
              <button
                type="button"
                className={
                  otherDirection?.selected
                    ? 'direction-option selected'
                    : showOtherInput
                      ? 'direction-option is-editing'
                      : 'direction-option'
                }
                disabled={selecting !== null}
                onClick={() => setShowOtherInput((value) => !value)}
              >
                {OTHER_LETTER}. Other
              </button>
            </div>

            {(showOtherInput || otherDirection?.selected) && (
              <div className="combine-picker">
                <input
                  type="text"
                  className="direction-other-input"
                  placeholder="Mô tả hướng bạn muốn tập trung..."
                  value={otherDirection?.selected && !showOtherInput ? otherDirection.label : customDirection}
                  disabled={otherDirection?.selected && !showOtherInput}
                  onChange={(e) => setCustomDirection(e.target.value)}
                  aria-label="Hướng tự chọn"
                />
                {(!otherDirection?.selected || showOtherInput) && (
                  <button type="button" className="direction-other-confirm" disabled={selecting !== null} onClick={handleConfirmOther}>
                    {selecting === OTHER_LETTER ? <Loader2 className="spin-icon" size={13} /> : <Check size={13} />}
                    Xác nhận hướng tự chọn
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {error && (
          <p className="lock-note" role="alert">
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: 4 }} />
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
