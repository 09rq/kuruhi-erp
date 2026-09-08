'use client'

import { useMemo } from 'react'
import { GitCompare } from 'lucide-react'

interface BudgetActual {
  account_name: string
  balance: number
  report_type: string
  year_month: string
}

interface FiscalYearTargetRow {
  fiscal_year: number
  start_month: string
  end_month: string
}

interface Props {
  budgetActuals: BudgetActual[]
  currentTarget: FiscalYearTargetRow
  previousTarget: FiscalYearTargetRow | null
}

interface PeriodMetrics {
  revenue: number
  grossProfit: number
  grossMargin: number | null
  mfgCost: number
  materialCost: number
  laborCost: number
  outsourceCost: number
  freightCost: number
  materialRate: number | null
  outsourceRate: number | null
  laborRate: number | null
  freightRate: number | null
}

function pct(part: number, base: number): number | null {
  return base > 0 ? Math.round((part / base) * 1000) / 10 : null
}

// 指定した年月レンジ（'YYYY-MM'）に含まれる月をすべて合算して集計する
function aggregate(budgetActuals: BudgetActual[], start: string, end: string): PeriodMetrics {
  const inRange = budgetActuals.filter((a) => a.year_month >= start && a.year_month <= end)
  const sum = (reportType: string, accountName: string) =>
    inRange
      .filter((a) => a.report_type === reportType && a.account_name === accountName)
      .reduce((s, a) => s + Number(a.balance), 0)

  const revenue = sum('pl', '売上高 計')
  const grossProfit = sum('pl', '売上総損益金額')
  const mfgCost = sum('mfg', '製造原価')
  const materialCost = sum('mfg', '材料費 計')
  const laborCost = sum('mfg', '労務費 計')
  const outsourceCost = sum('mfg', '[製]外注加工費')
  const freightCost = sum('mfg', '[製]荷造運賃')

  return {
    revenue, grossProfit, mfgCost, materialCost, laborCost, outsourceCost, freightCost,
    grossMargin: pct(grossProfit, revenue),
    materialRate: pct(materialCost, revenue),
    outsourceRate: pct(outsourceCost, revenue),
    laborRate: pct(laborCost, revenue),
    freightRate: pct(freightCost, revenue),
  }
}

// start〜end の間の年月（'YYYY-MM'）を1ヶ月ずつ列挙する
function monthRange(start: string, end: string): string[] {
  const months: string[] = []
  let [y, m] = start.split('-').map(Number)
  const [endY, endM] = end.split('-').map(Number)
  let guard = 0
  while ((y < endY || (y === endY && m <= endM)) && guard < 60) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
    guard += 1
  }
  return months
}

