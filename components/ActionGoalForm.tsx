'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Check } from 'lucide-react'

type GoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'not_achieved'

const STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  achieved: '達成',
  not_achieved: '未達',
}

const STATUS_COLORS: Record<GoalStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  achieved: 'bg-green-100 text-green-700',
  not_achieved: 'bg-red-100 text-red-700',
}

type EvalCategory = 'skill' | 'challenge' | 'teamwork'

const EVAL_CATEGORY_LABELS: Record<EvalCategory, string> = {
  skill: '業務スキル評価',
  challenge: 'チャレンジ評価',
  teamwork: 'チームワーク評価',
}

interface ActionGoal {
  id: string
  title: string
  action_plan: string
  target_value: number | null
  target_unit: string | null
  current_value: number
  due_date: string | null
  status: GoalStatus
  eval_category: EvalCategory | null
}

interface Props {
  memberId: string
  goals: ActionGoal[]
  onUpdate: () => void
}

export default function ActionGoalForm({ memberId, goals, onUpdate }: Props) {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    action_plan: '',
    target_value: '',
    target_unit: '',
    current_value: '',
    due_date: '',
    status: 'not_started' as GoalStatus,
    eval_category: '' as EvalCategory | '',
  })

  function resetForm() {
    setForm({ title: '', action_plan: '', target_value: '', target_unit: '', current_value: '', due_date: '', status: 'not_started', eval_category: '' })
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(goal: ActionGoal) {
    setForm({
      title: goal.title,
      action_plan: goal.action_plan || '',
      target_value: goal.target_value?.toString() || '',
      target_unit: goal.target_unit || '',
      current_value: goal.current_value?.toString() || '',
      due_date: goal.due_date || '',
      status: goal.status,
      eval_category: goal.eval_category || '',
    })
    setEditingId(goal.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.title) return
    setSaving(true)
    try {
      const payload = {
        member_id: memberId,
        fiscal_year: 2026,
        title: form.title,
        action_plan: form.action_plan || null,
        target_value: form.target_value ? Number(form.target_value) : null,
        target_unit: form.target_unit || null,
        current_value: form.current_value ? Number(form.current_value) : 0,
        due_date: form.due_date || null,
        status: form.status,
        eval_category: form.eval_category || null,
      }
      if (editingId) {
        await supabase.from('kpi_action_goals').update(payload).eq('id', editingId)
      } else {
        await supabase.from('kpi_action_goals').insert(payload)
      }
      resetForm()
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('kpi_action_goals').delete().eq('id', id)
    onUpdate()
  }

  async function handleStatusChange(id: string, status: GoalStatus) {
    await supabase.from('kpi_action_goals').update({ status }).eq('id', id)
    onUpdate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-700">個人アクション目標</h3>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          <Plus className="h-3.5 w-3.5" />目標を追加
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-blue-900 mb-3">{editingId ? '目標を編集' : '新しい目標を追加'}</p>
          <div className="grid gap-3">
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">目標タイトル *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="例：見積粗利率30%以上を維持する"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">アクションプラン（具体的な行動）</label>
              <textarea
                value={form.action_plan}
                onChange={e => setForm(p => ({ ...p, action_plan: e.target.value }))}
                placeholder="例：毎月の見積書を見直し、粗利率が30%を下回る場合は上司に相談する"
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">目標値</label>
                <input
                  type="number"
                  value={form.target_value}
                  onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))}
                  placeholder="30"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">単位</label>
                <input
                  type="text"
                  value={form.target_unit}
                  onChange={e => setForm(p => ({ ...p, target_unit: e.target.value }))}
                  placeholder="% / 円 / 件"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">現在値</label>
                <input
                  type="number"
                  value={form.current_value}
                  onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))}
                  placeholder="0"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">期限</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">評価カテゴリ（人事評価との連携）</label>
              <select
                value={form.eval_category}
                onChange={e => setForm(p => ({ ...p, eval_category: e.target.value as EvalCategory | "" }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">設定しない</option>
                {(Object.entries(EVAL_CATEGORY_LABELS) as [EvalCategory, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">ステータス</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as GoalStatus }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.entries(STATUS_LABELS) as [GoalStatus, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} disabled={saving || !form.title} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />{saving ? '保存中...' : '保存する'}
            </button>
            <button onClick={resetForm} className="flex items-center gap-1 text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100">
              <X className="h-3.5 w-3.5" />キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {goals.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">目標がまだ設定されていません。「目標を追加」から入力してください。</p>
        ) : (
          goals.map(goal => {
            const progress = goal.target_value && goal.target_value > 0
              ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
              : null
            return (
              <div key={goal.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 text-sm">{goal.title}</p>
                      {goal.eval_category && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {EVAL_CATEGORY_LABELS[goal.eval_category]}
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[goal.status]}`}>
                        {STATUS_LABELS[goal.status]}
                      </span>
                    </div>
                    {goal.action_plan && <p className="text-xs text-gray-500 mb-2">{goal.action_plan}</p>}
                    {goal.target_value && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>現在値: {goal.current_value.toLocaleString()}{goal.target_unit}</span>
                          <span>目標: {goal.target_value.toLocaleString()}{goal.target_unit}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-blue-700 font-bold mt-1">達成率 {progress}%</p>
                      </div>
                    )}
                    {goal.due_date && <p className="text-xs text-gray-400">期限: {new Date(goal.due_date).toLocaleDateString('ja-JP')}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <select
                    value={goal.status}
                    onChange={e => handleStatusChange(goal.id, e.target.value as GoalStatus)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                  >
                    {(Object.entries(STATUS_LABELS) as [GoalStatus, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <button onClick={() => startEdit(goal)} className="text-xs text-blue-600 hover:underline">編集</button>
                  <button onClick={() => handleDelete(goal.id)} className="text-xs text-red-400 hover:underline">削除</button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
