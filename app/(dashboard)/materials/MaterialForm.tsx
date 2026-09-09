'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMaterial, updateMaterial } from './actions'
import SearchableSelect from '@/components/SearchableSelect'
import type { Material } from '@/lib/types/material'
import {
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  ORDER_METHODS,
  TAX_TYPES,
  TAX_RATES,
} from '@/lib/types/material'
import type { EmployeeOption } from '@/lib/types/employee'

interface Supplier { id: string; name: string; type: string }

interface Props {
  material?: Material
  suppliers?: Supplier[]
}

const cls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'
const selCls = `${cls} appearance-none`

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

function Select({ name, defaultValue, children }: {
  name: string; defaultValue?: string | number | null; children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select name={name} defaultValue={defaultValue ?? ''} className={selCls}>
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
    </div>
  )
}

export default function MaterialForm({ material, suppliers = [] }: Props) {
  const router = useRouter()
  const isEdit = !!material
  const [pending,           setPending]           = useState(false)
  const [stockManaged,      setStockManaged]      = useState(material?.stock_managed ?? true)
  const [inventoryCategory, setInventoryCategory] = useState(material?.inventory_category ?? true)
  const [lotManagement,     setLotManagement]     = useState(material?.lot_management ?? false)
  const [procurementType,   setProcurementType]   = useState<'buy' | 'supplied'>(
    material?.procurement_type ?? 'buy'
  )
  const [supplierId, setSupplierId] = useState(material?.supplier_id ?? '')

  const isSupplied = procurementType === 'supplied'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    try {
      const fd = new FormData(e.currentTarget)
      if (isEdit) {
        await updateMaterial(material.id, fd)
      } else {
        await createMaterial(fd)
      }
    } catch (err) {
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* 基本情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
        <div className="grid grid-cols-2 gap-4">
          {isEdit && (
            <Field label="品目コード">
              <input
                type="text"
                value={material.code}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 font-mono"
              />
            </Field>
          )}
          <Field label="材料名" required colSpan={!isEdit}>
            <input
              type="text"
              name="name"
              required
              defaultValue={material?.name}
              placeholder="牛革 ブラック"
              className={cls}
            />
          </Field>
          <Field label="材料区分" required>
            <Select name="category" defaultValue={material?.category ?? ''}>
              <option value="" disabled>選択してください</option>
              {MATERIAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="単位" required>
            <Select name="unit" defaultValue={material?.unit ?? '個'}>
              {MATERIAL_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="略称">
            <input
              type="text"
              name="short_name"
              defaultValue={material?.short_name ?? ''}
              placeholder="牛革BK"
              className={cls}
            />
          </Field>
          <Field label="規格">
            <input
              type="text"
              name="spec"
              defaultValue={material?.spec ?? ''}
              placeholder="A4 / 0.8mm厚"
              className={cls}
            />
          </Field>
          <Field label="色CD">
            <input
              type="text"
              name="color_cd"
              defaultValue={material?.color_cd ?? ''}
              placeholder="BK"
              className={cls}
            />
          </Field>
          <Field label="JANCD">
            <input
              type="text"
              name="jan_cd"
              defaultValue={material?.jan_cd ?? ''}
              placeholder="4900000000000"
              className={`${cls} font-mono`}
            />
          </Field>
          <Field label="調達区分" required>
            <div className="flex gap-3">
              {[
                { val: 'buy',      label: '買い',  desc: '通常購入部材' },
                { val: 'supplied', label: '支給',  desc: '支給部材（単価¥0）' },
              ].map(({ val, label, desc }) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="procurement_type"
                    value={val}
                    checked={procurementType === val}
                    onChange={() => setProcurementType(val as 'buy' | 'supplied')}
                    className="accent-[#1F3864]"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                  <span className="text-xs text-gray-400">（{desc}）</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="ステータス">
            <Select
              name="is_active"
              defaultValue={material ? (material.is_active ? 'true' : 'false') : 'true'}
            >
              <option value="true">有効</option>
              <option value="false">無効</option>
            </Select>
          </Field>
        </div>
      </section>

      {/* 在庫評価単価 */}
      <section className={`bg-white rounded-xl border p-6 ${isSupplied ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">在庫評価単価</h2>
        {isSupplied && (
          <p className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
            ※ 支給部材のため在庫評価単価は ¥0 に固定されます
          </p>
        )}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '標準単価', name: 'standard_price', val: isSupplied ? 0 : material?.standard_price },
            { label: '月初単価', name: 'month_start_price', val: isSupplied ? 0 : material?.month_start_price },
            { label: '月末単価', name: 'month_end_price', val: isSupplied ? 0 : material?.month_end_price },
          ].map(({ label, name, val }) => (
            <div key={name}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}（円）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                <input
                  type="number"
                  name={name}
                  value={isSupplied ? 0 : undefined}
                  defaultValue={isSupplied ? undefined : (val ?? '')}
                  readOnly={isSupplied}
                  min={0}
                  step="0.01"
                  placeholder="0"
                  className={`w-full pl-7 pr-3 py-2 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1F3864] ${
                    isSupplied ? 'bg-gray-100 border-gray-200 text-gray-400' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 取引先情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">取引先情報</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="仕入先 / 支給元" colSpan>
            <SearchableSelect
              name="supplier_id"
              value={supplierId}
              onChange={(id) => setSupplierId(id)}
              options={suppliers.map((s) => ({
                id: s.id,
                label: s.type === 'customer' ? `【販売先】${s.name}（支給元）`
                     : s.type === 'vendor_processing' ? `【外注先】${s.name}`
                     : `【仕入先】${s.name}`,
              }))}
              placeholder="取引先名で検索"
              className={cls}
            />
          </Field>
          <Field label="発注方法">
            <Select name="order_method" defaultValue={material?.order_method ?? ''}>
              <option value="">未設定</option>
              {ORDER_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="発注ロット">
            <input
              type="number"
              name="order_lot"
              defaultValue={material?.order_lot ?? ''}
              min={0}
              step="0.001"
              placeholder="1"
              className={cls}
            />
          </Field>
          <Field label="課税区分">
            <Select name="tax_type" defaultValue={material?.tax_type ?? ''}>
              <option value="">未設定</option>
              {TAX_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="消費税率">
            <Select name="tax_rate" defaultValue={material?.tax_rate ?? ''}>
              <option value="">未設定</option>
              {TAX_RATES.map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </Select>
          </Field>
          <Field label="販売終了日" colSpan>
            <input
              type="date"
              name="sales_end_date"
              defaultValue={material?.sales_end_date ?? ''}
              className={cls}
            />
          </Field>
        </div>
      </section>

      {/* 在庫情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">在庫情報</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="在庫管理区分" colSpan>
            <div className="flex gap-3">
              {[
                { val: 'true', label: '在庫管理する' },
                { val: 'false', label: '在庫管理しない' },
              ].map(({ val, label }) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="stock_managed"
                    value={val}
                    defaultChecked={stockManaged === (val === 'true')}
                    onChange={() => setStockManaged(val === 'true')}
                    className="accent-[#1F3864]"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </Field>

          {stockManaged && (
            <>
              <Field label="現在庫数">
                <input
                  type="number"
                  name="current_stock"
                  defaultValue={material?.current_stock ?? 0}
                  min={0}
                  step="0.001"
                  className={cls}
                />
              </Field>
              <Field label="安全在庫数">
                <input
                  type="number"
                  name="safety_stock"
                  defaultValue={material?.safety_stock ?? ''}
                  min={0}
                  step="0.001"
                  placeholder="0"
                  className={cls}
                />
                <p className="mt-1 text-xs text-gray-400">
                  この数量を下回ると在庫アラートが表示されます
                </p>
              </Field>
              <Field label="発注点">
                <input
                  type="number"
                  name="reorder_point"
                  defaultValue={material?.reorder_point ?? ''}
                  min={0}
                  step="0.001"
                  placeholder="0"
                  className={cls}
                />
              </Field>
            </>
          )}

          {!stockManaged && (
            <input type="hidden" name="current_stock" value="0" />
          )}

          <Field label="備考" colSpan>
            <textarea
              name="note"
              defaultValue={material?.note ?? ''}
              rows={3}
              placeholder="特記事項など"
              className={`${cls} resize-none`}
            />
          </Field>
        </div>
      </section>

      {/* 在庫・棚卸設定 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">在庫・棚卸設定</h2>
        <div className="grid grid-cols-2 gap-4">

          {/* 棚卸区分 */}
          <Field label="棚卸区分" colSpan>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="inventory_category"
                value="true"
                checked={inventoryCategory}
                onChange={(e) => setInventoryCategory(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1F3864]"
              />
              <span className="text-sm text-gray-700">定期棚卸対象にする</span>
            </label>
            {!inventoryCategory && (
              <input type="hidden" name="inventory_category" value="false" />
            )}
          </Field>

          {/* 保管場所 */}
          <Field label="保管場所">
            <input
              type="text"
              name="storage_location"
              defaultValue={material?.storage_location ?? ''}
              placeholder="倉庫A / 1F資材庫"
              className={cls}
            />
          </Field>

          {/* 棚番号 */}
          <Field label="棚番号">
            <input
              type="text"
              name="shelf_number"
              defaultValue={material?.shelf_number ?? ''}
              placeholder="A-01-03"
              className={cls}
            />
          </Field>

          {/* ロット管理 */}
          <Field label="ロット管理" colSpan>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="lot_management"
                value="true"
                checked={lotManagement}
                onChange={(e) => setLotManagement(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1F3864]"
              />
              <span className="text-sm text-gray-700">ロットごとに単価管理する</span>
            </label>
            {!lotManagement && (
              <input type="hidden" name="lot_management" value="false" />
            )}
          </Field>

        </div>
      </section>

      {/* ボタン */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#1F3864' }}
        >
          {pending ? '保存中...' : isEdit ? '更新する' : '登録する'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
