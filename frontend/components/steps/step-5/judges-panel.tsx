'use client'

import { AlertTriangle, Check, Loader2, Play, ShieldCheck, Users } from 'lucide-react'
import { JUDGES, worstSeverity, type JudgeIssue } from './data'

type JudgesPanelProps = {
  running: boolean
  hasRun: boolean
  issues: JudgeIssue[]
  onRunJudges: () => Promise<void>
}

export function JudgesPanel({ running, hasRun, issues, onRunJudges }: JudgesPanelProps) {
  const hasIssues = issues.length > 0

  // "Đồng thuận" here means the judge currently has nothing unresolved left to flag —
  // either it never raised an issue, or every issue it raised has since been resolved.
  const perJudge = JUDGES.map((judge) => {
    const judgeIssues = issues.filter((issue) => issue.judgeType === judge.type)
    const unresolved = judgeIssues.filter((issue) => issue.status !== 'RESOLVED')
    return { judge, judgeIssues, unresolved }
  })
  const agreeingCount = perJudge.filter(({ unresolved }) => unresolved.length === 0).length

  return (
    <div className="mini-panel judges-panel">
      <h2 className="mini-title purple-text">
        <Users size={19} />
        Panel Judge độc lập
      </h2>

      {hasRun && (
        <p className="judge-consensus-summary">
          {agreeingCount === JUDGES.length ? (
            <>
              <Check size={13} /> Cả 5 Judge đều đồng thuận — không còn vấn đề nào chưa xử lý.
            </>
          ) : (
            <>
              <AlertTriangle size={13} /> {agreeingCount}/{JUDGES.length} Judge đồng thuận · {JUDGES.length - agreeingCount} Judge còn issue chưa xử lý.
            </>
          )}
        </p>
      )}

      <div className="judge-list">
        {perJudge.map(({ judge, judgeIssues, unresolved }) => {
          const severity = worstSeverity(unresolved.map((issue) => issue.severity))
          const cardStatus = !hasRun ? undefined : unresolved.length > 0 ? 'has-issues' : 'is-clean'
          return (
            <article key={judge.title} className={cardStatus}>
              <strong>
                {judge.label}
                <br />
                {judge.title}
              </strong>
              <judge.icon size={32} />
              {!hasRun ? (
                <div className="judge-dots">● ● ● ● ●</div>
              ) : unresolved.length > 0 ? (
                <div className="judge-issue-count">
                  {unresolved.length} issue{severity ? ` (${severity})` : ''} chưa xử lý
                </div>
              ) : judgeIssues.length > 0 ? (
                <div className="judge-clean">
                  <Check size={12} /> Đã xử lý xong
                </div>
              ) : (
                <div className="judge-clean">
                  <Check size={12} /> Không có vấn đề
                </div>
              )}
              <p>{judge.detail}</p>
            </article>
          )
        })}
      </div>
      <div className="judge-note">
        <ShieldCheck size={18} />
        Các Judge đánh giá độc lập, không xem nhận xét của nhau.
      </div>
      <button type="button" className="confirm-action full" disabled={running} onClick={() => void onRunJudges()}>
        {running ? <Loader2 className="spin-icon" size={16} /> : <Play size={16} />}
        {running ? 'Đang chạy Judge...' : hasIssues ? 'Chạy lại đánh giá Judge' : 'Chạy đánh giá Judge'}
      </button>
    </div>
  )
}
