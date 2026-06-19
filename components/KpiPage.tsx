'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Target, Star, TrendingUp, Users, ChevronDown, ChevronUp } from 'lucide-react'
import ActionGoalForm from './ActionGoalForm'

type Department = 'sales' | 'planning' | 'production' | 'cutting' | 'quality' | 'management'
type Position = 'director' | 'manager' | 'leader' | 'member' | 'hourly'

const DEPT_LABELS: Record<Department, string> = {
  sales: '営業部', planning: '企画開発部', production: '生産管理部',
  cutting: '生産管理部／裁断', quality: '品質管理部', management: '管理本部',
}
const POSITION_LABELS: Record<Position, string> = {
  director: '代表取締役', manager: '課長', leader: 'リーダー', member: 'メンバー', hourly: '時給社員',
}
const DEPT_COLORS: Record<Department, string> = {
  sales: 'bg-blue-100 text-blue-800', planning: 'bg-purple-100 text-purple-800',
  production: 'bg-green-100 text-green-800', cutting: 'bg-emerald-100 text-emerald-800',
  quality: 'bg-orange-100 text-orange-800', management: 'bg-red-100 text-red-800',
}

interface KpiMember {
  id: string; name: string; email: string
  department: Department; position: Position; can_view_all: boolean
}
interface KpiGoal {
  id: string; member_id: string | null; fiscal_year: number
  goal_title: string; goal_description: string | null
  target_value: number | null; target_unit: string | null
  department: string | null; eval_criteria: string | null
  category: string | null; period: string | null
}
interface ActionGoal {
  member_id: string;
  id: string; title: string; action_plan: string
  target_value: number | null; target_unit: string | null
  current_value: number; due_date: string | null
  status: 'not_started' | 'in_progress' | 'achieved' | 'not_achieved'
  eval_category: 'skill' | 'challenge' | 'teamwork' | null
}
interface MonthlyCost {
  year_month: string; revenue: number; material_cost: number
  outsource_cost: number; labor_cost: number; freight_cost: number
}

function getStars(p: number) { return p >= 100 ? 5 : p >= 80 ? 4 : p >= 60 ? 3 : p >= 40 ? 2 : p >= 20 ? 1 : 0 }

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </div>
  )
}

