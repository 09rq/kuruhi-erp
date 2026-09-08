'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createProduct, updateProduct } from './actions'
import SearchableSelect from '@/components/SearchableSelect'
import type {
  Product, ProductCategory, ProductVariant, ProductCostItem,
  ProductStatus, VariantStatus, CostMode,
} from '@/lib/types/product'
import {
  PRODUCT_STATUS_LABELS,
  MATERIAL_COST_CATEGORIES,
  OUTSOURCE_PROCESSES,
} from '@/lib/types/product'
import { DEPARTMENTS } from '@/lib/constants/departments'

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────
interface Client { id: string; name: string }
interface MaterialOption {
  id: string; name: string; code: string; standard_price: number | null
  category?: string; unit?: string | null; short_name?: string | null
  supplier_short_name?: string | null
}
interface VendorOption { id: string; name: string; short_name: string }
interface SupplierOption { id: string; name: string; short_name: string | null }

interface BrandOption { id: string; name: string }

interface Props {
  product?: Product
  variants?: ProductVariant[]
  costItems?: ProductCostItem[]
  categories?: ProductCategory[]
  clients?: Client[]
  materialOptions?: MaterialOption[]
  vendors?: VendorOption[]
  supplierOptions?: SupplierOption[]
  brands?: BrandOption[]
  copyFrom?: Product  // コピー元製品（新規作成時に基本情報を事前入力）
  initialProductNo?: string  // 新規登録時の自動採番品番
}

// 原価明細の行型（material / outsource / labor 共通）
interface CostRow {
  key: string
  category: string     // 材料:区分       外注:工程   労務:部門
  supplier: string     // 材料:取引先      外注:外注先名  労務:備考
  name: string         // 材料:材料名      外注:業務内容  労務:業務内容
  material_id: string  // 標準原価モードのみ
  quantity: string
  unit_price: string
  yield_rate: string   // 歩留（主材料・生地のみ）
  width_cm: string     // 横幅cm（生地のみ）
  notes: string        // 材料:備考
}

interface VariantRow {
  key: string
  color_name: string
  color_hex: string
  material: string
  size_label: string
  status: VariantStatus
}

// ────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────
let _keySeq = 0
function nextKey() { return String(++_keySeq) }

function newCostRow(): CostRow {
  return {
    key: nextKey(), category: '', supplier: '', name: '',
    material_id: '', quantity: '', unit_price: '',
    yield_rate: '', width_cm: '', notes: '',
  }
}

// 行を上下に移動
function moveRow<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

// 指定インデックスの直後に新しい行を挿入
function insertAfterRow<T>(arr: T[], idx: number, newItem: T): T[] {
  const copy = [...arr]
  copy.splice(idx + 1, 0, newItem)
  return copy
}

// 材料費：区分によって計算式が変わる（端数は切り上げ）
function materialRowAmount(r: CostRow): number {
  const qty       = Number(r.quantity)   || 0
  const price     = Number(r.unit_price) || 0
  const yieldRate = Number(r.yield_rate) || 0
  const widthCm   = Number(r.width_cm)   || 0

  if (r.category === '革') {
    // qty(ds) × yield_rate × unit_price
    return Math.ceil(qty * yieldRate * price)
  } else if (r.category === '生地') {
    // (qty ÷ width_cm) × yield_rate × unit_price
    return widthCm > 0 ? Math.ceil((qty / widthCm) * yieldRate * price) : 0
  } else {
    // 金具・ファスナー・箱・その他: qty × unit_price
    return Math.ceil(qty * price)
  }
}

// 実値数量（材料費の中間値）
function materialEffectiveQty(r: CostRow): number | null {
  const qty       = Number(r.quantity)   || 0
  const yieldRate = Number(r.yield_rate) || 0
  const widthCm   = Number(r.width_cm)   || 0

  if (r.category === '革')  return qty * yieldRate
  if (r.category === '生地') return widthCm > 0 ? (qty / widthCm) * yieldRate : null
  return null
}

// 外注費：qty × unit_price（端数は切り上げ）
function outsourceRowAmount(r: CostRow): number {
  return Math.ceil((Number(r.quantity) || 0) * (Number(r.unit_price) || 0))
}

// 社内労務：hourly_rate ÷ items_per_hour（1個あたり加工賃、切り上げ）
function laborRowAmount(r: CostRow): number {
  const hourlyRate   = Number(r.unit_price) || 0
  const itemsPerHour = Number(r.quantity)   || 0
  return itemsPerHour > 0 ? Math.ceil(hourlyRate / itemsPerHour) : 0
}

