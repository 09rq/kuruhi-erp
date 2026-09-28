import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  MATERIAL_CATEGORIES,
  CATEGORY_COLORS,
  type MaterialCategory,
} from '@/lib/types/material'
import MaterialDeleteButton from './MaterialDeleteButton'
import MaterialCSVButton from './MaterialCSVButton'
import MaterialImportWrapper from './MaterialImportWrapper'

interface SearchParams { q?: string; category?: string; stock_alert?: string; status?: string }

function fmt(n: number | null) {
  if (n === null) return '—'
  return n.toLocaleString('ja-JP')
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, category, stock_alert, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('materials')
    .select('*, supplier:customers(id,name)')
    .order('code', { ascending: true })

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,code.ilike.%${q}%,short_name.ilike.%${q}%,jan_cd.ilike.%${q}%`
    )
  }
  if (category && category !== 'all') query = query.eq('category', category)
  if (status === 'active')   query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)

  const { data: materials, error } = await query

  // 在庫アラート（現在庫 < 安全在庫）
  const alertMaterials = materials?.filter(
    (m) => m.stock_managed && m.safety_stock !== null && m.current_stock < m.safety_stock
  ) ?? []
  const filtered = stock_alert === '1'
    ? alertMaterials
    : (materials ?? [])

  // 区分別集計
  const countByCategory = MATERIAL_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = materials?.filter((m) => m.category === cat).length ?? 0
    return acc
  }, {})

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">材料登録</h1>
          <p className="mt-1 text-sm text-gray-500">材料・副資材の登録・管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/materials/groups"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            🗂️ 材料グループ管理
          </Link>
          <MaterialImportWrapper />
          <MaterialCSVButton materials={filtered} />
          <Link
            href="/materials/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#1F3864' }}
          >
            ＋ 新規登録
          </Link>
        </div>
      </div>

      {/* 区分別集計 */}
      <div className="grid grid-cols-3 gap-3 mb-6 lg:grid-cols-6">
        {MATERIAL_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/materials?category=${cat}`}
            className="bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors"
          >
            <p className="text-xs text-gray-500 mb-1">{cat}</p>
            <p className="text-xl font-bold text-gray-900">
              {countByCategory[cat]}
              <span className="text-xs font-normal text-gray-400 ml-1">件</span>
            </p>
          </Link>
        ))}
      </div>

      {/* 在庫アラートバナー */}
      {alertMaterials.length > 0 && stock_alert !== '1' && (
        <Link
          href="/materials?stock_alert=1"
          className="flex items-center gap-3 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <span className="text-lg">⚠️</span>
          <span>
            <span className="font-medium">{alertMaterials.length}件</span>
            の材料が安全在庫を下回っています
          </span>
          <span className="ml-auto text-xs text-amber-600">一覧を見る →</span>
        </Link>
      )}

      {/* 検索・フィルタ */}
      <form
        method="GET"
        className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">キーワード</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="材料名・略称・品目コード・JANCD"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">材料区分</label>
          <select
            name="category"
            defaultValue={category ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="all">すべて</option>
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
          <select
            name="status"
            defaultValue={status ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="all">すべて</option>
            <option value="active">有効</option>
            <option value="inactive">無効</option>
          </select>
        </div>
        {stock_alert === '1' && (
          <input type="hidden" name="stock_alert" value="1" />
        )}
        <button
          type="submit"
          className="px-4 py-2 text-white text-sm rounded-lg"
          style={{ backgroundColor: '#1F3864' }}
        >
          検索
        </button>
        <Link
          href="/materials"
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
        >
          クリア
        </Link>
      </form>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            データ取得に失敗しました: {error.message}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {stock_alert === '1' ? '在庫アラートの材料はありません' : '材料が登録されていません'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">品目コード</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">区分</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">材料名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-20">色</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-16">単位</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-16">調達</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">標準単価</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">現在庫</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">仕入先</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-16">状態</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((mat) => {
                  const isAlert =
                    mat.stock_managed &&
                    mat.safety_stock !== null &&
                    mat.current_stock < mat.safety_stock
                  return (
                    <tr key={mat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{mat.code}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            CATEGORY_COLORS[mat.category as MaterialCategory]
                          }`}
                        >
                          {mat.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{mat.name}</div>
                        {mat.short_name && (
                          <div className="text-xs text-gray-400">{mat.short_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{mat.color_cd || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{mat.unit}</td>
                      <td className="px-4 py-3">
                        {mat.procurement_type === 'supplied' ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                            支給
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                            買い
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {mat.standard_price !== null
                          ? `¥${fmt(mat.standard_price)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={isAlert ? 'font-semibold text-amber-600' : 'text-gray-700'}>
                          {fmt(mat.current_stock)}
                        </span>
                        {isAlert && (
                          <span className="ml-1 text-xs text-amber-500">⚠</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {(mat.supplier as { name?: string } | null)?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            mat.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {mat.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/materials/${mat.id}/edit`}
                            className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            編集
                          </Link>
                          <MaterialDeleteButton id={mat.id} name={mat.name} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">{filtered.length} 件表示</p>
    </div>
  )
}
