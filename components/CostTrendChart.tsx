'use client'

import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface BudgetActual {
  account_name: string
  balance: number
  report_type: string
  year_month: string
}

interface Props {
  budgetActuals?: BudgetActual[]
  fiscalYearTarget?: {
    material_rate_target: number
    outsource_rate_target: number
    labor_rate_target: number
    freight_rate_target: number
  } | null
}

const DEFAULT_TARGETS = { material: 18.5, outsource: 43.5, labor: 7.0, freight: 1.0 }

type MetricKey = '材料費率' | '外注加工費率' | '労務費率' | '荷造運賃率'

/**
 * 原価率の推移カード（案A：指標ごとの小カード＋ミニ推移グラフ）。
 * 予実管理下部の「原価率分析」セクションと同じfreee取り込みデータ（budget_actuals）を参照するため、
 * 数字の食い違いが起きない。
 */
export default function CostTrendChart({ budgetActuals = [], fiscalYearTarget }: Props) {
  const TARGETS = {
    material: fiscalYearTarget?.material_rate_target ?? DEFAULT_TARGETS.material,
    outsource: fiscalYearTarget?.outsource_rate_target ?? DEFAULT_TARGETS.outsource,
    labor: fiscalYearTarget?.labor_rate_target ?? DEFAULT_TARGETS.labor,
    freight: fiscalYearTarget?.freight_rate_target ?? DEFAULT_TARGETS.freight,
  }

  const series = useMemo(() => {
    const months = [...new Set(budgetActuals.map((a) => a.year_month))]
      .filter((m) => /^\d{4}-\d{2}$/.test(m))
      .sort()

    return months
      .map((month) => {
        const pl = budgetActuals.filter((a) => a.report_type === 'pl' && a.year_month === month)
        const mfg = budgetActuals.filter((a) => a.report_type === 'mfg' && a.year_month === month)
        const revenue = pl.find((a) => a.account_name === '売上高 計')?.balance || 0
        const materialCost = mfg.find((a) => a.account_name === '材料費 計')?.balance || 0
        const laborCost = mfg.find((a) => a.account_name === '労務費 計')?.balance || 0
        const outsourceCost = mfg.find((a) => a.account_name === '[製]外注加工費')?.balance || 0
        const freightCost = mfg.find((a) => a.account_name === '[製]荷造運賃')?.balance || 0
        return {
          month,
          revenue,
          材料費率: revenue > 0 ? Math.round((materialCost / revenue) * 1000) / 10 : null,
          外注加工費率: revenue > 0 ? Math.round((outsourceCost / revenue) * 1000) / 10 : null,
          労務費率: revenue > 0 ? Math.round((laborCost / revenue) * 1000) / 10 : null,
          荷造運賃率: revenue > 0 ? Math.round((freightCost / revenue) * 1000) / 10 : null,
        }
      })
      .filter((d) => d.revenue > 0)
  }, [budgetActuals])

  if (series.length === 0) return null

  const latest = series[series.length - 1]
  const prev = series.length > 1 ? series[series.length - 2] : null

  const metrics: { key: MetricKey; target: number; color: string }[] = [
    { key: '材料費率', target: TARGETS.material, color: '#3b82f6' },
    { key: '外注加工費率', target: TARGETS.outsource, color: '#f59e0b' },
    { key: '労務費率', target: TARGETS.labor, color: '#10b981' },
    { key: '荷造運賃率', target: TARGETS.freight, color: '#ef4444' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">原価率の推移</h3>
        </div>
        <span className="text-xs text-gray-400">
          {series[0].month} 〜 {latest.month}（最新月：{latest.month}）
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(({ key, target, color }) => {
          const val = latest[key]
          const prevVal = prev ? prev[key] : null
          const isGood = val !== null && val <= target
          const diff = val !== null && prevVal !== null ? Math.round((val - prevVal) * 10) / 10 : null
          return (
            <div
              key={key}
              className={`rounded-xl p-4 border ${isGood ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
            >
              <p className="text-xs text-gray-500 mb-1">{key}</p>
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <p className={`text-2xl font-bold ${isGood ? 'text-green-700' : 'text-red-700'}`}>
                  {val !== null ? `${val}%` : '—'}
                </p>
                {diff !== null && (
                  <span
                    className={`text-xs font-medium flex items-center gap-0.5 ${
                      diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {diff > 0 ? '+' : ''}
                    {diff}pt
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-2">目標 {target}%（前月比）</p>
              <div style={{ height: 36 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                    <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
