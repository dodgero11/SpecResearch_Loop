import { ChevronDown, CircleHelp, Clock3, Folder, Home, UserCircle } from 'lucide-react'

function Logo() {
  return (
    <div className="brand-mark" aria-label="SpecResearch Loop">
      <span className="loop loop-left" />
      <span className="loop loop-right" />
    </div>
  )
}

export function Header() {
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <span>SpecResearch Loop</span>
      </div>
      <nav className="nav" aria-label="Điều hướng chính">
        <a className="nav-item active" href="#home">
          <Home size={22} />
          Trang chủ
        </a>
        <a className="nav-item" href="#projects">
          <Folder size={22} />
          Dự án
        </a>
        <a className="nav-item" href="#history">
          <Clock3 size={22} />
          Lịch sử phiên bản
        </a>
        <a className="nav-item" href="#help">
          <CircleHelp size={22} />
          Trợ giúp
        </a>
      </nav>
      <button className="profile" aria-label="Mở menu tài khoản">
        <UserCircle size={44} />
        <ChevronDown size={17} />
      </button>
    </header>
  )
}
