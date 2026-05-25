'use client'

import { useState, useMemo } from 'react'

type MaterialTx = {
  id: string
  transaction_date: string
  quantity: number
  unit_price: number | null
  amount: number | null
  note: string | null
  materials: { name: string; code: string; category: string } | null
}

type OutsourceTx = {
  id: string
  process_name: string
  vendor_id: string | null
  planned_quantity: number
  unit_price: number
  amount: number
  purchase_status: string
  purchase_date: string | null
  production_lots: { lot_number: string; products: { name: string } | null } | null
  customers: { name: string } | null
}

function fmtJPY(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function PurchaseSummaryClient({
  materialTx,
  outsourceTx,
}: {
  materialTx: MaterialTx[]
  outsourceTx: OutsourceTx[]
}) {
  const [activeTab, setActiveTab] = useState<'material' | 'outsource'>('material')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [vendorFilter, setVendorFilter] = useState('')

  // 材料仕入フィルタ
  const filteredMaterial = useMemo(() => {
    return materialTx.filter(tx => {
      if (tx.transaction_date < dateFrom) return false
      if (tx.transaction_date > dateTo) return false
      return true
    })
  }, [materialTx, dateFrom, dateTo])

  // 外注加工フィルタ
  const filteredOutsource = useMemo(() => {
    return outsourceTx.filter(tx => {
      const date = tx.purchase_date
      if (date && date < dateFrom) return false
      if (date && date > dateTo) return false
      if (vendorFilter && tx.customers?.name !== vendorFilter) return false
      return true
    })
  }, [outsourceTx, dateFrom, dateTo, vendorFilter])

  // 材料仕入合計
  const materialTotal = filteredMaterial.reduce((s, tx) => s + (tx.amount || 0), 0)

  // 外注先一覧
  const vendors = useMemo(() => {
    const names = outsourceTx
      .map(tx => tx.customers?.name)
      .filter(Boolean) as string[]
    return [...new Set(names)].sort()
  }, [outsourceTx])

  // 外注先別集計
  const outsourceByVendor = useMemo(() => {
    const map: Record<string, { name: string; paid: number; unpaid: number; total: number }> = {}
    filteredOutsource.forEach(tx => {
      const name = tx.customers?.name || '未設定'
      if (!map[name]) map[name] = { name, paid: 0, unpaid: 0, total: 0 }
      const amt = tx.amount || 0
      if (tx.purchase_status === 'paid') map[name].paid += amt
      else map[name].unpaid += amt
      map[name].total += amt
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filteredOutsource])

  const outsourceTotal = filteredOutsource.reduce((s, tx) => s + (tx.amount || 0), 0)
  const outsourcePaid = filteredOutsource.filter(tx => tx.purchase_status === 'paid').reduce((s, tx) => s + (tx.amount || 0), 0)
  const outsourceUnpaid = outsourceTotal - outsourcePaid

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">購買集計・分析</h1>

      {/* 期間指定 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">期間</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">〜</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {activeTab === 'outsource' && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">外注先</label>
              <select
                value={vendorFilter}
                onChange={e => setVendorFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">すべて</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-4">
        {([
          { key: 'material', label: '材料仕入' },
          { key: 'outsource', label: '外注加工' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 材料仕入タブ */}
      {activeTab === 'material' && (
        <div className="space-y-4">
          {/* サマリー */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">仕入件数</p>
              <p className="text-2xl font-bold text-gray-900">{filteredMaterial.length}件</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">仕入合計金額</p>
              <p className="text-2xl font-bold text-blue-700">{fmtJPY(materialTotal)}</p>
            </div>
          </div>

          {/* 明細 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">仕入日</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">材料名</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">区分</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">数量</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">単価</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">金額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMaterial.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">該当データがありません</td></tr>
                ) : filteredMaterial.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(tx.transaction_date)}</td>
                    <td className="px-4 py-3 text-gray-900">{tx.materials?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{tx.materials?.category || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{Number(tx.quantity).toLocaleString('ja-JP')}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{tx.unit_price ? fmtJPY(Number(tx.unit_price)) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{tx.amount ? fmtJPY(Number(tx.amount)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-gray-700">合計</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtJPY(materialTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 外注加工タブ */}
      {activeTab === 'outsource' && (
        <div className="space-y-4">
          {/* サマリー */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">外注合計</p>
              <p className="text-2xl font-bold text-gray-900">{fmtJPY(outsourceTotal)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">支払済</p>
              <p className="text-2xl font-bold text-green-700">{fmtJPY(outsourcePaid)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">未払い（今月締め）</p>
              <p className="text-2xl font-bold text-red-700">{fmtJPY(outsourceUnpaid)}</p>
            </div>
          </div>

          {/* 外注先別集計 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-medium text-gray-700">外注先別集計</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">外注先</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">支払済</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">未払い</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">合計</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {outsourceByVendor.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">該当データがありません</td></tr>
                ) : outsourceByVendor.map(v => (
                  <tr key={v.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmtJPY(v.paid)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmtJPY(v.unpaid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtJPY(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 明細 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-medium text-gray-700">明細</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">支払日</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">外注先</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">工程</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">ロット</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">数量</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">単価</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">金額</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOutsource.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">該当データがありません</td></tr>
                ) : filteredOutsource.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600 text-xs">{fmtDate(tx.purchase_date)}</td>
                    <td className="px-4 py-2 text-gray-900">{tx.customers?.name || '—'}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{tx.process_name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{tx.production_lots?.lot_number || '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{Number(tx.planned_quantity).toLocaleString('ja-JP')}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{fmtJPY(Number(tx.unit_price))}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{fmtJPY(Number(tx.amount))}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                        tx.purchase_status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {tx.purchase_status === 'paid' ? '支払済' : '未払い'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right text-sm font-medium text-gray-700">合計</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtJPY(outsourceTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
