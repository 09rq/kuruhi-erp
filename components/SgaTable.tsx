'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, ChevronDown, ChevronUp, CalendarRange } from 'lucide-react'

interface SgaItem {
  account_name: string
  actual: number
  budget: number
  ratio: number
}

interface Props {
  yearMonth: string
  // 通期（年間累計）表示のときにセットされる期間。nullなら通常の単月表示。
  fullYearRange?: { start: string; end: string } | null
}

export default function SgaTable({ yearMonth, fullYearRange }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<SgaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // ── この表だけの「期間で集計」機能（親の月選択とは独立） ──────────────
  const [customRangeOn, setCustomRangeOn] = useState(false)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  useEffect(() => {
    supabase
      .from('budget_actuals')
      .select('year_month')
      .eq('report_type', 'pl')
      .eq('account_category', '販売管理費')
      .then(({ data }) => {
        const months = [...new Set((data || []).map(d => d.year_month))]
          .filter(m => /^\d{4}-\d{2}$/.test(m))
          .sort()
        setAvailableMonths(months)
        if (months.length > 0) {
          setRangeStart(prev => prev || months[Math.max(0, months.length - 3)])
          setRangeEnd(prev => prev || months[months.length - 1])
        }
      })
  }, [supabase])

  // 期間で集計がONの場合はその範囲を、OFFなら親から渡された通期レンジ（あれば）を使う
  const effectiveRange = customRangeOn && rangeStart && rangeEnd
    ? { start: rangeStart, end: rangeEnd }
    : (fullYearRange ?? null)

  const EXCLUDE = ['販売管理費 計', '営業外費用', '営業外収益', '営業損益金額', '経常損益金額', '税引前当期純損益金額', '当期純損益金額', '支払利息', '受取利息', '雑収入', '受取配当金']

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let actualsQuery = supabase
        .from('budget_actuals')
        .select('account_name, balance, ratio, year_month')
        .eq('report_type', 'pl')
        .eq('account_category', '販売管理費')
      let budgetsQuery = supabase.from('budgets').select('account_name, budget_amount, year_month')

      if (effectiveRange) {
        // 期間集計：期間内の全月を合算する
        actualsQuery = actualsQuery.gte('year_month', effectiveRange.start).lte('year_month', effectiveRange.end)
        budgetsQuery = budgetsQuery.gte('year_month', effectiveRange.start).lte('year_month', effectiveRange.end)
      } else {
        actualsQuery = actualsQuery.eq('year_month', yearMonth)
        budgetsQuery = budgetsQuery.eq('year_month', yearMonth)
      }

      const { data: actuals } = await actualsQuery
      const { data: budgets } = await budgetsQuery

      const budgetMap: Record<string, number> = {}
      budgets?.forEach(b => { budgetMap[b.account_name] = (budgetMap[b.account_name] || 0) + Number(b.budget_amount) })

      // 実績と予算の両方を統合（どちらかあれば表示）。期間集計の場合は期間内の月を合算する。
      const actualMap: Record<string, number> = {}
      ;(actuals || []).filter(a => !EXCLUDE.includes(a.account_name)).forEach(a => {
        actualMap[a.account_name] = (actualMap[a.account_name] || 0) + Number(a.balance)
      })
      
      const allNames = new Set([
        ...Object.keys(actualMap),
        ...Object.keys(budgetMap),
      ])
      
      const merged: SgaItem[] = Array.from(allNames)
        .filter(name => !EXCLUDE.includes(name))
        .map(name => ({
          account_name: name,
          actual: actualMap[name] || 0,
          budget: budgetMap[name] || 0,
          ratio: 0,
        }))
        .sort((a, b) => b.budget - a.budget)

      setItems(merged)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase, yearMonth, effectiveRange?.start, effectiveRange?.end])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSaveBudget(accountName: string) {
    setSaving(true)
    try {
      await supabase.from('budgets').upsert({
        year_month: yearMonth,
        account_name: accountName,
        budget_amount: Number(budgetInput),
      }, { onConflict: 'year_month,account_name' })
      setEditingBudget(null)
      fetchData()
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>

  const totalActual = items.reduce((s, i) => s + i.actual, 0)
  const totalBudget = items.reduce((s, i) => s + i.budget, 0)
  const totalDiff = totalActual - totalBudget
  const displayItems = showAll ? items : items.slice(0, 10)
  const monthCount = effectiveRange
    ? availableMonths.filter(m => m >= effectiveRange.start && m <= effectiveRange.end).length
    : 1

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-6">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h3 className="text-sm font-bold text-gray-900">販管費 予実管理</h3>
          {effectiveRange && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {customRangeOn ? `期間集計（${effectiveRange.start}〜${effectiveRange.end}／${monthCount}ヶ月分）` : '通期（年間累計）'}
            </span>
          )}
        </div>
        <div className={`text-sm font-bold px-3 py-1 rounded-full ${totalDiff > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          合計差異: {totalDiff > 0 ? '▲' : '▼'} {Math.abs(totalDiff).toLocaleString()}円
        </div>
      </div>

      {/* この表だけの期間集計コントロール */}
      <div className="flex items-center gap-2 flex-wrap mb-4 pb-4 border-b border-gray-100">
        <button
          onClick={() => setCustomRangeOn(v => !v)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            customRangeOn ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          期間で集計
        </button>
        {customRangeOn && (
          <>
            <select
              value={rangeStart}
              onChange={e => setRangeStart(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="text-xs text-gray-400">〜</span>
            <select
              value={rangeEnd}
              onChange={e => setRangeEnd(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {rangeStart > rangeEnd && (
              <span className="text-xs text-red-500">開始月は終了月より前にしてください</span>
            )}
          </>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">勘定科目</th>
              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">実績（円）</th>
              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">予算（円）{effectiveRange && customRangeOn && <span className="font-normal text-gray-400">（{monthCount}ヶ月合計）</span>}</th>
              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">差異（円）</th>
              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">達成率</th>
              <th className="text-center text-xs font-medium text-gray-500 px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayItems.map(item => {
              const diff = item.actual - item.budget
              const achievement = item.budget > 0 ? Math.round((item.actual / item.budget) * 100) : null
              const isOver = diff > 0
              const isEditing = editingBudget === item.account_name
              return (
                <tr key={item.account_name} className="hover:bg-gray-50">
                  <td className="text-sm text-gray-800 px-3 py-2 font-medium">{item.account_name}</td>
                  <td className="text-sm text-right text-gray-800 px-3 py-2">{item.actual.toLocaleString()}</td>
                  <td className="text-sm text-right px-3 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        value={budgetInput}
                        onChange={e => setBudgetInput(e.target.value)}
                        className="w-28 text-sm text-right border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span className={item.budget === 0 ? 'text-gray-300' : 'text-gray-800'}>
                        {item.budget === 0 ? '未設定' : item.budget.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="text-sm text-right px-3 py-2">
                    {item.budget > 0 ? (
                      <span className={isOver ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                        {isOver ? '▲' : '▼'} {Math.abs(diff).toLocaleString()}
                      </span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="text-sm text-right px-3 py-2">
                    {achievement !== null ? (
                      <span className={`font-medium ${achievement > 100 ? 'text-red-600' : 'text-green-600'}`}>
                        {achievement}%
                      </span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="text-center px-3 py-2">
                    {effectiveRange ? (
                      <span className="text-xs text-gray-300">-</span>
                    ) : isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleSaveBudget(item.account_name)} disabled={saving} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 disabled:opacity-50">保存</button>
                        <button onClick={() => setEditingBudget(null)} className="text-xs text-gray-400 px-2 py-0.5 rounded hover:bg-gray-100">取消</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingBudget(item.account_name); setBudgetInput(item.budget.toString()) }}
                        className="text-xs text-blue-600 hover:underline"
                      >予算入力</button>
                    )}
                  </td>
                </tr>
              )
            })}
            <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
              <td className="text-sm text-gray-900 px-3 py-2">合計</td>
              <td className="text-sm text-right text-gray-900 px-3 py-2">{totalActual.toLocaleString()}</td>
              <td className="text-sm text-right text-gray-900 px-3 py-2">{totalBudget > 0 ? totalBudget.toLocaleString() : '-'}</td>
              <td className="text-sm text-right px-3 py-2">
                {totalBudget > 0 && (
                  <span className={totalDiff > 0 ? 'text-red-600' : 'text-green-600'}>
                    {totalDiff > 0 ? '▲' : '▼'} {Math.abs(totalDiff).toLocaleString()}
                  </span>
                )}
              </td>
              <td className="text-sm text-right px-3 py-2">
                {totalBudget > 0 && (
                  <span className={totalActual > totalBudget ? 'text-red-600' : 'text-green-600'}>
                    {Math.round((totalActual / totalBudget) * 100)}%
                  </span>
                )}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {items.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:underline mx-auto"
        >
          {showAll ? <><ChevronUp className="h-3 w-3" />折りたたむ</> : <><ChevronDown className="h-3 w-3" />全{items.length}件を表示</>}
        </button>
      )}
    </div>
  )
}
