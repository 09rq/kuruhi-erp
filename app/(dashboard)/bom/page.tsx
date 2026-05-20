import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface SearchParams { q?: string; product_id?: string }

function fmtJPY(n: number | null | undefined) {
  if (n == null) return '—'
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

export default async function BomListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, product_id } = await searchParams
  const supabase = await createClient()

  const [{ data: boms }, { data: products }] = await Promise.all([
    supabase
      .from('boms')
      .select(`
        id, version, is_active, notes, created_at,
        product:products(id, product_no, name, status),
        variant:product_variants(color_name, size_label),
        bom_items(amount)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, product_no, name')
      .eq('status', 'active')
      .order('product_no'),
  ])

  // フィルタリング
  let filtered = boms ?? []
  if (q) {
    const lower = q.toLowerCase()
    filtered = filtered.filter((b) => {
      const p = b.product as unknown as { product_no: string; name: string } | null
      return (
        p?.product_no.toLowerCase().includes(lower) ||
        p?.name.toLowerCase().includes(lower)
      )
    })
  }
  if (product_id) {
    filtered = filtered.filter((b) => {
      const p = b.product as unknown as { id: string } | null
      return p?.id === product_id
    })
  }

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BOM・部品表</h1>
          <p className="mt-1 text-sm text-gray-500">製品ごとの材料構成リスト</p>
        </div>
        <Link
          href="/bom/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#1F3864' }}
        >
          ＋ 新規作成
        </Link>
      </div>

      {/* 検索・フィルタ */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">キーワード（品番・品名）</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="例：W-2024-001"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">製品</label>
          <select
            name="product_id"
            defaultValue={product_id ?? ''}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="">すべて</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.product_no} — {p.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="px-4 py-2 text-white text-sm rounded-lg" style={{ backgroundColor: '#1F3864' }}>
          検索
        </button>
        <Link href="/bom" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
          クリア
        </Link>
      </form>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">BOMが登録されていません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">品番</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">品名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">バリエーション</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 w-16">Ver.</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-20">材料点数</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">材料費合計</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 w-16">状態</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((bom) => {
                  const product = bom.product as unknown as { id: string; product_no: string; name: string; status: string } | null
                  const variant = bom.variant as unknown as { color_name: string | null; size_label: string | null } | null
                  const items   = (bom.bom_items ?? []) as { amount: number }[]
                  const total   = items.reduce((s, i) => s + (i.amount ?? 0), 0)
                  const variantLabel = variant
                    ? [variant.color_name, variant.size_label].filter(Boolean).join(' / ')
                    : null

                  return (
                    <tr key={bom.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {product?.product_no ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/bom/${bom.id}`} className="font-medium text-gray-900 hover:text-[#1F3864] hover:underline">
                          {product?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {variantLabel ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                            {variantLabel}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">共通</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">v{bom.version}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{items.length} 点</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                        {fmtJPY(total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          bom.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {bom.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/bom/${bom.id}`}
                            className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            詳細
                          </Link>
                          <Link
                            href={`/bom/${bom.id}/edit`}
                            className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            編集
                          </Link>
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
