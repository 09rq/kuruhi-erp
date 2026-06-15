'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileDown, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import EvalMemo from './EvalMemo'

type Department = 'sales' | 'planning' | 'production' | 'cutting' | 'quality' | 'management'
type Position = 'director' | 'manager' | 'leader' | 'member' | 'hourly'
type EvalCategory = 'company' | 'skill' | 'challenge' | 'teamwork'
type EvalPeriod = 'first_half' | 'second_half' | 'full_year'

const DEPT_LABELS: Record<Department, string> = {
  sales: '営業部', planning: '企画開発部', production: '生産管理部',
  cutting: '生産管理部／裁断', quality: '品質管理部', management: '管理本部',
}
const POSITION_LABELS: Record<Position, string> = {
  director: '代表取締役', manager: '課長', leader: 'リーダー', member: 'メンバー', hourly: '時給社員',
}
const CATEGORY_LABELS: Record<EvalCategory, string> = {
  company: '会社目標', skill: '業務スキル評価', challenge: 'チャレンジ評価', teamwork: 'チームワーク評価',
}
const PERIOD_LABELS: Record<EvalPeriod, string> = {
  first_half: '上半期（6〜11月）', second_half: '下半期（12〜5月）', full_year: '通期',
}
const SCORE_LABELS: Record<number, string> = { 10: 'S', 8: 'A', 6: 'B', 4: 'C', 2: 'D' }
const SCORE_COLORS: Record<number, string> = {
  10: 'bg-purple-100 text-purple-800', 8: 'bg-blue-100 text-blue-800',
  6: 'bg-green-100 text-green-800', 4: 'bg-yellow-100 text-yellow-800',
  2: 'bg-red-100 text-red-800',
}

function getTotalLabel(score: number) {
  if (score >= 90) return { label: 'S評価', color: 'text-purple-700' }
  if (score >= 80) return { label: 'A評価', color: 'text-blue-700' }
  if (score >= 70) return { label: 'B評価', color: 'text-green-700' }
  if (score >= 60) return { label: 'C評価', color: 'text-yellow-700' }
  return { label: 'D評価', color: 'text-red-700' }
}

interface KpiMember {
  id: string; name: string; email: string
  department: Department; position: Position; can_view_all: boolean
}
interface EvalGoal {
  id: string; category: EvalCategory; sort_order: number
  goal_text: string; is_quantitative: boolean
  target_value: number | null; target_unit: string | null
  member_id: string | null
}
interface EvalScore {
  id?: string; eval_goal_id: string; member_id: string
  self_score: number | null; self_comment: string
  manager_score: number | null; manager_comment: string
  actual_value: number | null
}

interface KpiActionGoal {
  id: string
  title: string
  eval_category: 'skill' | 'challenge' | 'teamwork'
  target_value: number | null
  target_unit: string | null
  is_quantitative: boolean
}

