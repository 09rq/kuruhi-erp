'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/settings/company', label: '自社情報' },
  { href: '/settings/employees', label: '従業員管理' },
  { href: '/settings/users', label: 'ユーザー管理' },
  { href: '/settings/approvers', label: '工程承認者設定' },
]

export default function SettingsTabs() {
  const pathname = usePathname()

  return (
    <div className="flex border-b border-gray-200 mb-6">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-[#1F3864] text-[#1F3864]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
