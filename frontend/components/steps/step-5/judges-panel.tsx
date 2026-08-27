import { ShieldCheck, Users } from 'lucide-react'
import { JUDGES } from './data'

export function JudgesPanel() {
  return (
    <div className="mini-panel judges-panel">
      <h2 className="mini-title purple-text">
        <Users size={19} />
        Panel Judge độc lập
      </h2>
      <div className="judge-list">
        {JUDGES.map((judge) => (
          <article key={judge.title}>
            <strong>
              {judge.label}
              <br />
              {judge.title}
            </strong>
            <judge.icon size={32} />
            <div className="judge-dots">● ● ● ● ●</div>
            <p>{judge.detail}</p>
          </article>
        ))}
      </div>
      <div className="judge-note">
        <ShieldCheck size={18} />
        Các Judge đánh giá độc lập, không xem nhận xét của nhau.
      </div>
    </div>
  )
}
