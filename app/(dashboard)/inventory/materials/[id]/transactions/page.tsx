import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MATERIAL_TRANSACTION_LABELS, type MaterialTransactionType } from '@/lib/types/inventory'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtNum(n: number, decimals = 3) {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: decimals })
}

const TX_TYPE_SIGN: Record<MaterialTransactionType, 1 | -1> = {
  purchase_in:      1,
  process_return:   1,
  inventory_adjust: 1,
  other_in:         1,
  production_out:  -1,
  other_out:       -1,
  use_out:         -1,
  return_in:        1,
  adjust:           1,
  inventory:        1,
}

export default async function MaterialTransactionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: material }, { data: transactions, error }] = await Promise.all([
    supabase.from('materials').select('id, name, code, unit, current_stock').eq('id', id).single(),
    supabase
      .from('material_stock_transactions')
      .select('*')
      .eq('material_id', id)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (!material) notFound()

  // 残高を計算
  let balance = 0
  const rows = (transactions ?? []).map((tx) => {
    const sign = TX_TYPE_SIGN[tx.transaction_type as MaterialTransactionType] ?? 1
    const qty  = tx.transaction_type === 'inventory_adjust'
      ? Number(tx.quantity)
      : sign * Math.abs(Number(tx.quantity))
    balance += qty
    return { ...tx, qty, balance }
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/inventory/materials" className="text-xs text-gray-400 hover:text-gray-600">
              ← 材料在庫一覧
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{material.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            コード: <span className="font-mono">{material.code}</span>
          </p>
        </div>
        <Link
          href={`/inventory/materials/${id}/transactions/new`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#1F3864' }}
        >
          ＋ 入出庫登録
        </Link>
      </div>

      {/* 現在庫サマリー */}
      <div className="grid grid-cols-2 gap-4 mb-6 mt-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">現在庫</p>
          <p className={`text-2xl font-bold font-mono ${Number(material.current_stock) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {fmtNum(Number(material.current_stock))}
            <span className="text-sm font-normal text-gray-400 ml-1">{material.unit ?? ''}</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">取引件数</p>
          <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
        </div>
      </div>

      {/* 履歴テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">データ取得に失敗しました: {error.message}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">入出庫履歴がありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">日付</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">区分</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">数量</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">単価</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">金額</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">残高</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">備考</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(tx.transaction_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      tx.qty > 0 ? 'bg-green-50 text-green-700' :
                      tx.qty < 0 ? 'bg-red-50 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {MATERIAL_TRANSACTION_LABELS[tx.transaction_type as MaterialTransactionType] ?? tx.transaction_type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${tx.qty > 0 ? 'text-green-700' : tx.qty < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {tx.qty > 0 ? '+' : ''}{fmtNum(tx.qty)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 text-xs">
                    {tx.unit_price != null ? `¥${Number(tx.unit_price).toLocaleString('ja-JP')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 text-xs">
                    {tx.amount != null ? `¥${Math.round(Number(tx.amount)).toLocaleString('ja-JP')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                    {fmtNum(tx.balance)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{tx.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
