import { GitBranch, Plus } from 'lucide-react'

type ToolbarProps = {
  cardCount: number
  graphMode: boolean
  onToggleGraph: () => void
  onAddCardClick: () => void
}

export function Toolbar({ cardCount, graphMode, onToggleGraph, onAddCardClick }: ToolbarProps) {
  return (
    <section className="decomposition-toolbar">
      <div>
        <strong>{cardCount} thẻ ý tưởng</strong>
        <span> • Chọn trạng thái để xác nhận nội dung</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" className={graphMode ? 'view-toggle active' : 'view-toggle'} onClick={onToggleGraph}>
          <GitBranch size={17} />
          {graphMode ? 'Dạng danh sách' : 'Xem graph'}
        </button>
        <button type="button" className="add-card" onClick={onAddCardClick}>
          <Plus size={17} />
          Thêm thẻ
        </button>
      </div>
    </section>
  )
}
