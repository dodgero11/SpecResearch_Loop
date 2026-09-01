import Link from 'next/link'
import { ArrowLeft, Construction, type LucideIcon } from 'lucide-react'
import { Header } from './header'

type ComingSoonProps = {
  title: string
  icon: LucideIcon
  description: string
}

export function ComingSoon({ title, icon: Icon, description }: ComingSoonProps) {
  return (
    <div className="app-shell">
      <Header />
      <main className="content" style={{ display: 'flex', justifyContent: 'center' }}>
        <section
          className="mini-panel"
          style={{ maxWidth: 480, marginTop: 60, textAlign: 'center', padding: '40px 24px' }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#f4f8ff',
              color: '#195dc4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <Icon size={30} />
          </div>
          <h1 style={{ fontSize: 20, margin: '0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon size={20} />
            {title}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
            <Construction size={16} style={{ display: 'inline', verticalAlign: -3, marginRight: 6 }} />
            Tính năng này chưa có — đang được phát triển, sẽ ra mắt trong bản cập nhật sau.
            <br />
            {description}
          </p>
          <Link href="/" className="next-step-cta compact" style={{ display: 'inline-flex' }}>
            <ArrowLeft size={18} />
            Về trang chủ
          </Link>
        </section>
      </main>
    </div>
  )
}
