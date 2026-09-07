'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface BudgetActual {
  account_name: string
  account_category: string
  balance: number
  ratio: number
  report_type: string
  year_month: string
}

export default function DashboardCostSummary() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [yearMonth, setYearMonth] = useState<string | null>(null)
  const [plData, setPlData] = useState<BudgetActual[]>([])
  const [mfgData, setMfgData] = useState<BudgetActual[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 予実管理（会計）画面と同じく、admin・accounting ロールのみ表示する
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      const role = roleData?.role ?? null
      if (!['admin', 'accounting'].includes(role || '')) {
        setVisible(false)
        return
      }
      setVisible(true)

      // 直近で取り込まれた月（freeeインポート履歴）を「最新月」として使う
      const { data: history } = await supabase
        .from('freee_imports')
        .select('year_month')
        .order('imported_at', { ascending: false })
        .limit(1)

      const latestMonth = history?.[0]?.year_month
      if (!latestMonth) { setYearMonth(null); return }
      setYearMonth(latestMonth)

      const { data: actuals } = await supabase
        .from('budget_actuals')
        .select('*')
        .eq('year_month', latestMonth)

      setPlData((actuals || []).filter(a => a.report_type === 'pl'))
      setMfgData((actuals || []).filter(a => a.report_type === 'mfg'))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !visible) return null

  const revenue = plData.find(a => a.account_name === '売上高 計')?.balance || 0
  const grossProfit = plData.find(a => a.account_name === '売上総損益金額')?.balance || 0
  const mfgCost = mfgData.find(a => a.account_name === '製造原価')?.balance || 0
  const materialCost = mfgData.find(a => a.account_name === '材料費 計')?.balance || 0
  const laborCost = mfgData.find(a => a.account_name === '労務費 計')?.balance || 0
  const outsourceCost = mfgData.find(a => a.account_name === '[製]外注加工費')?.balance || 0
  const freightCost = mfgData.find(a => a.account_name === '[製]荷造運賃')?.balance || 0

  const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0.0'
  const materialRate = revenue > 0 ? ((materialCost / revenue) * 100).toFixed(1) : '0.0'
  const laborRate = revenue > 0 ? ((laborCost / revenue) * 100).toFixed(1) : '0.0'
  const outsourceRate = revenue > 0 ? ((outsourceCost / revenue) * 100).toFixed(1) : '0.0'
  const freightRate = revenue > 0 ? ((freightCost / revenue) * 100).toFixed(1) : '0.0'

  return (
    <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-700" />
          <h2 className="text-base font-semibold text-gray-900">予実管理サマリー</h2>
          {yearMonth && <span className="text-xs text-gray-400">（{yearMonth}）</span>}
        </div>
        <Link href="/accounting" className="text-xs text-blue-600 hover:underline">
          詳細を見る →
        </Link>
      </div>

      {!yearMonth || revenue === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          まだfreeeのデータが取り込まれていません。「予実管理」画面からCSVを取り込んでください。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: '売上高', value: revenue, unit: '円', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
              { label: '粗利益', value: grossProfit, unit: '円', color: 'bg-green-50 border-green-200', textColor: 'text-green-700' },
              { label: '粗利率', value: grossMargin, unit: '%', color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700' },
              { label: '製造原価', value: mfgCost, unit: '円', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700' },
            ].map(({ label, value, unit, color, textColor }) => (
              <div key={label} className={`border rounded-xl p-4 ${color}`}>
                <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${textColor}`}>
                  {unit === '円' ? Number(value).toLocaleString() : value}{unit}
                </p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">原価率分析（KPI目標との比較）</h3>
            <div className="space-y-4">
              {[
                { label: '材料費率', actual: materialRate, target: 18.5, amount: materialCost },
                { label: '外注加工費率', actual: outsourceRate, target: 43.5, amount: outsourceCost },
                { label: '労務費率', actual: laborRate, target: 7.0, amount: laborCost },
                { label: '荷造運賃率', actual: freightRate, target: 1.0, amount: freightCost },
              ].map(({ label, actual, target, amount }) => {
                const actualNum = Number(actual)
                const isGood = actualNum <= target
                return (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">目標 {target}%</span>
                        <span className={`text-sm font-bold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                          実績 {actual}%
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isGood ? '✓ 目標内' : `▲ ${(actualNum - target).toFixed(1)}%超過`}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 relative">
                      <div
                        className={`h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, (actualNum / (target * 2)) * 100)}%` }}
                      />
                      <div
                        className="absolute top-0 h-2 w-0.5 bg-gray-400"
                        style={{ left: `${Math.min(100, (target / (target * 2)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{Number(amount).toLocaleString()}円</p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
