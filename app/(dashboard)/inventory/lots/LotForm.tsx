'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createProductionLot } from './actions'

interface ProductOption  { id: string; product_no: string; name: string }
interface VariantOption  { id: string; product_id: string; color_name: string | null; size_label: string | null }
interface VendorOption   { id: string; name: string }

interface Props {
  products: ProductOption[]
  variants:  VariantOption[]
  vendors:   VendorOption[]
}

interface ProcessRow {
  key: string
  process_name: string
  vendor_id: string
  planned_quantity: string
  unit_price: string
  notes: string
}

let _seq = 0
const nextKey = () => String(++_seq)

function newRow(): ProcessRow {
  return {
    key: nextKey(), process_name: '', vendor_id: '',
    planned_quantity: '', unit_price: '', notes: '',
  }
}

const cls       = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'
const cellInput = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const cellSel   = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const numInput  = `${cellInput} text-right`

function SelWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
    </div>
  )
}

export default function LotForm({ products, variants, vendors }: Props) {
  const router  = useRouter()
  const [pending,   setPending]   = useState(false)
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [rows, setRows] = useState<ProcessRow[]>([newRow()])

  const filteredVariants = variants.filter((v) => v.product_id === productId)

  const totalWIP = rows.reduce((s, r) => {
    return s + (Number(r.planned_quantity) || 0) * (Number(r.unit_price) || 0)
  }, 0)

  const buildProcesses = () =>
    rows.map((r, i) => ({
      sort_order:       i,
      process_name:     r.process_name,
      vendor_id:        r.vendor_id || null,
      planned_quantity: Number(r.planned_quantity) || 0,
      unit_price:       Number(r.unit_price) || 0,
      purchase_status:  'unpaid' as const,
      purchase_date:    null,
      notes:            r.notes || null,
    }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!productId) { alert('製品を選択してください'); return }

    setPending(true)
    try {
      const fd = new FormData(e.currentTarget)
      fd.set('product_id',         productId)
      fd.set('product_variant_id', variantId)
      fd.set('processes', JSON.stringify(buildProcesses()))
      await createProductionLot(fd)
    } catch (err) {
      if (isRedirectError(err)) throw err
      console.error('[LotForm]', err)
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl flex flex-col flex-1">
      {/* 基本情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <p className="text-xs font-semibold text-gray-600 mb-4">基本情報</p>
        <div className="grid grid-cols-2 gap-4">
          {/* 製品 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              製品 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={productId}
                onChange={(e) => { setProductId(e.target.value); setVariantId('') }}
                className={`${cls} appearance-none`}
                required
              >
                <option value="">製品を選択</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.product_no} — {p.name}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
          </div>

          {/* バリエーション */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              バリエーション<span className="ml-1 text-xs text-gray-400 font-normal">（任意）</span>
            </label>
            <div className="relative">
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                disabled={filteredVariants.length === 0}
                className={`${cls} appearance-none disabled:bg-gray-50 disabled:text-gray-400`}
              >
                <option value="">すべてのバリエーション共通</option>
                {filteredVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {[v.color_name, v.size_label].filter(Boolean).join(' / ') || `ID: ${v.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
          </div>

          {/* 予定数量 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              予定数量 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="planned_quantity"
              min={1}
              step={1}
              placeholder="0"
              className={`${cls} text-right font-mono`}
              required
            />
          </div>

          {/* 備考 */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="備考・メモ"
              className={`${cls} resize-none`}
            />
          </div>
        </div>
      </section>

      {/* 加工工程 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-600">加工工程</p>
          {rows.length > 0 && (
            <span className="text-xs text-gray-500">
              仕掛品評価額合計：
              <span className="font-mono font-semibold text-[#1F3864]">
                ¥{Math.round(totalWIP).toLocaleString('ja-JP')}
              </span>
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded-lg mb-3">
            工程がありません
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['工程名', '外注先', '予定数量', '単価（円）', '金額', ''].map((h, i) => (
                    <th key={i} className="px-2 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const amt = (Number(row.planned_quantity) || 0) * (Number(row.unit_price) || 0)
                  const set = (p: Partial<ProcessRow>) =>
                    setRows((prev) => prev.map((r) => r.key === row.key ? { ...r, ...p } : r))
                  return (
                    <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.process_name}
                          onChange={(e) => set({ process_name: e.target.value })}
                          placeholder="例：縫製"
                          className={cellInput}
                        />
                      </td>
                      <td className="px-2 py-1.5 w-40">
                        <SelWrap>
                          <select
                            value={row.vendor_id}
                            onChange={(e) => set({ vendor_id: e.target.value })}
                            className={cellSel}
                          >
                            <option value="">選択（任意）</option>
                            {vendors.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </SelWrap>
                      </td>
                      <td className="px-2 py-1.5 w-24">
                        <input
                          type="number"
                          value={row.planned_quantity}
                          onChange={(e) => set({ planned_quantity: e.target.value })}
                          min={0} step={1} placeholder="0"
                          className={numInput}
                        />
                      </td>
                      <td className="px-2 py-1.5 w-28">
                        <input
                          type="number"
                          value={row.unit_price}
                          onChange={(e) => set({ unit_price: e.target.value })}
                          min={0} step={1} placeholder="0"
                          className={numInput}
                        />
                      </td>
                      <td className="px-2 py-1.5 w-28 text-right text-sm font-mono text-gray-700">
                        ¥{Math.round(amt).toLocaleString('ja-JP')}
                      </td>
                      <td className="px-1 py-1.5 w-8 text-center">
                        <button
                          type="button"
                          onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                          className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                        >×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={() => setRows((p) => [...p, newRow()])}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ＋ 工程を追加
        </button>
      </section>

      {/* フッター */}
      <div className="sticky bottom-0 mt-0 py-4 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex gap-3 z-10">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: '#1F3864' }}
        >
          {pending ? '保存中...' : '登録する'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
