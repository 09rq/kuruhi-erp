'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, Trash2, Save } from 'lucide-react'

type EvalCategory = 'company' | 'skill' | 'challenge' | 'teamwork'
type EvalPeriod = 'first_half' | 'second_half' | 'full_year'

const CATEGORY_LABELS: Record<EvalCategory, string> = {
  company: '会社目標',
  skill: '業務スキル評価',
  challenge: 'チャレンジ評価',
  teamwork: 'チームワーク評価',
}

const PERIOD_LABELS: Record<EvalPeriod, string> = {
  first_half: '上半期（6〜11月）',
  second_half: '下半期（12〜5月）',
  full_year: '通期',
}

type EvalType = 'qualitative' | 'quantitative'

interface EvalGoal {
  id: string
  fiscal_year: number
  period: EvalPeriod
  category: EvalCategory
  sort_order: number
  goal_text: string
  is_quantitative: boolean
  target_value: number | null
  target_unit: string | null
  member_id: string | null
  eval_type: EvalType
  description: string | null
  key_points: string | null
  examples: string | null
}

interface KpiMember {
  id: string
  name: string
  department: string
}

export default function EvalGoalsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [fiscalYear, setFiscalYear] = useState(64)
  const [period, setPeriod] = useState<EvalPeriod>('first_half')
  const [category, setCategory] = useState<EvalCategory>('company')
  const [goals, setGoals] = useState<EvalGoal[]>([])
  const [members, setMembers] = useState<KpiMember[]>([])
  const [availableFiscalYears, setAvailableFiscalYears] = useState<number[]>([63, 64])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('eval_goals')
        .select('*')
        .eq('fiscal_year', fiscalYear)
        .eq('period', period)
        .eq('category', category)
        .order('sort_order')
      setGoals(data || [])

      const { data: memberData } = await supabase
        .from('kpi_members')
        .select('id, name, department')
        .order('department')
      setMembers(memberData || [])

      const { data: fyList } = await supabase
        .from('fiscal_year_targets')
        .select('fiscal_year')
        .order('fiscal_year', { ascending: false })
      if (fyList && fyList.length > 0) {
        setAvailableFiscalYears(fyList.map((r: {fiscal_year: number}) => r.fiscal_year))
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, fiscalYear, period, category])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  function addRow() {
    const newGoal: EvalGoal = {
      id: `new-${Date.now()}`,
      fiscal_year: fiscalYear,
      period,
      category,
      sort_order: goals.length,
      goal_text: '',
      is_quantitative: false,
      target_value: null,
      target_unit: null,
      member_id: null,
      eval_type: 'qualitative' as EvalType,
      description: null,
      key_points: null,
      examples: null,
    }
    setGoals(prev => [...prev, newGoal])
  }

  function updateRow(id: string, field: keyof EvalGoal, value: unknown) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  async function deleteGoal(id: string) {
    if (id.startsWith('new-')) {
      setGoals(prev => prev.filter(g => g.id !== id))
      return
    }
    if (!confirm('この評価項目を削除しますか？')) return
    await supabase.from('eval_goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function saveAll() {
    setSaving(true)
    setMessage(null)
    try {
      for (const goal of goals) {
        if (goal.id.startsWith('new-')) {
          await supabase.from('eval_goals').insert({
            fiscal_year: fiscalYear,
            period,
            category,
            sort_order: goal.sort_order,
            goal_text: goal.goal_text,
            is_quantitative: goal.is_quantitative,
            target_value: goal.target_value,
            target_unit: goal.target_unit,
            member_id: goal.member_id,
            eval_type: goal.eval_type,
            description: goal.description,
            key_points: goal.key_points,
            examples: goal.examples,
            key_points: goal.key_points,
            examples: goal.examples,
          })
        } else {
          await supabase.from('eval_goals').update({
            goal_text: goal.goal_text,
            is_quantitative: goal.is_quantitative,
            target_value: goal.target_value,
            target_unit: goal.target_unit,
            member_id: goal.member_id,
            sort_order: goal.sort_order,
            eval_type: goal.eval_type,
            description: goal.description,
            key_points: goal.key_points,
            examples: goal.examples,
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
          <h1 className="text-xl font-bold text-gray-900">評価項目管理</h1>
          <p className="text-sm text-gray-500">期・評価期間・カテゴリ別に評価項目を設定します</p>
        </div>
        <a href="/evaluation" className="text-sm text-blue-600 hover:underline">← 評価シートに戻る</a>
      </div>

      {/* フィルター */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">期</label>
            <select value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {availableFiscalYears.map(fy => <option key={fy} value={fy}>第{fy}期</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">評価期間</label>
            <select value={period} onChange={e => setPeriod(e.target.value as EvalPeriod)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">カテゴリ</label>
            <select value={category} onChange={e => setCategory(e.target.value as EvalCategory)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 評価項目一覧 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            第{fiscalYear}期 {PERIOD_LABELS[period]} / {CATEGORY_LABELS[category]}
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
                評価項目がありません。「＋ 項目を追加」から登録してください。
              </div>
            )}
            {goals.map((goal, idx) => (
              <div key={goal.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-400 mt-2 w-6 text-center">{idx + 1}</span>
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">評価項目</label>
                      <input
                        type="text"
                        value={goal.goal_text}
                        onChange={e => updateRow(goal.id, 'goal_text', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="評価項目を入力してください"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">評価基準</label>
                      <select
                        value={goal.eval_type}
                        onChange={e => updateRow(goal.id, 'eval_type', e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="qualitative">定性評価（S/A/B/C/D）</option>
                        <option value="quantitative">定量評価（達成率）</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">目標の説明（備考）</label>
                      <textarea
                        value={goal.description ?? ''}
                        onChange={e => updateRow(goal.id, 'description', e.target.value || null)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="目標の詳細や達成基準を入力してください"
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={goal.is_quantitative}
                          onChange={e => updateRow(goal.id, 'is_quantitative', e.target.checked)}
                          className="rounded"
                        />
                        数値目標あり
                      </label>
                      {goal.is_quantitative && (
                        <>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={goal.target_value ?? ''}
                              onChange={e => updateRow(goal.id, 'target_value', e.target.value ? Number(e.target.value) : null)}
                              className="w-32 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="目標値"
                            />
                            <input
                              type="text"
                              value={goal.target_unit ?? ''}
                              onChange={e => updateRow(goal.id, 'target_unit', e.target.value || null)}
                              className="w-20 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="単位"
                            />
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-500">対象メンバー（空=全員）</label>
                        <select
                          value={goal.member_id ?? ''}
                          onChange={e => updateRow(goal.id, 'member_id', e.target.value || null)}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">全員共通</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
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
          項目を追加
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
