import Link from 'next/link'
import BomPartsEditor from '@/components/BomPartsEditor'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { applyBomToProduct, deleteBom } from '../actions'

function fmtJPY(n: number | null | undefined) {
  if (n == null) return '—'
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
// 単価用：小数点以下2桁まで表示（繰り上げなし）
function fmtPrice(n: number | null | undefined) {
  if (n == null) return '—'
  return `¥${n.toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
function fmtNum(n: number | null | undefined, d = 3) {
  if (n == null) return '—'
  return n.toLocaleString('ja-JP', { maximumFractionDigits: d })
}

export default async function BomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [bomRes, { data: bomItems }] = await Promise.all([
    supabase
      .from('boms')
      .select(`
        *,
        product:products(id, product_no, name, status, standard_material_cost),
        variant:product_variants(color_name, size_label)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('bom_items')
      .select(`
        *,
        material:materials(name, code, unit)
      `)
      .eq('bom_id', id)
      .order('sort_order'),
  ])

  if (bomRes.error || !bomRes.data) notFound()
  const bom     = bomRes.data
  const product = bom.product as { id: string; product_no: string; name: string; status: string; standard_material_cost: number | null } | null
  const variant = bom.variant as { color_name: string | null; size_label: string | null } | null
  const items   = bomItems ?? []
  const totalAmount = items.reduce((s, i) => s + (i.amount ?? 0), 0)

  const variantLabel = variant
    ? [variant.color_name, variant.size_label].filter(Boolean).join(' / ')
    : null

  return (
    <div className="p-8 max-w-5xl">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/bom" className="hover:text-gray-700">BOM・部品表</Link>
        <span>/</span>
        <span className="text-gray-900">{product?.product_no ?? 'BOM'}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {product?.name ?? '—'}
            <span className="ml-3 text-base font-mono font-normal text-gray-400">
              {product?.product_no}
            </span>
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-gray-500">v{bom.version}</span>
            {variantLabel && (
              <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                {variantLabel}
              </span>
            )}
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              bom.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {bom.is_active ? '有効' : '無効'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/bom/${id}/edit`}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            編集
          </Link>
          <form action={async () => {
            'use server'
            await deleteBom(id)
          }}>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              削除
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* 材料費合計カード */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">材料費合計（BOM）</p>
              <p className="text-3xl font-bold text-[#1F3864] font-mono">{fmtJPY(totalAmount)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {items.length} 点の材料
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-500 mb-1">製品マスタの標準材料費</p>
              <p className="text-xl font-semibold text-gray-700 font-mono">
                {fmtJPY(product?.standard_material_cost ?? null)}
              </p>
            </div>
          </div>
        </div>

        {/* 製品マスタに反映ボタン */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">製品マスタへ反映</p>
            <p className="text-xs text-gray-400">
              このBOMの材料費合計を製品マスタの<br />標準材料費に上書きします
            </p>
          </div>
          <form action={async () => {
            'use server'
            await applyBomToProduct(id)
          }}>
            <button
              type="submit"
              className="w-full mt-3 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#1F3864] text-[#1F3864] hover:bg-[#1F3864]/5 transition-colors"
            >
              ↑ 標準材料費に反映
            </button>
          </form>
        </div>
      </div>

      {/* 備考 */}
      {bom.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-1">備考</p>
          <p className="text-sm text-gray-700">{bom.notes}</p>
        </div>
      )}

      {/* 材料明細テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">材料明細</p>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">明細がありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['#', '区分', '材料名', '品目コード', '数量', '単位', '歩留', '横幅(cm)', '実値数量', '単価', '金額'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => {
                  const mat = item.material as { name: string; code: string; unit: string | null } | null
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        {item.category ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                            {item.category}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">{mat?.name ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{mat?.code ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm">{fmtNum(item.quantity)}</td>
                      <td className="px-3 py-2.5 text-gray-500">{item.unit ?? mat?.unit ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm">{fmtNum(item.yield_rate, 4)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-center">
                        {item.category === '生地' && item.width_cm ? fmtNum(item.width_cm, 1) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm text-blue-600">
                        {fmtNum(item.net_quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm">{fmtPrice(item.unit_price)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-gray-900">
                        {fmtJPY(item.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={10} className="px-3 py-3 text-right text-sm font-semibold text-gray-700">
                    合計
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[#1F3864]">
                    {fmtJPY(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 部材表 */}
      <div className="mt-6">
        <BomPartsEditor
          bomId={bom.id}
          productName={product?.name || ''}
          productNo={product?.product_no || ''}
          brandName={undefined}
          version={bom.version}
          canEdit={true}
        />
      </div>

      {/* 関連リンク */}
      {product && (
        <div className="mt-4 text-right">
          <Link
            href={`/products/${product.id}`}
            className="text-xs text-gray-400 hover:text-[#1F3864] hover:underline"
          >
            → 製品マスタ詳細を見る
          </Link>
        </div>
      )}
    </div>
  )
}
