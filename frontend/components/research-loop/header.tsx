'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, CircleHelp, Clock3, Folder, Home, UserCircle } from 'lucide-react'

function Logo() {
  return (
    <div className="brand-mark" aria-label="SpecResearch Loop">
      <span className="loop loop-left" />
      <span className="loop loop-right" />
    </div>
  )
}

const NAV_ITEMS = [
  { href: '/', label: 'Trang chủ', icon: Home },
  { href: '/projects', label: 'Dự án', icon: Folder },
  { href: '/history', label: 'Lịch sử phiên bản', icon: Clock3 },
  { href: '/help', label: 'Trợ giúp', icon: CircleHelp },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <span>SpecResearch Loop</span>
      </div>
      <nav className="nav" aria-label="Điều hướng chính">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} className={pathname === item.href ? 'nav-item active' : 'nav-item'} href={item.href}>
            <item.icon size={22} />
            {item.label}
          </Link>
        ))}
      </nav>
      <button className="profile" aria-label="Mở menu tài khoản">
        <UserCircle size={44} />
        <ChevronDown size={17} />
      </button>
    </header>
  )
}
