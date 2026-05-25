import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MonthEndPriceButton from './MonthEndPriceButton'

// ─── 定数 ────────────────────────────────────────────────────────────────────
const CATEGORIES = ['すべて', '革', '生地', '金具', 'ファスナー', '箱', 'その他'] as const
type Category = typeof CATEGORIES[number]

// 在庫金額サマリーに表示するカテゴリ
const SUMMARY_CATEGORIES = ['革', '生地', '金具', 'ファスナー'] as const

// ─── ユーティリティ ────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtNum(n: number, decimals = 3) {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: decimals })
}

function fmtJPY(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

// ─── searchParams 型 ────────────────────────────────────────────────────────
interface SP { q?: string; category?: string }

// ─── ページ ───────────────────────────────────────────────────────────────────
export default async function InventoryMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const { q, category } = await searchParams
  const activeCategory = (category && CATEGORIES.includes(category as Category)) ? category : 'すべて'

  const supabase = await createClient()

  let dbQuery = supabase
    .from('materials')
    .select('id, name, code, category, unit, current_stock, standard_price, stock_updated_at, min_stock')
    .order('category')
    .order('name')

  if (activeCategory !== 'すべて') dbQuery = dbQuery.eq('category', activeCategory)
  if (q) dbQuery = dbQuery.or(`name.ilike.%${q}%,code.ilike.%${q}%`)

  const { data: materials, error } = await dbQuery

  // ── 在庫アラート（全件で集計するため、フィルター前の全件も欲しいが
  //    実装簡略化のため表示中データで判定）
  const lowStockItems = (materials ?? []).filter(
    (m) => m.min_stock != null && Number(m.current_stock) < Number(m.min_stock)
  )

  // ── 在庫金額サマリー（フィルターなしで全件取得して集計）
  const { data: allMaterials } = await supabase
    .from('materials')
    .select('category, current_stock, standard_price')

  const summaryByCategory = SUMMARY_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = (allMaterials ?? [])
      .filter((m) => m.category === cat)
      .reduce((s, m) => s + Number(m.current_stock) * Number(m.standard_price ?? 0), 0)
    return acc
  }, {})

  const totalStockValue = (allMaterials ?? []).reduce(
    (s, m) => s + Number(m.current_stock) * Number(m.standard_price ?? 0),
    0
  )

  // ── CSV エクスポート URL（現在のフィルターを引き継ぐ）
  const csvParams = new URLSearchParams()
  if (q) csvParams.set('q', q)
  if (activeCategory !== 'すべて') csvParams.set('category', activeCategory)
  const csvHref = `/inventory/materials/export${csvParams.size ? `?${csvParams}` : ''}`

  return (
    <div className="p-8">
      {/* ─── ヘッダー ─── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">材料在庫</h1>
          <p className="mt-1 text-sm text-gray-500">材料ごとの現在庫と入出庫管理</p>
        </div>
        <a
          href={csvHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          ↓ CSVダウンロード
        </a>
      </div>

      {/* ─── 在庫不足アラートバナー ─── */}
      {lowStockItems.length > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="text-red-500 text-lg">⚠</span>
          <div>
            <span className="text-sm font-semibold text-red-700">
              在庫不足 {lowStockItems.length} 件
            </span>
            <span className="text-xs text-red-500 ml-2">
              {lowStockItems.map((m) => m.name).slice(0, 5).join('、')}
              {lowStockItems.length > 5 ? ` ほか${lowStockItems.length - 5}件` : ''}
            </span>
          </div>
        </div>
      )}

      {/* ─── 在庫金額サマリーカード ─── */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {SUMMARY_CATEGORIES.map((cat) => (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{cat}</p>
            <p className="text-base font-bold font-mono text-gray-900">{fmtJPY(summaryByCategory[cat] ?? 0)}</p>
          </div>
        ))}
        <div className="bg-white rounded-xl border border-[#1F3864]/30 p-4">
          <p className="text-xs text-gray-500 mb-1">全体合計</p>
          <p className="text-base font-bold font-mono text-[#1F3864]">{fmtJPY(totalStockValue)}</p>
        </div>
      </div>

      {/* ─── 検索・フィルター ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        {/* キーワード検索 */}
        <form method="GET" className="flex gap-3 items-end mb-3">
          {/* hidden で現在のカテゴリを保持 */}
          {activeCategory !== 'すべて' && (
            <input type="hidden" name="category" value={activeCategory} />
          )}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">キーワード</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="材料名・コードで検索"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-white text-sm rounded-lg"
            style={{ backgroundColor: '#1F3864' }}
          >
            検索
          </button>
          <Link
            href="/inventory/materials"
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
          >
            クリア
          </Link>
        </form>

        {/* 区分フィルター */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => {
            const params = new URLSearchParams()
            if (q) params.set('q', q)
            if (cat !== 'すべて') params.set('category', cat)
            const href = `/inventory/materials${params.size ? `?${params}` : ''}`
            const isActive = activeCategory === cat
            return (
              <Link
                key={cat}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isActive
                    ? 'border-[#1F3864] bg-[#1F3864] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ─── 一覧テーブル ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">データ取得に失敗しました: {error.message}</div>
        ) : !materials || materials.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {q || activeCategory !== 'すべて' ? '条件に一致する材料がありません' : '材料が登録されていません'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">コード</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">材料名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">区分</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">現在庫</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">最低在庫</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-12">単位</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">在庫金額</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">最終更新</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-36">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materials.map((m) => {
                const stock       = Number(m.current_stock)
                const minStock    = m.min_stock != null ? Number(m.min_stock) : null
                const isLow       = minStock != null && stock < minStock
                const stockValue  = m.standard_price != null
                  ? stock * Number(m.standard_price)
                  : null

                return (
                  <tr
                    key={m.id}
                    className={`transition-colors ${isLow ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {m.name}
                      {isLow && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded font-medium">
                          在庫不足
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{m.category}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={stock < 0 ? 'text-red-600 font-semibold' : isLow ? 'text-red-500 font-semibold' : 'text-gray-800'}>
                        {fmtNum(stock)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400 text-xs">
                      {minStock != null ? fmtNum(minStock) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.unit ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {stockValue != null ? fmtJPY(stockValue) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(m.stock_updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/inventory/materials/${m.id}/transactions`}
                          className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          入出庫履歴
                        </Link>
                        <Link
                          href={`/inventory/materials/${m.id}/transactions/new`}
                          className="px-2.5 py-1 text-xs rounded border border-[#1F3864] text-[#1F3864] hover:bg-blue-50"
                        >
                          入出庫登録
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">{materials?.length ?? 0} 件</p>
    </div>
  )
}
