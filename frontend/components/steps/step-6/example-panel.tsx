import { BookOpen } from 'lucide-react'

type ExamplePanelProps = {
  before: string
  after: string
}

export function ExamplePanel({ before, after }: ExamplePanelProps) {
  return (
    <div className="mini-panel example-panel">
      <h2 className="final-panel-title blue-text">
        <BookOpen size={20} />
        Ví dụ dễ hiểu
      </h2>
      <div className="example-box">
        <b>Trước</b>
        <span>{before || '(chưa có ý tưởng ban đầu)'}</span>
      </div>
      <div className="example-box after">
        <b>Sau</b>
        <span>{after || '(chưa có contribution nào được chọn)'}</span>
      </div>
    </div>
  )
}
