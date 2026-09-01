import { CheckCircle2, FileText, FlaskConical, Sparkles, Target, type LucideIcon } from 'lucide-react'

export type SpecItem = { title: string; detail: string; fullContent: string[] }

export type JudgeInfo = { label: string; title: string; detail: string; icon: LucideIcon; type: string }

// `type` must match BE's PANEL_JUDGE_TYPES (backend/src/integrations/ai-payload-mapper.ts) —
// it's the value stored on JudgeIssue.judgeType, used to group issues back to the judge that raised them.
export const JUDGES: JudgeInfo[] = [
  { label: 'Judge 1:', title: 'Gap Judge', detail: 'Đánh giá khoảng trống & tính cần thiết của nghiên cứu.', icon: Target, type: 'gap' },
  { label: 'Judge 2:', title: 'Contribution Judge', detail: 'Đánh giá đóng góp mới & mức độ khác biệt của paper.', icon: Sparkles, type: 'contribution' },
  { label: 'Judge 3:', title: 'Experiment Judge', detail: 'Đánh giá thiết kế thí nghiệm & độ đáng tin cậy.', icon: FlaskConical, type: 'experiment' },
  { label: 'Judge 4:', title: 'Evidence Judge', detail: 'Đánh giá bằng chứng, phân tích & kết quả hỗ trợ claim.', icon: FileText, type: 'evidence' },
  {
    label: 'Judge 5:',
    title: 'Conference Readiness',
    detail: 'Đánh giá tính phù hợp & khả năng chấp nhận của conference.',
    icon: CheckCircle2,
    type: 'conference-readiness',
  },
]

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 3, MAJOR: 2, MINOR: 1 }

/** Worst (highest-rank) severity among a judge's still-unresolved issues, or null if none/unrecognized. */
export function worstSeverity(severities: string[]): string | null {
  let worst: string | null = null
  let worstRank = 0
  for (const severity of severities) {
    const rank = SEVERITY_RANK[severity.toUpperCase()] ?? 0
    if (rank > worstRank) {
      worstRank = rank
      worst = severity
    }
  }
  return worst
}

export type IssueChoice = { letter: string; label: string; understanding: string }

export type JudgeIssue = {
  id: string
  judgeType: string
  severity: string
  title: string
  description: string
  suggestion: string
  flaggedBy: string
  choices: IssueChoice[]
  status: string
}
