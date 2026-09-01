'use client'

import { useState } from 'react'
import { AlertTriangle, Cpu } from 'lucide-react'
import type { Feasibility } from './data'

type FeasibilityPanelProps = {
  feasibility: Feasibility | null
  selectedCount: number
  totalCount: number
}

export function FeasibilityPanel({ feasibility, selectedCount, totalCount }: FeasibilityPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <section className="mini-panel feasibility-panel">
      <h2 className="mini-title purple-text">
        <Cpu size={20} />
        Kiểm tra tính khả thi (RTX 3090)
      </h2>
      <p className="feasibility-note">
        Ước tính dựa trên {selectedCount}/{totalCount} contribution đang giữ lại.
      </p>

      {!feasibility ? (
        <p className="claim-empty">Cần giữ lại ít nhất 1 contribution để ước tính tính khả thi.</p>
      ) : (
        <>
          <div className="feasibility-stats">
            <div>
              <strong>Model</strong>
              <span>{feasibility.model || '—'}</span>
            </div>
            <div>
              <strong>Seed prompts</strong>
              <span>{feasibility.seedPrompts}</span>
            </div>
            <div>
              <strong>Candidates</strong>
              <span>{feasibility.candidates}</span>
            </div>
            <div>
              <strong>Số vòng</strong>
              <span>{feasibility.rounds}</span>
            </div>
          </div>
          <div className="resource-list">
            <div>
              <span>
                <Cpu size={17} />
                VRAM
              </span>
              <strong>~ {feasibility.vram} GB</strong>
            </div>
            <div>
              <span>
                <Cpu size={17} />
                Thời gian
              </span>
              <strong>~ {feasibility.hours.toFixed(1)} giờ</strong>
            </div>
            <div>
              <span>
                <Cpu size={17} />
                Token
              </span>
              <strong>~ {(feasibility.tokens / 1_000_000).toFixed(1)} triệu</strong>
            </div>
            <div>
              <span>
                <Cpu size={17} />
                Khả thi?
              </span>
              <strong>{feasibility.isFeasible ? 'Có' : 'Không'}</strong>
            </div>
          </div>
          {feasibility.explanation && <p className="conflict-note">{feasibility.explanation}</p>}
        </>
      )}

      <button type="button" className="warning-box" onClick={() => setAcknowledged(!acknowledged)}>
        <AlertTriangle size={23} />
        <span>
          {acknowledged
            ? 'Đã ghi nhận: ưu tiên giảm candidate trước khi giảm số vòng.'
            : 'Nếu vượt tài nguyên, hệ thống gợi ý giảm số candidate hoặc số vòng.'}
        </span>
      </button>
    </section>
  )
}
