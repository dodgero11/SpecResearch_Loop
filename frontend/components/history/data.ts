/** Maps a spec.data key to the step/panel where it gets written, for the diff summary. */
export const SECTION_LABELS: Record<string, string> = {
  relatedWork: 'Nghiên cứu liên quan (Bước 3)',
  gapAnalysis: 'Research Gap & hướng tập trung (Bước 3)',
  experimentPlan: 'Contribution & Kế hoạch thí nghiệm (Bước 4)',
  finalized: 'Chốt spec sau Judge (Bước 5)',
  finalConfirmed: 'Xác nhận Spec cuối (Bước 6)',
}

export type SpecVersion = {
  id: string
  version: number
  data: Record<string, unknown>
  createdAt: string
}

/** Coarse diff: which top-level sections of spec.data changed vs. the previous version. */
export function diffSections(current: Record<string, unknown>, previous: Record<string, unknown> | null): string[] {
  if (!previous) return ['Khởi tạo dự án (Bước 1 & 2)']
  const changed: string[] = []
  for (const key of Object.keys(SECTION_LABELS)) {
    if (JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
      changed.push(SECTION_LABELS[key])
    }
  }
  return changed.length > 0 ? changed : ['Cập nhật thẻ ý tưởng (Bước 2)']
}

type RelatedWorkEntry = { paper_title?: string; title?: string }
type GapAnalysisData = {
  limitation?: string
  directions?: { letter: string; label: string; selected?: boolean }[]
}
type ExperimentPlanData = {
  contributions?: { label: string }[]
  confirmed?: boolean
}

function summarizeRelatedWork(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return '(chưa có nghiên cứu nào)'
  const items = value as RelatedWorkEntry[]
  const titles = items.slice(0, 3).map((w) => w.paper_title ?? w.title ?? '(không tên)')
  const more = items.length > 3 ? `, +${items.length - 3} nghiên cứu khác` : ''
  return `${items.length} nghiên cứu: ${titles.join(', ')}${more}`
}

function summarizeGapAnalysis(value: unknown): string {
  const gap = value as GapAnalysisData | undefined
  if (!gap) return '(chưa có research gap)'
  const parts: string[] = []
  if (gap.limitation) parts.push(`Gap: "${gap.limitation}"`)
  const selected = gap.directions?.find((d) => d.selected)
  parts.push(selected ? `Hướng đã chọn: ${selected.letter}. ${selected.label}` : '(chưa chọn hướng)')
  return parts.join(' — ')
}

function summarizeExperimentPlan(value: unknown): string {
  const plan = value as ExperimentPlanData | undefined
  if (!plan || !plan.contributions || plan.contributions.length === 0) return '(chưa có contribution)'
  const labels = plan.contributions.slice(0, 2).map((c) => c.label).join(', ')
  const more = plan.contributions.length > 2 ? `, +${plan.contributions.length - 2} nữa` : ''
  return `${plan.contributions.length} contribution (${labels}${more}) — ${plan.confirmed ? 'đã xác nhận kế hoạch' : 'chưa xác nhận kế hoạch'}`
}

/** Turns one spec.data[key] value into a short human-readable line, for the old/new diff columns. */
export function summarizeSection(key: string, value: unknown): string {
  switch (key) {
    case 'relatedWork':
      return summarizeRelatedWork(value)
    case 'gapAnalysis':
      return summarizeGapAnalysis(value)
    case 'experimentPlan':
      return summarizeExperimentPlan(value)
    case 'finalized':
      return value ? 'Đã chốt spec sau Judge' : 'Chưa chốt'
    case 'finalConfirmed':
      return value ? 'Đã xác nhận Spec cuối' : 'Chưa xác nhận'
    default:
      return value === undefined ? '(trống)' : JSON.stringify(value)
  }
}

export type SectionDiff = {
  key: string
  label: string
  oldText: string
  newText: string
}

/** Side-by-side diff: for every changed section, the readable old value next to the new value. */
export function buildSectionDiffs(current: Record<string, unknown>, previous: Record<string, unknown> | null): SectionDiff[] {
  const diffs: SectionDiff[] = []
  for (const key of Object.keys(SECTION_LABELS)) {
    const curVal = current[key]
    const prevVal = previous ? previous[key] : undefined
    if (JSON.stringify(curVal) === JSON.stringify(prevVal)) continue
    diffs.push({
      key,
      label: SECTION_LABELS[key],
      oldText: previous ? summarizeSection(key, prevVal) : '(chưa tồn tại)',
      newText: summarizeSection(key, curVal),
    })
  }
  return diffs
}
