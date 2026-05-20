'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Download, TrendingUp, TrendingDown } from 'lucide-react'

type DeliveryType = '全て' | '量産' | 'サンプル' | '修理' | 'その他'

interface CustomerSummary {
  customer_id: string
  customer_name: string
  total_amount: number
  total_cost: number
  gross_profit: number
  gross_margin: number
  total_quantity: number
  avg_unit_price: number
  delivery_count: number
  by_type: Record<string, { amount: number; quantity: number; count: number }>
}

interface DeliveryRow {
  delivery_number: string
  delivery_date: string
  delivery_type: string
  customer_name: string
  product_name: string
  product_no: string
  quantity: number
  unit_price: number
  amount: number
  unit_cost: number
  cost_amount: number
  gross_profit: number
  gross_margin: number
  notes: string
}

export default function SalesReport() {
  const supabase = createClient()
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('全て')
  const [summaries, setSummaries] = useState<CustomerSummary[]>([])
  const [allRows, setAllRows] = useState<DeliveryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('delivery_notes')
        .select('id, delivery_number, delivery_date, delivery_type, customer_id, customer_name, delivery_note_items(product_name, product_no, quantity, unit_price, amount, unit_cost, cost_amount, notes)')
        .gte('delivery_date', dateFrom)
        .lte('delivery_date', dateTo)
        .eq('status', 'delivered')

      if (deliveryType !== '全て') {
        query = query.eq('delivery_type', deliveryType)
      }

      // statusに関わらず全件取得
      let query2 = supabase
        .from('delivery_notes')
        .select('id, delivery_number, delivery_date, delivery_type, customer_id, customer_name, delivery_note_items(product_name, product_no, quantity, unit_price, amount, unit_cost, cost_amount, notes)')
        .gte('delivery_date', dateFrom)
        .lte('delivery_date', dateTo)

      if (deliveryType !== '全て') {
        query2 = query2.eq('delivery_type', deliveryType)
      }

      const { data } = await query2

      if (!data) return

      // 明細行を展開
      const rows: DeliveryRow[] = []
      for (const dn of data) {
        const items = dn.delivery_note_items as {
          product_name: string; product_no: string; quantity: number
          unit_price: number; amount: number; unit_cost: number; cost_amount: number; notes: string | null
        }[]
        for (const item of items || []) {
          const profit = item.amount - item.cost_amount
          const margin = item.amount > 0 ? Math.round((profit / item.amount) * 100) : 0
          rows.push({
            delivery_number: dn.delivery_number,
            delivery_date: dn.delivery_date,
            delivery_type: dn.delivery_type,
            customer_name: dn.customer_name || '（未設定）',
            product_name: item.product_name,
            product_no: item.product_no || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
            unit_cost: item.unit_cost || 0,
            cost_amount: item.cost_amount || 0,
            gross_profit: profit,
            gross_margin: margin,
            notes: item.notes || '',
          })
        }
      }
      setAllRows(rows)

      // 取引先別集計
      const customerMap: Record<string, CustomerSummary> = {}
      for (const row of rows) {
        if (!customerMap[row.customer_name]) {
          customerMap[row.customer_name] = {
            customer_id: '',
            customer_name: row.customer_name,
            total_amount: 0, total_cost: 0, gross_profit: 0,
            gross_margin: 0, total_quantity: 0, avg_unit_price: 0,
            delivery_count: 0,
            by_type: {},
          }
        }
        const c = customerMap[row.customer_name]
        c.total_amount += row.amount
        c.total_cost += row.cost_amount
        c.gross_profit += row.gross_profit
        c.total_quantity += row.quantity
        c.delivery_count++
        if (!c.by_type[row.delivery_type]) {
          c.by_type[row.delivery_type] = { amount: 0, quantity: 0, count: 0 }
        }
        c.by_type[row.delivery_type].amount += row.amount
        c.by_type[row.delivery_type].quantity += row.quantity
        c.by_type[row.delivery_type].count++
      }

      const result = Object.values(customerMap).map(c => ({
        ...c,
        gross_margin: c.total_amount > 0 ? Math.round((c.gross_profit / c.total_amount) * 100) : 0,
        avg_unit_price: c.total_quantity > 0 ? Math.round(c.total_amount / c.total_quantity) : 0,
      })).sort((a, b) => b.total_amount - a.total_amount)

      setSummaries(result)
      setSearched(true)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase, dateFrom, dateTo, deliveryType])

  function handleCsvDownload() {
    const headers = ['納品番号', '納品日', '区分', '取引先', '商品名', '品番', '数量', '単価', '売上金額', '原価/個', '原価合計', '粗利', '粗利率', '備考']
    const rows = allRows.map(r => [
      r.delivery_number, r.delivery_date, r.delivery_type, r.customer_name,
      r.product_name, r.product_no, r.quantity, r.unit_price, r.amount,
      r.unit_cost, r.cost_amount, r.gross_profit, `${r.gross_margin}%`, r.notes
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `売上集計_${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalAmount = summaries.reduce((s, c) => s + c.total_amount, 0)
  const totalCost = summaries.reduce((s, c) => s + c.total_cost, 0)
  const totalProfit = summaries.reduce((s, c) => s + c.gross_profit, 0)
  const totalQty = summaries.reduce((s, c) => s + c.total_quantity, 0)
  const totalMargin = totalAmount > 0 ? Math.round((totalProfit / totalAmount) * 100) : 0
  const avgUnitPrice = totalQty > 0 ? Math.round(totalAmount / totalQty) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">取引先別売上集計</h1>
          <p className="text-sm text-gray-500">納品書データをもとに売上・粗利・平均単価を集計します</p>
        </div>
        {searched && allRows.length > 0 && (
          <button onClick={handleCsvDownload}
            className="flex items-center gap-2 text-sm font-medium text-green-700 border border-green-300 px-4 py-2 rounded-lg hover:bg-green-50">
            <Download className="h-4 w-4" />CSVダウンロード
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">開始日</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">終了日</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">区分</label>
            <select value={deliveryType} onChange={e => setDeliveryType(e.target.value as DeliveryType)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {(['全て', '量産', 'サンプル', '修理', 'その他'] as const).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={fetchData} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Search className="h-4 w-4" />
              {loading ? '集計中...' : '集計する'}
            </button>
          </div>
        </div>

        {/* 期間ショートカット */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: '今月', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
            { label: '先月', from: new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().split('T')[0], to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0] },
            { label: '第63期', from: '2025-06-01', to: '2026-05-31' },
            { label: '直近3ヶ月', from: new Date(new Date().setMonth(new Date().getMonth()-3)).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
          ].map(({ label, from, to }) => (
            <button key={label} onClick={() => { setDateFrom(from); setDateTo(to) }}
              className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50">
              {label}
            </button>
          ))}
        </div>
      </div>

      {searched && summaries.length > 0 && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            {[
              { label: '売上合計', value: `¥${totalAmount.toLocaleString()}`, color: 'text-blue-700' },
              { label: '原価合計', value: `¥${totalCost.toLocaleString()}`, color: 'text-gray-700' },
              { label: '粗利合計', value: `¥${totalProfit.toLocaleString()}`, color: totalProfit >= 0 ? 'text-green-700' : 'text-red-700' },
              { label: '粗利率', value: `${totalMargin}%`, color: totalMargin >= 30 ? 'text-green-700' : 'text-orange-600' },
              { label: '納品数量', value: `${totalQty.toLocaleString()}個`, color: 'text-gray-700' },
              { label: '平均単価', value: `¥${avgUnitPrice.toLocaleString()}`, color: 'text-purple-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* 取引先別テーブル */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">取引先別集計（{summaries.length}社）</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-medium text-gray-600">取引先名</th>
                    <th className="text-right p-3 font-medium text-gray-600">売上金額</th>
                    <th className="text-right p-3 font-medium text-gray-600">原価</th>
                    <th className="text-right p-3 font-medium text-gray-600">粗利</th>
                    <th className="text-right p-3 font-medium text-gray-600">粗利率</th>
                    <th className="text-right p-3 font-medium text-gray-600">数量</th>
                    <th className="text-right p-3 font-medium text-gray-600">平均単価</th>
                    <th className="text-left p-3 font-medium text-gray-600">区分内訳</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((c, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{c.customer_name}</td>
                      <td className="p-3 text-right font-medium text-blue-700">¥{c.total_amount.toLocaleString()}</td>
                      <td className="p-3 text-right text-gray-600">¥{c.total_cost.toLocaleString()}</td>
                      <td className="p-3 text-right font-medium">
                        <span className={c.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ¥{c.gross_profit.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.gross_margin >= 30
                            ? <TrendingUp className="h-3 w-3 text-green-500" />
                            : <TrendingDown className="h-3 w-3 text-orange-400" />}
                          <span className={c.gross_margin >= 30 ? 'text-green-600 font-medium' : 'text-orange-500'}>
                            {c.gross_margin}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-gray-600">{c.total_quantity.toLocaleString()}個</td>
                      <td className="p-3 text-right text-purple-700 font-medium">¥{c.avg_unit_price.toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(c.by_type).map(([type, data]) => (
                            <span key={type} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {type}: ¥{data.amount.toLocaleString()}（{data.quantity}個）
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td className="p-3 font-bold text-gray-900">合計</td>
                    <td className="p-3 text-right font-bold text-blue-700">¥{totalAmount.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-gray-600">¥{totalCost.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold">
                      <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{totalProfit.toLocaleString()}</span>
                    </td>
                    <td className="p-3 text-right font-bold">
                      <span className={totalMargin >= 30 ? 'text-green-600' : 'text-orange-500'}>{totalMargin}%</span>
                    </td>
                    <td className="p-3 text-right font-bold text-gray-600">{totalQty.toLocaleString()}個</td>
                    <td className="p-3 text-right font-bold text-purple-700">¥{avgUnitPrice.toLocaleString()}</td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {searched && summaries.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-400">該当する納品データがありません</p>
        </div>
      )}
    </div>
  )
}
