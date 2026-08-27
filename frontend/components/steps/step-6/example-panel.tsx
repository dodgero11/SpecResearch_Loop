import { BookOpen } from 'lucide-react'
import { BEFORE_AFTER_EXAMPLE } from './data'

export function ExamplePanel() {
  return (
    <div className="mini-panel example-panel">
      <h2 className="final-panel-title blue-text">
        <BookOpen size={20} />
        Ví dụ dễ hiểu
      </h2>
      <div className="example-box">
        <b>Trước</b>
        <span>{BEFORE_AFTER_EXAMPLE.before}</span>
      </div>
      <div className="example-box after">
        <b>Sau</b>
        <span>{BEFORE_AFTER_EXAMPLE.after}</span>
      </div>
    </div>
  )
}
