export type ProjectSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  latestSpec: { id: string; version: number; createdAt: string } | null
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