export default function EvaluationPage() {
  const supabase = createClient()
  const [myMember, setMyMember] = useState<KpiMember | null>(null)
  const [allMembers, setAllMembers] = useState<KpiMember[]>([])
  const [selectedMember, setSelectedMember] = useState<KpiMember | null>(null)
  const [period, setPeriod] = useState<EvalPeriod>('first_half')
  const [goals, setGoals] = useState<EvalGoal[]>([])
  const [scores, setScores] = useState<Record<string, EvalScore>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    company: true, skill: true, challenge: true, teamwork: true,
  })
  const [canViewAll, setCanViewAll] = useState(false)
  const [kpiActionGoals, setKpiActionGoals] = useState<KpiActionGoal[]>([])
  const [fiscalYear, setFiscalYear] = useState(63)
  const [availableFiscalYears, setAvailableFiscalYears] = useState<number[]>([63, 64])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: members } = await supabase.from('kpi_members').select('*').order('department')
      const { data: fyList } = await supabase.from('fiscal_year_targets').select('fiscal_year').order('fiscal_year', { ascending: false })
      if (fyList && fyList.length > 0) setAvailableFiscalYears(fyList.map((r: {fiscal_year: number}) => r.fiscal_year))
      const me = members?.find((m: KpiMember) => m.email === user.email)
      setMyMember(me || null)
      setAllMembers(members || [])
      setCanViewAll(me?.can_view_all || false)
      const target = selectedMember || me
      if (!target) return
      const { data: goalsData } = await supabase
        .from('eval_goals').select('*')
        .eq('fiscal_year', fiscalYear).in('period', [period, 'full_year'])
        .or(`member_id.eq.${target.id},member_id.is.null`)
        .order('category').order('sort_order')
      const { data: scoresData } = await supabase
        .from('eval_scores').select('*')
        .eq('member_id', target.id).eq('fiscal_year', fiscalYear).eq('period', period)
      setGoals(goalsData || [])

      // KPIアクション目標（eval_categoryが設定されているもの）を取得
      const { data: kpiGoalsData } = await supabase
        .from('kpi_action_goals')
        .select('id, title, eval_category, target_value, target_unit')
        .eq('member_id', target.id)
        .eq('fiscal_year', fiscalYear === 63 ? 2026 : fiscalYear)
        .not('eval_category', 'is', null)
      setKpiActionGoals((kpiGoalsData || []).map((g: {id: string; title: string; eval_category: string; target_value: number | null; target_unit: string | null}) => ({
        ...g,
        is_quantitative: g.target_value !== null,
      })) as KpiActionGoal[])
      const scoresMap: Record<string, EvalScore> = {}
      scoresData?.forEach((s: EvalScore) => { scoresMap[s.eval_goal_id] = s })
      setScores(scoresMap)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase, selectedMember, period, fiscalYear])

  useEffect(() => { fetchData() }, [fetchData])

  const targetMember = selectedMember || myMember
  const isOwnSheet = targetMember?.id === myMember?.id

  function handleScoreChange(goalId: string, field: keyof EvalScore, value: number | string | null) {
    const current = scores[goalId] || {
      eval_goal_id: goalId, member_id: targetMember!.id,
      self_score: null, self_comment: '', manager_score: null, manager_comment: '', actual_value: null
    }
    setScores(prev => ({ ...prev, [goalId]: { ...current, [field]: value } }))
  }

  async function handleSaveAll() {
    if (!targetMember) return
    setSaving(true)
    setSaveMessage(null)
    try {
      for (const score of Object.values(scores)) {
        await supabase.from('eval_scores').upsert({
          ...score, fiscal_year: fiscalYear, period,
        }, { onConflict: 'eval_goal_id,member_id,fiscal_year,period' })
      }
      setSaveMessage('保存しました')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (e) {
      console.error(e)
      setSaveMessage('保存に失敗しました')
    } finally { setSaving(false) }
  }

  async function handlePdfDownload() {
    if (!targetMember) return
    setPdfLoading(true)
    try {
      const { pdf, Document, Page, Text, View, StyleSheet, Font } = await import('@react-pdf/renderer')
      Font.register({ family: 'NotoSans', src: '/NotoSans.otf' })
      const totals = calcTotalScore()
      const totalLabel = getTotalLabel(totals.total)
      const styles = StyleSheet.create({
        page: { padding: 30, fontSize: 9, fontFamily: 'NotoSans' },
        title: { fontSize: 14, fontWeight: 'bold', marginBottom: 2, textAlign: 'center' },
        subtitle: { fontSize: 8, color: '#666', marginBottom: 4, textAlign: 'center' },
        badge: { fontSize: 8, textAlign: 'center', marginBottom: 12, color: '#7c3aed' },
        infoRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
        infoCard: { flex: 1, padding: 6, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e0e7ff', borderRadius: 3 },
        infoLabel: { fontSize: 7, color: '#666', marginBottom: 1 },
        infoValue: { fontSize: 9, fontWeight: 'bold', color: '#1e3a5f' },
        section: { marginBottom: 10 },
        sectionTitle: { fontSize: 10, fontWeight: 'bold', padding: 4, backgroundColor: '#1e3a5f', color: 'white', marginBottom: 0 },
        tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#d1d5db' },
        tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
        colGoal: { flex: 4, padding: 4 },
        colSelf: { flex: 1, padding: 4, textAlign: 'center', borderLeftWidth: 1, borderLeftColor: '#e5e7eb' },
        colManager: { flex: 1, padding: 4, textAlign: 'center', borderLeftWidth: 1, borderLeftColor: '#e5e7eb' },
        colComment: { flex: 3, padding: 4, borderLeftWidth: 1, borderLeftColor: '#e5e7eb' },
        scoreGood: { color: '#16a34a', fontWeight: 'bold' },
        scoreBad: { color: '#dc2626', fontWeight: 'bold' },
        totalBox: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 10 },
        totalCard: { flex: 1, padding: 8, backgroundColor: '#f0f4ff', borderRadius: 4, textAlign: 'center' },
        totalLabel: { fontSize: 8, color: '#666', marginBottom: 2 },
        totalValue: { fontSize: 16, fontWeight: 'bold' },
        handwriteBox: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, padding: 6, height: 80, marginBottom: 6 },
        handwriteLabel: { fontSize: 7, color: '#9ca3af', marginBottom: 3 },
        signRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
        signBox: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, padding: 6, height: 40 },
        signLabel: { fontSize: 7, color: '#9ca3af' },
        footer: { position: 'absolute', bottom: 15, left: 30, right: 30, textAlign: 'center', fontSize: 7, color: '#9ca3af' },
      })
      const categories: EvalCategory[] = ['company', 'skill', 'challenge', 'teamwork']
      const MyDoc = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.title}>人事評価シート　第{fiscalYear}期（{PERIOD_LABELS[period]}）</Text>
            <Text style={styles.subtitle}>株式会社クルヒ　作成日: {new Date().toLocaleDateString('ja-JP')}</Text>
            {period === 'first_half' && <Text style={styles.badge}>※冬季賞与評価対象</Text>}
            {period === 'full_year' && <Text style={styles.badge}>※夏季賞与・昇給評価対象</Text>}
            <View style={styles.infoRow}>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>氏名</Text><Text style={styles.infoValue}>{targetMember.name}</Text></View>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>部署</Text><Text style={styles.infoValue}>{DEPT_LABELS[targetMember.department]}</Text></View>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>役職</Text><Text style={styles.infoValue}>{POSITION_LABELS[targetMember.position]}</Text></View>
              <View style={styles.infoCard}><Text style={styles.infoLabel}>総合評価</Text><Text style={[styles.infoValue, { color: '#7c3aed' }]}>{totalLabel.label}（{totals.total}点）</Text></View>
            </View>
            {/* 評価基準 */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              <View style={{ flex: 1, padding: 6, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e0e7ff', borderRadius: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 3 }}>【定性評価基準】</Text>
                <Text style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>S(10点)　とても素晴らしい（満点の100%）</Text>
                <Text style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>A(8点)　期待以上によくできている（満点の80%）</Text>
                <Text style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>B(6点)　しっかりできている（満点の70%）</Text>
                <Text style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>C(4点)　もう一歩伸びてほしい（満点の40%）</Text>
                <Text style={{ fontSize: 7, color: '#333' }}>D(2点)　これからに期待したい（満点の20%）</Text>
              </View>
              <View style={{ flex: 1, padding: 6, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e0e7ff', borderRadius: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 3 }}>【定量評価基準】</Text>
                <Text style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>S(10点)　極めて優れている（達成率110%以上）</Text>
                <Text style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>A(8点)　優れている（達成率100〜109%）</Text>
                <Text style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>B(6点)　標準（達成率90〜99%）</Text>
                <Text style={{ fontSize: 7, color: '#333', marginBottom: 1 }}>C(4点)　やや不十分（達成率80〜89%）</Text>
                <Text style={{ fontSize: 7, color: '#333' }}>D(2点)　かなり不十分（達成率80%未満）</Text>
              </View>
            </View>
            <View style={{ padding: 4, backgroundColor: '#f3f4f6', borderRadius: 3, marginBottom: 8 }}>
              <Text style={{ fontSize: 7, color: '#555' }}>【総合評価基準】S：95点以上　A：80〜94点　B：70〜79点　C：60〜69点　D：60点未満　（満点110点）</Text>
            </View>
            {categories.map(cat => {
              const catGoals = goals.filter(g => g.category === cat)
              const kpiCatGoals = kpiActionGoals.filter(kg => kg.eval_category === cat)
              if (catGoals.length === 0 && kpiCatGoals.length === 0) return null
              return (
                <View key={cat} style={styles.section}>
                  <Text style={styles.sectionTitle}>{CATEGORY_LABELS[cat]}</Text>
                  <View style={styles.tableHeader}>
                    <Text style={styles.colGoal}>目標・評価項目</Text>
                    <Text style={styles.colSelf}>自己評価</Text>
                    <Text style={styles.colManager}>上司評価</Text>
                    <Text style={styles.colComment}>判断理由・根拠</Text>
                  </View>
                  {kpiCatGoals.map(kpiGoal => {
                    const score = scores[kpiGoal.id]
                    const isGood = (n: number) => n === 10 || n === 8
                    return (
                      <View key={`kpi-${kpiGoal.id}`} style={styles.tableRow} wrap={false}>
                        <View style={styles.colGoal}>
                          <Text style={{ fontSize: 7, color: '#7c3aed', marginBottom: 1 }}>KPI目標</Text>
                          <Text>{kpiGoal.title}</Text>
                          {kpiGoal.target_value && <Text style={{ fontSize: 7, color: '#666', marginTop: 1 }}>目標: {kpiGoal.target_value}{kpiGoal.target_unit}</Text>}
                          {score?.actual_value && <Text style={{ fontSize: 7, color: '#2563eb', marginTop: 1 }}>実績: {score.actual_value}{kpiGoal.target_unit}</Text>}
                        </View>
                        <Text style={[styles.colSelf, score?.self_score ? (isGood(score.self_score) ? styles.scoreGood : styles.scoreBad) : {}]}>
                          {score?.self_score ? `${SCORE_LABELS[score.self_score]}(${score.self_score})` : '　'}
                        </Text>
                        <Text style={[styles.colManager, score?.manager_score ? (isGood(score.manager_score) ? styles.scoreGood : styles.scoreBad) : {}]}>
                          {score?.manager_score ? `${SCORE_LABELS[score.manager_score]}(${score.manager_score})` : '　'}
                        </Text>
                        <Text style={styles.colComment}>{score?.self_comment || score?.manager_comment || ''}</Text>
                      </View>
                    )
                  })}
                  {catGoals.map(goal => {
                    const score = scores[goal.id]
                    const isGood = (n: number) => n === 10 || n === 8
                    return (
                      <View key={goal.id} style={styles.tableRow} wrap={false}>
                        <View style={styles.colGoal}>
                          <Text>{goal.goal_text}</Text>
                          {goal.target_value && <Text style={{ fontSize: 7, color: '#666', marginTop: 1 }}>目標: {goal.target_value}{goal.target_unit}</Text>}
                          {score?.actual_value && <Text style={{ fontSize: 7, color: '#2563eb', marginTop: 1 }}>実績: {score.actual_value}{goal.target_unit}</Text>}
                        </View>
                        <Text style={[styles.colSelf, score?.self_score ? (isGood(score.self_score) ? styles.scoreGood : styles.scoreBad) : {}]}>
                          {score?.self_score ? `${SCORE_LABELS[score.self_score]}(${score.self_score})` : '　'}
                        </Text>
                        <Text style={[styles.colManager, score?.manager_score ? (isGood(score.manager_score) ? styles.scoreGood : styles.scoreBad) : {}]}>
                          {score?.manager_score ? `${SCORE_LABELS[score.manager_score]}(${score.manager_score})` : '　'}
                        </Text>
                        <Text style={styles.colComment}>{score?.self_comment || score?.manager_comment || ''}</Text>
                      </View>
                    )
                  })}
                </View>
              )
            })}
            <View style={styles.totalBox}>
              <View style={styles.totalCard}><Text style={styles.totalLabel}>自己評価合計</Text><Text style={[styles.totalValue, { color: '#2563eb' }]}>{totals.self}点</Text></View>
              <View style={styles.totalCard}><Text style={styles.totalLabel}>上司評価合計</Text><Text style={[styles.totalValue, { color: '#1e3a5f' }]}>{totals.manager}点</Text></View>
              <View style={styles.totalCard}><Text style={styles.totalLabel}>総合得点</Text><Text style={[styles.totalValue, { color: '#7c3aed' }]}>{totals.total}点</Text></View>
              <View style={styles.totalCard}><Text style={styles.totalLabel}>総合評価</Text><Text style={[styles.totalValue, { color: '#7c3aed' }]}>{totalLabel.label}</Text></View>
            </View>
            <View style={styles.handwriteBox}><Text style={styles.handwriteLabel}>面談メモ・コメント（手書き記入欄）</Text></View>
            <View style={styles.signRow}>
              <View style={styles.signBox}><Text style={styles.signLabel}>本人署名</Text></View>
              <View style={styles.signBox}><Text style={styles.signLabel}>上司署名（小淵 陽介）</Text></View>
              <View style={styles.signBox}><Text style={styles.signLabel}>承認（安田 明宏）</Text></View>
              <View style={styles.signBox}><Text style={styles.signLabel}>面談日：　　年　　月　　日</Text></View>
            </View>
            <Text style={styles.footer}>株式会社クルヒ　人事評価シート　第{fiscalYear}期　機密文書　©{new Date().getFullYear()}</Text>
          </Page>
        </Document>
      )
      const blob = await pdf(<MyDoc />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `評価シート_${targetMember.name}_第${fiscalYear}期_${PERIOD_LABELS[period]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('PDF生成に失敗しました: ' + String(e))
    } finally { setPdfLoading(false) }
  }

  function calcTotalScore() {
    let selfTotal = 0, managerTotal = 0
    goals.forEach(goal => {
      const score = scores[goal.id]
      if (score?.self_score) selfTotal += score.self_score
      if (score?.manager_score) managerTotal += score.manager_score
    })
    kpiActionGoals.forEach(kpiGoal => {
      const score = scores[kpiGoal.id]
      if (score?.self_score) selfTotal += score.self_score
      if (score?.manager_score) managerTotal += score.manager_score
    })
    const total = selfTotal > 0 && managerTotal > 0
      ? Math.round((selfTotal + managerTotal) / 2)
      : selfTotal > 0 ? selfTotal : managerTotal
    return { self: selfTotal, manager: managerTotal, total }
  }

  const totals = calcTotalScore()
  const totalLabel = getTotalLabel(totals.total)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">人事評価シート</h1>
          <a href="/evaluation/goals" className="text-xs text-blue-600 hover:underline mt-0.5 block">⚙️ 評価項目を管理する</a>
          <p className="text-sm text-gray-500">第{fiscalYear}期</p>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && <span className="text-xs text-green-600 font-medium">{saveMessage}</span>}
          <button onClick={handleSaveAll} disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存する'}
          </button>
          <button onClick={handlePdfDownload} disabled={pdfLoading} className="flex items-center gap-2 bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-900 disabled:opacity-50">
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDFで出力
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">期</label>
          <select
            value={fiscalYear}
            onChange={e => setFiscalYear(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableFiscalYears.map(fy => (
              <option key={fy} value={fy}>第{fy}期</option>
            ))}
          </select>
        </div>
        {canViewAll && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">対象メンバー</label>
            <select value={selectedMember?.id || myMember?.id || ''} onChange={e => setSelectedMember(allMembers.find(m => m.id === e.target.value) || null)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {allMembers.map(m => <option key={m.id} value={m.id}>{m.name}（{DEPT_LABELS[m.department]}）</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">評価期間</label>
          <select value={period} onChange={e => setPeriod(e.target.value as EvalPeriod)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Object.entries(PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* 評価基準 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-bold text-gray-700 mb-2">【定性評価基準】</p>
            <div className="space-y-1 text-gray-600">
              <p><span className="font-bold text-purple-700">S(10点)</span>　とても素晴らしい（満点の100%）</p>
              <p><span className="font-bold text-blue-700">A(8点)</span>　期待以上によくできている（満点の80%）</p>
              <p><span className="font-bold text-green-700">B(6点)</span>　しっかりできている（満点の70%）</p>
              <p><span className="font-bold text-yellow-700">C(4点)</span>　もう一歩伸びてほしい（満点の40%）</p>
              <p><span className="font-bold text-red-700">D(2点)</span>　これからに期待したい（満点の20%）</p>
            </div>
          </div>
          <div>
            <p className="font-bold text-gray-700 mb-2">【定量評価基準】</p>
            <div className="space-y-1 text-gray-600">
              <p><span className="font-bold text-purple-700">S(10点)</span>　極めて優れている（達成率110%以上）</p>
              <p><span className="font-bold text-blue-700">A(8点)</span>　優れている（達成率100〜109%）</p>
              <p><span className="font-bold text-green-700">B(6点)</span>　標準（達成率90〜99%）</p>
              <p><span className="font-bold text-yellow-700">C(4点)</span>　やや不十分（達成率80〜89%）</p>
              <p><span className="font-bold text-red-700">D(2点)</span>　かなり不十分（達成率80%未満）</p>
            </div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 text-gray-500">
          <p>【総合評価基準】S：95点以上　A：80〜94点　B：70〜79点　C：60〜69点　D：60点未満　（満点110点）</p>
        </div>
      </div>

      {targetMember && (
        <>
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl p-5 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">{DEPT_LABELS[targetMember.department]} / {POSITION_LABELS[targetMember.position]}</p>
                <h2 className="text-xl font-bold mt-1">{targetMember.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-blue-200 text-xs mb-1">総合得点</p>
                <p className="text-3xl font-bold">{totals.total}<span className="text-lg ml-1">点</span></p>
                <p className="text-sm font-bold mt-1 text-yellow-300">{totalLabel.label}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-white/10 rounded-lg p-3 text-center"><p className="text-blue-200 text-xs">自己評価</p><p className="text-xl font-bold">{totals.self}点</p></div>
              <div className="bg-white/10 rounded-lg p-3 text-center"><p className="text-blue-200 text-xs">上司評価</p><p className="text-xl font-bold">{totals.manager}点</p></div>
              <div className="bg-white/10 rounded-lg p-3 text-center"><p className="text-blue-200 text-xs">入力済み項目</p><p className="text-xl font-bold">{Object.keys(scores).length} / {goals.length}</p></div>
            </div>
          </div>

          {(['company', 'skill', 'challenge', 'teamwork'] as EvalCategory[]).map(cat => {
            const catGoals = goals.filter(g => g.category === cat)
            const kpiCatGoals2 = kpiActionGoals.filter(kg => kg.eval_category === cat)
            if (catGoals.length === 0 && kpiCatGoals2.length === 0) return null
            const isExpanded = expandedCategories[cat]
            const catSelf = catGoals.reduce((s, g) => s + (scores[g.id]?.self_score || 0), 0)
              + kpiCatGoals2.reduce((s, g) => s + (scores[g.id]?.self_score || 0), 0)
            const catManager = catGoals.reduce((s, g) => s + (scores[g.id]?.manager_score || 0), 0)
              + kpiCatGoals2.reduce((s, g) => s + (scores[g.id]?.manager_score || 0), 0)
            return (
              <div key={cat} className="bg-white border border-gray-200 rounded-2xl mb-4 overflow-hidden">
                <button onClick={() => setExpandedCategories(p => ({ ...p, [cat]: !p[cat] }))} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">{CATEGORY_LABELS[cat]}</span>
                    <span className="text-xs text-gray-400">{catGoals.length}項目</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-blue-600">自己: {catSelf}点</span>
                    <span className="text-xs text-gray-600">上司: {catManager}点</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <div className="grid grid-cols-12 gap-0 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
                      <div className="col-span-4">評価項目</div>
                      <div className="col-span-2 text-center">自己評価</div>
                      <div className="col-span-2 text-center">上司評価</div>
                      <div className="col-span-4">コメント・判断根拠</div>
                    </div>
                    {/* KPIアクション目標（eval_categoryが一致するもの）を表示 */}
                    {kpiActionGoals.filter(kg => kg.eval_category === cat).map(kpiGoal => {
                      const score = scores[kpiGoal.id] || { eval_goal_id: kpiGoal.id, member_id: targetMember.id, self_score: null, self_comment: '', manager_score: null, manager_comment: '', actual_value: null }
                      return (
                        <div key={`kpi-${kpiGoal.id}`} className="grid grid-cols-12 gap-0 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 bg-purple-50/30">
                          <div className="col-span-4 pr-3">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">KPI目標</span>
                            </div>
                            <p className="text-sm text-gray-800">{kpiGoal.title}</p>
                            {kpiGoal.target_value && <p className="text-xs text-gray-400 mt-0.5">目標: {kpiGoal.target_value}{kpiGoal.target_unit}</p>}
                            {kpiGoal.is_quantitative && (
                              <input type="number" value={score.actual_value || ''} onChange={e => handleScoreChange(kpiGoal.id, 'actual_value', e.target.value ? Number(e.target.value) : null)} placeholder="実績値を入力" className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            )}
                          </div>
                          <div className="col-span-2 flex flex-col items-center gap-1">
                            {(isOwnSheet || canViewAll) && (
                              <select value={score.self_score || ''} onChange={e => handleScoreChange(kpiGoal.id, 'self_score', e.target.value ? Number(e.target.value) : null)} className="w-full text-xs border border-gray-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">選択</option>
                                <option value="10">S（10点）</option>
                                <option value="8">A（8点）</option>
                                <option value="6">B（6点）</option>
                                <option value="4">C（4点）</option>
                                <option value="2">D（2点）</option>
                              </select>
                            )}
                            {score.self_score && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SCORE_COLORS[score.self_score]}`}>{SCORE_LABELS[score.self_score]}({score.self_score})</span>}
                          </div>
                          <div className="col-span-2 flex flex-col items-center gap-1">
                            {canViewAll && (
                              <select value={score.manager_score || ''} onChange={e => handleScoreChange(kpiGoal.id, 'manager_score', e.target.value ? Number(e.target.value) : null)} className="w-full text-xs border border-gray-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">選択</option>
                                <option value="10">S（10点）</option>
                                <option value="8">A（8点）</option>
                                <option value="6">B（6点）</option>
                                <option value="4">C（4点）</option>
                                <option value="2">D（2点）</option>
                              </select>
                            )}
                            {score.manager_score && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SCORE_COLORS[score.manager_score]}`}>{SCORE_LABELS[score.manager_score]}({score.manager_score})</span>}
                          </div>
                          <div className="col-span-4 pl-3">
                            <textarea value={isOwnSheet ? (score.self_comment || '') : (score.manager_comment || '')} onChange={e => handleScoreChange(kpiGoal.id, isOwnSheet ? 'self_comment' : 'manager_comment', e.target.value)} placeholder="判断理由・根拠を入力" rows={2} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                          </div>
                        </div>
                      )
                    })}
                    {catGoals.map(goal => {
                      const score = scores[goal.id] || { eval_goal_id: goal.id, member_id: targetMember.id, self_score: null, self_comment: '', manager_score: null, manager_comment: '', actual_value: null }
                      return (
                        <div key={goal.id} className="grid grid-cols-12 gap-0 px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                          <div className="col-span-4 pr-3">
                            <p className="text-sm text-gray-800">{goal.goal_text}</p>
                            {goal.target_value && <p className="text-xs text-gray-400 mt-0.5">目標: {goal.target_value}{goal.target_unit}</p>}
                            {goal.is_quantitative && (
                              <input type="number" value={score.actual_value || ''} onChange={e => handleScoreChange(goal.id, 'actual_value', e.target.value ? Number(e.target.value) : null)} placeholder="実績値を入力" className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            )}
                          </div>
                          <div className="col-span-2 flex flex-col items-center gap-1">
                            {(isOwnSheet || canViewAll) && (
                              <select value={score.self_score || ''} onChange={e => handleScoreChange(goal.id, 'self_score', e.target.value ? Number(e.target.value) : null)} className="w-full text-xs border border-gray-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">選択</option>
                                <option value="10">S（10点）</option>
                                <option value="8">A（8点）</option>
                                <option value="6">B（6点）</option>
                                <option value="4">C（4点）</option>
                                <option value="2">D（2点）</option>
                              </select>
                            )}
                            {score.self_score && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SCORE_COLORS[score.self_score]}`}>{SCORE_LABELS[score.self_score]}({score.self_score})</span>}
                          </div>
                          <div className="col-span-2 flex flex-col items-center gap-1">
                            {canViewAll && (
                              <select value={score.manager_score || ''} onChange={e => handleScoreChange(goal.id, 'manager_score', e.target.value ? Number(e.target.value) : null)} className="w-full text-xs border border-gray-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">選択</option>
                                <option value="10">S（10点）</option>
                                <option value="8">A（8点）</option>
                                <option value="6">B（6点）</option>
                                <option value="4">C（4点）</option>
                                <option value="2">D（2点）</option>
                              </select>
                            )}
                            {score.manager_score && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SCORE_COLORS[score.manager_score]}`}>{SCORE_LABELS[score.manager_score]}({score.manager_score})</span>}
                          </div>
                          <div className="col-span-4 pl-3">
                            <textarea value={isOwnSheet ? (score.self_comment || '') : (score.manager_comment || '')} onChange={e => handleScoreChange(goal.id, isOwnSheet ? 'self_comment' : 'manager_comment', e.target.value)} placeholder="判断理由・根拠を入力" rows={2} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <EvalMemo memberId={targetMember.id} period={period} canViewAll={canViewAll} />
        </>
      )}
    </div>
  )
}
