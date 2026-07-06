'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, Trash2, Save, ChevronLeft } from 'lucide-react'

type Department = 'sales' | 'planning' | 'production' | 'cutting' | 'quality' | 'management'
type Category = 'company' | 'skill' | 'challenge' | 'teamwork'
type Period = 'first_half' | 'second_half' | 'full_year'

const DEPT_LABELS: Record<Department, string> = {
  sales: '営業部',
  planning: '企画開発部',
  production: '生産管理部',
  cutting: '生産管理部／裁断',
  quality: '品質管理部',
  management: '管理本部',
}

const CATEGORY_LABELS: Record<Category, string> = {
  company: '全社目標',
  skill: '業務スキル評価',
  challenge: 'チャレンジ評価',
  teamwork: 'チームワーク評価',
}

const PERIOD_LABELS: Record<Period, string> = {
  first_half: '上半期（6〜11月）',
  second_half: '下半期（12〜5月）',
  full_year: '通期',
}

interface KpiGoal {
  id: string
  department: Department | null
  category: Category
  period: Period
  fiscal_year: number
  goal_title: string
  goal_description: string | null
  target_value: number | null
  target_unit: string | null
  eval_criteria: string | null
  key_points: string | null
  examples: string | null
}

export default function KpiGoalsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [fiscalYear, setFiscalYear] = useState(64)
  const [availableFiscalYears, setAvailableFiscalYears] = useState<number[]>([63, 64])
  const [department, setDepartment] = useState<Department | 'all'>('all')
  const [category, setCategory] = useState<Category>('company')
  const [period, setPeriod] = useState<Period>('first_half')
  const [goals, setGoals] = useState<KpiGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('kpi_goals')
        .select('*')
        .eq('fiscal_year', fiscalYear)
        .eq('category', category)
        .eq('period', period)
        .order('created_at')

      if (department !== 'all') {
        query = query.eq('department', department)
      } else {
        query = query.is('department', null)
      }

      const { data } = await query
      setGoals(data || [])

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
  }, [supabase, fiscalYear, department, category, period])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  function addRow() {
    const newGoal: KpiGoal = {
      id: `new-${Date.now()}`,
      department: department === 'all' ? null : department,
      category,
      period,
      fiscal_year: fiscalYear,
      goal_title: '',
      goal_description: null,
      target_value: null,
      target_unit: null,
      eval_criteria: null,
      key_points: null,
      examples: null,
    }
    setGoals(prev => [...prev, newGoal])
  }

  function updateRow(id: string, field: keyof KpiGoal, value: unknown) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  async function deleteGoal(id: string) {
    if (id.startsWith('new-')) {
      setGoals(prev => prev.filter(g => g.id !== id))
      return
    }
    if (!confirm('この目標を削除しますか？')) return
    await supabase.from('kpi_goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function saveAll() {
    setSaving(true)
    setMessage(null)
    try {
      for (const goal of goals) {
        if (goal.id.startsWith('new-')) {
          await supabase.from('kpi_goals').insert({
            fiscal_year: fiscalYear,
            department: department === 'all' ? null : department,
            category,
            period,
            goal_title: goal.goal_title,
            goal_description: goal.goal_description,
            target_value: goal.target_value,
            target_unit: goal.target_unit,
            eval_criteria: goal.eval_criteria,
            key_points: goal.key_points,
            examples: goal.examples,
          })
        } else {
          await supabase.from('kpi_goals').update({
            goal_title: goal.goal_title,
            goal_description: goal.goal_description,
            target_value: goal.target_value,
            target_unit: goal.target_unit,
            eval_criteria: goal.eval_criteria,
            key_points: goal.key_points,
            examples: goal.examples,
          }).eq('id', goal.id)
        }
      }
      setMessage('保存しました')
      fetchGoals()
    } catch {
      setMessage('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/kpi" className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-2">
            <ChevronLeft className="h-4 w-4" />KPI・目標管理に戻る
          </a>
          <h1 className="text-xl font-bold text-gray-900">部門目標管理</h1>
          <p className="text-sm text-gray-500">全社・部門ごとの目標を設定します</p>
        </div>
        <select
          value={fiscalYear}
          onChange={e => setFiscalYear(Number(e.target.value))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {availableFiscalYears.map(fy => <option key={fy} value={fy}>第{fy}期</option>)}
        </select>
      </div>

      {/* フィルター */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">対象</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value as Department | 'all')}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全社共通</option>
              {Object.entries(DEPT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">カテゴリ</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">評価期間</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as Period)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 目標一覧 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            第{fiscalYear}期 {department === 'all' ? '全社共通' : DEPT_LABELS[department as Department]} / {CATEGORY_LABELS[category]} / {PERIOD_LABELS[period]}
          </h2>
          <span className="text-xs text-gray-500">{goals.length}件</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {goals.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                目標がありません。「＋ 目標を追加」から登録してください。
              </div>
            )}
            {goals.map((goal, idx) => (
              <div key={goal.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-400 mt-2 w-6 text-center">{idx + 1}</span>
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">目標項目 *</label>
                      <input
                        type="text"
                        value={goal.goal_title}
                        onChange={e => updateRow(goal.id, 'goal_title', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例：売上高 3億2千万円の達成"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">目標内容・定量目標</label>
                      <textarea
                        value={goal.goal_description ?? ''}
                        onChange={e => updateRow(goal.id, 'goal_description', e.target.value || null)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例：売上高 320,000,000円（年間）"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">評価基準</label>
                      <textarea
                        value={goal.eval_criteria ?? ''}
                        onChange={e => updateRow(goal.id, 'eval_criteria', e.target.value || null)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例：S:3億3千万円以上 / A:3億2千万円以上 / B:3億円以上 / C:2億9千万円以上 / D:2億9千万円未満"
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">目標値</label>
                        <input
                          type="number"
                          value={goal.target_value ?? ''}
                          onChange={e => updateRow(goal.id, 'target_value', e.target.value ? Number(e.target.value) : null)}
                          className="w-36 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="320000000"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">単位</label>
                        <input
                          type="text"
                          value={goal.target_unit ?? ''}
                          onChange={e => updateRow(goal.id, 'target_unit', e.target.value || null)}
                          className="w-20 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="円"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="text-red-400 hover:text-red-600 mt-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={addRow}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          目標を追加
        </button>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-sm ${message.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}