function fmtYen(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
function fmtPct(n: number | null) {
  return n === null ? '—' : `${n}%`
}
function diffBadge(diff: number, unit: '円' | 'pt' | '%') {
  if (diff === 0) return <span className="text-gray-400">±0{unit === '円' ? '円' : unit}</span>
  const isUp = diff > 0
  return (
    <span className={isUp ? 'text-blue-600' : 'text-red-500'}>
      {isUp ? '+' : ''}
      {unit === '円' ? fmtYen(diff) : `${diff}${unit}`}
    </span>
  )
}

const SUMMARY_ROWS: { label: string; key: keyof PeriodMetrics; unit: '円' | '%' }[] = [
  { label: '売上高', key: 'revenue', unit: '円' },
  { label: '粗利益', key: 'grossProfit', unit: '円' },
  { label: '粗利率', key: 'grossMargin', unit: '%' },
  { label: '製造原価', key: 'mfgCost', unit: '円' },
  { label: '材料費率', key: 'materialRate', unit: '%' },
  { label: '外注加工費率', key: 'outsourceRate', unit: '%' },
  { label: '労務費率', key: 'laborRate', unit: '%' },
  { label: '荷造運賃率', key: 'freightRate', unit: '%' },
]

export default function FiscalYearComparison({ budgetActuals, currentTarget, previousTarget }: Props) {
  const current = useMemo(
    () => aggregate(budgetActuals, currentTarget.start_month, currentTarget.end_month),
    [budgetActuals, currentTarget]
  )
  const previous = useMemo(
    () => (previousTarget ? aggregate(budgetActuals, previousTarget.start_month, previousTarget.end_month) : null),
    [budgetActuals, previousTarget]
  )

  // 会計期間内の「何ヶ月目か」で今期と前期の月を対応させる（例：期の1ヶ月目同士＝通常は同じ暦月）
  const monthPairs = useMemo(() => {
    if (!previousTarget) return []
    const curMonths = monthRange(currentTarget.start_month, currentTarget.end_month)
    const prevMonths = monthRange(previousTarget.start_month, previousTarget.end_month)
    const len = Math.min(curMonths.length, prevMonths.length)
    return Array.from({ length: len }, (_, i) => ({ cur: curMonths[i], prev: prevMonths[i] }))
  }, [currentTarget, previousTarget])

  if (!previousTarget) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900">前期比較</h3>
        </div>
        <p className="text-sm text-gray-400">
          第{currentTarget.fiscal_year - 1}期（前期）の目標・対象期間が登録されていないため、比較できません。「KPI・目標管理」から前期の設定を登録してください。
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="h-5 w-5 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-900">
          第{currentTarget.fiscal_year}期 vs 第{previousTarget.fiscal_year}期（前期比較）
        </h3>
      </div>

      {/* 通期（年間累計）比較 */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="text-left py-2 font-medium">指標</th>
              <th className="text-right py-2 font-medium">第{previousTarget.fiscal_year}期（通期）</th>
              <th className="text-right py-2 font-medium">第{currentTarget.fiscal_year}期（通期）</th>
              <th className="text-right py-2 font-medium">増減</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {SUMMARY_ROWS.map(({ label, key, unit }) => {
              const curVal = current[key] as number | null
              const prevVal = previous![key] as number | null
              const diff = curVal !== null && prevVal !== null ? Math.round((curVal - prevVal) * (unit === '%' ? 10 : 1)) / (unit === '%' ? 10 : 1) : null
              return (
                <tr key={label}>
                  <td className="py-2 text-gray-700">{label}</td>
                  <td className="py-2 text-right font-mono text-gray-500">
                    {unit === '円' ? fmtYen(prevVal ?? 0) : fmtPct(prevVal)}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-800 font-medium">
                    {unit === '円' ? fmtYen(curVal ?? 0) : fmtPct(curVal)}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {diff === null ? '—' : diffBadge(diff, unit === '円' ? '円' : 'pt')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 同じ月同士の比較（期の1ヶ月目 = 期の1ヶ月目で対応付け） */}
      {monthPairs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">月別比較（同じ月同士）</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-1.5 pr-2 font-medium">月</th>
                  <th className="text-right py-1.5 px-2 font-medium">売上高（前期）</th>
                  <th className="text-right py-1.5 px-2 font-medium">売上高（今期）</th>
                  <th className="text-right py-1.5 px-2 font-medium">増減</th>
                  <th className="text-right py-1.5 px-2 font-medium">粗利率（前期）</th>
                  <th className="text-right py-1.5 pl-2 font-medium">粗利率（今期）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthPairs.map(({ cur, prev }) => {
                  const curM = aggregate(budgetActuals, cur, cur)
                  const prevM = aggregate(budgetActuals, prev, prev)
                  const revDiff = curM.revenue - prevM.revenue
                  const hasData = curM.revenue > 0 || prevM.revenue > 0
                  if (!hasData) return null
                  return (
                    <tr key={cur}>
                      <td className="py-1.5 pr-2 text-gray-600 whitespace-nowrap">
                        {cur}<span className="text-gray-300"> / {prev}</span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-400">{fmtYen(prevM.revenue)}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-700">{fmtYen(curM.revenue)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{diffBadge(revDiff, '円')}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-400">{fmtPct(prevM.grossMargin)}</td>
                      <td className="py-1.5 pl-2 text-right font-mono text-gray-700">{fmtPct(curM.grossMargin)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
