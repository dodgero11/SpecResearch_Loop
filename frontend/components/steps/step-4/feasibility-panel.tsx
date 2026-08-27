'use client'

import { useState } from 'react'
import { AlertTriangle, Cpu } from 'lucide-react'
import { BASE_FEASIBILITY_CONFIG, type FieldRow } from './data'

type FeasibilityPanelProps = {
  selectedCount: number
  totalCount: number
}

export function FeasibilityPanel({ selectedCount, totalCount }: FeasibilityPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  const ratio = totalCount === 0 ? 1 : Math.max(selectedCount, 1) / totalCount
  const rounds = Math.max(3, Math.round(BASE_FEASIBILITY_CONFIG.rounds * ratio))
  const candidates = Math.max(3, Math.round(BASE_FEASIBILITY_CONFIG.candidatesPerRound * ratio))
  const vramGb = Math.max(12, Math.round(BASE_FEASIBILITY_CONFIG.vramGb * (0.7 + 0.3 * ratio)))
  const hoursLow = Math.max(4, Math.round(BASE_FEASIBILITY_CONFIG.hoursLow * ratio))
  const hoursHigh = Math.max(hoursLow + 2, Math.round(BASE_FEASIBILITY_CONFIG.hoursHigh * ratio))
  const tokensLowM = Math.max(1, Math.round(BASE_FEASIBILITY_CONFIG.tokensLowM * ratio))
  const tokensHighM = Math.max(tokensLowM + 1, Math.round(BASE_FEASIBILITY_CONFIG.tokensHighM * ratio))

  const stats: FieldRow[] = [
    { label: 'Model', value: BASE_FEASIBILITY_CONFIG.model },
    { label: 'Seed prompts', value: String(BASE_FEASIBILITY_CONFIG.seedPrompts) },
    { label: 'Candidates mỗi vòng', value: String(candidates) },
    { label: 'Số vòng', value: String(rounds) },
    { label: 'Dev set', value: `${BASE_FEASIBILITY_CONFIG.devSet} mẫu` },
    { label: 'Val set', value: `${BASE_FEASIBILITY_CONFIG.valSet} mẫu` },
    { label: 'Top-k đầy đủ', value: String(BASE_FEASIBILITY_CONFIG.topK) },
  ]

  const resources: FieldRow[] = [
    { label: 'VRAM', value: `~ ${vramGb} GB` },
    { label: 'Thời gian', value: `~ ${hoursLow}–${hoursHigh} giờ` },
    { label: 'Token', value: `~ ${tokensLowM}–${tokensHighM} triệu` },
    { label: 'Chi phí API', value: 'tùy chọn' },
  ]

  return (
    <section className="mini-panel feasibility-panel">
      <h2 className="mini-title purple-text">
        <Cpu size={20} />
        Kiểm tra tính khả thi (RTX 3090)
      </h2>
      <p className="feasibility-note">
        Ước tính dựa trên {selectedCount}/{totalCount} contribution đang giữ lại.
      </p>
      <div className="feasibility-stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.label}</strong>
            <span>{stat.value}</span>
          </div>
        ))}
      </div>
      <div className="resource-list">
        {resources.map((item) => (
          <div key={item.label}>
            <span>
              <Cpu size={17} />
              {item.label}
            </span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
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
