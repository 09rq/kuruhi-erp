'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createSalesOrder, updateSalesOrder } from './actions'
import { SO_STATUS_LABELS, type SOStatus, type SalesOrder, type SalesOrderItem, type SOItemRow } from '@/lib/types/sales-order'
import SearchableSelect from '@/components/SearchableSelect'

// ─── Props 型 ───────────────────────────────────────────────────────────────
interface ClientOption   { id: string; name: string }
interface ProductOption  { id: string; product_no: string; name: string; selling_price: number | null; cost_confirmed: boolean; client_id: string | null }
interface VariantOption  { id: string; product_id: string; color_name: string | null; size_label: string | null }
interface EmployeeOption { id: string; name: string; department: string | null }

interface Props {
  order?: SalesOrder & { items?: SalesOrderItem[] }
  clients:   ClientOption[]
  products:  ProductOption[]
  variants:  VariantOption[]
  employees: EmployeeOption[]
}

// ─── ユーティリティ ──────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }

function newRow(): SOItemRow {
  return {
    _key: crypto.randomUUID(),
    product_id: '', product_variant_id: '',
    quantity: '1', unit_price: '0',
    desired_delivery_date: '', notes: '',
  }
}

const cls      = 'w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const cellCls  = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const numCls   = `${cellCls} text-right font-mono`
const selCls   = `${cellCls} appearance-none`

const EDITABLE_STATUSES: SOStatus[] = ['draft', 'confirmed', 'in_production', 'delivered', 'invoiced', 'cancelled']

