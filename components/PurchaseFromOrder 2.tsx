'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, ChevronDown, Plus, Loader2, Check } from 'lucide-react'

interface SalesOrder {
  id: string
  order_number: string
  status: string
  customers?: { name: string }[]
}

interface RequiredMaterial {
  material_id: string
  material_name: string
  material_code: string
  unit: string
  required_quantity: number
  surplus_quantity: number
  standard_price: number | null
  supplier_name: string | null
  supplier_id: string | null
  product_name: string
  product_quantity: number
}

interface Props {
  onAddToOrder: (materials: RequiredMaterial[]) => void
}

export default function PurchaseFromOrder({ onAddToOrder }: Props) {
  const supabase = createClient()
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [requiredMaterials, setRequiredMaterials] = useState<RequiredMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const fetchSalesOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const { data } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, customers(name)')
        .in('status', ['confirmed', 'in_production'])
        .order('order_number', { ascending: false })
      setSalesOrders(data || [])
    } finally { setLoadingOrders(false) }
  }, [supabase])

  async function handleSelectOrder(orderId: string) {
    setSelectedOrderId(orderId)
    if (!orderId) { setRequiredMaterials([]); return }
    setLoading(true)
    try {
      // 受注明細を取得
      const { data: orderItems } = await supabase
        .from('sales_order_items')
        .select('*, products(id, name, product_no)')
        .eq('order_id', orderId)

      if (!orderItems || orderItems.length === 0) {
        setRequiredMaterials([])
        setLoading(false)
        return
      }

      const allMaterials: RequiredMaterial[] = []

      for (const item of orderItems) {
        const product = item.products as { id: string; name: string; product_no: string } | null
        if (!product) continue

        // 製品のBOMを取得
        const { data: bom } = await supabase
          .from('boms')
          .select('id')
          .eq('product_id', product.id)
          .eq('is_active', true)
          .single()

        if (!bom) continue

        // BOM明細を取得
        const { data: bomItems } = await supabase
          .from('bom_items')
          .select('*, materials(id, name, code, unit, standard_price, supplier_id, customers(name))')
          .eq('bom_id', bom.id)

        if (!bomItems) continue

        for (const bomItem of bomItems) {
          const material = bomItem.materials as {
            id: string; name: string; code: string; unit: string
            standard_price: number | null; supplier_id: string | null
            customers?: { name: string }[]
          } | null
          if (!material) continue

          const requiredQty = (bomItem.net_quantity || bomItem.quantity) * item.quantity

          // 同じ材料が既に追加されている場合は数量を加算
          const existing = allMaterials.find(m => m.material_id === material.id)
          if (existing) {
            existing.required_quantity += requiredQty
          } else {
            allMaterials.push({
              material_id: material.id,
              material_name: material.name,
              material_code: material.code,
              unit: material.unit,
              required_quantity: Number(requiredQty.toFixed(3)),
              surplus_quantity: 0,
              standard_price: material.standard_price,
              supplier_name: material.customers?.[0]?.name || null,
              supplier_id: material.supplier_id,
              product_name: product.name,
              product_quantity: item.quantity,
            })
          }
        }
      }

      setRequiredMaterials(allMaterials)
      // 全選択
      const sel: Record<string, boolean> = {}
      allMaterials.forEach(m => { sel[m.material_id] = true })
      setSelected(sel)
    } finally { setLoading(false) }
  }

  function handleToggle(materialId: string) {
    setSelected(prev => ({ ...prev, [materialId]: !prev[materialId] }))
  }

  function handleSurplusChange(materialId: string, value: number) {
    setRequiredMaterials(prev => prev.map(m =>
      m.material_id === materialId ? { ...m, surplus_quantity: value } : m
    ))
  }

  function handleAddSelected() {
    const selectedMaterials = requiredMaterials.filter(m => selected[m.material_id])
    onAddToOrder(selectedMaterials)
    setShowPanel(false)
    setSelectedOrderId('')
    setRequiredMaterials([])
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div className="mb-6">
      <button
        onClick={() => { setShowPanel(!showPanel); if (!showPanel) fetchSalesOrders() }}
        className="flex items-center gap-2 text-sm font-medium text-blue-600 border border-blue-300 px-4 py-2 rounded-lg hover:bg-blue-50"
      >
        <ShoppingCart className="h-4 w-4" />
        受注Noから材料を自動算出
        <ChevronDown className={`h-4 w-4 transition-transform ${showPanel ? 'rotate-180' : ''}`} />
      </button>

      {showPanel && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-blue-900 mb-3">受注Noから必要材料を自動算出</h3>

          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">受注Noを選択</label>
            {loadingOrders ? (
              <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />読み込み中...</div>
            ) : (
              <select
                value={selectedOrderId}
                onChange={e => handleSelectOrder(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">選択してください</option>
                {salesOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.order_number}（{o.customers?.[0]?.name || ''}）
                  </option>
                ))}
              </select>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />BOMから必要材料を算出中...
            </div>
          )}

          {!loading && requiredMaterials.length > 0 && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
                <div className="grid grid-cols-12 gap-0 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
                  <div className="col-span-1"></div>
                  <div className="col-span-3">材料名</div>
                  <div className="col-span-2">仕入先</div>
                  <div className="col-span-2 text-right">必要数量</div>
                  <div className="col-span-2">余剰数量</div>
                  <div className="col-span-1 text-right">単価</div>
                  <div className="col-span-1 text-right">小計</div>
                </div>
                {requiredMaterials.map(mat => {
                  const total = (mat.required_quantity + mat.surplus_quantity) * (mat.standard_price || 0)
                  return (
                    <div key={mat.material_id} className={`grid grid-cols-12 gap-0 px-3 py-2 border-b border-gray-100 ${!selected[mat.material_id] ? 'opacity-40' : ''}`}>
                      <div className="col-span-1 flex items-center">
                        <input type="checkbox" checked={selected[mat.material_id] || false}
                          onChange={() => handleToggle(mat.material_id)}
                          className="rounded border-gray-300" />
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs font-medium text-gray-900">{mat.material_name}</p>
                        <p className="text-xs text-gray-400">{mat.material_code}</p>
                      </div>
                      <div className="col-span-2 text-xs text-gray-600 flex items-center">{mat.supplier_name || '未設定'}</div>
                      <div className="col-span-2 text-xs text-right flex items-center justify-end font-medium text-blue-700">
                        {mat.required_quantity.toFixed(2)} {mat.unit}
                      </div>
                      <div className="col-span-2 flex items-center px-2">
                        <input
                          type="number"
                          value={mat.surplus_quantity}
                          onChange={e => handleSurplusChange(mat.material_id, Number(e.target.value))}
                          min={0} step="0.1"
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400 ml-1">{mat.unit}</span>
                      </div>
                      <div className="col-span-1 text-xs text-right flex items-center justify-end text-gray-600">
                        {mat.standard_price ? `¥${mat.standard_price.toLocaleString()}` : '-'}
                      </div>
                      <div className="col-span-1 text-xs text-right flex items-center justify-end font-medium">
                        {mat.standard_price ? `¥${Math.round(total).toLocaleString()}` : '-'}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{selectedCount}件を選択中</p>
                <button
                  onClick={handleAddSelected}
                  disabled={selectedCount === 0}
                  className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  選択した材料を発注明細に追加
                </button>
              </div>
            </>
          )}

          {!loading && selectedOrderId && requiredMaterials.length === 0 && (
            <p className="text-xs text-gray-500 py-3">BOMが登録されていないか、材料が見つかりませんでした</p>
          )}
        </div>
      )}
    </div>
  )
}
