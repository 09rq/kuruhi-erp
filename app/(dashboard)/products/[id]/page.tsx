import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_COLORS,
  type ProductStatus,
} from '@/lib/types/product'
import ProductDeleteButton from '../ProductDeleteButton'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `¥${n.toLocaleString('ja-JP')}`
}

function fmtMm(n: number | null | undefined) {
  if (n == null) return null
  return `${n} mm`
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [productRes, { data: variants }, { data: costItems }] = await Promise.all([
    supabase
      .from('products')
      .select('*, category:product_categories(name), client:customers(name)')
      .eq('id', id)
      .single(),
    supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', id)
      .order('sort_order'),
    supabase
      .from('product_cost_items')
      .select('*')
      .eq('product_id', id)
      .order('sort_order'),
  ])

  if (productRes.error || !productRes.data) notFound()
  const p = productRes.data

  const hasSize = p.width_mm || p.height_mm || p.depth_mm

  // 原価明細集計（表示モード: standard があれば standard、なければ estimate）
  const costMode = p.cost_mode ?? 'estimate'
  const modeItems = (costItems ?? []).filter((c) => c.cost_mode === costMode)
  const materialTotal  = modeItems.filter((c) => c.cost_type === 'material').reduce((s, c) => s + Number(c.amount), 0)
  const outsourceTotal = modeItems.filter((c) => c.cost_type === 'outsource').reduce((s, c) => s + Number(c.amount), 0)
  const laborTotal     = modeItems.filter((c) => c.cost_type === 'labor').reduce((s, c) => s + Number(c.amount), 0)
  const shippingNum    = Number(p.shipping_cost) || 0
  const miscNum        = Number(p.misc_cost) || 0
  const defectRate     = Number(p.defect_rate) || 0
  const baseTotal      = Math.round(materialTotal + outsourceTotal + laborTotal + shippingNum + miscNum)
  const defectAmount   = Math.round(baseTotal * defectRate / 100)
  const costWithDefect = baseTotal + defectAmount

  const grossProfit =
    p.selling_price != null ? p.selling_price - costWithDefect : null
  const grossMargin =
    grossProfit != null && p.selling_price ? (grossProfit / p.selling_price) * 100 : null

  return (
    <div className="p-8">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/products" className="hover:text-gray-700">製品マスタ</Link>
        <span>/</span>
        <span className="text-gray-900">{p.product_no}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{p.name}</h1>
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${PRODUCT_STATUS_COLORS[p.status as ProductStatus]}`}>
              {PRODUCT_STATUS_LABELS[p.status as ProductStatus]}
            </span>
            {p.cost_confirmed && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                確定済み ✅
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-gray-400">{p.product_no}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/products/copy/${id}`}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            コピー
          </Link>
          <Link
            href={`/products/${id}/edit`}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            編集
          </Link>
          <ProductDeleteButton id={id} name={p.name} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 左カラム: 基本情報 */}
        <div className="col-span-2 space-y-5">
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-400">カテゴリ</dt>
                <dd className="mt-0.5 text-gray-800">
                  {(p.category as { name?: string } | null)?.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">クライアント</dt>
                <dd className="mt-0.5 text-gray-800">
                  {(p.client as { name?: string } | null)?.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">クライアント品番</dt>
                <dd className="mt-0.5 font-mono text-gray-800">{p.client_product_no ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">サイズ（W × H × D）</dt>
                <dd className="mt-0.5 text-gray-800">
                  {hasSize
                    ? [fmtMm(p.width_mm), fmtMm(p.height_mm), fmtMm(p.depth_mm)]
                        .map((v) => v ?? '—')
                        .join(' × ')
                    : '—'}
                </dd>
              </div>
              {p.note && (
                <div className="col-span-2">
                  <dt className="text-xs text-gray-400">備考</dt>
                  <dd className="mt-0.5 text-gray-800 whitespace-pre-wrap">{p.note}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* バリエーション */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              バリエーション
              <span className="ml-2 text-xs font-normal text-gray-400">{variants?.length ?? 0}件</span>
            </h2>
            {!variants || variants.length === 0 ? (
              <p className="text-sm text-gray-400">バリエーションなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">色</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">素材</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">サイズ</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {variants.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {v.color_hex && (
                              <span
                                className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0"
                                style={{ backgroundColor: v.color_hex }}
                              />
                            )}
                            <span className="text-gray-800">{v.color_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{v.material ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{v.size_label ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                            v.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {v.status === 'active' ? '有効' : '廃番'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* 右カラム: 原価・価格 */}
        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                原価・価格
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {costMode === 'standard' ? '標準原価' : '簡易見積'}
                </span>
              </h2>
              {p.cost_confirmed ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  確定済み ✅
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  未確定
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>材料費</span>
                <span className="font-mono">{fmt(Math.round(materialTotal))}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>外注費</span>
                <span className="font-mono">{fmt(Math.round(outsourceTotal))}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>社内労務</span>
                <span className="font-mono">{fmt(Math.round(laborTotal))}</span>
              </div>
              {shippingNum > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>送料</span>
                  <span className="font-mono">{fmt(shippingNum)}</span>
                </div>
              )}
              {miscNum > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>雑費</span>
                  <span className="font-mono">{fmt(miscNum)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-gray-800">
                <span>製造原価合計</span>
                <span className="font-mono">{fmt(baseTotal)}</span>
              </div>
              {defectRate > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>不良率補正 ({defectRate}%)</span>
                    <span className="font-mono">+{fmt(defectAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-gray-800">
                    <span>不良率込み原価</span>
                    <span className="font-mono">{fmt(costWithDefect)}</span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">販売単価</h2>
            <p className="text-2xl font-bold font-mono" style={{ color: '#1F3864' }}>
              {fmt(p.selling_price)}
            </p>
            {grossProfit != null && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">粗利</span>
                  <span className={`font-mono font-medium ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(grossProfit)}
                  </span>
                </div>
                {grossMargin != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">粗利率</span>
                    <span className={`font-medium ${grossMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {grossMargin.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="text-xs text-gray-400 space-y-1 px-1">
            <p>登録: {new Date(p.created_at).toLocaleDateString('ja-JP')}</p>
            <p>更新: {new Date(p.updated_at).toLocaleDateString('ja-JP')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
