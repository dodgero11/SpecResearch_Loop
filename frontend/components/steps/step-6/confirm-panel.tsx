'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, FileDown, FileJson, FilePlus2, FileText, Loader2, Pencil } from 'lucide-react'

type ConfirmPanelProps = {
  specConfirmed: boolean
  onConfirm: () => Promise<void>
  onExportPdf: () => Promise<void>
  onExportMarkdown: () => void
  onExportJson: () => void
  onCreateNewProject: () => Promise<void>
}

export function ConfirmPanel({ specConfirmed, onConfirm, onExportPdf, onExportMarkdown, onExportJson, onCreateNewProject }: ConfirmPanelProps) {
  const [confirming, setConfirming] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreateNewProject() {
    setCreatingProject(true)
    setCreateError(null)
    try {
      await onCreateNewProject()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Tạo dự án mới thất bại, thử lại.')
      setCreatingProject(false)
    }
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      await onConfirm()
    } finally {
      setConfirming(false)
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true)
    try {
      await onExportPdf()
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="mini-panel final-confirm">
      <h2 className="final-panel-title green-text">
        <CheckCircle2 size={20} />
        Xác nhận cuối cùng
      </h2>
      <div className="final-buttons">
        <button type="button" className="confirm-action" disabled={specConfirmed || confirming} onClick={handleConfirm}>
          {confirming ? <Loader2 className="spin-icon" size={16} /> : <CheckCircle2 size={16} />}
          {specConfirmed ? 'Đã xác nhận spec' : confirming ? 'Đang xác nhận...' : 'Xác nhận spec'}
        </button>
        <Link href="/step-5" className="outline-action">
          <Pencil size={15} />
          Chỉnh sửa thêm
        </Link>
        <button
          type="button"
          className="outline-action"
          disabled={!specConfirmed || exportingPdf}
          title={!specConfirmed ? 'Cần xác nhận spec trước khi xuất' : undefined}
          onClick={handleExportPdf}
        >
          {exportingPdf ? <Loader2 className="spin-icon" size={15} /> : <FileText size={15} />}
          {exportingPdf ? 'Đang xuất...' : 'Xuất PDF'}
        </button>
        <button
          type="button"
          className="outline-action"
          disabled={!specConfirmed}
          title={!specConfirmed ? 'Cần xác nhận spec trước khi xuất' : undefined}
          onClick={onExportMarkdown}
        >
          <FileDown size={15} />
          Xuất Markdown
        </button>
        <button
          type="button"
          className="outline-action"
          disabled={!specConfirmed}
          title={!specConfirmed ? 'Cần xác nhận spec trước khi xuất' : undefined}
          onClick={onExportJson}
        >
          <FileJson size={15} />
          Xuất JSON
        </button>
      </div>

      {specConfirmed && (
        <div className="new-project-row">
          <p>{createError ?? 'Đã chốt xong dự án này. Muốn bắt đầu nghiên cứu mới?'}</p>
          <button type="button" className="outline-action" disabled={creatingProject} onClick={handleCreateNewProject}>
            {creatingProject ? <Loader2 className="spin-icon" size={15} /> : <FilePlus2 size={15} />}
            {creatingProject ? 'Đang tạo...' : 'Tạo dự án mới'}
          </button>
        </div>
      )}
    </div>
  )
}
