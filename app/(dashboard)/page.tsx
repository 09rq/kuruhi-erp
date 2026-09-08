import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DashboardCostSummary from '@/components/DashboardCostSummary'

function fmtYen(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

  const [{ data: monthOrders }, { data: prevMonthOrders }, { data: materials }] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id, sales_order_items(amount)')
      .gte('order_date', monthStart)
      .lte('order_date', monthEnd)
      .neq('status', 'cancelled'),
    supabase
      .from('sales_orders')
      .select('id, sales_order_items(amount)')
      .gte('order_date', prevMonthStart)
      .lte('order_date', prevMonthEnd)
      .neq('status', 'cancelled'),
    supabase
      .from('materials')
      .select('current_stock, safety_stock, stock_managed')
      .eq('is_active', true),
  ])

  const sumOrderAmount = (orders: { sales_order_items?: { amount: number }[] }[] | null) =>
    (orders ?? []).reduce(
      (sum, o) => sum + (o.sales_order_items ?? []).reduce((s, i) => s + Number(i.amount || 0), 0),
      0
    )

  const monthSales = sumOrderAmount(monthOrders)
  const prevMonthSales = sumOrderAmount(prevMonthOrders)
  const orderCount = monthOrders?.length ?? 0

  const salesDiffLabel =
    prevMonthSales > 0
      ? `前月比 ${monthSales >= prevMonthSales ? '+' : ''}${Math.round(((monthSales - prevMonthSales) / prevMonthSales) * 1000) / 10}%`
      : '前月比 —'

  const stockAlertCount = (materials ?? []).filter(
    (m) => m.stock_managed && m.safety_stock !== null && m.current_stock < m.safety_stock
  ).length

  const summaryCards = [
    { label: '今月の売上', value: fmtYen(monthSales), sub: salesDiffLabel, icon: '💹', link: { href: '/sales/report', label: '売上集計を見る →' } },
    { label: '受注件数', value: `${orderCount} 件`, sub: '今月', icon: '📋' },
    { label: '在庫アラート', value: `${stockAlertCount} 件`, sub: '要補充（材料）', icon: '⚠️' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-500">
          ようこそ、{user?.email} さん
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            {card.link && (
              <Link href={card.link.href} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
                {card.link.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* 予実管理サマリー（売上高・粗利益・粗利率・製造原価・原価率分析） */}
      <DashboardCostSummary />

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

const notices = [
  { id: 1, title: 'システムが正常に起動しました', date: '2026-04-06' },
  { id: 2, title: 'クルヒ ERP へようこそ', date: '2026-04-06' },
]
