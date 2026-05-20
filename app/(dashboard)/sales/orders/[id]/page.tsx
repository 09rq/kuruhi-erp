import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SO_STATUS_LABELS, SO_STATUS_COLORS, type SOStatus } from '@/lib/types/sales-order'
import { LOT_STATUS_LABELS, LOT_STATUS_COLORS, type LotStatus } from '@/lib/types/inventory'
import StatusButton from './StatusButton'

import CreateLotButton from './CreateLotButton'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('sales_orders')
    .select(`
      id, order_number, order_date, desired_delivery_date, confirmed_delivery_date,
      status, notes, created_at,
      customers ( name, phone, email, contact_person ),
      employees!sales_orders_assigned_to_fkey ( name, department ),
      sales_order_items (
        id, product_id, product_variant_id, quantity, unit_price, amount,
        desired_delivery_date, production_lot_id, notes, sort_order,
        products ( name, product_no, cost_confirmed, standard_cost ),
        product_variants ( color_name, size_label ),
        production_lots ( id, lot_number, status )
      )
    `)
    .eq('id', id)
    .single()

  if (!order) notFound()

  const client   = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const assignee = Array.isArray(order.employees) ? order.employees[0] : order.employees

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [...(order.sales_order_items ?? [])].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  const totalAmount = items.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)

  // 標準原価未確定の製品が含まれるか
  const hasUnconfirmedCost = items.some(
    (i: { products: { cost_confirmed: boolean } | null }) =>
      i.products != null && !i.products.cost_confirmed
  )

  // ロット未作成かつ製品設定済みの明細があるか
  const hasUnlinkedItems = items.some(
    (i: { product_id: string | null; production_lot_id: string | null }) =>
      i.product_id && !i.production_lot_id
  )

  // 粗利計算
  const hasAllCosts = items.every(
    (i: { product_id: string | null; products: { standard_cost: number } | null }) =>
      !i.product_id || i.products != null
  )
  const manufacturingCost = items.reduce(
    (s: number, i: { quantity: number; products: { standard_cost: number } | null }) =>
      s + Number(i.quantity) * Number(i.products?.standard_cost ?? 0),
    0
  )
  const grossProfit = hasAllCosts ? totalAmount - manufacturingCost : null
  const grossMargin = grossProfit != null && totalAmount > 0
    ? (grossProfit / totalAmount) * 100 : null

  // 紐付き製造ロット（重複除去）
  const linkedLots = items
    .map((i: { production_lots: { id: string; lot_number: string; status: string } | null }) => i.production_lots)
    .filter(Boolean)
    .filter((lot, idx, arr) => arr.findIndex((l) => l!.id === lot!.id) === idx) as { id: string; lot_number: string; status: string }[]

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="mb-1">
            <Link href="/sales/orders" className="text-xs text-gray-400 hover:text-gray-600">
              ← 受注管理
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.order_number}</h1>
          <p className="mt-1 text-sm text-gray-600">{client?.name ?? '—'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${SO_STATUS_COLORS[order.status as SOStatus] ?? 'bg-gray-100 text-gray-600'}`}>
            {SO_STATUS_LABELS[order.status as SOStatus] ?? order.status}
          </span>
          <CreateLotButton orderId={order.id} hasUnlinkedItems={hasUnlinkedItems} />
          <StatusButton orderId={order.id} currentStatus={order.status as SOStatus} />

          <Link
            href={`/sales/orders/${id}/edit`}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            編集
          </Link>
        </div>
      </div>

      {/* 標準原価未確定警告 */}
      {hasUnconfirmedCost && (
        <div className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <span className="text-base leading-none mt-0.5">⚠️</span>
          <div>
            <p className="font-medium">標準原価が未確定の製品が含まれています</p>
            <p className="text-xs text-amber-600 mt-0.5">製品マスタで標準原価を確定してから製造ロットを作成することを推奨します</p>
          </div>
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">受注金額合計</p>
          <p className="text-xl font-bold font-mono text-[#1F3864]">
            ¥{Math.round(totalAmount).toLocaleString('ja-JP')}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">製造原価合計</p>
          <p className="text-xl font-bold font-mono text-gray-700">
            {hasAllCosts ? `¥${Math.round(manufacturingCost).toLocaleString('ja-JP')}` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">粗利合計</p>
          <p className={`text-xl font-bold font-mono ${grossProfit == null ? 'text-gray-300' : grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {grossProfit != null ? `¥${Math.round(grossProfit).toLocaleString('ja-JP')}` : '—'}
          </p>
          {grossMargin != null && (
            <p className={`text-xs mt-0.5 font-medium ${grossMargin >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {grossMargin.toFixed(1)}%
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">受注日</p>
          <p className="text-base font-semibold text-gray-900">{fmtDate(order.order_date)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">確定納期</p>
          <p className="text-base font-semibold text-gray-900">{fmtDate(order.confirmed_delivery_date ?? order.desired_delivery_date)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">担当者</p>
          <p className="text-base font-semibold text-gray-900">
            {assignee ? `${assignee.name}${assignee.department ? `（${assignee.department}）` : ''}` : '—'}
          </p>
        </div>
      </div>

      {/* 基本情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">受注情報</p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">クライアント</p>
            <p className="text-gray-800 font-medium">{client?.name ?? '—'}</p>
            {client?.contact_person && (
              <p className="text-xs text-gray-400 mt-0.5">担当: {client.contact_person}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">希望納期</p>
            <p className="text-gray-700">{fmtDate(order.desired_delivery_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">作成日</p>
            <p className="text-gray-700">{fmtDate(order.created_at)}</p>
          </div>
          {order.notes && (
            <div className="col-span-3">
              <p className="text-xs text-gray-400 mb-0.5">備考</p>
              <p className="text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 受注明細 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-600">受注明細</p>
          <span className="text-xs text-gray-500">
            合計：<span className="font-mono font-semibold text-[#1F3864] ml-1">
              ¥{Math.round(totalAmount).toLocaleString('ja-JP')}
            </span>
          </span>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">明細がありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-8">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">製品</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">バリエーション</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-20">数量</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">単価</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">金額</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">標準原価</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">粗利</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">明細納期</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">製造ロット</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">備考</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item: {
                id: string; sort_order: number; quantity: number; unit_price: number; amount: number;
                desired_delivery_date: string | null; notes: string | null;
                products: { name: string; product_no: string; cost_confirmed: boolean; standard_cost: number } | null;
                product_variants: { color_name: string | null; size_label: string | null } | null;
                production_lots: { id: string; lot_number: string; status: string } | null;
              }, idx: number) => {
                const prod    = item.products
                const variant = item.product_variants
                const lot     = item.production_lots
                const itemManufCost = prod ? Number(item.quantity) * Number(prod.standard_cost) : null
                const itemGrossProfit = itemManufCost != null ? Number(item.amount) - itemManufCost : null
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {prod ? `${prod.product_no} — ${prod.name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {variant
                        ? [variant.color_name, variant.size_label].filter(Boolean).join(' / ') || '—'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {item.quantity.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 text-xs">
                      ¥{Number(item.unit_price).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">
                      ¥{Math.round(Number(item.amount)).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">
                      {itemManufCost != null ? `¥${Math.round(itemManufCost).toLocaleString('ja-JP')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {itemGrossProfit != null ? (
                        <span className={itemGrossProfit >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                          ¥{Math.round(itemGrossProfit).toLocaleString('ja-JP')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(item.desired_delivery_date)}</td>
                    <td className="px-4 py-3">
                      {lot ? (
                        <Link href={`/inventory/lots/${lot.id}`}
                          className="font-mono text-xs text-[#1F3864] hover:underline">
                          {lot.lot_number}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-300">未作成</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.notes ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-600 text-right">合計</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                  ¥{Math.round(totalAmount).toLocaleString('ja-JP')}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">
                  {hasAllCosts ? `¥${Math.round(manufacturingCost).toLocaleString('ja-JP')}` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {grossProfit != null ? (
                    <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ¥{Math.round(grossProfit).toLocaleString('ja-JP')}
                    </span>
                  ) : '—'}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* 紐付き製造ロット */}
      {linkedLots.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600">紐付き製造ロット</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">ロット番号</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">ステータス</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linkedLots.map((lot) => (
                <tr key={lot.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{lot.lot_number}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${LOT_STATUS_COLORS[lot.status as LotStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {LOT_STATUS_LABELS[lot.status as LotStatus] ?? lot.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/inventory/lots/${lot.id}`}
                      className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
