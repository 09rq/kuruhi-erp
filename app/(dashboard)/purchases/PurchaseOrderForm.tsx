'use client'

import { useState, useCallback } from 'react'
import PurchaseFromOrder from '@/components/PurchaseFromOrder'
import { useRouter } from 'next/navigation'
import { createPurchaseOrder, updatePurchaseOrder } from './actions'
import type { PurchaseOrder, POItemRow } from '@/lib/types/purchase-order'
import type { EmployeeOption } from '@/lib/types/employee'

interface Supplier { id: string; name: string; phone: string | null; fax: string | null; contact_person: string | null }
interface MaterialOption { id: string; name: string; unit: string | null; standard_price: number | null }

interface Props {
  order?: PurchaseOrder
  suppliers: Supplier[]
  employees: EmployeeOption[]
  materials: MaterialOption[]
}

const cls = 'w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3864]'

function today() {
  return new Date().toISOString().split('T')[0]
}

function newRow(): POItemRow {
  return {
    _key: crypto.randomUUID(),
    material_id: '',
    item_name: '',
    model_name: '',
    color: '',
    quantity: '1',
    unit: '',
    unit_price: '0',
    delivery_date: '',
  }
}

export default function PurchaseOrderForm({ order, suppliers, employees, materials }: Props) {
  const router = useRouter()
  const isEdit = !!order
  const [pending, setPending] = useState(false)

  // ── ヘッダー状態 ──
  const [orderDate, setOrderDate] = useState(order?.order_date ?? today())
  const [deliveryDate, setDeliveryDate] = useState(order?.desired_delivery_date ?? '')
  const [supplierId, setSupplierId] = useState(order?.supplier_id ?? '')
  const [supplierPhone, setSupplierPhone] = useState(order?.supplier_phone ?? '')
  const [supplierFax, setSupplierFax] = useState(order?.supplier_fax ?? '')
  const [supplierContact, setSupplierContact] = useState(order?.supplier_contact ?? '')
  const [employeeId, setEmployeeId] = useState(order?.assigned_employee_id ?? '')
  const [note, setNote] = useState(order?.note ?? '')

  // ── 明細行 ──
  const [items, setItems] = useState<POItemRow[]>(() => {
    if (order?.items && order.items.length > 0) {
      return order.items.map((it) => ({
        _key: it.id,
        id: it.id,
        material_id: it.material_id ?? '',
        item_name: it.item_name,
        model_name: it.model_name ?? '',
        color: it.color ?? '',
        quantity: String(it.quantity),
        unit: it.unit ?? '',
        unit_price: String(it.unit_price),
        delivery_date: it.delivery_date ?? '',
      }))
    }
    return [newRow()]
  })

  // ── 発注先選択 → 自動入力 ──
  const handleSupplierChange = (id: string) => {
    setSupplierId(id)
    const s = suppliers.find((s) => s.id === id)
    if (s) {
      setSupplierPhone(s.phone ?? '')
      setSupplierFax(s.fax ?? '')
      setSupplierContact(s.contact_person ?? '')
    } else {
      setSupplierPhone(''); setSupplierFax(''); setSupplierContact('')
    }
  }

  // ── 材料選択 → 単位・単価自動入力 ──
  const handleMaterialChange = useCallback((key: string, materialId: string) => {
    const mat = materials.find((m) => m.id === materialId)
    setItems((prev) =>
      prev.map((row) =>
        row._key !== key ? row : {
          ...row,
          material_id: materialId,
          item_name: mat?.name ?? row.item_name,
          unit: mat?.unit ?? row.unit,
          unit_price: mat?.standard_price != null ? String(mat.standard_price) : row.unit_price,
        }
      )
    )
  }, [materials])

  const updateRow = useCallback((key: string, patch: Partial<POItemRow>) => {
    setItems((prev) => prev.map((r) => r._key === key ? { ...r, ...patch } : r))
  }, [])

  function handleAddFromOrder(materials: {
    material_id: string; material_name: string; material_code: string
    unit: string; required_quantity: number; surplus_quantity: number
    standard_price: number | null; supplier_name: string | null; supplier_id: string | null
  }[]) {
    const newItems = materials.map(mat => ({
      ...newRow(),
      item_name: mat.material_name,
      material_id: mat.material_id,
      quantity: String(mat.required_quantity + mat.surplus_quantity),
      unit: mat.unit,
      unit_price: String(mat.standard_price || 0),
      
    }))
    setItems(prev => [...prev.filter(r => r.item_name.trim()), ...newItems])
  }

  const addRow = () => setItems((prev) => [...prev, newRow()])
  const removeRow = (key: string) => setItems((prev) => prev.filter((r) => r._key !== key))

  // ── 合計 ──
  const subtotal = items.reduce(
    (s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0),
    0
  )

  // ── 送信 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!items.some((r) => r.item_name.trim())) {
      alert('明細を1件以上入力してください')
      return
    }
    const supplier = suppliers.find((s) => s.id === supplierId)
    setPending(true)
    try {
      const payload = {
        order_date: orderDate,
        desired_delivery_date: deliveryDate,
        supplier_id: supplierId,
        supplier_name: supplier?.name ?? '',
        supplier_phone: supplierPhone,
        supplier_fax: supplierFax,
        supplier_contact: supplierContact,
        assigned_employee_id: employeeId,
        note,
        items: items.filter((r) => r.item_name.trim()),
      }
      if (isEdit) {
        await updatePurchaseOrder(order.id, payload)
      } else {
        await createPurchaseOrder(payload)
      }
    } catch (err) {
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">

      {/* ヘッダー */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">発注日 <span className="text-red-500">*</span></label>
            <input type="date" required value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">希望納期</label>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">担当者</label>
            <div className="relative">
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={`${cls} appearance-none pr-7`}>
                <option value="">未設定</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}{e.department ? `（${e.department}）` : ''}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
          </div>
        </div>
      </section>

      {/* 発注先 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">発注先</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">発注先 <span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={supplierId} onChange={(e) => handleSupplierChange(e.target.value)} className={`${cls} appearance-none pr-7`}>
                <option value="">選択してください</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">TEL</label>
            <input type="tel" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="自動入力" className={cls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">FAX</label>
            <input type="tel" value={supplierFax} onChange={(e) => setSupplierFax(e.target.value)} placeholder="自動入力" className={cls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
            <input type="text" value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} placeholder="自動入力" className={cls} />
          </div>
        </div>
      </section>

      {/* 明細テーブル */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <PurchaseFromOrder onAddToOrder={handleAddFromOrder} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">明細</h2>
          <button
            type="button"
            onClick={addRow}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ＋ 行を追加
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left font-medium text-gray-500 w-44">シリーズ／商品名</th>
                <th className="pb-2 text-left font-medium text-gray-500 w-28 pl-2">型名</th>
                <th className="pb-2 text-left font-medium text-gray-500 w-20 pl-2">色</th>
                <th className="pb-2 text-right font-medium text-gray-500 w-20 pl-2">数量</th>
                <th className="pb-2 text-left font-medium text-gray-500 w-16 pl-2">単位</th>
                <th className="pb-2 text-right font-medium text-gray-500 w-24 pl-2">単価（円）</th>
                <th className="pb-2 text-right font-medium text-gray-500 w-24 pl-2">金額（円）</th>
                <th className="pb-2 text-left font-medium text-gray-500 w-28 pl-2">納期</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((row) => {
                const amount = (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)
                return (
                  <tr key={row._key} className="group">
                    <td className="py-2 pr-2">
                      <div className="space-y-1">
                        <div className="relative">
                          <select
                            value={row.material_id}
                            onChange={(e) => handleMaterialChange(row._key, e.target.value)}
                            className="appearance-none w-full pl-2 pr-6 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1F3864] bg-white"
                          >
                            <option value="">材料から選択</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400" style={{ fontSize: 9 }}>▼</span>
                        </div>
                        <input
                          type="text"
                          value={row.item_name}
                          onChange={(e) => updateRow(row._key, { item_name: e.target.value })}
                          placeholder="または手入力"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1F3864]"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <input type="text" value={row.model_name} onChange={(e) => updateRow(row._key, { model_name: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1F3864]" placeholder="型名" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="text" value={row.color} onChange={(e) => updateRow(row._key, { color: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1F3864]" placeholder="色" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" value={row.quantity} onChange={(e) => updateRow(row._key, { quantity: e.target.value })} min={0} step="0.001" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#1F3864]" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="text" value={row.unit} onChange={(e) => updateRow(row._key, { unit: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1F3864]" placeholder="個" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" value={row.unit_price} onChange={(e) => updateRow(row._key, { unit_price: e.target.value })} min={0} step="0.01" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#1F3864]" />
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-gray-700 whitespace-nowrap">
                      ¥{amount.toLocaleString('ja-JP')}
                    </td>
                    <td className="py-2 px-2">
                      <input type="date" value={row.delivery_date} onChange={(e) => updateRow(row._key, { delivery_date: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1F3864]" />
                    </td>
                    <td className="py-2 pl-2">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row._key)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none"
                        >×</button>
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
            <p className="text-xs text-gray-500 mb-1">御注文金額（税抜）</p>
            <p className="text-2xl font-bold text-gray-900">
              ¥{subtotal.toLocaleString('ja-JP')}
            </p>
          </div>
        </div>
      </section>

      {/* 備考 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">備考</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="特記事項など"
          className={`${cls} resize-none`}
        />
      </section>

      {/* ボタン */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#1F3864' }}
        >
          {pending ? '保存中...' : isEdit ? '更新する' : '発注書を作成'}
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
