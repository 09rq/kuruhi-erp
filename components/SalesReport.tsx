'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Download, TrendingUp, TrendingDown } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { parseClosingDay, closingPeriodLabel } from '@/lib/utils/closingPeriod'

type DeliveryType = '全て' | '量産' | 'サンプル' | '修理' | 'その他'
type DataSource = 'delivery' | 'order'
type ViewMode = 'total' | 'monthly'

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

interface Row {
  doc_number: string
  customer_id: string
  customer_name: string
  date: string          // 集計に使う日付（納品書＝納品日／受注登録＝確定・希望納期）
  type_label: string     // 区分（納品書＝量産等／受注登録＝ステータス）
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

const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  delivery: '納品書売上',
  order: '受注登録売上',
}

const SO_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  confirmed: '受注確定',
  in_production: '製造中',
  delivered: '納品済み',
  invoiced: '請求済み',
}

function fmtYen(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

export default function SalesReport() {
  const supabase = createClient()
  const [dataSource, setDataSource] = useState<DataSource>('delivery')
  const [viewMode, setViewMode] = useState<ViewMode>('total')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('全て')
  const [allRows, setAllRows] = useState<Row[]>([])
  const [closingDayMap, setClosingDayMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // 取引先ごとの締日（payment_terms から解析）を一度だけ取得
  useEffect(() => {
    supabase.from('customers').select('id, payment_terms').then(({ data }) => {
      const map: Record<string, number> = {}
      for (const c of data || []) map[c.id] = parseClosingDay(c.payment_terms)
      setClosingDayMap(map)
    })
  }, [supabase])

  const fetchDeliveryRows = useCallback(async (): Promise<Row[]> => {
    let query = supabase
      .from('delivery_notes')
      .select('id, delivery_number, delivery_date, delivery_type, customer_id, customer_name, delivery_note_items(product_name, product_no, quantity, unit_price, amount, unit_cost, cost_amount, notes)')
      .gte('delivery_date', dateFrom)
      .lte('delivery_date', dateTo)

    if (deliveryType !== '全て') {
      query = query.eq('delivery_type', deliveryType)
    }

    const { data } = await query
    if (!data) return []

    const rows: Row[] = []
    for (const dn of data) {
      const items = dn.delivery_note_items as {
        product_name: string; product_no: string; quantity: number
        unit_price: number; amount: number; unit_cost: number; cost_amount: number; notes: string | null
      }[]
      for (const item of items || []) {
        const profit = item.amount - item.cost_amount
        const margin = item.amount > 0 ? Math.round((profit / item.amount) * 100) : 0
        rows.push({
          doc_number: dn.delivery_number,
          customer_id: dn.customer_id || '',
          customer_name: dn.customer_name || '（未設定）',
          date: dn.delivery_date,
          type_label: dn.delivery_type,
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
    return rows
  }, [supabase, dateFrom, dateTo, deliveryType])

  const fetchOrderRows = useCallback(async (): Promise<Row[]> => {
    const { data } = await supabase
      .from('sales_orders')
      .select(`
        order_number, client_id, order_date, desired_delivery_date, confirmed_delivery_date, status,
        customers ( name ),
        sales_order_items ( quantity, unit_price, amount, notes, desired_delivery_date, products ( name, product_no, standard_cost ) )
      `)
      .neq('status', 'cancelled')

    if (!data) return []

    const rows: Row[] = []
    for (const so of data) {
      const customerRaw = so.customers as unknown
      const customer = (Array.isArray(customerRaw) ? customerRaw[0] : customerRaw) as { name: string } | null
      // 集計に使う日付：明細の希望納期 ＞ 受注の確定納期 ＞ 受注の希望納期 ＞ 受注日 の順で採用
      const orderLevelDate = so.confirmed_delivery_date || so.desired_delivery_date || so.order_date
      const items = so.sales_order_items as unknown as {
        quantity: number; unit_price: number; amount: number; notes: string | null
        desired_delivery_date: string | null
        products: { name: string; product_no: string; standard_cost: number | null } | { name: string; product_no: string; standard_cost: number | null }[] | null
      }[]
      for (const item of items || []) {
        const productRaw = item.products
        const product = (Array.isArray(productRaw) ? productRaw[0] : productRaw) ?? null
        const date = item.desired_delivery_date || orderLevelDate
        if (!date || date < dateFrom || date > dateTo) continue
        const unitCost = product?.standard_cost || 0
        const costAmount = unitCost * item.quantity
        const profit = item.amount - costAmount
        const margin = item.amount > 0 ? Math.round((profit / item.amount) * 100) : 0
        rows.push({
          doc_number: so.order_number,
          customer_id: so.client_id || '',
          customer_name: customer?.name || '（未設定）',
          date,
          type_label: SO_STATUS_LABELS[so.status] || so.status,
          product_name: product?.name || '',
          product_no: product?.product_no || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          unit_cost: unitCost,
          cost_amount: costAmount,
          gross_profit: profit,
          gross_margin: margin,
          notes: item.notes || '',
        })
      }
    }
    return rows
  }, [supabase, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const rows = dataSource === 'delivery' ? await fetchDeliveryRows() : await fetchOrderRows()
      setAllRows(rows)
      setSearched(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [dataSource, fetchDeliveryRows, fetchOrderRows])

  // ── 期間合計：取引先別集計 ──────────────────────────────────────
  const summaries: CustomerSummary[] = useMemo(() => {
    const customerMap: Record<string, CustomerSummary> = {}
    for (const row of allRows) {
      if (!customerMap[row.customer_name]) {
        customerMap[row.customer_name] = {
          customer_id: row.customer_id,
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
      if (!c.by_type[row.type_label]) {
        c.by_type[row.type_label] = { amount: 0, quantity: 0, count: 0 }
      }
      c.by_type[row.type_label].amount += row.amount
      c.by_type[row.type_label].quantity += row.quantity
      c.by_type[row.type_label].count++
    }
    return Object.values(customerMap).map(c => ({
      ...c,
      gross_margin: c.total_amount > 0 ? Math.round((c.gross_profit / c.total_amount) * 100) : 0,
      avg_unit_price: c.total_quantity > 0 ? Math.round(c.total_amount / c.total_quantity) : 0,
    })).sort((a, b) => b.total_amount - a.total_amount)
  }, [allRows])

  // ── 月別（締日ベース）集計 ──────────────────────────────────────
  const monthly = useMemo(() => {
    const perCustomerPeriod: Record<string, Record<string, number>> = {}
    const periodTotals: Record<string, number> = {}
    for (const r of allRows) {
      const closingDay = closingDayMap[r.customer_id] ?? 31
      const period = closingPeriodLabel(r.date, closingDay)
      perCustomerPeriod[r.customer_name] ??= {}
      perCustomerPeriod[r.customer_name][period] = (perCustomerPeriod[r.customer_name][period] ?? 0) + r.amount
      periodTotals[period] = (periodTotals[period] ?? 0) + r.amount
    }
    const periods = Object.keys(periodTotals).sort()
    let running = 0
    const periodCumulative: Record<string, number> = {}
    for (const p of periods) {
      running += periodTotals[p]
      periodCumulative[p] = running
    }
    const customers = Object.keys(perCustomerPeriod).sort((a, b) => {
      const totalA = Object.values(perCustomerPeriod[a]).reduce((s, v) => s + v, 0)
      const totalB = Object.values(perCustomerPeriod[b]).reduce((s, v) => s + v, 0)
      return totalB - totalA
    })
    const chartData = periods.map(p => ({ period: p, 月次売上: periodTotals[p], 累計売上: periodCumulative[p] }))
    return { periods, perCustomerPeriod, periodTotals, periodCumulative, customers, chartData }
  }, [allRows, closingDayMap])

  function handleCsvDownload() {
    const dateHeader = dataSource === 'delivery' ? '納品日' : '集計対象日（納期）'
    const docHeader = dataSource === 'delivery' ? '納品番号' : '受注番号'
    const headers = [docHeader, dateHeader, '区分', '取引先', '商品名', '品番', '数量', '単価', '売上金額', '原価/個', '原価合計', '粗利', '粗利率', '備考']
    const rows = allRows.map(r => [
      r.doc_number, r.date, r.type_label, r.customer_name,
      r.product_name, r.product_no, r.quantity, r.unit_price, r.amount,
      r.unit_cost, r.cost_amount, r.gross_profit, `${r.gross_margin}%`, r.notes
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${DATA_SOURCE_LABELS[dataSource]}_${dateFrom}_${dateTo}.csv`
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
          <p className="text-sm text-gray-500">
            {dataSource === 'delivery' ? '納品書データをもとに' : '受注登録データ（納期ベース）をもとに'}売上・粗利・平均単価を集計します
          </p>
        </div>
        {searched && allRows.length > 0 && (
          <button onClick={handleCsvDownload}
            className="flex items-center gap-2 text-sm font-medium text-green-700 border border-green-300 px-4 py-2 rounded-lg hover:bg-green-50">
            <Download className="h-4 w-4" />CSVダウンロード
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        {/* データソース・集計単位の切り替え */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">集計対象</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['delivery', 'order'] as DataSource[]).map((ds) => (
                <button key={ds} onClick={() => { setDataSource(ds); setSearched(false) }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${dataSource === ds ? 'bg-white shadow text-[#1F3864]' : 'text-gray-500 hover:text-gray-700'}`}>
                  {DATA_SOURCE_LABELS[ds]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">集計単位</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode('total')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'total' ? 'bg-white shadow text-[#1F3864]' : 'text-gray-500 hover:text-gray-700'}`}>
                期間合計
              </button>
              <button onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-white shadow text-[#1F3864]' : 'text-gray-500 hover:text-gray-700'}`}>
                月別（締日ベース）
              </button>
            </div>
          </div>
        </div>

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
          {dataSource === 'delivery' && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">区分</label>
              <select value={deliveryType} onChange={e => setDeliveryType(e.target.value as DeliveryType)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {(['全て', '量産', 'サンプル', '修理', 'その他'] as const).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
          <div className={`flex items-end ${dataSource === 'order' ? 'col-span-2' : ''}`}>
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

      {searched && allRows.length > 0 && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            {[
              { label: '売上合計', value: `¥${totalAmount.toLocaleString()}`, color: 'text-blue-700' },
              { label: '原価合計', value: `¥${totalCost.toLocaleString()}`, color: 'text-gray-700' },
              { label: '粗利合計', value: `¥${totalProfit.toLocaleString()}`, color: totalProfit >= 0 ? 'text-green-700' : 'text-red-700' },
              { label: '粗利率', value: `${totalMargin}%`, color: totalMargin >= 30 ? 'text-green-700' : 'text-orange-600' },
              { label: dataSource === 'delivery' ? '納品数量' : '受注数量', value: `${totalQty.toLocaleString()}個`, color: 'text-gray-700' },
              { label: '平均単価', value: `¥${avgUnitPrice.toLocaleString()}`, color: 'text-purple-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {viewMode === 'total' ? (
            /* ── 期間合計：取引先別テーブル ── */
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
          ) : (
            /* ── 月別（締日ベース）：グラフ＋マトリックス表 ── */
            <>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">月次推移＋累計（締日ベース）</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={monthly.chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`¥${Number(v).toLocaleString()}`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="月次売上" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="累計売上" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">取引先 × 月別マトリックス</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-3 font-medium text-gray-600 sticky left-0 bg-gray-50">取引先名</th>
                        {monthly.periods.map(p => (
                          <th key={p} className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">{p}</th>
                        ))}
                        <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap bg-blue-50">期間合計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.customers.map((cust) => {
                        const rowTotal = Object.values(monthly.perCustomerPeriod[cust]).reduce((s, v) => s + v, 0)
                        return (
                          <tr key={cust} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-900 sticky left-0 bg-white whitespace-nowrap">{cust}</td>
                            {monthly.periods.map(p => (
                              <td key={p} className="p-3 text-right text-gray-600 whitespace-nowrap">
                                {monthly.perCustomerPeriod[cust][p] ? fmtYen(monthly.perCustomerPeriod[cust][p]) : '—'}
                              </td>
                            ))}
                            <td className="p-3 text-right font-medium text-blue-700 whitespace-nowrap bg-blue-50/50">{fmtYen(rowTotal)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td className="p-3 font-bold text-gray-900 sticky left-0 bg-gray-50">月次合計</td>
                        {monthly.periods.map(p => (
                          <td key={p} className="p-3 text-right font-bold text-gray-800 whitespace-nowrap">{fmtYen(monthly.periodTotals[p])}</td>
                        ))}
                        <td className="p-3 text-right font-bold text-blue-700 whitespace-nowrap bg-blue-50">{fmtYen(totalAmount)}</td>
                      </tr>
                      <tr className="bg-orange-50 border-t border-orange-200">
                        <td className="p-3 font-bold text-orange-800 sticky left-0 bg-orange-50">累計</td>
                        {monthly.periods.map(p => (
                          <td key={p} className="p-3 text-right font-bold text-orange-700 whitespace-nowrap">{fmtYen(monthly.periodCumulative[p])}</td>
                        ))}
                        <td className="p-3 bg-orange-50"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {searched && allRows.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-400">該当するデータがありません</p>
        </div>
      )}
    </div>
  )
}
