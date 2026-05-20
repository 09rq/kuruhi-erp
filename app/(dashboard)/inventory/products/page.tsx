import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default async function InventoryProductsPage() {
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, product_no, name, current_stock, standard_material_cost, stock_updated_at')
    .order('product_no')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">製品在庫</h1>
          <p className="mt-1 text-sm text-gray-500">製品ごとの現在庫と在庫評価額</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">データ取得に失敗しました: {error.message}</div>
        ) : !products || products.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">製品が登録されていません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">品番</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">製品名</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">現在庫</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">製造原価</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">在庫評価額</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">最終更新</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => {
                const stock     = Number(p.current_stock) || 0
                const cost      = Number(p.standard_material_cost) || 0
                const evalValue = stock * cost
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.product_no}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/products/${p.id}`} className="hover:text-[#1F3864] hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={stock < 0 ? 'text-red-600 font-semibold' : 'text-gray-800'}>
                        {stock.toLocaleString('ja-JP')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 text-xs">
                      {cost > 0 ? `¥${cost.toLocaleString('ja-JP')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                      {cost > 0 ? `¥${Math.round(evalValue).toLocaleString('ja-JP')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(p.stock_updated_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">{products?.length ?? 0} 件</p>
    </div>
  )
}
