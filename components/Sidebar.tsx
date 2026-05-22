'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'

interface NavItem {
  href: string
  label: string
  icon: string
  disabled?: boolean
}

const navItems: NavItem[] = [
  { href: '/',             label: 'ダッシュボード',     icon: '🏠' },
  { href: '/customers',    label: '取引先管理',         icon: '🏢' },
  { href: '/materials',    label: '材料登録',           icon: '🧵' },
  { href: '/products',     label: '製品マスタ',         icon: '👜' },
  { href: '/bom',          label: 'BOM・部品表',        icon: '📋' },
  { href: '/estimates',    label: '御見積書',           icon: '📄' },
  { href: '/sales/orders', label: '受注管理',           icon: '💼' },
  { href: '/purchases',    label: '購買管理（発注）',   icon: '🛒' },
  { href: '/delivery',     label: '納品書発行',          icon: '📦' },
  { href: '/sales/report',  label: '売上集計',             icon: '📊' },
  { href: '/manufacturing', label: '製造指示・工程管理', icon: '🏭' },
  { href: '/inventory',    label: '在庫管理',           icon: '📦' },
  { href: '/inventory/stocktake', label: '棚卸管理',           icon: '📋' },
  { href: '/accounting', label: '予実管理', icon: '📊' },
  { href: '/hr',           label: '人事・給与',         icon: '👥' },
  { href: '/reports',      label: 'レポート',           icon: '📊' },
  { href: '/kpi',          label: 'KPI・目標管理',      icon: '🎯' },
  { href: '/evaluation',   label: '人事評価',           icon: '📝' },
  { href: '/settings',     label: '設定',               icon: '⚙️' },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col w-60 flex-shrink-0 h-full"
      style={{ backgroundColor: '#1F3864' }}
    >
      {/* ロゴ */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg">
          <span className="text-white text-sm font-bold">K</span>
        </div>
        <span className="text-white font-semibold text-sm">クルヒ ERP</span>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              !item.disabled && (
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)
              )

            return (
              <li key={item.href}>
                {item.disabled ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/30 cursor-not-allowed select-none">
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] font-medium bg-white/10 text-white/40 px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                      ${
                        isActive
                          ? 'bg-white/20 text-white font-medium'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ユーザー情報・ログアウト */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-white/50 truncate">{userEmail}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left"
          >
            <span className="text-base">🚪</span>
            <span>ログアウト</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
