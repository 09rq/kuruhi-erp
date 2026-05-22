'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

const WIP_TYPE_LABELS = {
  internal: '社内仕掛',
  outsource: '外注仕掛',
  pre_inspection: '製品仕掛（検品前）',
}

const STATUS_LABELS = {
  draft: '下書き',
  in_progress: '実施中',
  completed: '完了',
}

type Material = {
  id: string
  material_id: string
  system_quantity: number
  actual_quantity: number | null
  unit_price: number
  system_amount: number
  actual_amount: number
  diff_quantity: number
  note: string | null
  materials: { name: string; code: string; unit: string } | null
}

type Wip = {
  id: string
  lot_id: string
  wip_type: string
  quantity: number
  unit_cost: number
  process_cost: number
  total_amount: number
  note: string | null
  production_lots: {
    lot_number: string
    planned_quantity: number
    products: { name: string } | null
  } | null
}

type Product = {
  id: string
  product_id: string
  product_variant_id: string | null
  system_quantity: number
  actual_quantity: number | null
  unit_cost: number
  system_amount: number
  actual_amount: number
  diff_quantity: number
  note: string | null
  products: { name: string; code: string } | null
  product_variants: { name: string } | null
}

type Stocktake = {
  id: string
  year_month: string
  status: string
  notes: string | null
}

