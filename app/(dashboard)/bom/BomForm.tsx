'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createBom, updateBom } from './actions'
import { BOM_CATEGORIES } from '@/lib/types/bom'
import type { Bom, BomItem } from '@/lib/types/bom'
import { createClient } from '@/lib/supabase/client'

// ────────────────────────────────────────────────────────────
// 型
// ────────────────────────────────────────────────────────────
interface ProductOption  { id: string; product_no: string; name: string; cost_confirmed: boolean }
interface VariantOption  { id: string; product_id: string; color_name: string | null; size_label: string | null }
interface MaterialOption {
  id: string; name: string; code: string
  unit: string | null; standard_price: number | null
  category: string | null
}

interface Props {
  bom?: Bom
  bomItems?: BomItem[]
  products: ProductOption[]
  variants: VariantOption[]
  materials: MaterialOption[]
}

interface ItemRow {
  key: string
  material_id: string
  category: string
  quantity: string
  unit: string
  yield_rate: string
  width_cm: string
  unit_price: string
  notes: string
}

// ────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────
let _seq = 0
const nextKey = () => String(++_seq)

function newRow(): ItemRow {
  return {
    key: nextKey(), material_id: '', category: '',
    quantity: '', unit: '', yield_rate: '1', width_cm: '', unit_price: '', notes: '',
  }
}

function calcNetQty(r: ItemRow): number {
  const qty       = Number(r.quantity)   || 0
  const yieldRate = Number(r.yield_rate) || 0
  const widthCm   = Number(r.width_cm)   || 0
  if (r.category === '生地') return widthCm > 0 ? (qty / widthCm) * yieldRate : 0
  return qty * yieldRate
}

function calcAmount(r: ItemRow): number {
  return calcNetQty(r) * (Number(r.unit_price) || 0)
}

function fmtJPY(n: number) { return `¥${Math.ceil(n).toLocaleString('ja-JP')}` }
function fmtNum(n: number, d = 3) { return n.toLocaleString('ja-JP', { maximumFractionDigits: d }) }

// ────────────────────────────────────────────────────────────
// スタイル定数
// ────────────────────────────────────────────────────────────
const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'
const cellInput  = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const cellSelect = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const numInput   = `${cellInput} text-right`

function SelWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 明細行コンポーネント
// ────────────────────────────────────────────────────────────
function ItemRowComp({
  row, onChange, onRemove, materials,
}: {
  row: ItemRow
  onChange: (r: ItemRow) => void
  onRemove: () => void
  materials: MaterialOption[]
}) {
  const set = (p: Partial<ItemRow>) => onChange({ ...row, ...p })

  const handleMaterialSelect = (materialId: string) => {
    const mat = materials.find((m) => m.id === materialId)
    set({
      material_id: materialId,
      unit_price:  mat?.standard_price?.toString() ?? row.unit_price,
      unit:        mat?.unit ?? row.unit,
      category:    mat?.category ?? row.category,
    })
  }

  // 区分が選択されている場合はその区分の材料のみ表示
  const filteredMaterials = row.category
    ? materials.filter((m) => m.category === row.category)
    : materials

  const netQty = calcNetQty(row)
  const amount = calcAmount(row)
  const isFabric = row.category === '生地'

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      {/* 区分 */}
      <td className="px-2 py-1.5 w-28">
        <SelWrap>
          <select
            value={row.category}
            onChange={(e) => set({ category: e.target.value, material_id: '', unit: '', unit_price: '' })}
            className={cellSelect}
          >
            <option value="">選択</option>
            {BOM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </SelWrap>
      </td>
      {/* 材料名 */}
      <td className="px-2 py-1.5">
        <SelWrap>
          <select value={row.material_id} onChange={(e) => handleMaterialSelect(e.target.value)} className={cellSelect}>
            <option value="">{row.category ? `${row.category}から選択` : '材料を選択'}</option>
            {filteredMaterials.map((m) => (
              <option key={m.id} value={m.id}>{m.name}（{m.code}）</option>
            ))}
          </select>
        </SelWrap>
      </td>
      {/* 数量 */}
      <td className="px-2 py-1.5 w-20">
        <input type="number" value={row.quantity} onChange={(e) => set({ quantity: e.target.value })}
          min={0} step="0.001" placeholder="0" className={numInput} />
      </td>
      {/* 単位 */}
      <td className="px-2 py-1.5 w-16">
        <input type="text" value={row.unit} onChange={(e) => set({ unit: e.target.value })}
          placeholder="ds" className={cellInput} />
      </td>
      {/* 歩留 */}
      <td className="px-2 py-1.5 w-20">
        <input type="number" value={row.yield_rate} onChange={(e) => set({ yield_rate: e.target.value })}
          min={0} max={2} step="0.001" placeholder="1" className={numInput} />
      </td>
      {/* 横幅cm（生地のみ） */}
      <td className="px-2 py-1.5 w-20 text-center">
        {isFabric ? (
          <input type="number" value={row.width_cm} onChange={(e) => set({ width_cm: e.target.value })}
            min={0} step="0.1" placeholder="0" className={numInput} />
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      {/* 実値数量 */}
      <td className="px-2 py-1.5 w-24 text-right text-xs font-mono text-gray-500">
        {row.quantity ? fmtNum(netQty) : <span className="text-gray-300">—</span>}
      </td>
      {/* 単価 */}
      <td className="px-2 py-1.5 w-28">
        <input type="number" value={row.unit_price} onChange={(e) => set({ unit_price: e.target.value })}
          min={0} step="0.1" placeholder="0" className={numInput} />
      </td>
      {/* 金額 */}
      <td className="px-2 py-1.5 w-28 text-right text-sm font-mono text-gray-700">
        {fmtJPY(Math.ceil(amount))}
      </td>
      {/* 削除 */}
      <td className="px-1 py-1.5 w-8 text-center">
        <button type="button" onClick={onRemove}
          className="text-red-400 hover:text-red-600 text-lg leading-none px-1">×</button>
      </td>
    </tr>
  )
}

// ────────────────────────────────────────────────────────────
// メインフォーム
// ────────────────────────────────────────────────────────────
export default function BomForm({ bom, bomItems = [], products, variants, materials }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const isEdit = !!bom

  const [pending,   setPending]   = useState(false)
  const [productId, setProductId] = useState(bom?.product_id ?? '')
  const [variantId, setVariantId] = useState(bom?.product_variant_id ?? '')
  const [rows, setRows] = useState<ItemRow[]>(() =>
    bomItems.length > 0
      ? bomItems.map((i) => ({
          key:         nextKey(),
          material_id: i.material_id,
          category:    i.category    ?? '',
          quantity:    i.quantity.toString(),
          unit:        i.unit        ?? '',
          yield_rate:  i.yield_rate.toString(),
          width_cm:    i.width_cm?.toString()   ?? '',
          unit_price:  i.unit_price.toString(),
          notes:       i.notes       ?? '',
        }))
      : [newRow()]
  )

  const filteredVariants = variants.filter((v) => v.product_id === productId)
  const totalAmount = rows.reduce((s, r) => s + calcAmount(r), 0)

  // 製品選択時に製品マスタの原価明細（material）を自動読み込み
  const handleProductChange = async (newProductId: string) => {
    setProductId(newProductId)
    setVariantId('')
    if (!newProductId) return

    const supabase = createClient()
    const { data: costItems } = await supabase
      .from('product_cost_items')
      .select('*')
      .eq('product_id', newProductId)
      .eq('cost_type', 'material')
      .order('sort_order')

    if (!costItems || costItems.length === 0) return

    // 既存の入力済み行がある場合は確認
    const hasData = rows.some((r) => r.material_id || r.category)
    if (hasData) {
      if (!confirm('既存の明細を製品マスタの原価データで上書きしますか？')) return
    }

    const newRows: ItemRow[] = costItems.map((item) => {
      const mat = materials.find((m) => m.id === item.material_id)
      return {
        key:         nextKey(),
        material_id: item.material_id ?? '',
        category:    item.category    ?? '',
        quantity:    String(item.quantity),
        unit:        mat?.unit        ?? '',
        yield_rate:  String(item.yield_rate ?? 1),
        width_cm:    item.width_cm != null ? String(item.width_cm) : '',
        unit_price:  String(item.unit_price),
        notes:       item.notes       ?? '',
      }
    })

    setRows(newRows.length > 0 ? newRows : [newRow()])
  }

  const buildItems = () =>
    rows.map((r, i) => ({
      material_id: r.material_id,
      category:    r.category,
      quantity:    parseFloat(r.quantity)   || 0,
      unit:        r.unit,
      yield_rate:  parseFloat(r.yield_rate) || 1,
      width_cm:    r.width_cm ? (parseFloat(r.width_cm) || null) : null,
      unit_price:  parseFloat(r.unit_price) || 0,
      sort_order:  i,
      notes:       r.notes,
    }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!productId) { alert('製品を選択してください'); return }

    setPending(true)
    try {
      const fd = new FormData(e.currentTarget)
      fd.set('product_id',         productId)
      fd.set('product_variant_id', variantId)
      fd.set('bom_items', JSON.stringify(buildItems()))

      if (isEdit) {
        await updateBom(bom.id, fd)
      } else {
        await createBom(fd)
      }
    } catch (err) {
      if (isRedirectError(err)) throw err
      console.error('[BomForm]', err)
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-5xl flex flex-col flex-1">
      {/* ─── 基本情報 ─── */}
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
                onChange={(e) => handleProductChange(e.target.value)}
                className={`${cls} appearance-none`}
              >
                <option value="">製品を選択</option>
                {products.filter((p) => p.cost_confirmed).map((p) => (
                  <option key={p.id} value={p.id}>{p.product_no} — {p.name}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">※ 標準原価確定済みの製品のみ表示されます</p>
          </div>

          {/* バリエーション */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              バリエーション
              <span className="ml-1 text-xs text-gray-400 font-normal">（任意）</span>
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

          {/* 備考 */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
            <textarea
              name="notes"
              defaultValue={bom?.notes ?? ''}
              rows={2}
              placeholder="備考・メモ"
              className={`${cls} resize-none`}
            />
          </div>
        </div>
      </section>

      {/* ─── 材料明細 ─── */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-600">材料明細</p>
          {rows.length > 0 && (
            <span className="text-xs text-gray-500">
              合計：<span className="font-mono font-semibold text-[#1F3864]">{fmtJPY(totalAmount)}</span>
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded-lg mb-3">
            行がありません
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['区分', '材料名', '数量', '単位', '歩留', '横幅(cm)', '実値数量', '単価（円）', '金額'].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ItemRowComp
                    key={row.key}
                    row={row}
                    materials={materials}
                    onChange={(r) => setRows((prev) => prev.map((p) => p.key === row.key ? r : p))}
                    onRemove={() => setRows((prev) => prev.filter((p) => p.key !== row.key))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={() => setRows((p) => [...p, newRow()])}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ＋ 行を追加
        </button>

        {/* 合計サマリー */}
        {rows.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-gray-500">材料点数</span>
              <span className="font-medium">{rows.filter((r) => r.material_id).length} 点</span>
              <span className="text-gray-500">材料費合計</span>
              <span className="font-mono font-semibold text-[#1F3864]">{fmtJPY(totalAmount)}</span>
            </div>
          </div>
        )}
      </section>

      {/* ─── フッター ─── */}
      <div className="sticky bottom-0 mt-0 py-4 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex gap-3 z-10">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: '#1F3864' }}
        >
          {pending ? '保存中...' : isEdit ? '更新する' : '登録する'}
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
