import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export function CreativePanel() {
  return (
    <section className="creative-panel">
      <div className="creative-icon">
        <Sparkles size={24} />
      </div>
      <div>
        <strong>Khuyến khích sáng tạo</strong>
        <p>Biểu diễn các thẻ thành graph, kéo thả để liên kết claim với evidence, hoặc đề xuất loại thẻ phù hợp với domain.</p>
      </div>
      <Link href="/" className="secondary-action">
        Quay lại bước 1
      </Link>
    </section>
  )
}