export default function StocktakeDetailClient({
  stocktake,
  materials,
  wip,
  products,
}: {
  stocktake: Stocktake
  materials: Material[]
  wip: Wip[]
  products: Product[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'materials' | 'wip' | 'products'>('materials')
  const [matData, setMatData] = useState<Material[]>(materials)
  const [prodData, setProdData] = useState<Product[]>(products)
  const [saving, setSaving] = useState<string | null>(null)
  const [status, setStatus] = useState(stocktake.status)
  const [deleting, setDeleting] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    internal: true, outsource: true, pre_inspection: true
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const isCompleted = status === 'completed'

  async function updateMaterialActual(id: string, value: string) {
    const num = value === '' ? null : parseFloat(value)
    setMatData(prev => prev.map(m => m.id === id ? { ...m, actual_quantity: num } : m))
    setSaving(id)
    await supabase.from('stocktake_materials').update({ actual_quantity: num }).eq('id', id)
    setSaving(null)
  }

  async function updateProductActual(id: string, value: string) {
    const num = value === '' ? null : parseInt(value)
    setProdData(prev => prev.map(p => p.id === id ? { ...p, actual_quantity: num } : p))
    setSaving(id)
    await supabase.from('stocktake_products').update({ actual_quantity: num }).eq('id', id)
    setSaving(null)
  }

  async function handleDelete() {
    if (!confirm(`${stocktake.year_month}の棚卸データを削除しますか？この操作は元に戻せません。`)) return
    setDeleting(true)
    await supabase.from(`stocktakes`).delete().eq(`id`, stocktake.id)
    router.push(`/inventory/stocktake`)
  }

  async function updateStatus(newStatus: string) {
    await supabase.from('stocktakes').update({ status: newStatus }).eq('id', stocktake.id)
    setStatus(newStatus)
    router.refresh()
  }

  const matTotal = matData.reduce((s, m) => s + (m.actual_quantity ?? m.system_quantity) * m.unit_price, 0)
  const wipTotal = wip.reduce((s, w) => s + w.total_amount, 0)
  const prodTotal = prodData.reduce((s, p) => s + (p.actual_quantity ?? p.system_quantity) * p.unit_cost, 0)
  const grandTotal = matTotal + wipTotal + prodTotal

  const wipGroups = {
    internal: wip.filter(w => w.wip_type === 'internal'),
    outsource: wip.filter(w => w.wip_type === 'outsource'),
    pre_inspection: wip.filter(w => w.wip_type === 'pre_inspection'),
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{stocktake.year_month} 棚卸</h1>
          <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mt-1 ${
            status === 'completed' ? 'bg-green-100 text-green-700' :
            status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'draft' && (
            <button onClick={() => updateStatus('in_progress')}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700">
              実施開始
            </button>
          )}
          {status === 'in_progress' && (
            <button onClick={() => updateStatus('completed')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4" />
              棚卸完了
            </button>
          )}
        </div>
      </div>

      {/* 合計サマリー */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '材料', amount: matTotal },
          { label: '仕掛', amount: wipTotal },
          { label: '製品', amount: prodTotal },
          { label: '合計', amount: grandTotal, bold: true },
        ].map(item => (
          <div key={item.label} className={`bg-white border rounded-xl p-4 ${item.bold ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className={`text-lg font-bold ${item.bold ? 'text-blue-700' : 'text-gray-900'}`}>
              ¥{item.amount.toLocaleString('ja-JP')}
            </p>
          </div>
        ))}
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['materials', 'wip', 'products'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'materials' ? `材料 (${matData.length})` :
             tab === 'wip' ? `仕掛 (${wip.length})` :
             `製品 (${prodData.length})`}
          </button>
        ))}
      </div>

      {/* 材料タブ */}
      {activeTab === 'materials' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">コード</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">材料名</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">システム在庫</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">実地数量</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">差異</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">単価</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">棚卸金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matData.map(m => {
                const actual = m.actual_quantity ?? m.system_quantity
                const diff = actual - m.system_quantity
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.materials?.code}</td>
                    <td className="px-4 py-3 text-gray-900">{m.materials?.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {m.system_quantity.toLocaleString('ja-JP')} {m.materials?.unit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isCompleted ? (
                        <span>{actual.toLocaleString('ja-JP')} {m.materials?.unit}</span>
                      ) : (
                        <input
                          type="number"
                          step="0.001"
                          defaultValue={m.actual_quantity ?? ''}
                          onBlur={e => updateMaterialActual(m.id, e.target.value)}
                          className="w-28 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder={m.system_quantity.toString()}
                        />
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {diff !== 0 ? (diff > 0 ? '+' : '') + diff.toLocaleString('ja-JP') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ¥{m.unit_price.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ¥{(actual * m.unit_price).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right text-sm font-medium text-gray-700">材料合計</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  ¥{matTotal.toLocaleString('ja-JP')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 仕掛タブ */}
      {activeTab === 'wip' && (
        <div className="space-y-4">
          {(['internal', 'outsource', 'pre_inspection'] as const).map(type => {
            const items = wipGroups[type]
            if (items.length === 0) return null
            const subtotal = items.reduce((s, w) => s + w.total_amount, 0)
            const isOpen = openSections[type]
            return (
              <div key={type} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenSections(prev => ({ ...prev, [type]: !prev[type] }))}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200"
                >
                  <span className="font-medium text-gray-900">{WIP_TYPE_LABELS[type]}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-gray-700">¥{subtotal.toLocaleString('ja-JP')}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                  </div>
                </button>
                {isOpen && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">ロット番号</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">製品名</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">数量</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">材料原価</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">加工費</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">棚卸金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map(w => (
                        <tr key={w.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500">{w.production_lots?.lot_number}</td>
                          <td className="px-4 py-3 text-gray-900">{w.production_lots?.products?.name}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{w.quantity.toLocaleString('ja-JP')}</td>
                          <td className="px-4 py-3 text-right text-gray-700">¥{w.unit_cost.toLocaleString('ja-JP')}</td>
                          <td className="px-4 py-3 text-right text-gray-700">¥{w.process_cost.toLocaleString('ja-JP')}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">¥{w.total_amount.toLocaleString('ja-JP')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
          <div className="text-right text-sm font-bold text-gray-700 pr-2">
            仕掛合計：¥{wipTotal.toLocaleString('ja-JP')}
          </div>
        </div>
      )}

      {/* 製品タブ */}
      {activeTab === 'products' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">製品名</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">バリエーション</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">システム在庫</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">実地数量</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">差異</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">標準原価</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">棚卸金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prodData.map(p => {
                const actual = p.actual_quantity ?? p.system_quantity
                const diff = actual - p.system_quantity
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{p.products?.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.product_variants?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.system_quantity.toLocaleString('ja-JP')}</td>
                    <td className="px-4 py-3 text-right">
                      {isCompleted ? (
                        <span>{actual.toLocaleString('ja-JP')}</span>
                      ) : (
                        <input
                          type="number"
                          defaultValue={p.actual_quantity ?? ''}
                          onBlur={e => updateProductActual(p.id, e.target.value)}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder={p.system_quantity.toString()}
                        />
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {diff !== 0 ? (diff > 0 ? '+' : '') + diff.toLocaleString('ja-JP') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">¥{p.unit_cost.toLocaleString('ja-JP')}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ¥{(actual * p.unit_cost).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right text-sm font-medium text-gray-700">製品合計</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  ¥{prodTotal.toLocaleString('ja-JP')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
