'use client'

import { useEffect, useState } from 'react'
import { CircleHelp, Lightbulb } from 'lucide-react'
import { BASE_GAP_DIRECTIONS, GAP_DIRECTIONS, type RelatedWork } from './data'

type GapPanelProps = {
  results: RelatedWork[]
  onSelectionChange: (hasSelection: boolean) => void
}

type GapAnalysis = {
  whatWasDone: string
  limitation: string
  whyItMatters: string
  testableWith: string
}

function buildGapAnalysis(results: RelatedWork[]): GapAnalysis | null {
  if (results.length === 0) return null
  const names = results.map((work) => work.name).join(', ')
  const feedbackTypes = Array.from(new Set(results.map((work) => work.feedbackType.toLowerCase())))
  const gaps = Array.from(new Set(results.map((work) => work.missingGap.toLowerCase())))
  return {
    whatWasDone: `${names} đã tối ưu prompt bằng ${feedbackTypes.join(' hoặc ')}.`,
    limitation: `Vẫn còn hạn chế: ${gaps.join('; ')}.`,
    whyItMatters:
      'Vì các phương pháp trên đo chất lượng ở mức tổng thể, không tách theo từng claim, nên khó xác định chính xác phần nào của output đang thiếu bằng chứng — làm giảm độ tin cậy khi áp dụng cho tác vụ cần độ chính xác cao.',
    testableWith: `So sánh baseline hiện có (${feedbackTypes.join(', ')}) với phương pháp claim-level feedback trên cùng tập dữ liệu, đo tỉ lệ unsupported claim.`,
  }
}

export function GapPanel({ results, onSelectionChange }: GapPanelProps) {
  const [selectedLetter, setSelectedLetter] = useState('')
  const [mainDirection, setMainDirection] = useState<string | null>(null)
  const [secondaryDirections, setSecondaryDirections] = useState<string[]>([])
  const [customDirection, setCustomDirection] = useState('')

  const isCombine = selectedLetter === 'D'
  const isOther = selectedLetter === 'E'
  const hasEvidence = results.length > 0
  const gapAnalysis = buildGapAnalysis(results)

  useEffect(() => {
    let hasSelection = false
    if (selectedLetter === 'A' || selectedLetter === 'B' || selectedLetter === 'C') hasSelection = true
    else if (selectedLetter === 'D') hasSelection = mainDirection !== null
    else if (selectedLetter === 'E') hasSelection = customDirection.trim().length > 0
    onSelectionChange(hasSelection)
  }, [selectedLetter, mainDirection, customDirection, onSelectionChange])

  function pickMain(letter: string) {
    setMainDirection(letter)
    setSecondaryDirections((prev) => prev.filter((item) => item !== letter))
  }

  function toggleSecondary(letter: string) {
    setSecondaryDirections((prev) => (prev.includes(letter) ? prev.filter((item) => item !== letter) : [...prev, letter]))
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

        {!hasEvidence ? (
          <p className="direction-locked">
            Cần có ít nhất 1 nghiên cứu liên quan trong bảng đối sánh mới đủ căn cứ để chọn hướng tập trung.
          </p>
        ) : (
          <>
            <div className="direction-options">
              {GAP_DIRECTIONS.map((direction) => (
                <button
                  key={direction.letter}
                  type="button"
                  className={selectedLetter === direction.letter ? 'direction-option selected' : 'direction-option'}
                  onClick={() => setSelectedLetter(direction.letter)}
                >
                  {direction.letter}. {direction.label}
                </button>
              ))}
            </div>

            {isCombine && (
              <div className="combine-picker">
                <p className="combine-label">Chọn contribution chính:</p>
                <div className="direction-options small">
                  {BASE_GAP_DIRECTIONS.map((direction) => (
                    <button
                      key={direction.letter}
                      type="button"
                      className={mainDirection === direction.letter ? 'direction-option selected' : 'direction-option'}
                      onClick={() => pickMain(direction.letter)}
                    >
                      {direction.letter}. {direction.label}
                    </button>
                  ))}
                </div>
                <p className="combine-label">Contribution phụ (có thể chọn nhiều):</p>
                <div className="direction-options small">
                  {BASE_GAP_DIRECTIONS.filter((direction) => direction.letter !== mainDirection).map((direction) => (
                    <button
                      key={direction.letter}
                      type="button"
                      className={
                        secondaryDirections.includes(direction.letter) ? 'direction-option selected' : 'direction-option'
                      }
                      onClick={() => toggleSecondary(direction.letter)}
                    >
                      {direction.letter}. {direction.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isOther && (
              <input
                type="text"
                className="direction-other-input"
                placeholder="Mô tả hướng bạn muốn tập trung..."
                value={customDirection}
                onChange={(e) => setCustomDirection(e.target.value)}
                aria-label="Hướng tự chọn"
              />
            )}
          </>
        )}

        <p className="gap-example">
          <Lightbulb size={17} />
          Ví dụ: vừa cải tiến prompt, vừa thêm verifier và bước xác nhận người dùng.
        </p>
      </div>
    </section>
  )
}
