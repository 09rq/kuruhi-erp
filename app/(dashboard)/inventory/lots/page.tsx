import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LOT_STATUS_LABELS, LOT_STATUS_COLORS, type LotStatus } from '@/lib/types/inventory'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default async function InventoryLotsPage() {
  const supabase = await createClient()

  const { data: lots, error } = await supabase
    .from('production_lots')
    .select(`
      id, lot_number, planned_quantity, completed_quantity, status, started_at, completed_at, created_at,
      products ( name, product_no ),
      production_lot_processes ( wip_value )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">製造ロット</h1>
          <p className="mt-1 text-sm text-gray-500">製造ロットの登録・進捗管理</p>
        </div>
        <Link
          href="/inventory/lots/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#1F3864' }}
        >
          ＋ ロットを作成
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">データ取得に失敗しました: {error.message}</div>
        ) : !lots || lots.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">製造ロットがありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">ロット番号</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">製品名</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">予定数量</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">完了数量</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">ステータス</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">仕掛品評価額</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">作成日</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-20">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lots.map((lot) => {
                const product = Array.isArray(lot.products) ? lot.products[0] : lot.products
                const wipTotal = (lot.production_lot_processes ?? [])
                  .reduce((s: number, p: { wip_value: number }) => s + (Number(p.wip_value) || 0), 0)
                return (
                  <tr key={lot.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{lot.lot_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {product ? `${product.product_no} — ${product.name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {lot.planned_quantity.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {lot.completed_quantity.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${LOT_STATUS_COLORS[lot.status as LotStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {LOT_STATUS_LABELS[lot.status as LotStatus] ?? lot.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      ¥{Math.round(wipTotal).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(lot.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inventory/lots/${lot.id}`}
                        className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">{lots?.length ?? 0} 件</p>
    </div>
  )
}