function fmtJPY(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`
}

function fmtNum(n: number, digits = 3) {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: digits })
}

// ────────────────────────────────────────────────────────────
// 共通スタイル
// ────────────────────────────────────────────────────────────
const cls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'
const cellInput =
  'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const cellSelect =
  'w-full px-2 py-1.5 border border-gray-300 rounded text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const numInput =
  `${cellInput} text-right`

// ────────────────────────────────────────────────────────────
// 共通コンポーネント
// ────────────────────────────────────────────────────────────
function Field({ label, required, children, colSpan }: {
  label: string; required?: boolean; children: React.ReactNode; colSpan?: boolean
}) {
  return (
    <div className={colSpan ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function SelWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
    </div>
  )
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
      title="削除"
    >
      ×
    </button>
  )
}

function RowOps({
  onMoveUp, onMoveDown, onInsert, onRemove, isFirst, isLast,
}: {
  onMoveUp: () => void; onMoveDown: () => void
  onInsert: () => void; onRemove: () => void
  isFirst: boolean; isLast: boolean
}) {
  const btnBase = 'px-1 py-0.5 text-xs rounded transition-colors'
  return (
    <td className="px-1 py-1 text-center align-middle" style={{ width: 88 }}>
      <div className="flex flex-col gap-0.5 items-center">
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onMoveUp} disabled={isFirst}
            title="上に移動"
            className={`${btnBase} text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed`}>↑</button>
          <button type="button" onClick={onMoveDown} disabled={isLast}
            title="下に移動"
            className={`${btnBase} text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed`}>↓</button>
          <button type="button" onClick={onRemove}
            title="削除"
            className={`${btnBase} text-red-400 hover:text-red-600 hover:bg-red-50`}>×</button>
        </div>
        <button type="button" onClick={onInsert}
          title="直下に行を追加"
          className={`${btnBase} text-[10px] text-blue-400 hover:text-blue-600 hover:bg-blue-50 whitespace-nowrap`}>＋挿入</button>
      </div>
    </td>
  )
}

function AddRowBtn({ onClick, label = '＋ 行を追加' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
    >
      {label}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-600 mb-2">{children}</p>
}

function TotalRow({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
      <span className={`font-mono ${bold ? 'text-[#1F3864]' : 'text-gray-700'}`}>{fmtJPY(amount)}</span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 材料費明細 行コンポーネント
// 区分によって表示する列が変わる
// ────────────────────────────────────────────────────────────
function MaterialRow({
  row, onChange, onRemove, onMoveUp, onMoveDown, onInsert, isFirst, isLast, isStandard, materialOptions, supplierOptions,
}: {
  row: CostRow
  onChange: (r: CostRow) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onInsert: () => void
  isFirst: boolean
  isLast: boolean
  isStandard: boolean
  materialOptions: MaterialOption[]
  supplierOptions: SupplierOption[]
}) {
  const set = (p: Partial<CostRow>) => onChange({ ...row, ...p })
  const amount       = materialRowAmount(row)
  const effectiveQty = materialEffectiveQty(row)

  const hasYield = row.category === '革' || row.category === '生地'
  const hasWidth = row.category === '生地'

  const handleMaterialSelect = (opt: MaterialOption) => {
    set({
      material_id: opt.id,
      name:        opt.name,
      unit_price:  opt.standard_price?.toString() ?? row.unit_price,
      supplier:    opt.supplier_short_name ?? row.supplier,
    })
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      {/* 区分 */}
      <td className="px-2 py-1.5" style={{ width: 100, minWidth: 100 }}>
        <SelWrap>
          <select
            value={row.category}
            onChange={(e) => set({ category: e.target.value })}
            className={cellSelect}
          >
            <option value="">選択</option>
            {MATERIAL_COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </SelWrap>
      </td>
      {/* 取引先（簡易見積・標準原価とも取引先マスタから検索できる） */}
      <td className="px-2 py-1.5" style={{ width: 120, minWidth: 120 }}>
        {supplierOptions.length > 0 ? (
          <SupplierCombobox
            value={row.supplier}
            options={supplierOptions}
            onChange={(v) => set({ supplier: v })}
          />
        ) : (
          <input
            type="text"
            value={row.supplier}
            onChange={(e) => set({ supplier: e.target.value })}
            placeholder="取引先"
            className={cellInput}
          />
        )}
      </td>
      {/* 材料名（材料マスタから検索して選択。マスタが空の場合のみ手入力にフォールバック） */}
      <td className="px-2 py-1.5" style={{ width: 260, minWidth: 260 }}>
        {materialOptions.length > 0 ? (
          <MaterialCombobox
            value={row.name}
            options={materialOptions}
            onSelect={handleMaterialSelect}
            categoryFilter={row.category || undefined}
          />
        ) : (
          <input
            type="text"
            value={row.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="材料名"
            className={cellInput}
          />
        )}
      </td>
      {/* 備考 */}
      <td className="px-2 py-1.5" style={{ width: 120, minWidth: 120 }}>
        <input
          type="text"
          value={row.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="備考"
          className={cellInput}
        />
      </td>
      {/* 数量 */}
      <td className="px-2 py-1.5" style={{ width: 76, minWidth: 76 }}>
        <input
          type="number"
          value={row.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
          min={0} step="0.001"
          placeholder={hasYield ? 'ds' : '個'}
          className={numInput}
        />
      </td>
      {/* 横幅(cm) — 生地のみ */}
      <td className="px-2 py-1.5 text-center" style={{ width: 70, minWidth: 70 }}>
        {hasWidth ? (
          <input
            type="number"
            value={row.width_cm}
            onChange={(e) => set({ width_cm: e.target.value })}
            min={0} step="0.1" placeholder="0"
            className={numInput}
          />
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      {/* 歩留 — 革・生地のみ */}
      <td className="px-2 py-1.5 text-center" style={{ width: 70, minWidth: 70 }}>
        {hasYield ? (
          <input
            type="number"
            value={row.yield_rate}
            onChange={(e) => set({ yield_rate: e.target.value })}
            min={0} step="0.001" placeholder="1"
            className={numInput}
          />
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      {/* 実値数量 */}
      <td className="px-2 py-1.5 text-right text-xs font-mono text-gray-500" style={{ width: 80, minWidth: 80 }}>
        {effectiveQty !== null ? fmtNum(effectiveQty) : <span className="text-gray-300">—</span>}
      </td>
      {/* 単価（小数第1位まで） */}
      <td className="px-2 py-1.5" style={{ width: 90, minWidth: 90 }}>
        <input
          type="number"
          value={row.unit_price}
          onChange={(e) => set({ unit_price: e.target.value })}
          min={0} step="0.1" placeholder="0"
          className={numInput}
        />
      </td>
      {/* 金額 */}
      <td className="px-2 py-1.5 text-right text-sm font-mono text-gray-700" style={{ width: 80, minWidth: 80 }}>
        {fmtJPY(amount)}
      </td>
      <RowOps
        onMoveUp={onMoveUp} onMoveDown={onMoveDown}
        onInsert={onInsert} onRemove={onRemove}
        isFirst={isFirst} isLast={isLast}
      />
    </tr>
  )
}

// ────────────────────────────────────────────────────────────
// 外注費明細 行コンポーネント
// ────────────────────────────────────────────────────────────
function OutsourceRow({
  row, onChange, onRemove, onMoveUp, onMoveDown, onInsert, isFirst, isLast, vendors,
}: {
  row: CostRow; onChange: (r: CostRow) => void; onRemove: () => void
  onMoveUp: () => void; onMoveDown: () => void; onInsert: () => void
  isFirst: boolean; isLast: boolean
  vendors?: VendorOption[]
}) {
  const set = (p: Partial<CostRow>) => onChange({ ...row, ...p })
  const amount = outsourceRowAmount(row)

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      {/* 工程 */}
      <td className="px-2 py-1.5" style={{ width: 110, minWidth: 110 }}>
        <SelWrap>
          <select
            value={row.category}
            onChange={(e) => set({ category: e.target.value })}
            className={cellSelect}
          >
            <option value="">選択</option>
            {OUTSOURCE_PROCESSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </SelWrap>
      </td>
      {/* 外注先名（入力すると取引先候補が出るコンボボックス） */}
      <td className="px-2 py-1.5" style={{ width: 130, minWidth: 130 }}>
        {vendors && vendors.length > 0 ? (
          <SupplierCombobox
            value={row.supplier}
            options={vendors}
            onChange={(v) => set({ supplier: v })}
          />
        ) : (
          <input
            type="text"
            value={row.supplier}
            onChange={(e) => set({ supplier: e.target.value })}
            placeholder="外注先名"
            className={cellInput}
          />
        )}
      </td>
      {/* 業務内容 */}
      <td className="px-2 py-1.5" style={{ width: 180, minWidth: 180 }}>
        <input
          type="text"
          value={row.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="業務内容"
          className={cellInput}
        />
      </td>
      {/* 数量 */}
      <td className="px-2 py-1.5" style={{ width: 70, minWidth: 70 }}>
        <input
          type="number"
          value={row.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
          min={0} step="0.001" placeholder="0"
          className={numInput}
        />
      </td>
      {/* 単価 */}
      <td className="px-2 py-1.5" style={{ width: 90, minWidth: 90 }}>
        <input
          type="number"
          value={row.unit_price}
          onChange={(e) => set({ unit_price: e.target.value })}
          min={0} step="1" placeholder="0"
          className={numInput}
        />
      </td>
      {/* 金額 */}
      <td className="px-2 py-1.5 text-right text-sm font-mono text-gray-700" style={{ width: 80, minWidth: 80 }}>
        {fmtJPY(amount)}
      </td>
      <RowOps
        onMoveUp={onMoveUp} onMoveDown={onMoveDown}
        onInsert={onInsert} onRemove={onRemove}
        isFirst={isFirst} isLast={isLast}
      />
    </tr>
  )
}

// ────────────────────────────────────────────────────────────
// 社内労務 行コンポーネント
// unit_price=時間給、quantity=工数（個/h）、amount=時間給÷工数
// ────────────────────────────────────────────────────────────
function LaborRow({
  row, onChange, onRemove, onMoveUp, onMoveDown, onInsert, isFirst, isLast,
}: {
  row: CostRow; onChange: (r: CostRow) => void; onRemove: () => void
  onMoveUp: () => void; onMoveDown: () => void; onInsert: () => void
  isFirst: boolean; isLast: boolean
}) {
  const set = (p: Partial<CostRow>) => onChange({ ...row, ...p })
  const amount = laborRowAmount(row)

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      {/* 部門 */}
      <td className="px-2 py-1.5" style={{ width: 120, minWidth: 120 }}>
        <SelWrap>
          <select
            value={row.category}
            onChange={(e) => set({ category: e.target.value })}
            className={cellSelect}
          >
            <option value="">選択</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </SelWrap>
      </td>
      {/* 業務内容 */}
      <td className="px-2 py-1.5" style={{ width: 150, minWidth: 150 }}>
        <input
          type="text"
          value={row.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="業務内容"
          className={cellInput}
        />
      </td>
      {/* 備考 */}
      <td className="px-2 py-1.5" style={{ width: 150, minWidth: 150 }}>
        <input
          type="text"
          value={row.supplier}
          onChange={(e) => set({ supplier: e.target.value })}
          placeholder="備考"
          className={cellInput}
        />
      </td>
      {/* 時間給 */}
      <td className="px-2 py-1.5" style={{ width: 100, minWidth: 100 }}>
        <input
          type="number"
          value={row.unit_price}
          onChange={(e) => set({ unit_price: e.target.value })}
          min={0} step="1" placeholder="0"
          className={numInput}
        />
      </td>
      {/* 工数（個/h） */}
      <td className="px-2 py-1.5" style={{ width: 100, minWidth: 100 }}>
        <input
          type="number"
          value={row.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
          min={0} step="0.01" placeholder="0"
          className={numInput}
        />
      </td>
      {/* 金額 */}
      <td className="px-2 py-1.5 text-right text-sm font-mono text-gray-700" style={{ width: 80, minWidth: 80 }}>
        {fmtJPY(Math.round(amount))}
      </td>
      <RowOps
        onMoveUp={onMoveUp} onMoveDown={onMoveDown}
        onInsert={onInsert} onRemove={onRemove}
        isFirst={isFirst} isLast={isLast}
      />
    </tr>
  )
}

// ────────────────────────────────────────────────────────────
// バリエーション 行コンポーネント
// ────────────────────────────────────────────────────────────
function VariantRowItem({
  row, onChange, onRemove,
}: {
  row: VariantRow; onChange: (r: VariantRow) => void; onRemove: () => void
}) {
  const set = (p: Partial<VariantRow>) => onChange({ ...row, ...p })
  return (
    <tr className="border-b border-gray-100">
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={row.color_hex}
            onChange={(e) => set({ color_hex: e.target.value })}
            className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={row.color_name}
            onChange={(e) => set({ color_name: e.target.value })}
            placeholder="色名"
            className={cellInput}
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={row.material}
          onChange={(e) => set({ material: e.target.value })}
          placeholder="素材"
          className={cellInput}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={row.size_label}
          onChange={(e) => set({ size_label: e.target.value })}
          placeholder="例：F / S / M"
          className={cellInput}
        />
      </td>
      <td className="px-2 py-2">
        <SelWrap>
          <select
            value={row.status}
            onChange={(e) => set({ status: e.target.value as VariantStatus })}
            className={cellSelect}
          >
            <option value="active">有効</option>
            <option value="discontinued">廃番</option>
          </select>
        </SelWrap>
      </td>
      <td className="px-2 py-2 text-center">
        <RemoveBtn onClick={onRemove} />
      </td>
    </tr>
  )
}

// ────────────────────────────────────────────────────────────
// 文字列正規化（全角英数→半角、半角カタカナ→全角カタカナ）
// 検索時に全角・半角を統一して一致させるために使用
// ────────────────────────────────────────────────────────────
function normalize(s: string): string {
  // 全角英数字 → 半角
  let r = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  // 半角カタカナ → 全角カタカナ
  const hk: Record<string, string> = {
    'ｦ':'ヲ','ｧ':'ァ','ｨ':'ィ','ｩ':'ゥ','ｪ':'ェ','ｫ':'ォ','ｬ':'ャ','ｭ':'ュ','ｮ':'ョ',
    'ｯ':'ッ','ｰ':'ー','ｱ':'ア','ｲ':'イ','ｳ':'ウ','ｴ':'エ','ｵ':'オ','ｶ':'カ','ｷ':'キ',
    'ｸ':'ク','ｹ':'ケ','ｺ':'コ','ｻ':'サ','ｼ':'シ','ｽ':'ス','ｾ':'セ','ｿ':'ソ','ﾀ':'タ',
    'ﾁ':'チ','ﾂ':'ツ','ﾃ':'テ','ﾄ':'ト','ﾅ':'ナ','ﾆ':'ニ','ﾇ':'ヌ','ﾈ':'ネ','ﾉ':'ノ',
    'ﾊ':'ハ','ﾋ':'ヒ','ﾌ':'フ','ﾍ':'ヘ','ﾎ':'ホ','ﾏ':'マ','ﾐ':'ミ','ﾑ':'ム','ﾒ':'メ',
    'ﾓ':'モ','ﾔ':'ヤ','ﾕ':'ユ','ﾖ':'ヨ','ﾗ':'ラ','ﾘ':'リ','ﾙ':'ル','ﾚ':'レ','ﾛ':'ロ',
    'ﾜ':'ワ','ﾝ':'ン','ﾞ':'゛','ﾟ':'゜',
  }
  r = r.replace(/[ｦ-ﾟ]/g, (c) => hk[c] ?? c)
  return r.toLowerCase()
}

// ────────────────────────────────────────────────────────────
// 材料マスタ検索コンボボックス（標準原価タブ用）
// position:fixed ドロップダウンで overflow-x:auto テーブルを突き抜ける
// ────────────────────────────────────────────────────────────
function MaterialCombobox({
  value, options, onSelect, categoryFilter,
}: {
  value: string
  options: MaterialOption[]
  onSelect: (opt: MaterialOption) => void
  categoryFilter?: string
}) {
  const [query, setQuery]   = useState(value)
  const [open, setOpen]     = useState(false)
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 })
  const inputRef            = useRef<HTMLInputElement>(null)

  // 区分が選択されている場合はその区分の材料のみ対象にする
  const baseOptions = categoryFilter
    ? options.filter((o) => o.category === categoryFilter)
    : options

  const nq = normalize(query.trim())
  const filtered = (query.trim()
    ? baseOptions.filter((o) =>
        normalize(o.name).includes(nq) ||
        normalize(o.code).includes(nq) ||
        normalize(o.short_name ?? '').includes(nq) ||
        normalize(o.category ?? '').includes(nq)
      )
    : baseOptions
  ).slice(0, 12)

  const openWith = (q: string) => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom, left: r.left, width: Math.max(r.width, 280) })
    }
    setQuery(q)
    setOpen(true)
  }

  const handleSelect = (opt: MaterialOption) => {
    setQuery(opt.name)
    setOpen(false)
    onSelect(opt)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => openWith(e.target.value)}
        onFocus={() => openWith(query)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="材料名で検索"
        className={cellInput}
      />
      {open && filtered.length > 0 && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
        >
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={() => handleSelect(opt)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
            >
              <div className="text-xs font-medium text-gray-800">{opt.name}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {opt.code}
                {opt.category ? ` · ${opt.category}` : ''}
                {opt.unit ? ` · ${opt.unit}` : ''}
                {opt.supplier_short_name ? ` · ${opt.supplier_short_name}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 取引先検索コンボボックス（標準原価タブ 材料費明細用）
// ────────────────────────────────────────────────────────────
function SupplierCombobox({
  value, options, onChange,
}: {
  value: string
  options: SupplierOption[]
  onChange: (value: string) => void
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen]   = useState(false)
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 })
  const inputRef          = useRef<HTMLInputElement>(null)

  // 材料選択などで外部から value が変わった場合に表示を同期
  useEffect(() => { setQuery(value) }, [value])

  const nq = normalize(query.trim())
  const filtered = (query.trim()
    ? options.filter((o) =>
        normalize(o.short_name ?? '').includes(nq) ||
        normalize(o.name).includes(nq)
      )
    : options
  ).slice(0, 12)

  const openWith = (q: string) => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom, left: r.left, width: Math.max(r.width, 200) })
    }
    setQuery(q)
    setOpen(true)
  }

  const handleSelect = (opt: SupplierOption) => {
    const val = opt.short_name ?? opt.name
    setQuery(val)
    setOpen(false)
    onChange(val)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { openWith(e.target.value); onChange(e.target.value) }}
        onFocus={() => openWith(query)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="取引先で検索"
        className={cellInput}
      />
      {open && filtered.length > 0 && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
        >
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={() => handleSelect(opt)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
            >
              <div className="text-xs font-medium text-gray-800">{opt.short_name ?? opt.name}</div>
              {opt.short_name && (
                <div className="text-[10px] text-gray-400 mt-0.5">{opt.name}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 原価タブ テーブルラッパー
// ────────────────────────────────────────────────────────────
function CostTable({ headers, children, empty, minWidth }: {
  headers: string[]
  children: React.ReactNode
  empty: boolean
  minWidth?: string
}) {
  if (empty) {
    return (
      <div className="py-6 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded-lg">
        行がありません
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                {h}
              </th>
            ))}
            <th style={{ width: 88 }} />
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// メインフォーム
// ────────────────────────────────────────────────────────────
type Tab = 'basic' | 'cost' | 'variants'
const TABS: { id: Tab; label: string }[] = [
  { id: 'basic',    label: '基本情報' },
  { id: 'cost',     label: '原価・価格' },
  { id: 'variants', label: 'バリエーション' },
]

export default function ProductForm({
  product,
  variants = [],
  costItems = [],
  categories = [],
  clients = [],
  materialOptions = [],
  vendors = [],
  supplierOptions = [],
  brands = [],
  copyFrom,
  initialProductNo,
}: Props) {
  const router = useRouter()
  const isEdit = !!product
  const formRef = useRef<HTMLFormElement>(null)

  // コピー元を含む初期値ソース（編集時はproduct、コピー時はcopyFrom）
  const src = product ?? copyFrom

  const [activeTab, setActiveTab] = useState<Tab>('basic')
  const [pending, setPending] = useState(false)
  const [promoteMode, setPromoteMode] = useState(false)

  // 基本情報
  const [productNo, setProductNo] = useState(product?.product_no ?? initialProductNo ?? '')
  const [status, setStatus] = useState<ProductStatus>(src?.status ?? 'active')
  const [clientId, setClientId] = useState(product?.client_id ?? copyFrom?.client_id ?? '')
  const [brandName,  setBrandName]  = useState(src?.brand_name  ?? '')
  const [seriesName, setSeriesName] = useState(src?.series_name ?? '')
  const [brandOpen, setBrandOpen] = useState(false)

  // 原価モード
  const [costMode, setCostMode] = useState<CostMode>(src?.cost_mode ?? 'estimate')
  const [costConfirmed, setCostConfirmed] = useState(isEdit ? (product?.cost_confirmed ?? false) : false)
  const [defectRate, setDefectRate] = useState(src?.defect_rate?.toString() ?? '')
  const [sellingPrice, setSellingPrice] = useState(src?.selling_price?.toString() ?? '')
  const [shippingCost, setShippingCost] = useState(src?.shipping_cost?.toString() ?? '')
  const [miscCost, setMiscCost] = useState(src?.misc_cost?.toString() ?? '')

  // 原価明細行の初期化
  const initRows = (type: 'material' | 'outsource' | 'labor', mode: CostMode = costMode): CostRow[] =>
    costItems
      .filter((i) => i.cost_type === type && i.cost_mode === mode)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        key:         nextKey(),
        category:    i.category  ?? '',
        supplier:    i.supplier  ?? '',
        name:        i.name      ?? '',
        material_id: i.material_id ?? '',
        quantity:    i.quantity.toString(),
        unit_price:  i.unit_price.toString(),
        yield_rate:  i.yield_rate?.toString() ?? '',
        width_cm:    i.width_cm?.toString()   ?? '',
        notes:       i.notes     ?? '',
      }))

  const [materialRows,  setMaterialRows]  = useState<CostRow[]>(() => initRows('material'))
  const [outsourceRows, setOutsourceRows] = useState<CostRow[]>(() => initRows('outsource'))
  const [laborRows,     setLaborRows]     = useState<CostRow[]>(() => initRows('labor'))

  // バリエーション
  const [variantRows, setVariantRows] = useState<VariantRow[]>(() =>
    variants.map((v) => ({
      key:        nextKey(),
      color_name: v.color_name ?? '',
      color_hex:  v.color_hex  ?? '#000000',
      material:   v.material   ?? '',
      size_label: v.size_label ?? '',
      status:     v.status,
    }))
  )

  // 原価計算
  const materialTotal  = materialRows.reduce((s, r)  => s + materialRowAmount(r),  0)
  const outsourceTotal = outsourceRows.reduce((s, r) => s + outsourceRowAmount(r), 0)
  const laborTotal     = laborRows.reduce((s, r)     => s + laborRowAmount(r),     0)
  const shippingNum    = Number(shippingCost) || 0
  const miscNum        = Number(miscCost)     || 0
  const manufacturingCost = materialTotal + outsourceTotal + laborTotal + shippingNum + miscNum
  const defectRateNum  = Number(defectRate) || 0
  const mfgBase        = Math.round(manufacturingCost)
  const defectAmount   = Math.round(mfgBase * defectRateNum / 100)
  const costWithDefect = mfgBase + defectAmount
  const sellingNum     = Number(sellingPrice) || 0
  const grossProfit    = sellingPrice ? sellingNum - costWithDefect : null
  const grossMargin    = grossProfit !== null && sellingNum > 0
    ? (grossProfit / sellingNum) * 100
    : null

  // モード切替時に行を再初期化
  const handleModeChange = (mode: CostMode) => {
    setCostMode(mode)
    setMaterialRows(initRows('material', mode))
    setOutsourceRows(initRows('outsource', mode))
    setLaborRows(initRows('labor', mode))
  }

  // 簡易見積 → 標準原価へ転記（保存なし）
  const handlePromoteToStandard = () => {
    const copyRows = (rows: CostRow[]) => rows.map((r) => ({ ...r, key: nextKey() }))
    setMaterialRows(copyRows(materialRows))
    setOutsourceRows(copyRows(outsourceRows))
    setLaborRows(copyRows(laborRows))
    setCostMode('standard')
  }

  const buildCostItems = () => {
    const matItems = materialRows.map((r, i) => ({
      cost_type:   'material',
      cost_mode:   costMode,
      category:    r.category    || null,
      supplier:    r.supplier    || null,
      name:        r.name        || null,
      material_id: r.material_id || null,
      quantity:    Number(r.quantity)   || 0,
      unit_price:  Number(r.unit_price) || 0,
      yield_rate:  r.yield_rate ? (Number(r.yield_rate) || null) : null,
      width_cm:    r.width_cm   ? (Number(r.width_cm)   || null) : null,
      amount:      materialRowAmount(r),
      notes:       r.notes || null,
      sort_order:  i,
    }))

    const outItems = outsourceRows.map((r, i) => ({
      cost_type:   'outsource',
      cost_mode:   costMode,
      category:    r.category  || null,
      supplier:    r.supplier  || null,  // 外注先名
      name:        r.name      || null,  // 業務内容
      material_id: null,
      quantity:    Number(r.quantity)   || 0,
      unit_price:  Number(r.unit_price) || 0,
      yield_rate:  null,
      width_cm:    null,
      amount:      outsourceRowAmount(r),
      notes:       null,
      sort_order:  i,
    }))

    const laborItems = laborRows.map((r, i) => ({
      cost_type:   'labor',
      cost_mode:   costMode,
      category:    r.category  || null,  // 部門
      supplier:    r.supplier  || null,  // 備考
      name:        r.name      || null,  // 業務内容
      material_id: null,
      quantity:    Number(r.quantity)   || 0,
      unit_price:  Number(r.unit_price) || 0,
      yield_rate:  null,
      width_cm:    null,
      amount:      laborRowAmount(r),
      notes:       null,
      sort_order:  i,
    }))

    return [...matItems, ...outItems, ...laborItems]
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    try {
      const fd = new FormData(e.currentTarget)
      fd.set('brand_name',  brandName)
      fd.set('series_name', seriesName)
      fd.set('cost_items', JSON.stringify(buildCostItems()))
      fd.set('standard_material_cost',   String(Math.round(materialTotal)))
      fd.set('standard_processing_cost', String(Math.round(outsourceTotal + laborTotal + shippingNum + miscNum) + defectAmount))
      fd.set('selling_price',   sellingPrice)
      fd.set('defect_rate',     defectRate)
      fd.set('shipping_cost',   shippingCost)
      fd.set('misc_cost',       miscCost)
      fd.set('cost_mode',       costMode)
      fd.set('cost_confirmed',  costConfirmed ? 'true' : 'false')
      fd.set('variants', JSON.stringify(variantRows))
      if (promoteMode) fd.set('promote', 'true')

      if (isEdit) {
        await updateProduct(product.id, fd)
      } else {
        await createProduct(fd)
      }
    } catch (err) {
      // redirect() は内部的に例外を throw するため、re-throw して Next.js に処理させる
      if (isRedirectError(err)) throw err
      console.error('[ProductForm] 保存エラー:', err)
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
      setPromoteMode(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-7xl flex flex-col flex-1">
      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-6 sticky top-0 bg-gray-50 z-10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === tab.id
                ? 'border-[#1F3864] text-[#1F3864]'
                : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            {tab.label}
            {tab.id === 'variants' && variantRows.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs rounded-full bg-gray-200 text-gray-600">
                {variantRows.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════ 基本情報タブ ═══════════════════════════════ */}
      {/* hidden クラスで非表示にすることで DOM を保持し FormData に含まれるようにする */}
      <section className={`bg-white rounded-xl border border-gray-200 p-6 ${activeTab !== 'basic' ? 'hidden' : ''}`}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="品番" required>
            <input
              type="text"
              name="product_no"
              value={productNo}
              onChange={(e) =>
                setProductNo(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))
              }
              required
              placeholder="例：260414-00001"
              className={`${cls} font-mono uppercase`}
            />
            <p className="mt-1 text-xs text-gray-400">新規登録時は日付+連番で自動生成。手動変更も可能。</p>
          </Field>

          <Field label="品名" required>
            <input
              type="text"
              name="name"
              required
              defaultValue={product?.name ?? (copyFrom ? `${copyFrom.name}のコピー` : '')}
              placeholder="二つ折り財布"
              className={cls}
            />
          </Field>

          <Field label="ブランド名">
            <div className="relative">
              <input
                type="text"
                value={brandName}
                onChange={(e) => { setBrandName(e.target.value); setBrandOpen(true) }}
                onFocus={() => setBrandOpen(true)}
                onBlur={() => setTimeout(() => setBrandOpen(false), 150)}
                placeholder="例：KURUHI"
                className={cls}
                autoComplete="off"
              />
              {brandOpen && brands.filter((b) =>
                b.name.toLowerCase().includes(brandName.toLowerCase())
              ).length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
                  {brands
                    .filter((b) => b.name.toLowerCase().includes(brandName.toLowerCase()))
                    .map((b) => (
                      <li
                        key={b.id}
                        onMouseDown={() => { setBrandName(b.name); setBrandOpen(false) }}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                      >
                        {b.name}
                      </li>
                    ))
                  }
                </ul>
              )}
            </div>
          </Field>

          <Field label="シリーズ名">
            <input
              type="text"
              value={seriesName}
              onChange={(e) => setSeriesName(e.target.value)}
              placeholder="例：Classic Line"
              className={cls}
            />
          </Field>

          <Field label="カテゴリ">
            <SelWrap>
              <select name="category_id" defaultValue={product?.category_id ?? copyFrom?.category_id ?? ''} className={`${cls} appearance-none`}>
                <option value="">未設定</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </SelWrap>
          </Field>

          <Field label="ステータス" required>
            <SelWrap>
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                className={`${cls} appearance-none`}
              >
                {(Object.keys(PRODUCT_STATUS_LABELS) as ProductStatus[]).map((s) => (
                  <option key={s} value={s}>{PRODUCT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </SelWrap>
          </Field>

          <Field label="クライアント">
            <SearchableSelect
              name="client_id"
              value={clientId}
              onChange={(id) => setClientId(id)}
              options={clients.map((c) => ({ id: c.id, label: c.name }))}
              placeholder="クライアント名で検索"
              className={cls}
            />
          </Field>

          <Field label="クライアント品番">
            <input
              type="text"
              name="client_product_no"
              defaultValue={product?.client_product_no ?? copyFrom?.client_product_no ?? ''}
              placeholder="クライアント側の品番"
              className={cls}
            />
          </Field>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">サイズ（mm）</label>
            <div className="flex items-center gap-2">
              {(['width_mm', 'height_mm', 'depth_mm'] as const).map((field, i) => (
                <div key={field} className="flex items-center gap-2 flex-1">
                  {i > 0 && <span className="text-gray-400 text-sm">×</span>}
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {['W', 'H', 'D'][i]}
                    </span>
                    <input
                      type="number"
                      name={field}
                      defaultValue={product?.[field] ?? copyFrom?.[field] ?? ''}
                      min={0} step="0.1" placeholder="0"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
                    />
                  </div>
                </div>
              ))}
              <span className="text-xs text-gray-400 whitespace-nowrap">mm</span>
            </div>
          </div>

          <Field label="備考" colSpan>
            <textarea
              name="note"
              defaultValue={product?.note ?? copyFrom?.note ?? ''}
              rows={3}
              placeholder="特記事項など"
              className={`${cls} resize-none`}
            />
          </Field>
        </div>
      </section>

      {/* ═══════════════════════════════ 原価・価格タブ ═══════════════════════════════ */}
      <div className={`space-y-4 ${activeTab !== 'cost' ? 'hidden' : ''}`}>
        {/* モード切替ヘッダー */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {([
              { id: 'estimate', label: '簡易見積原価', sub: '営業向け・手入力' },
              { id: 'standard', label: '標準原価',     sub: '管理部向け・マスタ連携' },
            ] as { id: CostMode; label: string; sub: string }[]).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeChange(m.id)}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all
                  ${costMode === m.id
                    ? 'bg-white shadow text-[#1F3864]'
                    : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                <span>{m.label}</span>
                <span className="ml-1.5 text-xs font-normal opacity-60">{m.sub}</span>
              </button>
            ))}
          </div>

        </div>

        {/* ───── 材料費明細 ───── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>材料費明細</SectionTitle>
          <CostTable
            headers={[
              '区分', '取引先',
              '材料マスタ',
              '備考', '数量', '横幅(cm)', '歩留', '実値数量', '単価（円）', '金額',
            ]}
            minWidth="960px"
            empty={materialRows.length === 0}
          >
            {materialRows.map((row, idx) => (
              <MaterialRow
                key={row.key}
                row={row}
                isStandard={costMode === 'standard'}
                materialOptions={materialOptions}
                supplierOptions={supplierOptions}
                isFirst={idx === 0}
                isLast={idx === materialRows.length - 1}
                onChange={(r) => setMaterialRows((prev) => prev.map((p) => p.key === row.key ? r : p))}
                onRemove={() => setMaterialRows((prev) => prev.filter((p) => p.key !== row.key))}
                onMoveUp={() => setMaterialRows((prev) => moveRow(prev, idx, idx - 1))}
                onMoveDown={() => setMaterialRows((prev) => moveRow(prev, idx, idx + 1))}
                onInsert={() => setMaterialRows((prev) => insertAfterRow(prev, idx, newCostRow()))}
              />
            ))}
          </CostTable>
          <div className="flex items-center justify-between mt-2">
            <AddRowBtn onClick={() => setMaterialRows((p) => [...p, newCostRow()])} />
            {materialRows.length > 0 && (
              <span className="text-xs text-gray-500">
                材料費合計：<span className="font-mono font-medium">{fmtJPY(Math.round(materialTotal))}</span>
              </span>
            )}
          </div>
        </section>

        {/* ───── 外注費明細 ───── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>外注費明細</SectionTitle>
          <CostTable
            headers={['工程', '外注先名', '業務内容', '数量', '単価（円）', '金額']}
            minWidth="700px"
            empty={outsourceRows.length === 0}
          >
            {outsourceRows.map((row, idx) => (
              <OutsourceRow
                key={row.key}
                row={row}
                vendors={vendors}
                isFirst={idx === 0}
                isLast={idx === outsourceRows.length - 1}
                onChange={(r) => setOutsourceRows((prev) => prev.map((p) => p.key === row.key ? r : p))}
                onRemove={() => setOutsourceRows((prev) => prev.filter((p) => p.key !== row.key))}
                onMoveUp={() => setOutsourceRows((prev) => moveRow(prev, idx, idx - 1))}
                onMoveDown={() => setOutsourceRows((prev) => moveRow(prev, idx, idx + 1))}
                onInsert={() => setOutsourceRows((prev) => insertAfterRow(prev, idx, newCostRow()))}
              />
            ))}
          </CostTable>
          <div className="flex items-center justify-between mt-2">
            <AddRowBtn onClick={() => setOutsourceRows((p) => [...p, newCostRow()])} />
            {outsourceRows.length > 0 && (
              <span className="text-xs text-gray-500">
                外注費合計：<span className="font-mono font-medium">{fmtJPY(outsourceTotal)}</span>
              </span>
            )}
          </div>
        </section>

        {/* ───── 社内労務 ───── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>社内労務</SectionTitle>
          <CostTable
            headers={['部門', '業務内容', '備考', '時間給（円）', '工数（個/h）', '金額']}
            minWidth="740px"
            empty={laborRows.length === 0}
          >
            {laborRows.map((row, idx) => (
              <LaborRow
                key={row.key}
                row={row}
                isFirst={idx === 0}
                isLast={idx === laborRows.length - 1}
                onChange={(r) => setLaborRows((prev) => prev.map((p) => p.key === row.key ? r : p))}
                onRemove={() => setLaborRows((prev) => prev.filter((p) => p.key !== row.key))}
                onMoveUp={() => setLaborRows((prev) => moveRow(prev, idx, idx - 1))}
                onMoveDown={() => setLaborRows((prev) => moveRow(prev, idx, idx + 1))}
                onInsert={() => setLaborRows((prev) => insertAfterRow(prev, idx, newCostRow()))}
              />
            ))}
          </CostTable>
          <div className="flex items-center justify-between mt-2">
            <AddRowBtn onClick={() => setLaborRows((p) => [...p, newCostRow()])} />
            {laborRows.length > 0 && (
              <span className="text-xs text-gray-500">
                社内労務合計：<span className="font-mono font-medium">{fmtJPY(Math.round(laborTotal))}</span>
              </span>
            )}
          </div>
        </section>

        {/* ───── 簡易見積：標準原価に転記 ───── */}
        {costMode === 'estimate' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePromoteToStandard}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[#1F3864] text-[#1F3864] hover:bg-[#1F3864]/5 transition-colors"
            >
              → 標準原価に転記
            </button>
          </div>
        )}

        {/* ───── 原価サマリー & 販売単価 ───── */}
        <div className="grid grid-cols-2 gap-4">
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <SectionTitle>原価サマリー</SectionTitle>
            <TotalRow label="材料費合計"   amount={Math.round(materialTotal)} />
            <TotalRow label="外注費合計"   amount={Math.round(outsourceTotal)} />
            <TotalRow label="社内労務合計" amount={Math.round(laborTotal)} />
            {/* 発送費 */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-500 whitespace-nowrap">発送費</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">¥</span>
                <input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  min={0} step="1" placeholder="0"
                  className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                />
              </div>
            </div>
            {/* 雑費 */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-500 whitespace-nowrap">雑費</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">¥</span>
                <input
                  type="number"
                  value={miscCost}
                  onChange={(e) => setMiscCost(e.target.value)}
                  min={0} step="1" placeholder="0"
                  className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                />
              </div>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <TotalRow label="製造原価合計" amount={mfgBase} bold />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-sm text-gray-500 whitespace-nowrap">不良率</span>
              <div className="flex items-center gap-1.5">
                {defectRateNum > 0 && (
                  <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                    ＋{fmtJPY(defectAmount)}
                  </span>
                )}
                <input
                  name="defect_rate"
                  type="number"
                  value={defectRate}
                  onChange={(e) => setDefectRate(e.target.value)}
                  min={0} max={100} step="0.1" placeholder="0"
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
            {defectRateNum > 0 && (
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
                <span>不良率込み原価</span>
                <span className="font-mono text-[#1F3864]">{fmtJPY(costWithDefect)}</span>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <SectionTitle>販売単価</SectionTitle>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">販売単価（円）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                <input
                  name="selling_price"
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  min={0} step="1" placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
                />
              </div>
            </div>
            {grossProfit !== null && (
              <div className="rounded-lg bg-gray-50 p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">粗利</span>
                  <span className={`font-mono font-semibold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmtJPY(Math.round(grossProfit))}
                  </span>
                </div>
                {grossMargin !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">粗利率</span>
                    <span className={`font-semibold ${grossMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {grossMargin.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ───── 標準原価：確定ボタン ───── */}
        {costMode === 'standard' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">標準原価の確定</p>
              <p className="text-xs text-gray-400 mt-0.5">確定すると BOM・受注管理での選択候補に表示されます</p>
            </div>
            {costConfirmed ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
                  確定済み ✅
                </span>
                <button
                  type="button"
                  onClick={() => setCostConfirmed(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  確定を取り消す
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCostConfirmed(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#1F3864] text-white hover:bg-[#162b50] transition-colors"
              >
                標準原価を確定する
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════ バリエーションタブ ═══════════════════════════════ */}
      <section className={`bg-white rounded-xl border border-gray-200 p-6 ${activeTab !== 'variants' ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">バリエーション一覧</p>
          <AddRowBtn onClick={() => setVariantRows((p) => [...p, {
            key: nextKey(), color_name: '', color_hex: '#000000',
            material: '', size_label: '', status: 'active',
          }])} />
        </div>

        {variantRows.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
            バリエーションがありません。「行を追加」から登録してください。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 w-52">色</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600">素材</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 w-32">サイズラベル</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 w-24">ステータス</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {variantRows.map((row) => (
                  <VariantRowItem
                    key={row.key}
                    row={row}
                    onChange={(r) => setVariantRows((prev) => prev.map((p) => p.key === row.key ? r : p))}
                    onRemove={() => setVariantRows((prev) => prev.filter((p) => p.key !== row.key))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* フォーム最下部：ボタン（1セットのみ） */}
      <div className="sticky bottom-0 mt-6 py-4 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex items-center gap-3 z-10">
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