function ProgressBar({ value, color = 'bg-blue-500' }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export default function KpiPage() {
  const supabase = createClient()
  const [myMember, setMyMember] = useState<KpiMember | null>(null)
  const [allMembers, setAllMembers] = useState<KpiMember[]>([])
  const [goals, setGoals] = useState<KpiGoal[]>([])
  const [actionGoals, setActionGoals] = useState<ActionGoal[]>([])
  const [latestCost, setLatestCost] = useState<MonthlyCost | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'my' | 'all' | 'input'>('my')
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [costInput, setCostInput] = useState<Partial<MonthlyCost>>({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [fiscalYear, setFiscalYear] = useState(63)
  const [fiscalYearTargets, setFiscalYearTargets] = useState<{
    fiscal_year: number; start_month: string; end_month: string
    revenue_target: number; material_rate_target: number; outsource_rate_target: number
    labor_rate_target: number; freight_rate_target: number; memo: string | null
  } | null>(null)
  const [allFiscalYears, setAllFiscalYears] = useState<number[]>([])
  const [editingTargets, setEditingTargets] = useState(false)
  const [targetInput, setTargetInput] = useState<Record<string, number | string>>({})
  const [targetSaving, setTargetSaving] = useState(false)
  const [targetMessage, setTargetMessage] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: members } = await supabase.from('kpi_members').select('*').order('department')
      const { data: goalsData } = await supabase.from('kpi_goals').select('*').eq('fiscal_year', fiscalYear === 63 ? 2026 : fiscalYear).order('created_at')
      const { data: actionGoalsData } = await supabase.from('kpi_action_goals').select('*').eq('fiscal_year', fiscalYear === 63 ? 2026 : fiscalYear)
      const { data: fyTargets } = await supabase.from('fiscal_year_targets').select('*').eq('fiscal_year', fiscalYear).single()
      const { data: allFY } = await supabase.from('fiscal_year_targets').select('fiscal_year').order('fiscal_year', { ascending: false })
      setFiscalYearTargets(fyTargets || null)
      const fyList = (allFY || []).map((r: {fiscal_year: number}) => r.fiscal_year)
      setAllFiscalYears(fyList.length > 0 ? fyList : [63, 64])
      if (fyTargets) {
        setTargetInput({
          revenue_target: fyTargets.revenue_target,
          material_rate_target: fyTargets.material_rate_target,
          outsource_rate_target: fyTargets.outsource_rate_target,
          labor_rate_target: fyTargets.labor_rate_target,
          freight_rate_target: fyTargets.freight_rate_target,
          memo: fyTargets.memo || '',
        })
      }
      const { data: costs } = await supabase.from('monthly_costs').select('*').order('year_month', { ascending: false }).limit(1)
      setAllMembers(members || [])
      setGoals(goalsData || [])
      setActionGoals(actionGoalsData || [])
      setLatestCost(costs?.[0] || null)
      const me = members?.find((m: KpiMember) => m.email === user.email)
      setMyMember(me || null)
      if (costs?.[0]) { setCostInput(costs[0]) } else {
        const now = new Date()
        setCostInput({ year_month: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`, revenue: 0, material_cost: 0, outsource_cost: 0, labor_cost: 0, freight_cost: 0 })
      }
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase, fiscalYear])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSaveCost() {
    setSaving(true); setSaveMessage(null)
    try {
      const { error } = await supabase.from('monthly_costs').upsert(costInput, { onConflict: 'year_month' })
      if (error) throw error
      setSaveMessage('保存しました'); fetchData()
    } catch { setSaveMessage('保存に失敗しました') } finally { setSaving(false) }
  }

  function calcProgress(dept: Department): number {
    if (!latestCost?.revenue) return 0
    const r = latestCost.revenue
    const mat = Number(fiscalYearTargets?.material_rate_target ?? 18.5)
    const out = Number(fiscalYearTargets?.outsource_rate_target ?? 43.5)
    const lab = Number(fiscalYearTargets?.labor_rate_target ?? 7.0)
    const frt = Number(fiscalYearTargets?.freight_rate_target ?? 1.0)
    const rev = Number(fiscalYearTargets?.revenue_target ?? 300000000)
    switch (dept) {
      case 'sales': return Math.min(100, Math.round((r / rev) * 100))
      case 'planning': { const a = (latestCost.outsource_cost/r)*100; return a <= out ? Math.min(100, Math.round((out/a)*80)) : Math.round((out/a)*60) }
      case 'production': case 'cutting': { const a = (latestCost.material_cost/r)*100; return a <= mat ? Math.min(100, Math.round((mat/a)*80)) : Math.round((mat/a)*60) }
      case 'quality': { const a = (latestCost.freight_cost/r)*100; return a <= frt ? 90 : Math.round((frt/a)*60) }
      case 'management': { const a = (latestCost.labor_cost/r)*100; return a <= lab ? 90 : Math.round((lab/a)*60) }
      default: return 0
    }
  }

  function calcBonusProgress(): number {
    if (!latestCost?.revenue) return 0
    const r = latestCost.revenue
    const mat = Number(fiscalYearTargets?.material_rate_target ?? 18.5)
    const out = Number(fiscalYearTargets?.outsource_rate_target ?? 43.5)
    const lab = Number(fiscalYearTargets?.labor_rate_target ?? 7.0)
    const frt = Number(fiscalYearTargets?.freight_rate_target ?? 1.0)
    const targetTotal = mat + out + lab + frt
    const actual = ((latestCost.material_cost + latestCost.outsource_cost + latestCost.labor_cost + latestCost.freight_cost) / r) * 100
    return Math.min(100, Math.max(0, 50 + (targetTotal - actual) * 5))
  }

  const memberGoals = (id: string) => {
    const member = allMembers.find(m => m.id === id)
    if (!member) return []
    return goals.filter(g => g.department === member.department || g.department === null)
  }
  const memberActionGoals = (id: string) => actionGoals.filter(g => g.member_id === id)
  const canViewAll = myMember?.can_view_all || false
  const bonusProgress = calcBonusProgress()

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><Target className="h-6 w-6 text-blue-700" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">KPI・目標管理</h1>
            <p className="text-sm text-gray-500">個人目標と全社の原価改善状況</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={fiscalYear}
            onChange={e => setFiscalYear(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {allFiscalYears.map(fy => (
              <option key={fy} value={fy}>第{fy}期</option>
            ))}
          </select>
          {canViewAll && (
            <button
              onClick={() => setEditingTargets(!editingTargets)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50"
            >
              ⚙️ 目標値設定
            </button>
          )}
        </div>
      </div>

      {editingTargets && canViewAll && fiscalYearTargets && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">第{fiscalYear}期 目標値設定</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { label: '売上目標（円）', key: 'revenue_target', type: 'number' },
              { label: '材料費率目標（%）', key: 'material_rate_target', type: 'number' },
              { label: '外注費率目標（%）', key: 'outsource_rate_target', type: 'number' },
              { label: '労務費率目標（%）', key: 'labor_rate_target', type: 'number' },
              { label: '運賃率目標（%）', key: 'freight_rate_target', type: 'number' },
              { label: 'メモ', key: 'memo', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
                <input
                  type={type}
                  step="0.1"
                  value={targetInput[key] as string || ''}
                  onChange={e => setTargetInput(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setTargetSaving(true); setTargetMessage(null)
                try {
                  const { error } = await supabase.from('fiscal_year_targets').update(targetInput).eq('fiscal_year', fiscalYear)
                  if (error) throw error
                  setTargetMessage('保存しました')
                  fetchData()
                } catch { setTargetMessage('保存に失敗しました') } finally { setTargetSaving(false) }
              }}
              disabled={targetSaving}
              className="bg-blue-600 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {targetSaving ? '保存中...' : '保存する'}
            </button>
            {targetMessage && <p className={`text-sm ${targetMessage.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>{targetMessage}</p>}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-blue-200 text-sm font-medium">全社 賞与積み上げ状況</p>
            <p className="text-2xl font-bold mt-1">{bonusProgress.toFixed(0)}%</p>
          </div>
          <StarRating stars={getStars(bonusProgress)} />
        </div>
        <ProgressBar value={bonusProgress} color="bg-yellow-400" />
        <p className="text-blue-200 text-xs mt-2">原価率が目標値（材料費{fiscalYearTargets?.material_rate_target ?? 18.5}%・外注費{fiscalYearTargets?.outsource_rate_target ?? 43.5}%・人件費{fiscalYearTargets?.labor_rate_target ?? 7.0}%・運賃{fiscalYearTargets?.freight_rate_target ?? 1.0}%）に近づくほど賞与が積み上がります</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('my')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'my' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>自分の目標</button>
        {canViewAll && <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Users className="h-4 w-4 inline mr-1" />全メンバー</button>}
        {canViewAll && <button onClick={() => setActiveTab('input')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'input' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><TrendingUp className="h-4 w-4 inline mr-1" />実績入力</button>}
      </div>

      {activeTab === 'my' && (
        <div>
          {myMember ? (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{myMember.name}</h2>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DEPT_COLORS[myMember.department]}`}>{DEPT_LABELS[myMember.department]}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{POSITION_LABELS[myMember.position]}</span>
                    </div>
                  </div>
                  <StarRating stars={getStars(calcProgress(myMember.department))} />
                </div>
                <ProgressBar value={calcProgress(myMember.department)} color="bg-blue-500" />
                <p className="text-xs text-gray-400 mt-1">部門進捗 {calcProgress(myMember.department)}%</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">部門KPI目標</h3>
                  {canViewAll && (
                    <a href="/kpi/goals" className="text-xs text-blue-600 hover:underline">⚙️ 部門目標を管理する</a>
                  )}
                </div>
                <div className="grid gap-3">
                  {memberGoals(myMember.id).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">部門目標が設定されていません</p>
                  ) : (
                    memberGoals(myMember.id).map(goal => (
                      <div key={goal.id} className="bg-gray-50 rounded-xl p-3">
                        <p className="font-medium text-gray-900 text-sm">{goal.goal_title}</p>
                        {goal.goal_description && <p className="text-xs text-gray-500 mt-1">{goal.goal_description}</p>}
                        {goal.eval_criteria && <p className="text-xs text-orange-600 mt-1">評価基準: {goal.eval_criteria}</p>}
                        {goal.target_value && <p className="text-xs text-blue-700 font-bold mt-1">目標: {goal.target_value.toLocaleString()}{goal.target_unit}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <ActionGoalForm
                  memberId={myMember.id}
                  goals={memberActionGoals(myMember.id)}
                  onUpdate={fetchData}
                  fiscalYear={fiscalYear === 63 ? 2026 : fiscalYear}
                />
              </div>
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
              <p className="text-yellow-800 font-medium">KPIメンバーとして登録されていません</p>
              <p className="text-yellow-600 text-sm mt-1">管理者に登録を依頼してください</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'all' && canViewAll && (
        <div className="space-y-3">
          {allMembers.map(member => {
            const progress = calcProgress(member.department)
            const isExpanded = expandedMember === member.id
            const aGoals = memberActionGoals(member.id)
            const achievedCount = aGoals.filter(g => g.status === 'achieved').length
            return (
              <div key={member.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedMember(isExpanded ? null : member.id)} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DEPT_COLORS[member.department]}`}>{DEPT_LABELS[member.department]}</span>
                      <span className="text-xs text-gray-400">{POSITION_LABELS[member.position]}</span>
                      {aGoals.length > 0 && <span className="text-xs text-green-600 font-medium">{achievedCount}/{aGoals.length}達成</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1"><ProgressBar value={progress} color="bg-blue-500" /></div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{progress}%</span>
                      <StarRating stars={getStars(progress)} />
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <ActionGoalForm memberId={member.id} goals={aGoals} onUpdate={fetchData} fiscalYear={fiscalYear === 63 ? 2026 : fiscalYear} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'input' && canViewAll && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">今月の原価実績を入力</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { label: '対象月', key: 'year_month', type: 'month' },
              { label: '売上（円）', key: 'revenue', type: 'number' },
              { label: `材料費（円）目標率 ${fiscalYearTargets?.material_rate_target ?? 18.5}%`, key: 'material_cost', type: 'number' },
              { label: `外注費（円）目標率 ${fiscalYearTargets?.outsource_rate_target ?? 43.5}%`, key: 'outsource_cost', type: 'number' },
              { label: `人件費（円）目標率 ${fiscalYearTargets?.labor_rate_target ?? 7.0}%`, key: 'labor_cost', type: 'number' },
              { label: `運賃（円）目標率 ${fiscalYearTargets?.freight_rate_target ?? 1.0}%`, key: 'freight_cost', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
                <input
                  type={type}
                  value={(costInput as Record<string, unknown>)[key] as string || ''}
                  onChange={e => setCostInput(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={type === 'number' ? '0' : ''}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSaveCost} disabled={saving} className="bg-blue-600 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : '保存する'}
            </button>
            {saveMessage && <p className={`text-sm ${saveMessage.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>{saveMessage}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
