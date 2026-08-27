'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, FileDown, FileText, Pencil } from 'lucide-react'

type ConfirmPanelProps = {
  specConfirmed: boolean
  onConfirm: () => void
}

export function ConfirmPanel({ specConfirmed, onConfirm }: ConfirmPanelProps) {
  const [pdfExported, setPdfExported] = useState(false)
  const [markdownExported, setMarkdownExported] = useState(false)

  return (
    <div className="mini-panel final-confirm">
      <h2 className="final-panel-title green-text">
        <CheckCircle2 size={20} />
        Xác nhận cuối cùng
      </h2>
      <div className="final-buttons">
        <button type="button" className="confirm-action" disabled={specConfirmed} onClick={onConfirm}>
          <CheckCircle2 size={16} />
          {specConfirmed ? 'Đã xác nhận spec' : 'Xác nhận spec'}
        </button>
        <Link href="/step-5" className="outline-action">
          <Pencil size={15} />
          Chỉnh sửa thêm
        </Link>
        <button
          type="button"
          className="outline-action"
          disabled={!specConfirmed}
          title={!specConfirmed ? 'Cần xác nhận spec trước khi xuất' : undefined}
          onClick={() => setPdfExported(true)}
        >
          <FileText size={15} />
          {pdfExported ? 'Đã xuất PDF' : 'Xuất PDF'}
        </button>
        <button
          type="button"
          className="outline-action"
          disabled={!specConfirmed}
          title={!specConfirmed ? 'Cần xác nhận spec trước khi xuất' : undefined}
          onClick={() => setMarkdownExported(true)}
        >
          <FileDown size={15} />
          {markdownExported ? 'Đã xuất Markdown' : 'Xuất Markdown'}
        </button>
      </div>
    </div>
  )
}
