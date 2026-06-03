'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Save, ChevronLeft } from 'lucide-react'

const ACCOUNT_NAMES = [
  '役員報酬',
  '給与手当',
  '賞与',
  '法定福利費',
  '福利厚生費',
  '広告宣伝費',
  '交際費',
  '会議費',
  '旅費交通費',
  '通信費',
  '販売手数料',
  '消耗品費',
  '事務用品費',
  '修繕費',
  '水道光熱費',
  '新聞図書費',
  '諸会費',
  '支払手数料',
  '車両費',
  '地代家賃',
  'リース料',
  '保険料',
  '租税公課',
  '支払報酬料',
  '減価償却費',
  '雑費',
]

function getMonths(fiscalYear: number): string[] {
  const months: string[] = []
  // 6月始まり、5月終わり
  const startYear = fiscalYear + 1962 // 第63期 = 2025年
  for (let m = 6; m <= 12; m++) {
    months.push(`${startYear}-${String(m).padStart(2, '0')}`)
  }
  for (let m = 1; m <= 5; m++) {
    months.push(`${startYear + 1}-${String(m).padStart(2, '0')}`)
  }
  return months
}

export default function BudgetPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [fiscalYear, setFiscalYear] = useState(64)
  const [availableFiscalYears, setAvailableFiscalYears] = useState<number[]>([63, 64])
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    try {
      const months = getMonths(fiscalYear)
      const { data } = await supabase
        .from('budgets')
        .select('year_month, account_name, budget_amount')
        .in('year_month', months)

      // 年間合計を計算
      const annualMap: Record<string, number> = {}
      data?.forEach(b => {
        if (!annualMap[b.account_name]) annualMap[b.account_name] = 0
        annualMap[b.account_name] += Number(b.budget_amount)
      })

      const newBudgets: Record<string, string> = {}
      ACCOUNT_NAMES.forEach(name => {
        newBudgets[name] = annualMap[name] ? annualMap[name].toString() : ''
      })
      setBudgets(newBudgets)

      const { data: fyList } = await supabase
        .from('fiscal_year_targets')
        .select('fiscal_year')
        .order('fiscal_year', { ascending: false })
      if (fyList && fyList.length > 0) {
        setAvailableFiscalYears(fyList.map((r: { fiscal_year: number }) => r.fiscal_year))
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, fiscalYear])

  useEffect(() => { fetchBudgets() }, [fetchBudgets])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const months = getMonths(fiscalYear)
      const rows: { year_month: string; account_name: string; budget_amount: number }[] = []

      ACCOUNT_NAMES.forEach(name => {
        const annual = Number(budgets[name] || 0)
        if (annual === 0) return
        const monthly = Math.round(annual / 12)
        months.forEach((month, idx) => {
          // 端数は最終月に加算
          const amount = idx === 11 ? annual - monthly * 11 : monthly
          rows.push({ year_month: month, account_name: name, budget_amount: amount })
        })
      })

      // 既存データを削除して再登録
      await supabase.from('budgets').delete().in('year_month', months)
      if (rows.length > 0) {
        await supabase.from('budgets').insert(rows)
      }

      setMessage(`✅ ${rows.length}件の月次予算を登録しました`)
      fetchBudgets()
    } catch {
      setMessage('❌ 保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const totalBudget = ACCOUNT_NAMES.reduce((s, name) => s + Number(budgets[name] || 0), 0)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/accounting" className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-2">
            <ChevronLeft className="h-4 w-4" />
            予実管理に戻る
          </a>
          <h1 className="text-xl font-bold text-gray-900">年間予算入力</h1>
          <p className="text-sm text-gray-500">年間予算を入力すると12ヶ月に自動按分されます</p>
        </div>
        <select
          value={fiscalYear}
          onChange={e => setFiscalYear(Number(e.target.value))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {availableFiscalYears.map(fy => <option key={fy} value={fy}>第{fy}期</option>)}
        </select>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6 text-sm text-blue-700">
        第{fiscalYear}期（{getMonths(fiscalYear)[0]} 〜 {getMonths(fiscalYear)[11]}）の年間予算を入力してください。
        保存すると各月に均等按分されます。
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">勘定科目</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">年間予算（円）</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">月次換算（円）</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={3} className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></td></tr>
            ) : ACCOUNT_NAMES.map(name => {
              const annual = Number(budgets[name] || 0)
              const monthly = annual > 0 ? Math.round(annual / 12) : 0
              return (
                <tr key={name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      value={budgets[name] || ''}
                      onChange={e => setBudgets(prev => ({ ...prev, [name]: e.target.value }))}
                      className="w-40 text-right px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {monthly > 0 ? `¥${monthly.toLocaleString('ja-JP')}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-4 py-3 font-medium text-gray-700">合計</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">
                ¥{totalBudget.toLocaleString('ja-JP')}
              </td>
              <td className="px-4 py-3 text-right font-bold text-gray-500">
                ¥{Math.round(totalBudget / 12).toLocaleString('ja-JP')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div>
          {message && (
            <span className={`text-sm ${message.includes('❌') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? '保存中...' : '年間予算を保存する'}
        </button>
      </div>
    </div>
  )
}
