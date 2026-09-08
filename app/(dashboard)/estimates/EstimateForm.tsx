'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEstimate, updateEstimate } from './actions'
import type { Estimate, EstimateItemRow } from '@/lib/types/estimate'
import SearchableSelect from '@/components/SearchableSelect'

interface Client { id: string; name: string }
interface ProductVariant { id: string; label: string }
interface ProductOption {
  id: string
  name: string
  selling_price: number | null
  variants: ProductVariant[]
  client_id: string | null
}

interface Props {
  estimate?: Estimate
  clients: Client[]
  products: ProductOption[]
  estimateNumber: string   // 自動採番済みの番号（新規時）
}

// ────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0]
}

let _seq = 0
function nextKey() { return String(++_seq) }

function newRow(): EstimateItemRow {
  return { _key: nextKey(), product_id: '', item_name: '', quantity: '1', unit: '個', unit_price: '', notes: '' }
}

function rowAmount(row: EstimateItemRow): number {
  return (parseFloat(String(row.quantity ?? 0)) || 0) * (parseFloat(String(row.unit_price ?? 0)) || 0)
}

const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'
const cellCls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3864]'

function fmtMoney(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

// ────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────
export default function EstimateForm({ estimate, clients, products, estimateNumber }: Props) {
  const router = useRouter()
  const isEdit = !!estimate
  const [pending, setPending] = useState(false)

  // ── ヘッダー状態 ──────────────────────────────────────────
  const [clientId,      setClientId]      = useState(estimate?.client_id      ?? '')
  const [clientContact, setClientContact] = useState(estimate?.client_contact ?? '')
  const [issueDate,     setIssueDate]     = useState(estimate?.issue_date     ?? today())
  const [expiryDate,    setExpiryDate]    = useState(estimate?.expiry_date    ?? '')
  const [subject,       setSubject]       = useState(estimate?.subject        ?? '')
  const [deliveryDate,  setDeliveryDate]  = useState(estimate?.delivery_date  ?? '')
  const [paymentTerms,  setPaymentTerms]  = useState(estimate?.payment_terms  ?? '')
  const [notes,         setNotes]         = useState(estimate?.notes          ?? '')

  // ── 明細行 ────────────────────────────────────────────────
  const [items, setItems] = useState<EstimateItemRow[]>(() => {
    if (estimate?.items && estimate.items.length > 0) {
      return estimate.items.map((it) => ({
        _key:       it.id,
        id:         it.id,
        product_id: it.product_id ?? '',
        item_name:  it.item_name,
        quantity:   String(it.quantity  ?? '1'),
        unit:       it.unit       ?? '個',
        unit_price: String(it.unit_price ?? ''),
        notes:      it.notes      ?? '',
      }))
    }
    return [newRow()]
  })

  // ── 計算 ──────────────────────────────────────────────────
  const subtotal  = items.reduce((s, r) => s + rowAmount(r), 0)
  const taxAmount = Math.round(subtotal * 0.1)
  const grandTotal = subtotal + taxAmount

  // ── 明細操作 ──────────────────────────────────────────────
  function updateRow(key: string, patch: Partial<EstimateItemRow>) {
    setItems((prev) => prev.map((r) => r._key === key ? { ...r, ...patch } : r))
  }

  function removeRow(key: string) {
    setItems((prev) => prev.filter((r) => r._key !== key))
  }

  function addRow() {
    setItems((prev) => [...prev, newRow()])
  }

  function moveRow(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const copy = [...prev]
      const target = idx + dir
      if (target < 0 || target >= copy.length) return prev
      ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
      return copy
    })
  }

  function handleProductSelect(key: string, productId: string) {
    const prod = products.find((p) => p.id === productId)
    updateRow(key, {
      product_id: productId,
      item_name:  prod?.name ?? '',
      unit_price: prod?.selling_price != null ? String(prod.selling_price) : '',
    })
  }

  // ── 送信 ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (items.length === 0) { alert('明細を1行以上入力してください'); return }
    if (!issueDate) { alert('発行日を入力してください'); return }

    setPending(true)
    const payload = {
      client_id:      clientId,
      client_contact: clientContact,
      issue_date:     issueDate,
      expiry_date:    expiryDate,
      subject,
      delivery_date:  deliveryDate,
      total_amount:   Math.round(subtotal),
      tax_amount:     taxAmount,
      grand_total:    grandTotal,
      payment_terms:  paymentTerms,
      notes,
      items,
    }

    try {
      if (isEdit) {
        await updateEstimate(estimate!.id, payload)
      } else {
        await createEstimate(payload)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : String(err)))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 pb-8">
      <div className="flex flex-col gap-6">

        {/* ── 見積番号 ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">見積番号</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-500 select-none">
                {isEdit ? estimate!.estimate_number : estimateNumber}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 select-none">
                {isEdit ? estimate!.status === 'draft' ? '下書き' : estimate!.status === 'sent' ? '送付済' : estimate!.status === 'approved' ? '承認' : '失注' : '下書き'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">クライアント</label>
              <SearchableSelect
                value={clientId}
                onChange={(id) => setClientId(id)}
                options={clients.map((c) => ({ id: c.id, label: c.name }))}
                placeholder="クライアント名で検索"
                className={cls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
              <input
                type="text"
                value={clientContact}
                onChange={(e) => setClientContact(e.target.value)}
                placeholder="山田 太郎"
                className={cls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                発行日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                className={cls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">有効期限</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={cls}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">件名</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="例：財布 製造見積"
                className={cls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">納入期日</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={cls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">支払条件</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="例：月末締め翌月末払い"
                className={cls}
              />
            </div>

          </div>
        </div>

        {/* ── 明細 ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">明細</h2>
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-1.5 text-xs font-medium text-[#1F3864] border border-[#1F3864] rounded-lg hover:bg-blue-50 transition-colors"
            >
              ＋ 行を追加
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
                  <th className="px-2 py-2 text-left" style={{ width: 32 }}></th>
                  <th className="px-2 py-2 text-left" style={{ width: 160 }}>製品選択</th>
                  <th className="px-2 py-2 text-left">品名</th>
                  <th className="px-2 py-2 text-right" style={{ width: 72 }}>数量</th>
                  <th className="px-2 py-2 text-center" style={{ width: 64 }}>単位</th>
                  <th className="px-2 py-2 text-right" style={{ width: 100 }}>単価</th>
                  <th className="px-2 py-2 text-right" style={{ width: 100 }}>金額</th>
                  <th className="px-2 py-2 text-left" style={{ width: 140 }}>備考</th>
                  <th className="px-2 py-2" style={{ width: 72 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((row, idx) => {
                  // クライアントが選択されている場合は、製品マスタでそのクライアントに紐づく製品のみに絞り込む
                  // （既に選択済みの製品は、クライアント変更後も表示が消えないよう残す）
                  const rowProducts = clientId
                    ? products.filter((p) => p.client_id === clientId || p.id === row.product_id)
                    : products
                  return (
                  <tr key={row._key} className="hover:bg-gray-50/50">
                    {/* 順序 */}
                    <td className="px-1 py-2 text-center">
                      <div className="flex flex-col gap-0.5">
                        <button type="button" onClick={() => moveRow(idx, -1)} disabled={idx === 0}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">↑</button>
                        <button type="button" onClick={() => moveRow(idx, 1)} disabled={idx === items.length - 1}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">↓</button>
                      </div>
                    </td>

                    {/* 製品選択 */}
                    <td className="px-2 py-2">
                      <SearchableSelect
                        value={row.product_id ?? ''}
                        onChange={(id) => handleProductSelect(row._key ?? '', id)}
                        options={rowProducts.map((p) => ({ id: p.id, label: p.name }))}
                        placeholder="製品名で検索（手入力も可）"
                        className={`${cellCls} text-xs`}
                        emptyText={clientId ? 'このクライアントに紐づく製品がありません' : '該当する製品がありません'}
                      />
                      {/* バリエーション */}
                      {row.product_id && products.find((p) => p.id === row.product_id)?.variants?.length! > 0 && (
                        <div className="relative mt-1">
                          <select
                            className={`${cellCls} appearance-none pr-6 text-xs text-gray-500`}
                            onChange={(e) => {
                              const prod = products.find((p) => p.id === row.product_id)
                              const v = prod?.variants.find((v) => v.id === e.target.value)
                              if (v) updateRow(row._key ?? "", { item_name: `${prod!.name} [${v.label}]` })
                            }}
                          >
                            <option value="">バリエーション</option>
                            {products.find((p) => p.id === row.product_id)?.variants.map((v) => (
                              <option key={v.id} value={v.id}>{v.label}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▼</span>
                        </div>
                      )}
                    </td>

                    {/* 品名 */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.item_name ?? ""}
                        onChange={(e) => updateRow(row._key ?? "", { item_name: e.target.value })}
                        placeholder="品名を入力"
                        required
                        className={cellCls}
                      />
                    </td>

                    {/* 数量 */}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={row.quantity ?? ""}
                        onChange={(e) => updateRow(row._key ?? "", { quantity: e.target.value })}
                        min="0"
                        step="0.001"
                        className={`${cellCls} text-right`}
                      />
                    </td>

                    {/* 単位 */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.unit ?? ""}
                        onChange={(e) => updateRow(row._key ?? "", { unit: e.target.value })}
                        placeholder="個"
                        className={`${cellCls} text-center`}
                      />
                    </td>

                    {/* 単価 */}
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={row.unit_price ?? ""}
                        onChange={(e) => updateRow(row._key ?? "", { unit_price: e.target.value })}
                        min="0"
                        step="1"
                        placeholder="0"
                        className={`${cellCls} text-right`}
                      />
                    </td>

                    {/* 金額（計算済み） */}
                    <td className="px-2 py-2 text-right font-mono text-xs text-gray-700 whitespace-nowrap">
                      {fmtMoney(rowAmount(row))}
                    </td>

                    {/* 備考 */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.notes ?? ""}
                        onChange={(e) => updateRow(row._key ?? "", { notes: e.target.value })}
                        placeholder="備考"
                        className={`${cellCls} text-xs`}
                      />
                    </td>

                    {/* 削除 */}
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row._key ?? "")}
                        disabled={items.length <= 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-20 text-lg leading-none px-1"
                        title="削除"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 合計 */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">小計</span>
                <span className="font-mono">{fmtMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">消費税（10%）</span>
                <span className="font-mono">{fmtMoney(taxAmount)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-semibold text-gray-900">合計金額（税込）</span>
                <span className="font-mono font-bold text-lg text-[#1F3864]">{fmtMoney(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── その他 ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">その他</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">その他特記事項</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="特記事項・備考を入力"
              className={`${cls} resize-none`}
            />
          </div>
        </div>

        {/* ── 送信ボタン ──────────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-8 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#1F3864' }}
          >
            {pending ? '保存中...' : isEdit ? '更新する' : '登録する'}
          </button>
        </div>

      </div>
    </form>
  )
}