// ─── メインフォーム ──────────────────────────────────────────────────────────
export default function SalesOrderForm({ order, clients, products, variants, employees }: Props) {
  const router  = useRouter()
  const isEdit  = !!order
  const [pending, setPending] = useState(false)

  // ── ヘッダー ──
  const [clientId,   setClientId]   = useState(order?.client_id   ?? '')
  const [orderDate,  setOrderDate]  = useState(order?.order_date   ?? today())
  const [desiredDel, setDesiredDel] = useState(order?.desired_delivery_date   ?? '')
  const [confirmedDel, setConfirmedDel] = useState(order?.confirmed_delivery_date ?? '')
  const [assignedTo, setAssignedTo] = useState(order?.assigned_to  ?? '')
  const [status,     setStatus]     = useState<SOStatus>(order?.status ?? 'draft')
  const [notes,      setNotes]      = useState(order?.notes ?? '')

  // ── 明細行 ──
  const [items, setItems] = useState<SOItemRow[]>(() => {
    if (order?.items && order.items.length > 0) {
      return order.items.map((i) => ({
        _key:                  i.id,
        id:                    i.id,
        product_id:            i.product_id         ?? '',
        product_variant_id:    i.product_variant_id ?? '',
        quantity:              String(i.quantity),
        unit_price:            String(i.unit_price),
        desired_delivery_date: i.desired_delivery_date ?? '',
        notes:                 i.notes ?? '',
      }))
    }
    return [newRow()]
  })

  // ── 製品選択 → 単価・バリエーション自動入力 ──
  const handleProductChange = useCallback((key: string, productId: string) => {
    const prod = products.find((p) => p.id === productId)
    setItems((prev) =>
      prev.map((r) =>
        r._key !== key ? r : {
          ...r,
          product_id:         productId,
          product_variant_id: '',
          unit_price:         prod?.selling_price != null ? String(prod.selling_price) : r.unit_price,
        }
      )
    )
  }, [products])

  const updateRow = useCallback((key: string, patch: Partial<SOItemRow>) => {
    setItems((prev) => prev.map((r) => r._key === key ? { ...r, ...patch } : r))
  }, [])

  const addRow    = () => setItems((p) => [...p, newRow()])
  const removeRow = (key: string) => setItems((p) => p.filter((r) => r._key !== key))

  // ── 合計 ──
  const subtotal = items.reduce(
    (s, r) => s + (parseInt(String(r.quantity ?? 0)) || 0) * (parseFloat(String(r.unit_price ?? 0)) || 0), 0
  )

  // ── 送信 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!items.some((r) => r.product_id)) {
      alert('明細に製品を1件以上選択してください')
      return
    }
    setPending(true)
    try {
      const payload = {
        client_id: clientId, order_date: orderDate,
        desired_delivery_date: desiredDel, confirmed_delivery_date: confirmedDel,
        status, assigned_to: assignedTo, notes, items,
      }
      if (isEdit) {
        await updateSalesOrder(order.id, payload)
      } else {
        await createSalesOrder(payload)
      }
    } catch (err) {
      if (isRedirectError(err)) throw err
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">

      {/* ─── 基本情報 ─── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
        <div className="grid grid-cols-3 gap-4">

          {/* クライアント */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              クライアント <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={clientId}
              onChange={(id) => setClientId(id)}
              options={clients.map((c) => ({ id: c.id, label: c.name }))}
              placeholder="クライアント名で検索"
              className={cls}
              required
            />
          </div>

          {/* ステータス */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value as SOStatus)}
                className={`${cls} appearance-none pr-7`}>
                {EDITABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>{SO_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
          </div>

          {/* 受注日 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">受注日 <span className="text-red-500">*</span></label>
            <input type="date" required value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={cls} />
          </div>

          {/* 希望納期 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">希望納期</label>
            <input type="date" value={desiredDel} onChange={(e) => setDesiredDel(e.target.value)} className={cls} />
          </div>

          {/* 確定納期 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">確定納期</label>
            <input type="date" value={confirmedDel} onChange={(e) => setConfirmedDel(e.target.value)} className={cls} />
          </div>

          {/* 担当者 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">担当者</label>
            <div className="relative">
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
                className={`${cls} appearance-none pr-7`}>
                <option value="">未設定</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}{e.department ? `（${e.department}）` : ''}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 受注明細 ─── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">受注明細</h2>
          <button type="button" onClick={addRow}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50 transition-colors">
            ＋ 行を追加
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500 w-52">製品</th>
                <th className="pb-2 text-left font-medium text-gray-500 w-36 pl-2">バリエーション</th>
                <th className="pb-2 text-right font-medium text-gray-500 w-20 pl-2">数量</th>
                <th className="pb-2 text-right font-medium text-gray-500 w-24 pl-2">単価（円）</th>
                <th className="pb-2 text-right font-medium text-gray-500 w-24 pl-2">金額（円）</th>
                <th className="pb-2 text-left font-medium text-gray-500 w-28 pl-2">明細納期</th>
                <th className="pb-2 text-left font-medium text-gray-500 pl-2">備考</th>
                <th className="pb-2 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((row) => {
                const filteredVariants = variants.filter((v) => v.product_id === row.product_id)
                const amount = (parseInt(String(row.quantity ?? 0)) || 0) * (parseFloat(String(row.unit_price ?? 0)) || 0)
                const selectedProduct = row.product_id ? products.find((p) => p.id === row.product_id) : null
                const isUnconfirmed = selectedProduct != null && !selectedProduct.cost_confirmed
                // クライアントが選択されている場合は、製品マスタでそのクライアントに紐づく製品のみに絞り込む
                // （既に選択済みの製品は、クライアント変更後も表示が消えないよう残す）
                const rowProducts = clientId
                  ? products.filter((p) => p.client_id === clientId || p.id === row.product_id)
                  : products
                return (
                  <tr key={row._key} className="group">
                    {/* 製品 */}
                    <td className="py-2 pr-2">
                      <SearchableSelect
                        value={row.product_id ?? ''}
                        onChange={(id) => handleProductChange(row._key ?? '', id)}
                        options={rowProducts.map((p) => ({ id: p.id, label: `${p.product_no} — ${p.name}` }))}
                        placeholder="製品名・品番で検索"
                        className={`${cellCls}`}
                        emptyText={clientId ? 'このクライアントに紐づく製品がありません' : '該当する製品がありません'}
                      />
                      {isUnconfirmed && (
                        <p className="mt-0.5 text-amber-600 text-xs font-medium">⚠️ 標準原価未確定</p>
                      )}
                    </td>
                    {/* バリエーション */}
                    <td className="py-2 px-2">
                      <div className="relative">
                        <select value={row.product_variant_id ?? ""}
                          onChange={(e) => updateRow(row._key ?? "", { product_variant_id: e.target.value })}
                          disabled={filteredVariants.length === 0}
                          className={`${selCls} pr-5 disabled:bg-gray-50 disabled:text-gray-400`}>
                          <option value="">共通</option>
                          {filteredVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {[v.color_name, v.size_label].filter(Boolean).join(' / ') || v.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400" style={{ fontSize: 9 }}>▼</span>
                      </div>
                    </td>
                    {/* 数量 */}
                    <td className="py-2 px-2">
                      <input type="number" value={row.quantity ?? ""} min={1} step={1}
                        onChange={(e) => updateRow(row._key ?? "", { quantity: e.target.value })}
                        className={numCls} />
                    </td>
                    {/* 単価 */}
                    <td className="py-2 px-2">
                      <input type="number" value={row.unit_price ?? ""} min={0} step={1}
                        onChange={(e) => updateRow(row._key ?? "", { unit_price: e.target.value })}
                        className={numCls} />
                    </td>
                    {/* 金額 */}
                    <td className="py-2 px-2 text-right font-medium text-gray-700 whitespace-nowrap">
                      ¥{Math.round(amount).toLocaleString('ja-JP')}
                    </td>
                    {/* 明細納期 */}
                    <td className="py-2 px-2">
                      <input type="date" value={row.desired_delivery_date ?? ""}
                        onChange={(e) => updateRow(row._key ?? "", { desired_delivery_date: e.target.value })}
                        className={cellCls} />
                    </td>
                    {/* 備考 */}
                    <td className="py-2 px-2">
                      <input type="text" value={row.notes ?? ""} placeholder="備考"
                        onChange={(e) => updateRow(row._key ?? "", { notes: e.target.value })}
                        className={cellCls} />
                    </td>
                    {/* 削除 */}
                    <td className="py-2 pl-2">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeRow(row._key ?? "")}
                          className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none">×</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 合計 */}
        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">受注金額合計</p>
            <p className="text-2xl font-bold text-gray-900">
              ¥{Math.round(subtotal).toLocaleString('ja-JP')}
            </p>
          </div>
        </div>
      </section>

      {/* ─── 備考 ─── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">備考</h2>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          rows={3} placeholder="特記事項など"
          className={`${cls} resize-none`} />
      </section>

      {/* ─── ボタン ─── */}
      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="px-6 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#1F3864' }}>
          {pending ? '保存中...' : isEdit ? '更新する' : '受注を登録'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">
          キャンセル
        </button>
      </div>
    </form>
  )
}
