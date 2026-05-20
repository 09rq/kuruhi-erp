import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-500">
          ようこそ、{user?.email} さん
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* お知らせ */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">お知らせ</h2>
        <ul className="divide-y divide-gray-100">
          {notices.map((notice) => (
            <li key={notice.id} className="py-3 flex items-start gap-3">
              <span
                className="mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: '#1F3864' }}
              />
              <div>
                <p className="text-sm text-gray-800">{notice.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{notice.date}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const summaryCards = [
  { label: '今月の売上', value: '¥0', sub: '前月比 —', icon: '💹' },
  { label: '受注件数', value: '0 件', sub: '今月', icon: '📋' },
  { label: '在庫アラート', value: '0 件', sub: '要補充', icon: '⚠️' },
  { label: '未処理タスク', value: '0 件', sub: '本日', icon: '✅' },
]

const notices = [
  { id: 1, title: 'システムが正常に起動しました', date: '2026-04-06' },
  { id: 2, title: 'クルヒ ERP へようこそ', date: '2026-04-06' },
]
