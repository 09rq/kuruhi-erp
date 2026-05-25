import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StandardCostUpdateButton from './StandardCostUpdateButton'
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_COLORS,
  type ProductStatus,
} from '@/lib/types/product'
import ProductCSVButton from './ProductCSVButton'
import ProductDeleteButton from './ProductDeleteButton'

interface SearchParams {
  q?: string; status?: string; category_id?: string
  client_id?: string; brand?: string; series?: string
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `¥${n.toLocaleString('ja-JP')}`
}

function computeCostWithDefect(p: {
  cost_mode: string | null
  defect_rate: number | null
  shipping_cost: number | null
  misc_cost: number | null
  cost_items: Array<{ cost_type: string; cost_mode: string; amount: number }> | null
}): number | null {
  const items = p.cost_items
  if (!items || items.length === 0) return null
  const mode = p.cost_mode ?? 'estimate'
  const modeItems = items.filter((c) => c.cost_mode === mode)
  if (modeItems.length === 0) return null
  const itemsTotal = modeItems.reduce((s, c) => s + Number(c.amount), 0)
  const shipping = Number(p.shipping_cost) || 0
  const misc     = Number(p.misc_cost)     || 0
  const base     = Math.round(itemsTotal + shipping + misc)
  const defect   = Math.round(base * (Number(p.defect_rate) || 0) / 100)
  return base + defect
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, status, category_id, client_id, brand, series } = await searchParams
  const supabase = await createClient()

  const [{ data: categories }, productsRes, { data: brands }] = await Promise.all([
    supabase
      .from('product_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('products')
      .select('*, category:product_categories(name), client:customers(name), cost_items:product_cost_items(cost_type, cost_mode, amount)')
      .order('product_no', { ascending: true }),
    supabase.from('brands').select('id, name').order('name'),
  ])

  let products = productsRes.data ?? []

  // クライアントフィルター用に一覧からユニーク取得
  const uniqueClients = Array.from(
    new Map(
      (productsRes.data ?? [])
        .filter((p) => p.client_id && p.client)
        .map((p) => [p.client_id!, (p.client as { name?: string } | null)?.name ?? ''])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], 'ja'))

  if (q) {
    const lower = q.toLowerCase()
    products = products.filter((p) =>
      p.product_no.toLowerCase().includes(lower) ||
      p.name.toLowerCase().includes(lower) ||
      (p.client_product_no ?? '').toLowerCase().includes(lower)
    )
  }
  if (status && status !== 'all') {
    products = products.filter((p) => p.status === status)
  }
  if (category_id && category_id !== 'all') {
    products = products.filter((p) => p.category_id === category_id)
  }
  if (client_id && client_id !== 'all') {
    products = products.filter((p) => p.client_id === client_id)
  }
  if (brand && brand !== 'all') {
    products = products.filter((p) => p.brand_name === brand)
  }
  if (series) {
    const sl = series.toLowerCase()
    products = products.filter((p) => (p.series_name ?? '').toLowerCase().includes(sl))
  }

  // ステータス別集計
  const countByStatus = (['active', 'sample', 'discontinued'] as ProductStatus[]).reduce<Record<string, number>>(
    (acc, s) => {
      acc[s] = (productsRes.data ?? []).filter((p) => p.status === s).length
      return acc
    }, {}
  )

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">製品マスタ</h1>
          <p className="mt-1 text-sm text-gray-500">製品の登録・管理</p>
        </div>
        <div className="flex items-center gap-3">
          <StandardCostUpdateButton />
          <ProductCSVButton
            products={products.map((p) => ({
              ...p,
              computed_cost: computeCostWithDefect(p as Parameters<typeof computeCostWithDefect>[0]) ?? p.standard_cost,
            }))}
          />
          <Link
            href="/products/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#1F3864' }}
          >
            ＋ 新規登録
          </Link>
        </div>
      </div>

      {/* ステータス別サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['active', 'sample', 'discontinued'] as ProductStatus[]).map((s) => (
          <Link
            key={s}
            href={`/products?status=${s}`}
            className="bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">{PRODUCT_STATUS_LABELS[s]}</p>
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${PRODUCT_STATUS_COLORS[s]}`}>
                {PRODUCT_STATUS_LABELS[s]}
              </span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {countByStatus[s] ?? 0}
              <span className="text-xs font-normal text-gray-400 ml-1">件</span>
            </p>
          </Link>
        ))}
      </div>

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
            placeholder="品番・品名・クライアント品番"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
          <select
            name="status"
            defaultValue={status ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none appearance-none"
          >
            <option value="all">すべて</option>
            {(['active', 'sample', 'discontinued'] as ProductStatus[]).map((s) => (
              <option key={s} value={s}>{PRODUCT_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ</label>
          <select
            name="category_id"
            defaultValue={category_id ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none appearance-none"
          >
            <option value="all">すべて</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">クライアント</label>
          <select
            name="client_id"
            defaultValue={client_id ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none appearance-none"
          >
            <option value="all">すべて</option>
            {uniqueClients.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ブランド名</label>
          <select
            name="brand"
            defaultValue={brand ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none appearance-none"
          >
            <option value="all">すべて</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-32">
          <label className="block text-xs font-medium text-gray-600 mb-1">シリーズ名</label>
          <input
            type="text"
            name="series"
            defaultValue={series}
            placeholder="部分一致"
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
          href="/products"
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
        >
          クリア
        </Link>
      </form>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            製品が登録されていません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">品番</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">品名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">カテゴリ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">クライアント</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">ブランド名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">シリーズ名</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">標準原価</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">販売単価</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">粗利額</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-20">粗利率</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-20">ステータス</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => {
                    const cost = computeCostWithDefect(p as Parameters<typeof computeCostWithDefect>[0]) ?? p.standard_cost
                    const gp = p.selling_price != null && cost != null ? p.selling_price - cost : null
                    const gpRate = gp != null && p.selling_price ? (gp / p.selling_price) * 100 : null
                    return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${p.id}`}
                        className="font-mono text-xs text-[#1F3864] hover:underline font-medium"
                      >
                        {p.product_no}
                      </Link>
                      {p.client_product_no && (
                        <div className="text-xs text-gray-400 font-mono">{p.client_product_no}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {p.cost_confirmed && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                            確定済み
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {(p.category as { name?: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {(p.client as { name?: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.brand_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.series_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                      {fmt(cost)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                      {fmt(p.selling_price)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {gp != null ? (
                        <span className={gp >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {fmt(gp)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {gpRate != null ? (
                        <span className={gpRate >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {gpRate.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PRODUCT_STATUS_COLORS[p.status as ProductStatus]}`}>
                        {PRODUCT_STATUS_LABELS[p.status as ProductStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/products/copy/${p.id}`}
                          className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          コピー
                        </Link>
                        <Link
                          href={`/products/${p.id}/edit`}
                          className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          編集
                        </Link>
                        <ProductDeleteButton id={p.id} name={p.name} />
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
      <p className="mt-3 text-xs text-gray-400 text-right">{products.length} 件表示</p>
    </div>
  )
}
