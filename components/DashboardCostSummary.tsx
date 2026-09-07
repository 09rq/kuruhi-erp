'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp } from 'lucide-react'

interface BudgetActual {
  account_name: string
  account_category: string
  balance: number
  ratio: number
  report_type: string
  year_month: string
}

interface FiscalYearTarget {
  fiscal_year: number
  start_month: string
  end_month: string
}

// 「表示する月」で選ぶ特別な値：通期（年間累計）
const FULL_YEAR_VALUE = '__FULL_YEAR__'

export default function DashboardCostSummary() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [budgetActuals, setBudgetActuals] = useState<BudgetActual[]>([])
  const [fiscalYearTargets, setFiscalYearTargets] = useState<FiscalYearTarget[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState('')

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

      const { data: history } = await supabase
        .from('freee_imports')
        .select('year_month')
        .order('imported_at', { ascending: false })
        .limit(1)

      const { data: actuals } = await supabase
        .from('budget_actuals')
        .select('*')
        .order('year_month', { ascending: false })
        .limit(5000)
      setBudgetActuals(actuals || [])

      setSelectedMonth(prev => prev || (history && history.length > 0 ? history[0].year_month : ''))

      const { data: fyData } = await supabase
        .from('fiscal_year_targets')
        .select('fiscal_year, start_month, end_month')
        .order('fiscal_year', { ascending: false })
      setFiscalYearTargets(fyData || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !visible) return null

  const activeFyTarget = selectedFiscalYear
    ? fiscalYearTargets.find(t => t.fiscal_year === selectedFiscalYear)
    : null
  const isFullYear = selectedMonth === FULL_YEAR_VALUE

  // 「通期（年間累計）」が選ばれている場合は、選択中の期に含まれる月を全て合算する
  const filteredActuals: BudgetActual[] = (isFullYear && activeFyTarget)
    ? (() => {
        const inRange = budgetActuals.filter(a =>
          a.year_month >= activeFyTarget.start_month && a.year_month <= activeFyTarget.end_month
        )
        const merged: Record<string, BudgetActual> = {}
        inRange.forEach(a => {
          const key = `${a.report_type}__${a.account_name}`
          if (!merged[key]) {
            merged[key] = { ...a, balance: 0, ratio: 0, year_month: FULL_YEAR_VALUE }
          }
          merged[key].balance += Number(a.balance)
        })
        return Object.values(merged)
      })()
    : budgetActuals.filter(a => (!selectedMonth || a.year_month === selectedMonth))

  const plData = filteredActuals.filter(a => a.report_type === 'pl')
  const mfgData = filteredActuals.filter(a => a.report_type === 'mfg')

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
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-green-700" />
        <h2 className="text-base font-semibold text-gray-900">予実管理サマリー</h2>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">期で絞り込む</label>
          <select
            value={selectedFiscalYear ?? ''}
            onChange={e => {
              const fy = e.target.value ? Number(e.target.value) : null
              setSelectedFiscalYear(fy)
              if (fy) {
                const target = fiscalYearTargets.find(t => t.fiscal_year === fy)
                if (target) setSelectedMonth(target.start_month)
              }
            }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">すべての期</option>
            {fiscalYearTargets.map(t => (
              <option key={t.fiscal_year} value={t.fiscal_year}>第{t.fiscal_year}期</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">表示する月</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">月を選択</option>
            {selectedFiscalYear && activeFyTarget && (
              <option value={FULL_YEAR_VALUE}>📊 通期（年間累計）</option>
            )}
            {(() => {
              const allMonths = [...new Set(budgetActuals.map(a => a.year_month))].sort().reverse()
              if (!selectedFiscalYear) return allMonths.map(m => <option key={m} value={m}>{m}</option>)
              const target = fiscalYearTargets.find(t => t.fiscal_year === selectedFiscalYear)
              if (!target) return allMonths.map(m => <option key={m} value={m}>{m}</option>)
              return allMonths.filter(m => m >= target.start_month && m <= target.end_month).map(m => <option key={m} value={m}>{m}</option>)
            })()}
          </select>
        </div>
      </div>

      {revenue === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          {budgetActuals.length === 0
            ? 'まだfreeeのデータが取り込まれていません。'
            : '選択した月のデータがありません。上の「表示する月」から月を選択してください。'}
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
