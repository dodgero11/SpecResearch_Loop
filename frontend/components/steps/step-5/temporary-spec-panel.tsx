'use client'

import { useState } from 'react'
import { Eye, FileText } from 'lucide-react'
import type { SpecItem } from './data'
import { SpecDetailModal } from './spec-detail-modal'

type TemporarySpecPanelProps = {
  items: SpecItem[]
}

export function TemporarySpecPanel({ items }: TemporarySpecPanelProps) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <section className="mini-panel">
      <h2 className="mini-title purple-text">
        <FileText size={19} />
        Spec tạm thời
      </h2>
      <div className="spec-items">
        {items.map((item, index) => (
          <button type="button" key={item.title} onClick={() => setShowDetail(true)}>
            <span>{index + 1}</span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
      <button type="button" className="outline-action" onClick={() => setShowDetail(true)}>
        <Eye size={16} />
        Xem chi tiết Spec tạm thời
      </button>
      {showDetail && <SpecDetailModal items={items} onClose={() => setShowDetail(false)} />}
    </section>
  )
}
