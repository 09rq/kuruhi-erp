'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function NewStocktakePage() {
  const router = useRouter()
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // 棚卸ヘッダー作成
      const { data: stocktake, error: stErr } = await supabase
        .from('stocktakes')
        .insert({ year_month: yearMonth, notes, status: 'draft' })
        .select()
        .single()
      if (stErr) throw new Error(stErr.message)

      // 材料在庫を自動取得してstocktake_materialsに登録
      const { data: materials } = await supabase
        .from('materials')
        .select('id, current_stock, standard_price, month_end_price')
        .eq('is_active', true)

      if (materials && materials.length > 0) {
        const matRows = materials.map(m => ({
          stocktake_id: stocktake.id,
          material_id: m.id,
          system_quantity: m.current_stock || 0,
          unit_price: m.month_end_price || m.standard_price || 0,
        }))
        await supabase.from('stocktake_materials').insert(matRows)
      }

      // 進行中の製造ロットを自動取得してstocktake_wipに登録
      const { data: lots } = await supabase
        .from('production_lots')
        .select(`
          id, status, planned_quantity, completed_quantity, product_id,
          products(standard_cost),
          production_lot_processes(purchase_status, amount)
        `)
        .in('status', ['planned', 'in_progress'])

      if (lots && lots.length > 0) {
        const wipRows = lots.map(lot => {
          const processes = lot.production_lot_processes || []
          const paidProcessCost = processes
            .filter((p: {purchase_status: string, amount: number}) => p.purchase_status === 'paid')
            .reduce((sum: number, p: {amount: number}) => sum + (p.amount || 0), 0)
          const allPaid = processes.length > 0 &&
            processes.every((p: {purchase_status: string}) => p.purchase_status === 'paid')

          let wipType = 'internal'
          if (allPaid) wipType = 'pre_inspection'
          else if (paidProcessCost > 0) wipType = 'outsource'

          const product = lot.products as {standard_cost?: number} | null

          return {
            stocktake_id: stocktake.id,
            lot_id: lot.id,
            wip_type: wipType,
            quantity: lot.planned_quantity,
            unit_cost: product?.standard_cost || 0,
            process_cost: paidProcessCost,
          }
        })
        await supabase.from('stocktake_wip').insert(wipRows)
      }

      // 製品在庫を自動取得してstocktake_productsに登録
      const { data: products } = await supabase
        .from('products')
        .select('id, current_stock, standard_cost')

      if (products && products.length > 0) {
        const prodRows = products.map(p => ({
          stocktake_id: stocktake.id,
          product_id: p.id,
          system_quantity: p.current_stock || 0,
          unit_cost: p.standard_cost || 0,
        }))
        await supabase.from('stocktake_products').insert(prodRows)
      }

      router.push(`/inventory/stocktake/${stocktake.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '作成に失敗しました')
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">新規棚卸作成</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              対象年月 <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              value={yearMonth}
              onChange={e => setYearMonth(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="備考があれば入力してください"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            作成時に以下を自動で取り込みます：
            <ul className="mt-1 ml-4 list-disc">
              <li>現在の材料在庫（現在庫・最終仕入単価）</li>
              <li>進行中の製造ロット（仕掛）</li>
              <li>現在の製品在庫</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#1F3864' }}
            >
              {saving ? '作成中...' : '棚卸を作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
