import { Folder } from 'lucide-react'
import { ComingSoon } from '@/components/research-loop/coming-soon'

export default function ProjectsPage() {
  return (
    <ComingSoon
      title="Dự án"
      icon={Folder}
      description="Đây sẽ là nơi quản lý nhiều dự án nghiên cứu cùng lúc."
    />
  )
}
