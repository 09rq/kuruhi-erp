import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  SO_STATUS_LABELS, SO_STATUS_COLORS,
  type SOStatus,
} from '@/lib/types/sales-order'

const FILTER_STATUSES: SOStatus[] = ['draft', 'confirmed', 'in_production', 'delivered']

interface SP { q?: string; status?: string }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const { q, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('sales_orders')
    .select(`
      id, order_number, order_date, desired_delivery_date, confirmed_delivery_date, status, notes,
      customers ( name ),
      sales_order_items ( amount, quantity, products ( standard_cost ) )
    `)
    .order('order_date', { ascending: false })
    .order('order_number', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (q) query = query.or(`order_number.ilike.%${q}%`)

  const { data: orders, error } = await query

  // ステータス別件数（全件）
  const { data: allOrders } = await supabase
    .from('sales_orders')
    .select('status')

  const statusCounts = FILTER_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (allOrders ?? []).filter((o) => o.status === s).length
    return acc
  }, {})

  // CSV URL
  const csvParams = new URLSearchParams()
  if (q) csvParams.set('q', q)
  if (status && status !== 'all') csvParams.set('status', status)
  const csvHref = `/sales/orders/export${csvParams.size ? `?${csvParams}` : ''}`

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">受注管理</h1>
          <p className="mt-1 text-sm text-gray-500">受注の登録・進捗管理</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={csvHref}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            ↓ CSV
          </a>
          <Link
            href="/sales/orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#1F3864' }}
          >
            ＋ 新規受注
          </Link>
        </div>
      </div>

      {/* ステータス別件数カード */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {FILTER_STATUSES.map((s) => (
          <Link
            key={s}
            href={status === s ? '/sales/orders' : `/sales/orders?status=${s}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${
              status === s
                ? 'border-[#1F3864] bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full ${SO_STATUS_COLORS[s].split(' ')[0]}`} />
            <span className="text-gray-600">{SO_STATUS_LABELS[s]}</span>
            <span className="font-bold text-gray-900">{statusCounts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {/* 検索 */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3 items-end">
        {status && status !== 'all' && (
          <input type="hidden" name="status" value={status} />
        )}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">キーワード</label>
          <input
            type="text" name="q" defaultValue={q}
            placeholder="受注番号で検索"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
          <select
            name="status" defaultValue={status ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">すべて</option>
            {(Object.keys(SO_STATUS_LABELS) as SOStatus[]).map((s) => (
              <option key={s} value={s}>{SO_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="px-4 py-2 text-white text-sm rounded-lg" style={{ backgroundColor: '#1F3864' }}>検索</button>
        <Link href="/sales/orders" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">クリア</Link>
      </form>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">データ取得に失敗しました: {error.message}</div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">受注がありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">受注番号</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">クライアント</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">受注日</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">確定納期</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">金額合計</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">粗利</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-20">粗利率</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">ステータス</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => {
                const client = Array.isArray(o.customers) ? o.customers[0] : o.customers
                const items  = o.sales_order_items ?? []
                const total  = items.reduce(
                  (s: number, i: { amount: number }) => s + Number(i.amount), 0
                )
                const getStdCost = (prod: unknown) => {
                  if (!prod) return null
                  const p = Array.isArray(prod) ? prod[0] : prod
                  return p ? Number(p.standard_cost) : null
                }
                const hasAllCosts = items.every(
                  (i: { products: unknown }) => getStdCost(i.products) != null
                )
                const manufacturingCost = items.reduce(
                  (s: number, i: { quantity: number; products: unknown }) =>
                    s + Number(i.quantity) * (getStdCost(i.products) ?? 0),
                  0
                )
                const grossProfit = hasAllCosts ? total - manufacturingCost : null
                const grossMargin = grossProfit != null && total > 0
                  ? (grossProfit / total) * 100 : null
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">
                      <Link href={`/sales/orders/${o.id}`} className="hover:text-[#1F3864] hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{client?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(o.order_date)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(o.confirmed_delivery_date ?? o.desired_delivery_date)}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">
                      ¥{Math.round(total).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {grossProfit != null ? (
                        <span className={grossProfit >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                          ¥{Math.round(grossProfit).toLocaleString('ja-JP')}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {grossMargin != null ? (
                        <span className={grossMargin >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                          {grossMargin.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SO_STATUS_COLORS[o.status as SOStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {SO_STATUS_LABELS[o.status as SOStatus] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/sales/orders/${o.id}`} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50">詳細</Link>
                        <Link href={`/sales/orders/${o.id}/edit`} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50">編集</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">{orders?.length ?? 0} 件</p>
    </div>
  )
}
