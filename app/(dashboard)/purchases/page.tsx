import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PO_STATUS_LABELS, PO_STATUS_COLORS, type POStatus } from '@/lib/types/purchase-order'
import StatusBadge from './StatusBadge'
import PODeleteButton from './PODeleteButton'

interface SP { q?: string; status?: string }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { q, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (q) query = query.or(`po_number.ilike.%${q}%,supplier_name.ilike.%${q}%`)
  if (status && status !== 'all') query = query.eq('status', status)

  const { data: orders, error } = await query

  const statusCounts = (['draft','ordered','awaiting_delivery','delivered','cancelled'] as POStatus[])
    .reduce<Record<string, number>>((acc, s) => {
      acc[s] = orders?.filter((o) => o.status === s).length ?? 0
      return acc
    }, {})

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">購買管理</h1>
          <p className="mt-1 text-sm text-gray-500">発注書の作成・管理</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/purchases/summary"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            📊 集計・分析
          </Link>
          <Link
            href="/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#1F3864' }}
          >
            ＋ 発注書を作成
          </Link>
        </div>
      </div>

      {/* ステータス集計 */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {(['draft','ordered','awaiting_delivery','delivered','cancelled'] as POStatus[]).map((s) => (
          <Link
            key={s}
            href={`/purchases?status=${s}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${
              status === s ? 'border-[#1F3864] bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full ${PO_STATUS_COLORS[s].split(' ')[0]}`} />
            <span className="text-gray-600">{PO_STATUS_LABELS[s]}</span>
            <span className="font-bold text-gray-900">{statusCounts[s]}</span>
          </Link>
        ))}
      </div>

      {/* 検索 */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">キーワード</label>
          <input
            type="text" name="q" defaultValue={q}
            placeholder="発注番号・発注先"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
          <select name="status" defaultValue={status ?? 'all'} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">すべて</option>
            {(['draft','ordered','awaiting_delivery','delivered','cancelled'] as POStatus[]).map((s) => (
              <option key={s} value={s}>{PO_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="px-4 py-2 text-white text-sm rounded-lg" style={{ backgroundColor: '#1F3864' }}>検索</button>
        <Link href="/purchases" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">クリア</Link>
      </form>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">データ取得に失敗しました: {error.message}</div>
        ) : !orders || orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">発注書がありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">発注番号</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">ステータス</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">発注先</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">御注文金額</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">発注日</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">希望納期</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-36">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{po.po_number}</td>
                  <td className="px-4 py-3"><StatusBadge status={po.status as POStatus} /></td>
                  <td className="px-4 py-3 font-medium text-gray-900">{po.supplier_name}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    ¥{po.subtotal.toLocaleString('ja-JP')}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(po.order_date)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(po.desired_delivery_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/purchases/${po.id}/preview`} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50">プレビュー</Link>
                      <Link href={`/purchases/${po.id}/edit`} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50">編集</Link>
                      <PODeleteButton id={po.id} poNumber={po.po_number} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">{orders?.length ?? 0} 件</p>
    </div>
  )
}
